'use strict';

const { jestConfig } = require('ts-deps');

module.exports = jestConfig({
  isIntegrationTest: false,
});
