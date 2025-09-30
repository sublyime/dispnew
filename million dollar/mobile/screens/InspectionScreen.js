import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function InspectionScreen({ route }) {
  const { id } = route.params || {};
  // TODO: Fetch inspection details and checklist
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inspection {id}</Text>
      <Text>Inspection details and checklist will be shown here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 24, marginBottom: 16 },
});
