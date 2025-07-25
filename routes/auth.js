
const express = require('express');
const User = require('../models/User');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');

const router = express.Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { email, password, phone, organization } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    // Check if user already exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered.' });
    }
    // Create user
    const user = new User({ email, password, phone, organization });
    await user.save();
    res.status(201).json({ message: 'User created successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});

// POST /api/auth/google
router.post('/google', async (req, res) => {
  try {
    const { credential, phone, organization } = req.body;
    if (!credential) {
      return res.status(400).json({ message: 'Missing Google credential.' });
    }
    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email;
    const googleId = payload.sub;
    if (!email) {
      return res.status(400).json({ message: 'Google account has no email.' });
    }
    // Find user by email
    let user = await User.findOne({ email });
    if (!user) {
      // Require phone and organization for new users
      if (!phone || !organization) {
        return res.status(400).json({ message: 'Phone and organization are required for Google sign up.' });
      }
      user = new User({
        email,
        googleId,
        phone,
        organization,
        provider: 'google',
      });
      await user.save();
    } else {
      // If user exists, treat as login (do not create new)
      // Update phone/org/googleId if provided and missing
      let needsUpdate = false;
      if (!user.phone && phone) {
        user.phone = phone;
        needsUpdate = true;
      }
      if (!user.organization && organization) {
        user.organization = organization;
        needsUpdate = true;
      }
      if (!user.googleId) {
        user.googleId = googleId;
        needsUpdate = true;
      }
      if (needsUpdate) await user.save();
    }
    // Issue JWT
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Google authentication failed.' });
  }
});

// POST /api/auth/signin
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    if (!user.password) {
      return res.status(400).json({ message: 'You signed up with Google. Please use Google Sign-In.' });
    }
    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
});


// Auth middleware for protected endpoints
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

// GET /api/auth/me - Get current user info
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    // Return user info (omit password)
    const {  email, phone, organization, accountType, scanLeft,avatarType, avatar} = user;
    // res.json({ _id, email, phone, organization, accountType, scanLeft, provider, googleId });
    res.json({  email, phone, organization, accountType, scanLeft, avatarType, avatar });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch user info' });
  }
});

// POST /api/auth/avatar - Set or update user avatar
router.post('/avatar', auth, async (req, res) => {
  try {
    const { avatar, avatarType } = req.body;
    if (!avatar || !avatarType) {
      return res.status(400).json({ message: 'Avatar and avatarType are required.' });
    }
    // Check avatar size (base64 string length, ~4/3 of bytes)
    const maxSize = 1.5 * 1024 * 1024; // 4MB
    if (Buffer.byteLength(avatar, 'base64') > maxSize) {
      return res.status(413).json({ message: 'Avatar image is too large. Please upload a smaller image.' });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    user.avatar = avatar;
    user.avatarType = avatarType;
    await user.save();
    res.json({ message: 'Avatar updated.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update avatar.' });
  }
});

// POST /api/auth/edit - Edit essential user fields
router.post('/edit', auth, async (req, res) => {
  try {
    const { name, phone, organization, avatar, avatarType } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    // Validate avatar size if present
    if (avatar) {
      const maxSize = 1.5 * 1024 * 1024; // 4MB
      if (Buffer.byteLength(avatar, 'base64') > maxSize) {
        return res.status(413).json({ message: 'Avatar image is too large. Please upload a smaller image.' });
      }
    }
    let updated = false;
    if (name && name !== user.name) { user.name = name; updated = true; }
    if (phone && phone !== user.phone) { user.phone = phone; updated = true; }
    if (organization && organization !== user.organization) { user.organization = organization; updated = true; }
    // As email is unique, this will also update the email in the database
    // if (email && email !== user.email) { user.email = email; updated = true; }
    if (avatar && avatar !== user.avatar) { user.avatar = avatar; updated = true; }
    if (avatarType && avatarType !== user.avatarType) { user.avatarType = avatarType; updated = true; }
    if (updated) {
      await user.save();
      return res.json({ message: 'User info updated.' });
    } else {
      return res.json({ message: 'No changes made.' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Failed to update user info.' });
  }
});

// POST /api/auth/change-password - Change user password
router.post('/change-password', auth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Old and new password are required.' });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.password) {
      return res.status(400).json({ message: 'Password change not available for Google accounts.' });
    }
    const bcrypt = require('bcryptjs');
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Old password is incorrect.' });
    }
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to change password.' });
  }
});

module.exports = router; 