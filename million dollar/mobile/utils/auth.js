import AsyncStorage from '@react-native-async-storage/async-storage';

export async function storeGoogleToken(token) {
  await AsyncStorage.setItem('google_access_token', token);
}

export async function getGoogleToken() {
  return await AsyncStorage.getItem('google_access_token');
}

export async function clearGoogleToken() {
  await AsyncStorage.removeItem('google_access_token');
}
