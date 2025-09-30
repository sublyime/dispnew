const express = require('express');
const router = express.Router();

const { google } = require('googleapis');
const { uploadFileToDrive } = require('../utils/googleDrive');

// List files in Google Drive
router.get('/files', async (req, res) => {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const files = await drive.files.list({ fields: 'files(id, name, webViewLink)' });
    res.json(files.data.files);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Share a file (make public)
router.post('/share/:fileId', async (req, res) => {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    await drive.permissions.create({
      fileId: req.params.fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });
    res.json({ message: 'File shared publicly.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
