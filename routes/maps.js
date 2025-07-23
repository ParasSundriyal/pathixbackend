const express = require('express');
const Map = require('../models/Map');
const Theme = require('../models/Theme');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

// POST /api/maps/export - Save map and return public link (for QR)
router.post('/export', async (req, res) => {
  console.log('Received /export request:', req.body);
  const { name, gpsPath, landmarks, theme } = req.body;
  if (!name || !gpsPath || !theme) {
    console.log('Missing required fields');
    return res.status(400).json({ message: 'Missing required fields' });
  }
  try {
    // Fetch theme by ID
    const themeObj = await Theme.findById(theme);
    if (!themeObj) {
      console.log('Theme not found:', theme);
      return res.status(404).json({ message: 'Theme not found' });
    }
    // Save map (no user required for QR/public)
    const map = new Map({ name, data: { gpsPath, landmarks, theme: themeObj._id } });
    await map.save();
    console.log('Map saved:', map._id);
    // Return public link
    const link = `${process.env.FRONTEND_URL || 'https://pathix.vercel.app'}/api/maps/${map._id}`;
    res.json({ link });
  } catch (err) {
    console.error('Error saving map:', err);
    res.status(500).json({ message: 'Error saving map', error: err.message });
  }
});

// Auth middleware
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: 'No token' });
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}

// POST /api/maps - Save a new map
router.post('/', auth, async (req, res) => {
  const { name, data } = req.body;
  if (!name || !data) return res.status(400).json({ message: 'Name and data required' });
  const map = new Map({ user: req.user.id, name, data });
  await map.save();
  res.status(201).json({ message: 'Map saved', map });
});

// GET /api/maps - List all maps for user
router.get('/', auth, async (req, res) => {
  const maps = await Map.find({ user: req.user.id }).sort({ createdAt: -1 });
  res.json(maps);
});

// GET /api/maps/:id - Publicly view a specific map
router.get('/:id', async (req, res) => {
  const map = await Map.findById(req.params.id);
  if (!map) return res.status(404).json({ message: 'Map not found' });
  res.json(map);
});

// DELETE /api/maps/:id - Delete a map
router.delete('/:id', auth, async (req, res) => {
  const map = await Map.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!map) return res.status(404).json({ message: 'Map not found' });
  res.json({ message: 'Map deleted' });
});

module.exports = router; 