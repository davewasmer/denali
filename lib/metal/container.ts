import {
  camelCase,
  forOwn,
  isObject,
  forEach,
  defaults,
  forIn
} from 'lodash';
import * as dedent from 'dedent-js';
import { Dict, Constructor } from '../utils/types';
import DenaliObject from './object';
import Resolver from './resolver';
import { assign, mapValues } from 'lodash';
import { IS_INJECTION } from './inject';

export interface ParsedName {
  fullName: string;
  type: string;
  modulePath: string;
  moduleName: string;
}

export interface ContainerOptions {
  containerize?: boolean;
  singleton?: boolean;
}

const DEFAULT_CONTAINER_OPTIONS = {
  containerize: true,
  singleton: false
}


/**
 * The Container houses all the various classes that makeup a Denali app's
 *
 * runtime. It holds references to the modules themselves, as well as managing lookup logic (i.e.
 * some types of classes fall back to a generic "application" class if a more specific one is not
 * found.
 *
 * @package runtime
 * @since 0.1.0
 */
export default class Container extends DenaliObject {

  constructor(root: string | Resolver = process.cwd()) {
    super();
    this.resolvers.push(typeof root === 'string' ? new Resolver(root) : root);
  }

  /**
   * An internal cache of lookups and their resolved values
   */
  private lookups: Map<string, any> = new Map();

  /**
   * Optional resolvers to use as a fallback if the default resolver is unable to resolve a lookup.
   * Usually these are the resolvers for child addons, but you could also use a fallback resolver
   * to support an alternative directory structure for your app. NOTE: this is NOT recommended, and
   * may break compatibility with poorly designed addons as well as certainly CLI features.
   */
  private resolvers: Resolver[] = [];

  /**
   * Holds options for how to handle constructing member objects
   */
  private memberOptions: Map<string, ContainerOptions> = new Map([
    [ 'app', { singleton: true } ],
    [ 'orm-adapter', { singleton: true } ],
    [ 'serializer', { singleton: true } ],
    [ 'service', { singleton: true } ]
  ]);

  /**
   * Add a fallback resolver to the bottom of the fallback queue.
   *
   * @since 0.1.0
   */
  public addResolver(resolver: Resolver) {
    this.resolvers.push(resolver);
  }

  /**
   * Register a value under the given `fullName` for later use.
   *
   * @since 0.1.0
   */
  public register(name: string, value: any, options?: ContainerOptions): void {
    this.resolvers[0].register(name, value);
    if (options) {
      this.registerOptions(name, options);
    }
  }

  /**
   * Set options for how the given member will be constructed. Options passed in are merged with any
   * existing options - they do not replace them entirely.
   *
   * @since 0.1.0
   */
  public registerOptions(name: string, options: ContainerOptions = {}): void {
    let { fullName } = parseName(name);
    let currentOptions = this.memberOptions.get(fullName);
    this.memberOptions.set(fullName, assign(currentOptions, options));
  }

  /**
   * Get the given option for the given member of the container
   *
   * @since 0.1.0
   */
  public optionFor(name: string, option?: keyof ContainerOptions): any {
    let { type, fullName } = parseName(name);
    let options = this.memberOptions.get(fullName);
    let typeOptions = this.memberOptions.get(type);
    let combinedOptions = defaults(defaults(options, typeOptions), DEFAULT_CONTAINER_OPTIONS);
    if (!option) {
      return combinedOptions;
    }
    return combinedOptions[option];
  }

  /**
   * Lookup a value in the container. Uses type specific lookup logic if available.
   *
   * @since 0.1.0
   */
  public lookup(name: string, lookupOptions: { loose?: boolean, raw?: boolean } = {}): any {
    let parsedName = parseName(name);

    if (!this.lookups.has(parsedName.fullName)) {

      // Find the member with the top level resolver
      let object: any;
      forEach(this.resolvers, (resolver) => {
        object = resolver.retrieve(parsedName);
        return !object; // Break loop if we found something
      });

      // Handle a bad lookup
      if (!object) {
        // Allow failed lookups (opt-in)
        if (lookupOptions.loose) {
          this.lookups.set(parsedName.fullName, null);
          return null;
        }
        throw new Error(`No such ${ parsedName.type } found: '${ parsedName.moduleName }'`);
      }

      // Make the singleton if needed
      if (this.optionFor(parsedName.fullName, 'singleton')) {
        object = new object();
      }

      // Inject container references
      if (this.optionFor(parsedName.fullName, 'containerize')) {
        object.container = this;
        if (object.prototype) {
          object.prototype.container = this;
        }
      }

      // Inject other references
      this.applyInjections(object);
      if (object.prototype) {
        this.applyInjections(object.prototype);
      }

      // Freeze the actual containered value to avoid allowing mutations. If `object` here is the
      // direct result of a require() call, then any mutations to it will be shared with other
      // containers that require() it (i.e. when running concurrent tests). If it's a singleton,
      // this isn't necessary since each container gets it's own instance. But if it's not, then we
      // freeze it to prevent mutations which can lead to extremely difficult to trace bugs.
      if (!this.optionFor(parsedName.fullName, 'singleton')) {
        object = Object.freeze(object);
      }

      this.lookups.set(parsedName.fullName, object);
    }

    return this.lookups.get(parsedName.fullName);
  }

  private applyInjections(object: any) {
    forIn(object, (value, key) => {
      if (value && value[IS_INJECTION]) {
        object[key] = this.lookup(value.lookup);
      }
    });
  }

  /**
   * Lookup all modules of a specific type in the container. Returns an object of all the modules
   * keyed by their module path (i.e. `role:employees/manager` would be found under
   * `lookupAll('role')['employees/manager']`
   */
  public lookupAll(type: string): { [modulePath: string]: any } {
    let resolverResultsets = this.resolvers.map((resolver) => {
      return resolver.retrieveAll(type);
    });
    let mergedResultset = <{ [modulePath: string]: any }>(<any>assign)(...resolverResultsets.reverse());
    return mapValues(mergedResultset, (rawResolvedObject, modulePath) => {
      return this.lookup(`${ type }:${ modulePath }`);
    });
  }

  /**
   * For a given type, returns the names of all the available modules under that
   * type. Primarily used for debugging purposes (i.e. to show available modules
   * when a lookup of that type fails).
   */
  availableForType(type: string): string[] {
    return Object.keys(this.lookupAll(type));
  }
}

/**
 * Take the supplied name which can come in several forms, and normalize it.
 */
export function parseName(name: string): ParsedName {
  let [ type, modulePath ] = name.split(':');
  return {
    fullName: name,
    type,
    modulePath,
    moduleName: camelCase(modulePath)
  };
}
