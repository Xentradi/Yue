const { Schema } = require('mongoose');

const fishSchema = new Schema({
  type: {
    type: String,
    required: true,
    trim: true,
  },
  count: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: Number.isFinite,
      message: 'Fish count must be a finite number.',
    },
  },
  reward: {
    type: Number,
    required: true,
    validate: {
      validator: Number.isFinite,
      message: 'Fish reward must be a finite number.',
    },
  },
});

fishSchema.index({ type: 1 });

module.exports = { fishSchema };
