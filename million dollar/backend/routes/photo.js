const express = require('express');
const router = express.Router();
const multer = require('multer');
const Photo = require('../models/Photo');
const { requireAuth } = require('../utils/auth');


const upload = multer({ dest: 'uploads/' });
const { uploadFileToDrive } = require('../utils/googleDrive');

// Upload photo for checklist item (to Google Drive)
router.post('/:checklistItemId', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    const driveFile = await uploadFileToDrive(req.file);
    const url = driveFile.webViewLink;
    const photo = await Photo.create({ checklistItem: req.params.checklistItemId, url });
    res.status(201).json(photo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get photos for checklist item
router.get('/:checklistItemId', requireAuth, async (req, res) => {
  const photos = await Photo.find({ checklistItem: req.params.checklistItemId });
  res.json(photos);
});

module.exports = router;
