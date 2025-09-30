import React, { useEffect, useState } from 'react';

function DriveFolderPicker({ token, onPick }) {
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch('https://www.googleapis.com/drive/v3/files?q=mimeType="application/vnd.google-apps.folder" and trashed=false&fields=files(id,name)', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        setFolders(data.files || []);
        setLoading(false);
      });
  }, [token]);

  return (
    <div>
      <h4>Select a Drive Folder</h4>
      {loading ? <div>Loading folders...</div> : null}
      <ul>
        {folders.map(folder => (
          <li key={folder.id}>
            <button onClick={() => onPick(folder)}>{folder.name}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default DriveFolderPicker;
