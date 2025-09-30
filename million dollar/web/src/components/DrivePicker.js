import React, { useEffect } from 'react';

// Google Picker API integration for file browsing/upload
// Requires Google API client to be loaded in index.html

const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY;
const SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly';
const DISCOVERY_DOCS = [
  'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
];

function DrivePicker({ onPick }) {
  useEffect(() => {
    if (!window.gapi) return;
    window.gapi.load('client:picker', async () => {
      await window.gapi.client.init({
        apiKey: API_KEY,
        clientId: CLIENT_ID,
        discoveryDocs: DISCOVERY_DOCS,
        scope: SCOPE,
      });
    });
  }, []);

  const openPicker = () => {
    if (!window.google || !window.google.picker) return;
    const view = new window.google.picker.DocsView();
    const picker = new window.google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(window.gapi.auth.getToken().access_token)
      .setDeveloperKey(API_KEY)
      .setCallback(data => {
        if (data.action === window.google.picker.Action.PICKED) {
          onPick(data.docs);
        }
      })
      .build();
    picker.setVisible(true);
  };

  return (
    <button onClick={openPicker}>Browse Google Drive</button>
  );
}

export default DrivePicker;
