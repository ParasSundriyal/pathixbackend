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
      });
      await user.save();
    } else {
      // If user exists but is missing phone/org, require them
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
      if (!user.phone || !user.organization) {
        return res.status(400).json({ message: 'Phone and organization are required for Google sign in.' });
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

module.exports = router; 