const mongoose = require('mongoose');

const carrierSchema = new mongoose.Schema({
  companyName: {
    type: String,
    required: true,
    trim: true,
    unique: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Carrier', carrierSchema);

