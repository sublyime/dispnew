import React, { useState } from 'react';
import { View, Text, Button, FlatList, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import axios from 'axios';
import { getGoogleToken } from '../utils/auth';

export default function DriveScreen() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({});
    if (result.type === 'success') {
      setUploading(true);
      const token = await getGoogleToken();
      const formData = new FormData();
      formData.append('photo', {
        uri: result.uri,
        name: result.name,
        type: result.mimeType || 'application/octet-stream',
      });
      try {
        // Upload to backend, which uploads to Google Drive using user's token (future: direct upload)
        await axios.post('http://localhost:4000/api/photos/drive', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          },
        });
        alert('File uploaded to Google Drive!');
      } catch (err) {
        alert('Upload failed');
      }
      setUploading(false);
    }
  };

  const fetchFiles = async () => {
    try {
      const token = await getGoogleToken();
      const res = await axios.get('http://localhost:4000/api/drive/files', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setFiles(res.data);
    } catch (err) {
      alert('Failed to fetch files');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Google Drive File Browser</Text>
      <Button title="Pick and Upload File" onPress={pickFile} disabled={uploading} />
      <Button title="List Drive Files" onPress={fetchFiles} />
      <FlatList
        data={files}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => Linking.openURL(item.webViewLink)}>
            <Text style={styles.file}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 24, marginBottom: 16 },
  file: { color: 'blue', marginVertical: 8 },
});
