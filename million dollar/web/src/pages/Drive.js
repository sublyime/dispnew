import React, { useState } from 'react';
import DrivePicker from '../components/DrivePicker';

function Drive() {
  const [files, setFiles] = useState([]);

  const handlePick = (docs) => {
    setFiles(docs);
  };

  return (
    <div style={{ padding: 32 }}>
      <h2>Google Drive File Browser</h2>
      <DrivePicker onPick={handlePick} />
      <ul>
        {files.map(file => (
          <li key={file.id}>
            <a href={file.url} target="_blank" rel="noopener noreferrer">{file.name}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Drive;
