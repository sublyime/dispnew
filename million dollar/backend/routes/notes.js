const express = require('express');
const router = express.Router();
const ChecklistItem = require('../models/ChecklistItem');
const { requireAuth } = require('../utils/auth');

// Add or update notes for a checklist item
router.post('/:checklistItemId', requireAuth, async (req, res) => {
  try {
    const { notes } = req.body;
    const item = await ChecklistItem.findByIdAndUpdate(
      req.params.checklistItemId,
      { notes },
      { new: true }
    );
    res.json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
