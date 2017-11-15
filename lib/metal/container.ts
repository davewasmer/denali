import * as assert from 'assert';
import { defaults, forEach, forOwn, uniq, zipObject } from 'lodash';
import Resolver from './resolver';
import { Dict, Constructor } from '../utils/types';
import strings from '../utils/strings';
import * as crawl from 'tree-crawl';
import Loader from '@denali-js/loader';

const DEFAULT_OPTIONS = {
  singleton: true,
  fallbacks: <string[]>[]
};

export interface ContainerOptions {
  /**
   * The container should treat the member as a singleton. If true, the
   * container will create that singleton on the first lookup.
   */
  singleton?: boolean;
  /**
   * What should the container fallback to if it's unable to find a specific
   * entry under the given type? This is used to allow for the common
   * "application" fallback entry, i.e. if you don't define a model-specific
   * ORM adapter, then because the `orm-adapter` type has `fallbacks: [
   * 'application' ]`, the container will return the ApplicationORMAdapter
   * instead.
   */
  fallbacks?: string[];
}

/**
 * The Container is the dependency injection solution for Denali. It is
 * responsible for managing the lifecycle of objects (i.e. singletons),
 * as well as orchestrating dependency lookup. This provides two key benefits:
 *
 *   * Apps can consume classes that originate from anywhere in the addon
 *     dependency tree, without needing to care/specify where.
 *   * We can more easily test parts of the framework by mocking out container
 *     entries instead of dealing with hardcoding dependencies
 *
 * @package metal
 * @since 0.1.0
 */
export class Container {

  /**
   * Manual registrations that should override resolver retrieved values
   */
  protected registry: Dict<any> = {};

  /**
   * An array of resolvers used to retrieve container members. Resolvers are
   * tried in order, first to find the member wins. Normally, each addon will
   * supply it's own resolver, allowing for addon order and precedence when
   * looking up container entries.
   */
  protected resolvers: Resolver[] = [];

  /**
   * Internal cache of lookup values
   */
  protected lookups: Dict<any> = {};

  /**
   * The top level loader for the entire bundle
   */
  loader: Loader;

  /**
   * Default options for container entries. Keyed on specifier or type. See
   * ContainerOptions.
   */
  protected options: Dict<ContainerOptions> = {
    app: { singleton: true },
    'app:application': { singleton: false },
    action: { singleton: false },
    config: { singleton: false },
    initializer: { singleton: false },
    'orm-adapter': { singleton: true, fallbacks: [ 'orm-adapter:application' ] },
    model: { singleton: false },
    parser: { singleton: true, fallbacks: [ 'parser:application' ] },
    serializer: { singleton: true, fallbacks: [ 'serializer:application' ] },
    service: { singleton: true },
    view: { singleton: true, fallbacks: [ 'view:application' ] }
  };

  /**
   * Take a top level bundle loader and load it into this container
   */
  loadBundle(loader: Loader) {
    this.loader = loader;
    crawl(loader, this.loadBundleScope.bind(this), {
      order: 'bfs',
      getChildren(loader: Loader) {
        return Array.from(loader.children.values());
      }
    });
  }

  /**
   * Load a bundle scope into the container. A bundle scope typically
   * corresponds to an addon. Each bundle scope can provide it's own resolver to
   * tell the consuming app how to look things up within the bundle scope. If
   * no resolver is supplied, Denali will use the default Denali resolver.
   */
  loadBundleScope(loader: Loader) {
    let LoaderResolver: typeof Resolver;
    try {
        LoaderResolver = loader.load<typeof Resolver>('resolver');
    } catch (e) {
        LoaderResolver = Resolver;
    }
    let resolver = new LoaderResolver(loader);
    this.resolvers.push(resolver);
    loader.resolver = resolver;
  }

  /**
   * Add a manual registration that will take precedence over any resolved
   * lookups.
   *
   * @since 0.1.0
   */
  register(specifier: string, entry: any, options?: ContainerOptions) {
    this.registry[specifier] = entry;
    if (options) {
      forOwn(options, (value, key: keyof ContainerOptions) => {
        this.setOption(specifier, key, value);
      });
    }
  }

  /**
   * Lookup the given specifier in the container. If options.loose is true,
   * failed lookups will return undefined rather than throw.
   *
   * @since 0.1.0
   * @param options.loose if the entry is not found, don't throw, just return `false`
   * @param options.raw Ignore the cache, and lookup the underlying container
   * value rather than any singletons; mostly useful for tests, you should rarely use
   * this option, and at your own risk
   */
  lookup<T = any>(specifier: string, options?: { raw?: true }): T;
  lookup<T = any>(specifier: string, options?: { raw?: true, loose: true }): T | false;
  lookup<T>(specifier: string, options: { raw?: true, loose?: boolean } = {}): T | false {
    // Raw lookups skip caching and singleton behavior
    if (options.raw) {
       let entry = this.lookupRaw<T>(specifier);
       if (entry === false && !options.loose) {
         throw new ContainerEntryNotFound(specifier, this.registry, this.resolvers);
       }
       return entry;
    }
    // I can haz cache hit plz?
    if (this.lookups[specifier]) {
      return this.lookups[specifier];
    }

    // Not in cache - first lookup. Get the underlying value first
    let entry = this.lookupRaw<T>(specifier);
    // If that works - handle singletons, cache, and call it good
    if (entry !== false) {
      entry = this.instantiateSingletons<T>(specifier, entry);
      this.lookups[specifier] = entry;
      return entry;
    }

    // Not in cache and no underlying entry found. Can we fallback?
    let fallbacks = this.getOption(specifier, 'fallbacks').slice(0);
    let fallback;
    while ((fallback = fallbacks.shift()) && (fallback !== specifier)) {
      entry = this.lookup<T>(fallback, options);
      if (entry) {
        break;
      }
    }
    if (entry !== false) {
      // No singleton instantiation here - the recursion into lookup should
      // handle that
      this.lookups[specifier] = entry;
      return entry;
    }

    if (options.loose) {
      return false;
    }

    throw new ContainerEntryNotFound(specifier, this.registry, this.resolvers);
  }

