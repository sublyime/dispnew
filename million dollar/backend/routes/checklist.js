const express = require('express');
const router = express.Router();
const ChecklistItem = require('../models/ChecklistItem');
const { requireAuth } = require('../utils/auth');

// Add checklist item
router.post('/', requireAuth, async (req, res) => {
  try {
    const { inspection, room, item } = req.body;
    const checklistItem = await ChecklistItem.create({ inspection, room, item });
    res.status(201).json(checklistItem);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get checklist for inspection
router.get('/inspection/:inspectionId', requireAuth, async (req, res) => {
  const items = await ChecklistItem.find({ inspection: req.params.inspectionId });
  res.json(items);
});

module.exports = router;
