import path from 'path';
import http from 'http';
import https from 'https';
import Promise from 'bluebird';
import dotenv from 'dotenv';
import values from 'lodash/values';
import Addon from './addon';
import topsort from '../utils/topsort';
import Router from './router';
import Logger from './logger';
import Container from './container';
import discoverAddons from '../utils/discover-addons';


/**
 * Application instances are specialized Addons, designed to kick off the
 * loading, mounting, and launching stages of booting up.
 *
 * @class Application
 * @constructor
 * @extends Addon
 * @module denali
 * @submodule runtime
 */
export default class Application extends Addon {

  constructor(options = {}) {
    if (!options.container) {
      options.container = new Container();
      options.logger = options.logger || new Logger();
      options.router = options.router || new Router({
        container: options.container,
        logger: options.logger
      });
      options.container.register('router:main', options.router);
      options.container.register('logger:main', options.logger);
    }
    super(options);
    this.container.register('application:main', this);
    this.router = this.container.lookup('router:main');
    this.logger = this.container.lookup('logger:main');
    this.addons = this.buildAddons(options.addons || []);
    // Generate config first, since the loading process may need it
    this.config = this.generateConfig();

    this.addons.forEach((addon) => {
      addon.load();
    });
    this.load();
    this.compileRouter();
  }

  /**
   * Given a directory that contains an addon, load that addon and instantiate
   * it's Addon class.
   *
   * @method createAddonFromDirectory
   * @param directory {String} path to the directory containing the addon
   * @return {Addon} the instantiated Addon class representing that directory
   * @private
   */
  buildAddons(preseededAddons) {
    return discoverAddons(this.dir, { preseededAddons }).map((dir) => {
      let pkg;
      let AddonClass;
      try {
        pkg = require(path.join(dir, 'package.json'));
        AddonClass = require(path.join(dir, 'app', 'addon.js'));
      } catch (e) {
        /* eslint-disable no-console */
        console.error(`Error loading an addon from ${ dir }:`);
        console.error(e);
        /* eslint-enable no-console */
        throw e;
      }
      AddonClass = AddonClass.default || AddonClass;
      return new AddonClass({
        dir,
        environment: this.environment,
        parent: this,
        container: this.container,
        pkg
      });
    });
  }

  /**
   * Take the loaded environment config functions, and execute them.
   * Application config is executed first, and the returned config object is
   * handed off to the addon config files, which add their configuration by
   * mutating that same object.
   *
   * The resulting final config is stored at `application.config`, and is
   * registered in the container under `config:environment`.
   *
   * @method generateConfig
   * @return {Object} the generated config
   * @private
   */
  generateConfig() {
    dotenv.config({ silent: true });
    let config = this._config(this.environment);
    config.environment = this.environment;
    this.container.register('config:environment', config);
    this.addons.forEach((addon) => {
      addon._config(this.environment, config);
    });
    return config;
  }

  /**
   * Assemble middleware and routes
   *
   * @method compileRouter
   * @private
   */
  compileRouter() {
    this.addons.forEach((addon) => {
      addon._middleware(this.router, this);
    });
    this._middleware(this.router, this);

    this._routes(this.router, this);
    this.addons.reverse().forEach((addon) => {
      addon._routes(this.router, this);
    });
  }

  /**
   * Start the Denali server. Runs all initializers, creates an HTTP server,
   * and binds to the port to handle incoming HTTP requests.
   *
   * @method start
   * @return {Promise} resolves when the startup completes
   */
  start() {
    let port = this.config.server.port || 3000;
    return this.runInitializers()
      .then(() => {
        if (!this.config.server.detached) {
          return this.createServer(port).then(() => {
            this.logger.info(`${ this.pkg.name }@${ this.pkg.version } server up on port ${ port }`);
          });
        }
      }).catch((err) => {
        this.logger.error('Problem starting app ...');
        this.logger.error(err.stack || err);
      });
  }

  /**
   * Creates an HTTP or HTTPS server, depending on whether or not SSL
   * configuration is present in config/environment.js
   *
   * @method createServer
   * @param port {Number}
   * @return {Promise} resolves once the server is up and ready for connections
   * @private
   */
  createServer(port) {
    return new Promise((resolve) => {
      // TODO create both http & https if redirect-to-ssl is enabled
      let handler = this.router.handle.bind(this.router);
      if (this.config.server.ssl) {
        https.createServer(this.config.server.ssl, handler).listen(port, resolve);
      } else {
        http.createServer(handler).listen(port, resolve);
      }
    });
  }

  /**
   * Lookup all initializers and run them in sequence. Initializers can
   * override the default load order by including `before` or `after`
   * properties on the exported class (the name or array of names of the other
   * initializers it should run before/after).
   *
   * @method runInitializers
   * @return {Promise} resolves when all the initializers have completed
   * @private
   */
  runInitializers() {
    let initializers = topsort(values(this.container.lookupAll('initializer')));
    return Promise.resolve(initializers)
      .each((initializer) => {
        return initializer.initialize(this);
      });
  }

}
