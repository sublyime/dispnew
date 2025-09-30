const mongoose = require('mongoose');

const ChecklistItemSchema = new mongoose.Schema({
  inspection: { type: mongoose.Schema.Types.ObjectId, ref: 'Inspection', required: true },
  room: { type: String, required: true },
  item: { type: String, required: true },
  photos: [{ type: String }], // Google Drive file IDs or URLs
  notes: { type: String },
  completed: { type: Boolean, default: false }
});

module.exports = mongoose.model('ChecklistItem', ChecklistItemSchema);
