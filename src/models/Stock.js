const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  symbol: String,
  price: Number,
  volatility: { type: Number, default: 0.1 }, // 10% volatility
});

module.exports = mongoose.model('Stock', stockSchema);
