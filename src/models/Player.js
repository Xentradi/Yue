const {model} = require('mongoose');
const {playerSchema} = require('../schemas/playerSchema');

module.exports = model('Player', playerSchema);