  protected instantiateSingletons<T>(specifier: string, entry: T): T {
    // Instantiate if it's a singleton
    let singleton = this.getOption(specifier, 'singleton');
    if (singleton) {
      let Class = <Constructor<T>>(<any>entry);
      assert(typeof Class === 'function', strings.ContainerEntryNotAConstructor(specifier, Class));
      return new Class();
    }
    return entry;
  }

  /**
   * Recursive lookup method that takes a specifier and fallback specifiers.
   * Checks manual registrations first, then iterates through each resolver. If
   * the entry is still not found, it recurses through the fallback options
   * before ultimatley throwing (or returning false if loose: true)
   */
  protected lookupRaw<T>(specifier: string): T | false {
    // Manual registrations take precedence
    let entry = <T>this.registry[specifier];

    // Try each resolver in order
    if (!entry) {
      forEach(this.resolvers, (resolver) => {
        entry = resolver.retrieve<T>(specifier);
        if (entry) {
          return false;
        }
      });
    }

    return entry == null ? false : entry;
  }

  /**
   * Lookup all the entries for a given type in the container. This will ask
   * all resolvers to eagerly load all classes for this type. Returns an object
   * whose keys are container specifiers and values are the looked up values
   * for those specifiers.
   *
   * @since 0.1.0
   */
  lookupAll<T = any>(type: string): Dict<T> {
    let entries = this.availableForType(type);
    let values = entries.map((entry) => this.lookup(`${ type }:${ entry }`));
    return <Dict<T>>zipObject(entries, values);
  }

  /**
   * Returns an array of entry names for all entries under this type.
   *
   * @since 0.1.0
   */
  availableForType(type: string): string[] {
    let registrations = Object.keys(this.registry).filter((specifier) => {
      return specifier.startsWith(type);
    });
    let resolved = this.resolvers.reduce((entries, resolver) => {
      return entries.concat(resolver.availableForType(type));
    }, []);
    return uniq(registrations.concat(resolved)).map((specifier) => specifier.split(':')[1]);
  }

  /**
   * Return the value for the given option on the given specifier. Specifier
   * may be a full specifier or just a type.
   *
   * @since 0.1.0
   */
  getOption<U extends keyof ContainerOptions>(specifier: string, optionName: U): ContainerOptions[U] {
    let [ type ] = specifier.split(':');
    let options = defaults(this.options[specifier], this.options[type], DEFAULT_OPTIONS);
    return options[optionName];
  }

  /**
   * Set the option for the given specifier or type.
   *
   * @since 0.1.0
   */
  setOption(specifier: string, optionName: keyof ContainerOptions, value: any): void {
    if (!this.options[specifier]) {
      this.options[specifier] = Object.assign({}, DEFAULT_OPTIONS);
    }
    this.options[specifier][optionName] = value;
  }

  /**
   * Clear any cached lookups for this specifier. You probably don't want to
   * use this. The only significant use case is for testing to allow test
   * containers to override an already looked up value.
   */
  clearCache(specifier: string) {
    delete this.lookups[specifier];
  }

  /**
   * Empties the entire container, including removing all resolvers and the
   * loader, as well as emptying all caches. The primary use case is for
   * unit testing, when you want a clean slate environment to selectively
   * add things back to.
   */
  clear() {
    this.lookups = {};
    this.registry = {};
    this.resolvers = [];
    this.loader = null;
  }

  /**
   * Given container-managed singletons a chance to cleanup on application
   * shutdown
   *
   * @since 0.1.0
   */
  teardown() {
    forEach(this.lookups, (instance) => {
      if (typeof instance.teardown === 'function') {
        instance.teardown();
      }
    });
  }

}

class ContainerEntryNotFound extends Error {
  constructor(specifier: string, registry: { [specifier: string]: any }, resolvers: Resolver[]) {
    let message = strings.ContainerEntryNotFound(specifier, Object.keys(registry), resolvers.map((r) => r.name));
    super(message);
  }
}

// The exports here are unusual - rather than exporting the Container class, we
// actually instantiate the container and export that. This is because all
// Denali code is loaded via a bundle, and there is only one container instance
// per bundle. Instantiating it here allows us to treat the container as
// effectively a global variable, which allows for *much* more convenient use
// (otherwise, the container would need to control instantiation of every object
// to ensure each object could get a reference to the container instance).
const container = new Container();
export default container;
export const lookup: typeof Container.prototype.lookup = container.lookup.bind(container);
