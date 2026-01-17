const mongoose = require('mongoose');

const policySchema = new mongoose.Schema({
  policyNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  policyStartDate: {
    type: Date,
    required: true
  },
  policyEndDate: {
    type: Date,
    required: true
  },
  policyCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LOB',
    required: true
  },
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Carrier',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for faster queries
policySchema.index({ userId: 1 });
policySchema.index({ policyNumber: 1 });

module.exports = mongoose.model('Policy', policySchema);

