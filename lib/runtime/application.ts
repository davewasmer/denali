import { values, constant, noop, defaults } from 'lodash';
import * as http from 'http';
import * as https from 'https';
import { all } from 'bluebird';
import Addon from './addon';
import topsort from '../utils/topsort';
import Router from './router';
import Logger from './logger';
import { AppConfig } from './config';
import container, { Container } from '../metal/container';
import { Vertex } from '../utils/topsort';
import Loader from '@denali-js/loader';

export interface AppConfigBuilder {
  (environment: string, container: Container): AppConfig;
}

export interface AddonConfigBuilder {
  (environment: string, container: Container, config: AppConfig): void;
}

export interface MiddlewareBuilder {
  (router: Router, application: Application): void;
}

export interface RoutesMap {
  (router: Router, application: Application): void;
}

/**
 * Initializers are run before the application starts up. You are given the
 * application instance, and if you need to perform async operations, you can
 * return a Promise. You can configure initializer order by specifying the
 * names of initializers that should come before or after your initializer.
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
 * Application instances are specialized Addons, designed to kick off the
 * loading, mounting, and launching stages of booting up.
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
   * List of child addons for this app (one-level deep only, i.e. no
   * addons-of-addons are included)
   *
   * @since 0.1.0
   */
  addons: Addon[] = [];

  constructor(loader: Loader, options: { environment?: string }) {
    super(loader, defaults(options, { environment: 'development' }));

    this.loader.children.forEach((addonLoader, addonName) => {
      let Addon = addonLoader.resolver.retrieve('app:addon');
      this.addons.push(new Addon(addonLoader, options));
    });

    this.drainers = [];

    // Setup some helpful container shortcuts
    container.register('app:main', this);

    this.router = container.lookup('app:router');
    this.logger = container.lookup('app:logger');

    // Generate config first, since the loading process may need it
    this.config = this.generateConfig();

    this.compileRouter();
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
   * This is invoked before the rest of the addons are loaded for 2 reasons:
   *
   * - The config values for the application could theoretically impact the
   *   addon loading process
   * - Addons are given a chance to modify the application config, so it must
   *   be loaded before they are.
   */
  protected generateConfig(): any {
    let appConfig = this.resolver.retrieve<AppConfigBuilder>('config:environment') || <AppConfigBuilder>constant({
      environment: 'development',
      server: {
        port: 3000
      }
    });
    let config = appConfig(this.environment, container);
    config.environment = this.environment;
    container.register('config:environment', config);
    this.addons.forEach((addon) => {
      let addonConfig = addon.resolver.retrieve<AddonConfigBuilder>('config:environment');
      if (addonConfig) {
        addonConfig(this.environment, container, config);
      }
    });
    return config;
  }

  /**
   * Assemble middleware and routes
   */
  protected compileRouter(): void {
    // Load addon middleware first
    this.addons.forEach((addon) => {
      let addonMiddleware = addon.resolver.retrieve<MiddlewareBuilder>('config:middleware') || noop;
      addonMiddleware(this.router, this);
    });
    // Then load app middleware
    let appMiddleware = this.resolver.retrieve<MiddlewareBuilder>('config:middleware') || noop;
    appMiddleware(this.router, this);
    // Load app routes first so they have precedence
    let appRoutes = this.resolver.retrieve<RoutesMap>('config:routes') || noop;
    appRoutes(this.router, this);
    // Load addon routes in reverse order so routing precedence matches addon load order
    this.addons.reverse().forEach((addon) => {
      let addonRoutes = addon.resolver.retrieve<RoutesMap>('config:routes') || noop;
      addonRoutes(this.router, this);
    });
  }

  /**
   * Start the Denali server. Runs all initializers, creates an HTTP server,
   * and binds to the port to handle incoming HTTP requests.
   *
   * @since 0.1.0
   */
  async start(): Promise<void> {
    let port = this.config.server.port || 3000;
    await this.runInitializers();
    if (!this.config.server.detached) {
      await this.createServer(port);
      this.logger.info(`${ this.name } server up on port ${ port }`);
    }
  }

  /**
   * Creates an HTTP or HTTPS server, depending on whether or not SSL
   * configuration is present in config/environment.js
   */
  protected async createServer(port: number): Promise<void> {
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
   * Lookup all initializers and run them in sequence. Initializers can
   * override the default load order by including `before` or `after`
   * properties on the exported class (the name or array of names of the other
   * initializers it should run before/after).
   *
   * @since 0.1.0
   */
  async runInitializers(): Promise<void> {
    let initializers = values(container.lookupAll<Initializer>('initializer'));
    initializers = topsort(<Vertex[]>initializers);
    for (let initializer of initializers) {
      await initializer.initialize(this);
    }
  }

  /**
   * Shutdown the application gracefully (i.e. close external database
   * connections, drain in-flight requests, etc)
   *
   * @since 0.1.0
   */
  async shutdown(): Promise<void> {
    await all(this.drainers.map((drainer) => drainer()));
    await all(this.addons.map(async (addon) => {
      await addon.shutdown(this);
    }));
    container.teardown();
  }

}
