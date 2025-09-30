import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ComparisonScreen({ route }) {
  const { propertyId } = route.params || {};
  // TODO: Fetch move-in and move-out inspections for this property and compare photos
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Move-In/Move-Out Comparison for Property {propertyId}</Text>
      <Text>Side-by-side photo comparison will be shown here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  title: { fontSize: 24, marginBottom: 16 },
});
