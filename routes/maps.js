const express = require('express');
const Map = require('../models/Map');
const Theme = require('../models/Theme');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;


// POST /api/maps - Save a new map (unified, supports QR/public and user)
router.post('/', auth, async (req, res) => {
  // req.user is set by auth middleware
  const userId = req.user && req.user.id ? req.user.id : null;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized: You must be signed in to export a map.' });
  }
  const user = await User.findById(userId);
  const { name, data, gpsPath, landmarks, theme } = req.body;
  // Accept both {name, data} and {name, gpsPath, landmarks, theme}
  if (!name || (!data && (!gpsPath || !theme))) return res.status(400).json({ message: 'Name and data required' });
  // Plan enforcement
  if (user.accountType === 'starter') {
    const mapCount = await Map.countDocuments({ user: user._id });
    if (mapCount >= 1) return res.status(403).json({ message: 'Starter plan allows only 1 map. Upgrade to pro plan' });
  }
  // Pro: unlimited
  let mapData = data;
  if (!mapData) {
    // If gpsPath/landmarks/theme provided, build data
    const themeObj = await Theme.findById(theme);
    if (!themeObj) return res.status(404).json({ message: 'Theme not found' });
    mapData = { gpsPath, landmarks, theme: themeObj._id };
  }
  const map = new Map({ user: user._id, name, data: mapData });
  await map.save();
  // Return public link for QR
  const link = `${process.env.FRONTEND_URL || 'https://pathix.vercel.app'}/maps/${map._id}`;
  res.status(201).json({ message: 'Map saved', map, link });
});

// Auth middleware
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: 'Signin needed (No token)' });
  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}



// GET /api/maps - List all maps for user
router.get('/', auth, async (req, res) => {
  const maps = await Map.find({ user: req.user.id }).sort({ createdAt: -1 });
  res.json({ maps });
});

// GET /api/maps/:id - Publicly view a specific map
router.get('/:id', async (req, res) => {
  const map = await Map.findById(req.params.id);
  if (!map) return res.status(404).json({ message: 'Map not found' });
  // Decrement user's scan left if map belongs to a user
  if (map.user) {
    const user = await User.findById(map.user);
    if (user && typeof user.scanLeft === 'number') {
      if (user.scanLeft > 0) user.scanLeft -= 1;
      await user.save();
    }
  }
  res.json(map);
});

// DELETE /api/maps/:id - Delete a map
router.delete('/:id', auth, async (req, res) => {
  const map = await Map.findOneAndDelete({ _id: req.params.id, user: req.user.id });
  if (!map) return res.status(404).json({ message: 'Map not found' });
  res.json({ message: 'Map deleted', id: req.params.id });
});



module.exports = router;