import React from 'react';
import { useParams } from 'react-router-dom';

function Inspection() {
  const { id } = useParams();
  // TODO: Fetch inspection details and checklist
  return (
    <div style={{ padding: 32 }}>
      <h2>Inspection {id}</h2>
      <p>Inspection details and checklist will be shown here.</p>
    </div>
  );
}

export default Inspection;
