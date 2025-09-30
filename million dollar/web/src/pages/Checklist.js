import React from 'react';
import { useParams } from 'react-router-dom';

function Checklist() {
  const { inspectionId } = useParams();
  // TODO: Fetch checklist items for this inspection
  return (
    <div style={{ padding: 32 }}>
      <h2>Checklist for Inspection {inspectionId}</h2>
      <p>Checklist items and photo upload UI will be here.</p>
    </div>
  );
}

export default Checklist;
