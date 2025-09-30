import React, { useState, useEffect } from 'react';
import { View, Text, Button, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { getGoogleToken } from '../utils/auth';

export default function DriveAdvancedScreen() {
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    getGoogleToken().then(setToken);
  }, []);

  const fetchFolders = async () => {
    if (!token) return;
    try {
      const res = await fetch('https://www.googleapis.com/drive/v3/files?q=mimeType="application/vnd.google-apps.folder" and trashed=false&fields=files(id,name)', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setFolders(data.files || []);
    } catch (err) {
      Alert.alert('Error', 'Failed to fetch folders');
    }
  };

  useEffect(() => {
    if (token) fetchFolders();
  }, [token]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select a Google Drive Folder</Text>
      <FlatList
        data={folders}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setSelectedFolder(item)}>
            <Text style={styles.folder}>{item.name}</Text>
          </TouchableOpacity>
        )}
      />
      {selectedFolder && (
        <View style={{ marginTop: 24 }}>
          <Text>Selected Folder: {selectedFolder.name}</Text>
          <Text>ID: {selectedFolder.id}</Text>
          {/* TODO: Add upload, sharing, and search UI here */}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 24, marginBottom: 16 },
  folder: { color: 'blue', marginVertical: 8 },
});
