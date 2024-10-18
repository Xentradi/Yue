const {Schema} = require('mongoose');

const loanSchema = new Schema({
  loanId: {type: mongoose.types.ObjectId, required: true, unique: true},
  userId: {type: String, required: true},
  amount: {type: Number, required: true},
  interestRate: {type: Number, default: 0.0},
  dueDate: {type: Date, default: Date.now},
  status: {type: String, required: true, default: 'active'},
})