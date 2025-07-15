const mongoose = require('mongoose');

const ThemeSchema = new mongoose.Schema({
  name: { type: String, required: true },

  assets: [
    {
      name: { type: String, required: true },
      icon: { type: String, required: true }, // emoji or image URL
    }
  ],
  backgroundImage: { type: String },

  fonts: [String],
  roadStyle: {
    color: { type: String },
    width: { type: Number },
    lineCap: { type: String },
    lineJoin: { type: String },
  },
  animations: {
    glowingRoad: { type: Boolean, default: false },
    pulsingIcons: { type: Boolean, default: false },
    // Add more animation toggles as needed
  },
}, { timestamps: true });

module.exports = mongoose.model('Theme', ThemeSchema); 