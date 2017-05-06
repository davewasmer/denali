import findup = require('findup-sync');
import * as tryRequire from 'try-require';
import DenaliObject from '../metal/object';
import Container from '../metal/container';
import Application from './application';
import Resolver from '../metal/resolver';

/**
 * Constructor options for Addon class
 *
 * @package runtime
 * @since 0.1.0
 */
export interface AddonOptions {
  environment: string;
  dir: string;
  container: Container;
  pkg?: any;
}

/**
 * Addons are the fundamental unit of organization for Denali apps. The Application class is just a
 * specialized Addon, and each Addon can contain any amount of functionality.
 *
 * ## Structure
 *
 * Addons are packaged as npm modules for easy sharing. When Denali boots up, it searches your
 * node_modules for available Denali Addons (identified by the `denali-addon` keyword in the
 * package.json). Addons can be nested (i.e. an addon can itself depend on another addon).
 *
 * Each addon can be composed of one or several of the following parts:
 *
 *   * Config
 *   * Initializers
 *   * Middleware
 *   * App classes
 *   * Routes
 *
 * ## Load order
 *
 * After Denali discovers the available addons, it then merges them to form a unified application.
 * Addons higher in the dependency tree take precedence, and sibling addons can specify load order
 * via their package.json files:
 *
 *     "denali": {
 *       "before": [ "another-addon-name" ],
 *       "after": [ "cool-addon-name" ]
 *     }
 *
 * @package runtime
 * @since 0.1.0
 */
export default class Addon extends DenaliObject {

  /**
   * The current environment for the app, i.e. 'development'
   *
   * @since 0.1.0
   */
  environment: string;

  /**
   * The root directory on the filesystem for this addon
   *
   * @since 0.1.0
   */
  dir: string;

  /**
   * The package.json for this addon
   *
   * @since 0.1.0
   */
  pkg: any;

  /**
   * The resolver instance to use with this addon.
   *
   * @since 0.1.0
   */
  resolver: Resolver;

  /**
   * The consuming application container instance
   *
   * @since 0.1.0
   */
  container: Container;

  constructor(options: AddonOptions) {
    super();
    this.environment = options.environment;
    this.dir = options.dir;
    this.pkg = options.pkg || tryRequire(findup('package.json', { cwd: this.dir }));
    this.container = options.container;

    this.resolver = this.resolver || new Resolver(this.dir);
    this.container.addResolver(this.resolver);
    this.container.register(`addon:${ this.pkg.name }@${ this.pkg.version }`, this);
  }

  /**
   * The name of the addon. Override this to use a different name than the package name for your
   * addon.
   *
   * @since 0.1.0
   */
  get name(): string {
    return (this.pkg && this.pkg.name) || 'anonymous-addon';
  }

  /**
   * A hook to perform any shutdown actions necessary to gracefully exit the application, i.e. close
   * database/socket connections.
   *
   * @since 0.1.0
   */
  async shutdown(application: Application): Promise<void> {
    // defaults to noop
  }

}
