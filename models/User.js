const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String }, // Not required for Google users
  phone: { type: String },
  organization: { type: String },
  googleId: { type: String },
  accountType: { type: String, enum: ['Starter', 'Pro', 'Enterprise'], default: 'Starter' },
  scanLeft: { type: Number, default: 50 }, // Starter: 50, Pro: 1000, Enterprise: unlimited (set high)
  avatar: { type: String }, // base64 string
  avatarType: { type: String }, // MIME type
  createdAt: { type: Date, default: Date.now },
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema); 