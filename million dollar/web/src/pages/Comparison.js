import React from 'react';
import { useParams } from 'react-router-dom';

function Comparison() {
  const { propertyId } = useParams();
  // TODO: Fetch move-in and move-out inspections for this property and compare photos
  return (
    <div style={{ padding: 32 }}>
      <h2>Move-In/Move-Out Comparison for Property {propertyId}</h2>
      <p>Side-by-side photo comparison will be shown here.</p>
    </div>
  );
}

export default Comparison;
