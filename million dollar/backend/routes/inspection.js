const express = require('express');
const router = express.Router();
const Inspection = require('../models/Inspection');
const { requireAuth } = require('../utils/auth');

// Create inspection
router.post('/', requireAuth, async (req, res) => {
  try {
    const { property, type, notes } = req.body;
    const inspection = await Inspection.create({ property, user: req.user.id, type, notes });
    res.status(201).json(inspection);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all inspections for a property
router.get('/property/:propertyId', requireAuth, async (req, res) => {
  const inspections = await Inspection.find({ property: req.params.propertyId, user: req.user.id });
  res.json(inspections);
});

module.exports = router;
