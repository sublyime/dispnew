import React from 'react';
import { View, Button, StyleSheet, Alert } from 'react-native';
import { storeGoogleToken } from '../utils/auth';
import * as AuthSession from 'expo-auth-session';

const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com'; // Replace with your client ID
const REDIRECT_URI = AuthSession.makeRedirectUri();
const SCOPE = encodeURIComponent('https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email');
const RESPONSE_TYPE = 'token';

export default function GoogleLoginScreen({ navigation }) {
  const handleGoogleLogin = async () => {
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=${RESPONSE_TYPE}` +
      `&scope=${SCOPE}`;
    const result = await AuthSession.startAsync({ authUrl });
    if (result.type === 'success' && result.params.access_token) {
      await storeGoogleToken(result.params.access_token);
      Alert.alert('Google Login Success', 'Access token received.');
      navigation.replace('Drive');
    } else {
      Alert.alert('Google Login Failed', 'Could not authenticate.');
    }
  };

  return (
    <View style={styles.container}>
      <Button title="Sign in with Google" onPress={handleGoogleLogin} color="#4285F4" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
