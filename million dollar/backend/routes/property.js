const express = require('express');
const router = express.Router();
const Property = require('../models/Property');
const { requireAuth } = require('../utils/auth');

// Create property
router.post('/', requireAuth, async (req, res) => {
  try {
    const { address, name } = req.body;
    const property = await Property.create({ owner: req.user.id, address, name });
    res.status(201).json(property);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all properties for user
router.get('/', requireAuth, async (req, res) => {
  const properties = await Property.find({ owner: req.user.id });
  res.json(properties);
});

module.exports = router;
