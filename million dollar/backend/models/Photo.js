const mongoose = require('mongoose');

const PhotoSchema = new mongoose.Schema({
  checklistItem: { type: mongoose.Schema.Types.ObjectId, ref: 'ChecklistItem', required: true },
  url: { type: String, required: true }, // Google Drive file ID or URL
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Photo', PhotoSchema);
