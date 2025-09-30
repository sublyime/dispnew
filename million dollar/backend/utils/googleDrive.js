const { google } = require('googleapis');

function getDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return google.drive({ version: 'v3', auth: oauth2Client });
}

async function uploadFileToDrive(file, folderId) {
  const drive = getDriveClient();
  const res = await drive.files.create({
    requestBody: {
      name: file.originalname,
      parents: folderId ? [folderId] : [],
    },
    media: {
      mimeType: file.mimetype,
      body: require('fs').createReadStream(file.path),
    },
    fields: 'id, webViewLink, webContentLink',
  });
  return res.data;
}

module.exports = { uploadFileToDrive };
