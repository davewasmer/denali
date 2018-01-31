import {
  defaults,
  forEach,
  forOwn,
  uniq,
  zipObject
} from 'lodash';
import * as assert from 'assert';
import Resolver from './resolver';
import { Dict, Constructor } from '../utils/types';
import DenaliObject from './object';
import { injectInstance } from './inject';
import * as dedent from 'dedent-js';

const DEFAULT_OPTIONS = {
  instantiate: false,
  singleton: true
};

/**
 * Anytime the container first looks up a particular entry, if that entry defines a method under the
 * `onLoad` symbol, it will invoke that method with the looked up entry value.
 *
 * This is useful for simulating pseudo-design-time logic. For example, Model classes use this to
 * create getter and setter methods for attributes which forward to the underlying ORM instance. The
 * result is that we can programmatically customize the class prototype based on static
 * declarations, loosely analagous to Ruby's `included` hook.
 *
 * Warning: this is a very low-level API, and should be used sparingly! Since the onLoad hook is
 * invoked with the _static_ class, take care to avoid sharing any container-specific state on that
 * static class, lest you pollute across containers (since containers share the static class
 * reference)
 */
export const onLoad = Symbol('container onLoad method');

export interface ContainerOptions {
  /**
   * The container should treat the member as a singleton. If paired with `instantiate`, the
   * container will create that singleton on the first lookup. If not, then the container will
   * assume to member is already a singleton
   */
  singleton?: boolean;
  /**
   * The container should create an instance on lookup. If `singleton` is also true, only one
   * instance will be created
   */
  instantiate?: boolean;
}

/**
 * A Factory is a wrapper object around a containered class. It includes the original class, plus a
 * `create()` method that is responsible for creating a new instance and applying any appropriate
 * injections.
 *
 * The Factory object is used to isolate this injection logic to a single spot. The container uses
 * this Factory object internally when instantiating during a `lookup` call. Users can also fetch
 * this Factory via `factoryFor()` if they want to control instantiation. A good example here is
 * Models. We could allow the container to instantiate models by setting `instantiate: true`, but
 * that is inconvenient - Models typically take constructor arguments (container instantiation
 * doesn't support that), and we frequently want to fetch the Model class itself, which is
 * cumbersome with `instantiate: true`.
 *
 * Instead, users can simply use `factoryFor` to fetch this Factory wrapper. Then they can
 * instantiate the object however they like.
 */
export interface Factory<T> {
  class: Constructor<T>;
  create(...args: any[]): T;
}

/**
 * The container is the dependency injection solution for Denali. It is responsible for abstracting
 * away where a class came from. This allows several things:
 *
 *   * Apps can consume classes that originate from anywhere in the addon dependency tree, without
 *     needing to care/specify where.
 *   * We can more easily test parts of the framework by mocking out container entries instead of
 *     dealing with hardcoding dependencies
 *   * Support clean injection syntax, i.e. `mailer = service();`.
 *
 * In order to do these, the container must control creating instances of any classes it holds. This
 * allows us to ensure injections are applied to every instance. If you need to create your own
 * instance of a class, you can use the `factoryFor` method which allows you to create your own
 * instance with injections properly applied.
 *
 * However, this should be relatiely rare - most of the time you'll be dealing with objects that
 * are controlled by the framework.
 */
export default class Container {

  /**
   * Manual registrations that should override resolver retrieved values
   */
  protected registry: Dict<Constructor<any>> = {};

  /**
   * An array of resolvers used to retrieve container members. Resolvers are tried in order, first
   * to find the member wins. Normally, each addon will supply it's own resolver, allowing for
   * addon order and precedence when looking up container entries.
   */
  protected resolvers: Resolver[] = [];

  /**
   * Internal cache of lookup values
   */
  protected lookups: Dict<{ factory: Factory<any>, instance: any }> = {};

  /**
   * Internal cache of classes
   */
  protected classLookups: Dict<Constructor<any>> = {};

  /**
   * Internal cache of factories
   */
  protected factoryLookups: Dict<Factory<any>> = {};

  /**
   * Options for container entries. Keyed on specifier or type. See ContainerOptions.
   */
  protected options: Dict<ContainerOptions> = {
    app: { singleton: true, instantiate: true },
    action: { singleton: false, instantiate: true },
    config: { singleton: true, instantiate: false },
    initializer: { singleton: true, instantiate: false },
    'orm-adapter': { singleton: true, instantiate: true },
    model: { singleton: false, instantiate: false },
    parser: { singleton: true, instantiate: true },
    serializer: { singleton: true, instantiate: true },
    service: { singleton: true, instantiate: true },
    view: { singleton: true, instantiate: true }
  };

  /**
   * Internal metadata store. See `metaFor()`
   */
  protected meta: Map<any, Dict<any>> = new Map();

  /**
   * Create a new container with a base (highest precedence) resolver at the given directory.
   */
  constructor(root: string) {
    assert(root, 'You must supply a valid path as the root directory for the container to load from');
    this.resolvers.push(new Resolver(root));
  }

  /**
   * Add a resolver to the container to use for lookups. New resolvers are added at lowest priority,
   * so all previously added resolvers will take precedence.
   */
  addResolver(resolver: Resolver) {
    this.resolvers.push(resolver);
  }

