import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ChecklistScreen({ route }) {
  const { inspectionId } = route.params || {};
  // TODO: Fetch checklist items for this inspection
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Checklist for Inspection {inspectionId}</Text>
      <Text>Checklist items and photo upload UI will be here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 24, marginBottom: 16 },
});
