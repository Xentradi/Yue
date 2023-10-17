const {model} = require('mongoose');
const lakeSchema = require('../schemas/lakeSchema');

module.exports = model('Lake', lakeSchema);
