const { loadSpec } = require('./utils/loader');
const { validate } = require('./validators/index');
const { generate } = require('./generators/index');

module.exports = { loadSpec, validate, generate };
