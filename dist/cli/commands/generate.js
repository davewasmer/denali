'use strict';

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _chalk = require('chalk');

var _chalk2 = _interopRequireDefault(_chalk);

var _utils = require('../utils');

var _generateBlueprint = require('./utils/generate-blueprint');

var _generateBlueprint2 = _interopRequireDefault(_generateBlueprint);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// import fs from 'fs';

var args = process.argv.slice(2);

var generatorCommand = args.shift();

if (generatorCommand === 'app') {
  console.error(_chalk2.default.red('Try denali new [my app name] instead.'));
} else {
  if ((0, _utils.isDenaliApp)(process.cwd())) {
    (0, _generateBlueprint2.default)({
      src: _path2.default.join(__dirname, '..', 'blueprints', generatorCommand),
      dest: process.cwd(),
      args: args
    });
  } else {
    console.error(_chalk2.default.red('You must be inside a Denali application to run the generate command.'));
  }
}