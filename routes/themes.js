const express = require('express');
const Theme = require('../models/Theme');
const router = express.Router();

// GET /api/themes - fetch all themes
router.get('/', async (req, res) => {
  try {
    const themes = await Theme.find();
    res.json(themes);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch themes' });
  }
});

// GET /api/themes/:id - fetch single theme
router.get('/:id', async (req, res) => {
  try {
    const theme = await Theme.findById(req.params.id);
    if (!theme) return res.status(404).json({ error: 'Theme not found' });
    res.json(theme);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch theme' });
  }
});

// POST /api/themes - add new theme (optional, for admin use)
router.post('/', async (req, res) => {
  try {
    const theme = new Theme(req.body);
    await theme.save();
    res.status(201).json(theme);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create theme', details: err.message });
  }
});

module.exports = router; 