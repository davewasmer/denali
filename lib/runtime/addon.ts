import container from '../metal/container';
import Resolver from '../metal/resolver';
import Application from './application';
import Loader from '@denali-js/loader';

/**
 * Addons are the fundamental unit of organization for Denali apps. The
 * Application class is just a specialized Addon, and each Addon can contain
 * any amount of functionality - each one is essentially a mini Denali app.
 *
 * @package runtime
 * @since 0.1.0
 */
export default class Addon {

  /**
   * The current environment for the app, i.e. 'development'
   *
   * @since 0.1.0
   */
  environment: string;

  /**
   * The loader scope for this addon
   */
  loader: Loader;

  /**
   * The resolver for this addon's loader scope
   */
  get resolver(): Resolver {
    return this.loader.resolver;
  }

  constructor(loader: Loader, options: { environment: string }) {
    this.loader = loader;
    this.environment = options.environment;
    container.register(`addon:${ this.name }`, this);
  }

  /**
   * The name of the addon. Override this to use a different name than the
   * package name for your addon.
   *
   * @since 0.1.0
   */
  get name(): string {
    return `${ this.loader.pkgName }@${ this.loader.version }`;
  }

  /**
   * A hook to perform any shutdown actions necessary to gracefully exit the
   * application, i.e. close database/socket connections.
   *
   * @since 0.1.0
   */
  async shutdown(application: Application): Promise<void> {
    // defaults to noop
  }

}
