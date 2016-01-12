'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _assert = require('assert');

var _assert2 = _interopRequireDefault(_assert);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _object = require('./object');

var _object2 = _interopRequireDefault(_object);

var _dagMap = require('dag-map');

var _dagMap2 = _interopRequireDefault(_dagMap);

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _findup = require('findup');

var _findup2 = _interopRequireDefault(_findup);

var _resolve = require('resolve');

var _resolve2 = _interopRequireDefault(_resolve);

var _routerDsl = require('./router-dsl');

var _routerDsl2 = _interopRequireDefault(_routerDsl);

var _container = require('./container');

var _container2 = _interopRequireDefault(_container);

var _log2 = require('../utils/log');

var _log3 = _interopRequireDefault(_log2);

var _eachDir = require('../utils/each-dir');

var _eachDir2 = _interopRequireDefault(_eachDir);

var _requireDir = require('../utils/require-dir');

var _requireDir2 = _interopRequireDefault(_requireDir);

var _tryRequire = require('../utils/try-require');

var _tryRequire2 = _interopRequireDefault(_tryRequire);

var _forIn = require('lodash/object/forIn');

var _forIn2 = _interopRequireDefault(_forIn);

var _contains = require('lodash/collection/contains');

var _contains2 = _interopRequireDefault(_contains);

var _values = require('lodash/object/values');

var _values2 = _interopRequireDefault(_values);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Addons form the foundation of Denali, and are built with extensibility as a
 * first-class feature. They are responsible for coordinating the various other
 * libraries in the Denali framework, and act as the glue that holds
 * everything together.
 *
 * @title Addon
 */

exports.default = _object2.default.extend({

  /**
   * Create a new Addon. Upon creation, the Addon instance will search for any
   * child Addon's present, then load it's config, intializers, routing
   * information, and app classes (i.e. adapters, controllers, etc).
   *
   * @constructor
   *
   * @param  {Object} options
   * @param  {Object} options.dir  The root directory for this addon
   * @param  {Object} options.environment  The current environment, i.e. 'production'
   * @param  {Object} options.parent  If this is a child addon, the parent addon to this one
   *
   * @return {Addon}
   */

  init: function init() {
    this._super.apply(this, arguments);
    (0, _assert2.default)(this.dir, 'You must supply a dir to an Addon instance');
    (0, _assert2.default)(this.environment, 'You must supply an environment to an Addon instance');

    this.appDir = _path2.default.join(this.dir, 'app');
    this.configDir = _path2.default.join(this.dir, 'config');
    this.pkg = (0, _tryRequire2.default)(_path2.default.join(this.dir, 'package.json'));
    this.name = this.pkg.name;

    this.router = _express2.default.Router();
    this._addonMounts = {};
    this.container = this.container || new _container2.default();
    if (this.parent) {
      this.parent.container.addChildContainer(this.container);
    }

    this.load();
    this.discoverAddons();
  },
  load: function load() {
    this.loadConfig();
    this.loadInitializers();
    this.loadMiddleware();
    this.loadApp();
    this.loadRoutes();
  },
  loadConfig: function loadConfig() {
    this._config = this.loadConfigFile('environment');
  },
  loadInitializers: function loadInitializers() {
    var initializersDir = _path2.default.join(this.configDir, 'initializers');
    this._initializers = (0, _values2.default)((0, _requireDir2.default)(initializersDir));
  },
  loadMiddleware: function loadMiddleware() {
    this._middleware = this.loadConfigFile('environment');
    this._middleware(this.router);
  },
  loadRoutes: function loadRoutes() {
    this._routes = this.loadConfigFile('routes');
    this._routes.call((0, _routerDsl2.default)(this));
  },
  loadApp: function loadApp() {
    var _this = this;

    (0, _eachDir2.default)(this.appDir, function (dir) {
      _this.container.registerDir(_path2.default.join(_this.appDir, dir), dir);
    });
  },

  /**
   * Discovers any child addons present for this addon, and loads them.
   *
   * @method discoverAddons
   * @private
   */
  discoverAddons: function discoverAddons() {
    var _this2 = this;

    this.addonGraph = new _dagMap2.default();
    (0, _forIn2.default)(this.pkg.dependencies, function (version, pkgName) {
      var pkgMainPath = _resolve2.default.sync(pkgName, { basedir: _this2.dir });
      var pkgPath = _findup2.default.sync(pkgMainPath, 'package.json');
      var pkgJSONPath = _path2.default.join(pkgPath, 'package.json');
      var pkg = require(pkgJSONPath);
      var isDenaliAddon = pkg.keywords && (0, _contains2.default)(pkg.keywords, 'denali-addon');

      if (isDenaliAddon) {
        var config = pkg.denali || {};

        var AddonClass = undefined;
        var customAddonClass = _path2.default.join(root, 'app', 'addon.js');
        if (_fs2.default.existsSync(customAddonClass)) {
          AddonClass = require(customAddonClass);
        } else {
          AddonClass = module.exports;
        }

        var addon = new AddonClass({
          dir: pkgPath,
          environment: _this2.environment,
          parent: _this2
        });
        _this2.addonGraph.addEdges(pkg.name, addon, config.before, config.after);
      }
    });
  },
  eachAddon: function eachAddon(fn) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    var childrenFirst = options.childrenFirst;
    return this.addonGraph.topsort(function (_ref) {
      var value = _ref.value;

      if (childrenFirst) {
        value.eachAddon(fn, options);
        fn(value);
      } else {
        fn(value);
        value.eachAddon(fn, options);
      }
    });
  },
  loadConfigFile: function loadConfigFile(filename) {
    return require(_path2.default.join(this.configDir, filename + '.js'));
  },
  log: function log(level) {
    if (this.environment !== 'test' || level === 'error') {
      for (var _len = arguments.length, msg = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        msg[_key - 1] = arguments[_key];
      }

      if (!this.isApplication) {
        msg.unshift('[' + this.name + ']');
      }
      _log3.default.call.apply(_log3.default, [this, level].concat(msg));
    }
  }
});
module.exports = exports['default'];