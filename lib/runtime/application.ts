import {
  values,
  constant,
  noop
} from 'lodash';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import { each, all } from 'bluebird';
import Addon from './addon';
import topsort from '../utils/topsort';
import Router from './router';
import Logger from './logger';
import Container from '../metal/container';
import findPlugins from 'find-plugins';
import * as tryRequire from 'try-require';
import * as createDebug from 'debug';
import { Vertex } from '../utils/topsort';

const debug = createDebug('denali:application');

/**
 * Options for instantiating an application
 */
export interface ApplicationOptions {
  router?: Router;
  addons?: string[];
  container?: Container;
  environment: string;
  dir: string;
  pkg?: any;
}

/**
 * Initializers are run before the application starts up. You are given the application instance,
 * and if you need to perform async operations, you can return a Promise. You can configure
 * initializer order by specifying the names of initializers that should come before or after your
 * initializer.
 *
 * @since 0.1.0
 */
export interface Initializer {
  name: string;
  before?: string | string[];
  after?: string | string[];
  initialize(application: Application): Promise<any>;
}

/**
 * Application instances are specialized Addons, designed to kick off the loading, mounting, and
 * launching stages of booting up.
 *
 * @package runtime
 */
export default class Application extends Addon {

  /**
   * The Router instance for this Application.
   */
  router: Router;

  /**
   * The application config
   *
   * @since 0.1.0
   */
  config: any;

  /**
   * The container instance for the entire application
   *
   * @since 0.1.0
   */
  container: Container;

  /**
   * Track servers that need to drain before application shutdown
   */
  protected drainers: (() => Promise<void>)[];

  /**
   * The logger instance for the entire application
   *
   * @since 0.1.0
   */
  logger: Logger;

  /**
   * List of child addons for this app (one-level deep only, i.e. no addons-of-addons are included)
   *
   * @since 0.1.0
   */
  addons: Addon[];

  constructor(options: ApplicationOptions) {
    let container = new Container(options.dir);
    super(Object.assign(options, { container }));

    this.drainers = [];

    // Setup some helpful container shortcuts
    this.container.register('app:main', this, { singleton: true, instantiate: false });

    // Find addons for this application
    this.addons = this.buildAddons(options.addons || []);

    this.router = this.container.lookup('app:router');
    this.logger = this.container.lookup('app:logger');

    // Generate config first, since the loading process may need it
    this.config = this.generateConfig();

    this.compileRouter();
  }

  /**
   * Given a directory that contains an addon, load that addon and instantiate it's Addon class.
   */
  private buildAddons(preseededAddons: string[]): Addon[] {
    return findPlugins({
      dir: this.dir,
      keyword: 'denali-addon',
      include: preseededAddons
    }).map((plugin) => {
      let AddonClass;
      try {
        AddonClass = tryRequire(path.join(plugin.dir, 'app', 'addon.js'));
        AddonClass = AddonClass || Addon;
      } catch (e) {
        /* tslint:disable:no-console */
        console.error(`Error loading an addon from ${ plugin.dir }:`);
        console.error(e);
        /* tslint:enable:no-console */
        throw e;
      }
      AddonClass = <typeof Addon>(AddonClass.default || AddonClass);
      let addon = new AddonClass({
        environment: this.environment,
        container: this.container,
        dir: plugin.dir,
        pkg: plugin.pkg
      });
      debug(`Addon: ${ addon.pkg.name }@${ addon.pkg.version } (${ addon.dir }) `);
      return addon;
    });
  }

  /**
   * Take the loaded environment config functions, and execute them. Application config is executed
   * first, and the returned config object is handed off to the addon config files, which add their
   * configuration by mutating that same object.
   *
   * The resulting final config is stored at `application.config`, and is registered in the
   * container under `config:environment`.
   *
   * This is invoked before the rest of the addons are loaded for 2 reasons:
   *
   * - The config values for the application could theoretically impact the addon loading process
   * - Addons are given a chance to modify the application config, so it must be loaded before they
   *   are.
   */
  private generateConfig(): any {
    let appConfig = this.resolver.retrieve('config:environment') || constant({});
    let config = appConfig(this.environment);
    config.environment = this.environment;
    this.container.register('config:environment', config);
    this.addons.forEach((addon) => {
      let addonConfig = addon.resolver.retrieve('config:environment');
      if (addonConfig) {
        addonConfig(this.environment, config);
      }
    });
    return config;
  }

  /**
   * Assemble middleware and routes
   */
  private compileRouter(): void {
    // Load addon middleware first
    this.addons.forEach((addon) => {
      let addonMiddleware = addon.resolver.retrieve('config:middleware') || noop;
      addonMiddleware(this.router, this);
    });
    // Then load app middleware
    let appMiddleware = this.resolver.retrieve('config:middleware') || noop;
    appMiddleware(this.router, this);
    // Load app routes first so they have precedence
    let appRoutes = this.resolver.retrieve('config:routes') || noop;
    appRoutes(this.router, this);
    // Load addon routes in reverse order so routing precedence matches addon load order
    this.addons.reverse().forEach((addon) => {
      let addonRoutes = addon.resolver.retrieve('config:routes') || noop;
      addonRoutes(this.router);
    });
  }

  /**
   * Start the Denali server. Runs all initializers, creates an HTTP server, and binds to the port
   * to handle incoming HTTP requests.
   *
   * @since 0.1.0
   */
  async start(): Promise<void> {
    let port = this.config.server.port || 3000;
    try {
      await this.runInitializers();
      if (!this.config.server.detached) {
        await this.createServer(port);
        this.logger.info(`${ this.pkg.name }@${ this.pkg.version } server up on port ${ port }`);
      }
    } catch (error) {
      this.logger.error('Problem starting app ...');
      this.logger.error(error.stack || error);
    }
  }

  /**
   * Creates an HTTP or HTTPS server, depending on whether or not SSL configuration is present in
   * config/environment.js
   */
  private async createServer(port: number): Promise<void> {
    await new Promise((resolve) => {
      let handler = this.router.handle.bind(this.router);
      let server: any;
      if (this.config.server.ssl) {
        server = https.createServer(this.config.server.ssl, handler).listen(port, resolve);
      } else {
        server = http.createServer(handler).listen(port, resolve);
      }
      this.drainers.push(async function drainHttp() {
        await new Promise((resolveDrainer) => {
          server.close(resolveDrainer);
          setTimeout(resolveDrainer, 60 * 1000);
        });
      });
    });
  }

  /**
   * Lookup all initializers and run them in sequence. Initializers can override the default load
   * order by including `before` or `after` properties on the exported class (the name or array of
   * names of the other initializers it should run before/after).
   *
   * @since 0.1.0
   */
  async runInitializers(): Promise<void> {
    let initializers = <Initializer[]>topsort(<Vertex[]>values(this.container.lookupAll('initializer')));
    await each(initializers, async (initializer: Initializer) => {
      await initializer.initialize(this);
    });
  }

  /**
   * Shutdown the application gracefully (i.e. close external database connections, drain in-flight
   * requests, etc)
   *
   * @since 0.1.0
   */
  async shutdown(): Promise<void> {
    await all(this.drainers.map((drainer) => drainer()));
    await all(this.addons.map(async (addon) => {
      await addon.shutdown(this);
    }));
  }

}
