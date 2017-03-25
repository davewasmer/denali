import {
  defaults,
  camelCase,
  omitBy,
  forEach
} from 'lodash';
import Resolver from './resolver';
import { Dict, Constructor } from '../utils/types';

interface Lookup {
  factory: Factory<any>;
  instance: any;
}

export interface ParsedSpecifier {
  fullName: string;
  moduleName: string;
  modulePath: string;
  type: string;
}

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

export interface FactoryDefinition<T> extends Constructor<T> {
  teardownInstance?(instance: object): void;
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
  class: FactoryDefinition<T>;
  create(...args: any[]): T;
  teardownInstance(instance: any): void;
}

/**
 * Parse a specifier string into a structured object with fields for each part of the specifier.
 */
export function parseSpecifier(specifier: string): ParsedSpecifier {
  let [ type, modulePath ] = specifier.split(':');
  return {
    fullName: specifier,
    type,
    modulePath,
    moduleName: camelCase(modulePath)
  };
}

export default class Container {

  /**
   * Manual registrations that should override resolver retrieved values
   */
  private registry: Dict<FactoryDefinition<any>> = {};

  /**
   * An array of resolvers used to retrieve container members. Resolvers are tried in order, first
   * to find the member wins.
   */
  private resolvers: Resolver[];

  /**
   * Cache of lookup values
   */
  private lookups: Dict<Lookup> = {};

  /**
   * Cache of factory definitions
   */
  private factoryDefinitionLookups: Dict<FactoryDefinition<any>> = {};

  /**
   * Options map for container members. Keyed on specifier or type.
   */
  private options: Dict<ContainerOptions> = {};

  constructor(root: string) {
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
   * Return the factory for the given specifier. Typically only used when you need to control when
   * an object is instantiated.
   */
  factoryFor<T>(specifier: string, options: { loose?: boolean } = {}): Factory<T> {
    let factoryDefinition: FactoryDefinition<T> = this.factoryDefinitionLookups[specifier];

    if (!factoryDefinition) {
      factoryDefinition = this.registry[specifier];

      if (!factoryDefinition) {
        forEach(this.resolvers, (resolver) => {
          factoryDefinition = resolver.retrieve(specifier);
          if (factoryDefinition) {
            return false;
          }
        })
      }

      if (factoryDefinition) {
        this.factoryDefinitionLookups[specifier] = factoryDefinition;
      }
    }

    if (!factoryDefinition) {
      if (options.loose) {
        return;
      }
      throw new Error(`No factory found for ${ specifier }`);
    }

    return this.buildFactory(specifier, factoryDefinition);
  }

  /**
   * Lookup the given specifier in the container. If options.loose is true, failed lookups will
   * return undefined rather than throw.
   */
  lookup<T>(specifier: string, options: { loose?: boolean } = {}): T | FactoryDefinition<T> {
    let singleton = (this.getOption(specifier, 'singleton') !== false);

    if (singleton) {
      let lookup = this.lookups[specifier];
      if (lookup) {
        return lookup.instance;
      }
    }

    let factory = this.factoryFor<T>(specifier, options);
    if (!factory) { return; }

    if (this.getOption(specifier, 'instantiate') === false) {
      return factory.class;
    }

    let instance = factory.create();

    if (singleton && instance) {
      this.lookups[specifier] = { factory, instance };
    }

    return instance;
  }

  lookupAll<T>(type: string): Dict<T> {
    let registrations = omitBy(this.registry, (registration, specifier) => {
      return specifier.startsWith(type);
    });
    let resolved = this.resolvers.reduce((members, resolver) => {
      return Object.assign(members, resolver.retrieveAll(type));
    }, {});
    return Object.assign(resolved, registrations);
  }

  /**
   * Return the value for the given option on the given specifier. Specifier may be a full specifier
   * or just a type.
   */
  getOption(specifier: string, optionName: keyof ContainerOptions): any {
    let { type } = parseSpecifier(specifier);
    let options = defaults(this.options[specifier], this.options[type]);
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
   * Teardown this container. Iterates through all the values that have been looked up, and invokes
   * that item's factory's teardownInstance method.
   */
  teardown(): void {
    let specifiers = Object.keys(this.lookups);

    for (let i=0;i<specifiers.length;i++) {
      let specifier = specifiers[i];
      let { factory, instance } = this.lookups[specifier];
      factory.teardownInstance(instance);
    }
  }

  /**
   * Build the factory wrapper for a given container member
   */
  private buildFactory<T>(specifier: string, factoryDefinition: FactoryDefinition<T>): Factory<T> {
    return {
      class: factoryDefinition,
      teardownInstance: (instance) => {
        if (factoryDefinition.teardownInstance) {
          factoryDefinition.teardownInstance(instance);
        }
      },
      create(...args: any[]) {
        let instance = new factoryDefinition(...args);
        this.applyInjections(instance);
        return instance;
      }
    }
  }
}