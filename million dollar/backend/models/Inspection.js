const mongoose = require('mongoose');

const InspectionSchema = new mongoose.Schema({
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['move-in', 'move-out'], required: true },
  date: { type: Date, default: Date.now },
  checklist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ChecklistItem' }],
  notes: { type: String },
  completed: { type: Boolean, default: false }
});

module.exports = mongoose.model('Inspection', InspectionSchema);
