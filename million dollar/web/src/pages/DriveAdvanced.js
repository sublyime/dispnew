import React, { useState } from 'react';
import DriveFolderPicker from '../components/DriveFolderPicker';

function DriveAdvanced() {
  const [token] = useState(localStorage.getItem('google_access_token'));
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [shareFileId, setShareFileId] = useState('');
  const [shareResult, setShareResult] = useState('');

  const handleSearch = async () => {
    if (!token || !search) return;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=name contains '${search}' and trashed=false&fields=files(id,name,webViewLink)`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setSearchResults(data.files || []);
  };

  const handleShare = async () => {
    if (!token || !shareFileId) return;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${shareFileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' })
    });
    if (res.ok) {
      setShareResult('File shared publicly!');
    } else {
      setShareResult('Failed to share file.');
    }
  };

  return (
    <div style={{ padding: 32 }}>
      <h2>Advanced Google Drive Features</h2>
      <DriveFolderPicker token={token} onPick={setSelectedFolder} />
      {selectedFolder && (
        <div>
          <h4>Selected Folder: {selectedFolder.name}</h4>
          <p>ID: {selectedFolder.id}</p>
        </div>
      )}
      <div style={{ marginTop: 32 }}>
        <h4>Drive Search</h4>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search files by name" />
        <button onClick={handleSearch}>Search</button>
        <ul>
          {searchResults.map(file => (
            <li key={file.id}>
              <a href={file.webViewLink} target="_blank" rel="noopener noreferrer">{file.name}</a>
            </li>
          ))}
        </ul>
      </div>
      <div style={{ marginTop: 32 }}>
        <h4>Share File</h4>
        <input value={shareFileId} onChange={e => setShareFileId(e.target.value)} placeholder="Enter File ID to share" />
        <button onClick={handleShare}>Share Publicly</button>
        {shareResult && <div>{shareResult}</div>}
      </div>
    </div>
  );
}

export default DriveAdvanced;