  /**
   * Add a manual registration that will take precedence over any resolved lookups.
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
   * Return the factory for the given specifier. Typically only used when you need to control when
   * an object is instantiated.
   */
  factoryFor<T = any>(specifier: string, options: { loose?: boolean } = {}): Factory<T> {
    let factory = this.factoryLookups[specifier];
    if (!factory) {
      let klass = this.classLookups[specifier];

      if (!klass) {
        klass = this.registry[specifier];

        if (!klass) {
          forEach(this.resolvers, (resolver) => {
            klass = resolver.retrieve(specifier);
            if (klass) {
              return false;
            }
          });
        }

        if (klass) {
          this.classLookups[specifier] = klass;
          this.onFirstLookup(specifier, klass);
        }
      }

      if (!klass) {
        if (options.loose) {
          return;
        }
        console.error(dedent`
          \n\nUnable to find factory source for ${ specifier }.

          Available registrations:
            - ${ Object.keys(this.registry).join('\n  - ') }

          Available resolvers:
            - ${ this.resolvers.map((r) => r.root).join('\n  - ') }

          Run with DEBUG=silly-denali:resolver:<path> to trace a specific resolver's resolution
        `);
        throw new Error(`No class found for ${ specifier }.`);
      }

      factory = this.factoryLookups[specifier] = this.buildFactory(specifier, klass);
    }
    return factory;
  }

  /**
   * Run some logic anytime an entry is first looked up in the container. Here, we add some metadata
   * so the class can know what specifier it was looked up under, as well as running the special
   * onLoad hook, allowing classes to run some psuedo-design-time logic.
   */
  onFirstLookup(specifier: string, klass: any) {
    this.metaFor(klass).containerName = specifier.split(':')[1];
    if (klass[onLoad]) {
      klass[onLoad](klass);
    }
  }

  /**
   * Lookup the given specifier in the container. If options.loose is true, failed lookups will
   * return undefined rather than throw.
   */
  lookup<T = any>(specifier: string, options: { loose?: boolean } = {}): T {
    let singleton = this.getOption(specifier, 'singleton') !== false;

    if (singleton) {
      let lookup = this.lookups[specifier];
      if (lookup) {
        return lookup.instance;
      }
    }

    let factory = this.factoryFor<T>(specifier, options);
    if (!factory) { return; }

    if (this.getOption(specifier, 'instantiate') === false) {
      let klass = (<any>factory).class;
      if (!singleton) {
        this.lookups[specifier] = klass;
        return klass;
      }
      let instance = klass;
      injectInstance(instance, this);
      this.lookups[specifier] = { factory, instance };
      return klass;
    }

    let instance = factory.create();

    if (singleton && instance) {
      this.lookups[specifier] = { factory, instance };
    }

    return instance;
  }

  /**
   * Lookup all the entries for a given type in the container. This will ask all resolvers to
   * eagerly load all classes for this type. Returns an object whose keys are container specifiers
   * and values are the looked up values for those specifiers.
   */
  lookupAll<T = any>(type: string): Dict<T> {
    let entries = this.availableForType(type);
    let values = entries.map((entry) => this.lookup(`${ type }:${ entry }`));
    return <Dict<T>>zipObject(entries, values);
  }

  /**
   * Returns an array of entry names for all entries under this type. Entries are eagerly looked up,
   * so resolvers will actively scan for all matching files, for example. Use sparingly.
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
   * Return the value for the given option on the given specifier. Specifier may be a full specifier
   * or just a type.
   */
  getOption(specifier: string, optionName: keyof ContainerOptions): any {
    let [ type ] = specifier.split(':');
    let options = defaults(this.options[specifier], this.options[type], DEFAULT_OPTIONS);
    return options[optionName];
  }

  /**
   * Set the give option for the given specifier or type.
   */
  setOption(specifier: string, optionName: keyof ContainerOptions, value: any): void {
    if (!this.options[specifier]) {
      this.options[specifier] = { singleton: false, instantiate: false };
    }
    this.options[specifier][optionName] = value;
  }

  /**
   * Allow consumers to store metadata on the container. This is useful if you want to store data
   * tied to the lifetime of the container. For example, you may have an expensive calculation that
   * you can cache once per class. Rather than storing that cached value on `this.constructor`,
   * which is shared across containers, you can store it on `container.metaFor(this.constructor)`,
   * ensuring that your container doesn't pollute others.
   */
  metaFor(key: any) {
    if (!this.meta.has(key)) {
      this.meta.set(key, {});
    }
    return this.meta.get(key);
  }

  /**
   * Clear any cached lookups for this specifier. You probably don't want to use this. The only
   * significant use case is for testing to allow test containers to override an already looked up
   * value.
   */
  clearCache(specifier: string) {
    delete this.lookups[specifier];
    delete this.classLookups[specifier];
    delete this.factoryLookups[specifier];
  }

  /**
   * Given container-managed singletons a chance to cleanup on application shutdown
   */
  teardown() {
    forEach(this.lookups, (instance: DenaliObject, specifier) => {
      if (typeof instance.teardown === 'function') {
        instance.teardown();
      }
    });
  }

  /**
   * Build the factory wrapper for a given container member
   */
  protected buildFactory<T extends DenaliObject>(specifier: string, klass: Constructor<T>): Factory<T> {
    let container = this;
    return {
      class: klass,
      create(...args: any[]) {
        assert(typeof klass === 'function', `Unable to instantiate ${ specifier } (it's not a constructor). Try setting the 'instantiate: false' option on this container entry to avoid instantiating it`);
        let instance = <T>new klass();
        injectInstance(instance, container);
        if (typeof instance.init === 'function') {
          instance.init(...args);
        }
        return instance;
      }
    };
  }
}
