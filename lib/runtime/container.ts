import {
  camelCase,
  forOwn,
  isObject,
  forEach,
  defaults
} from 'lodash';
import * as dedent from 'dedent-js';
import { Dict } from '../utils/types';
import DenaliObject from '../metal/object';
import Resolver from './resolver';
import { assign, mapValues } from 'lodash';

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
  singleton: true
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

  constructor(options: { resolver?: Resolver } = {}) {
    super();
    this.resolvers.push(options.resolver || new Resolver(process.cwd()));
    this.registerOptions('action', { singleton: false });
  }

  /**
   * An internal cache of lookups and their resolved values
   */
  private lookups: Map<string, any> = new Map();

  /**
   * Options for entries in this container. Keyed on the parsedName.fullName, each entry supplies
   * metadata for how the container entry should be treated.
   */
  private options: Map<string, ContainerOptions> = new Map();

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
  private memberOptions: Map<string, ContainerOptions> = new Map();

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
  public optionFor(name: string, option: keyof ContainerOptions): any {
    let { fullName } = parseName(name);
    let options = this.memberOptions.get(fullName) || {};
    return defaults(options, DEFAULT_CONTAINER_OPTIONS)[option];
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
      let object;
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
        throw new Error(dedent`
          No such ${ parsedName.type } found: '${ parsedName.moduleName }'
          Available "${ parsedName.type }" container entries:
          ${ Object.keys(this.lookupAll(parsedName.type)) }
        `);
      }

      // Create a clone of the object so that we won't share a reference with other containers.
      // This is important for tests especially - since our test runner (ava) runs tests from the
      // same file concurrently, each test's container would end up using the same underlying
      // object (since Node's require caches modules), so mutations to the object in one test would
      // change it for all others. So we need to clone the object so our container gets a unique
      // in-memory object to work with.
      object = this.createLocalClone(object);

      // Inject container references
      if (this.optionFor(parsedName.fullName, 'containerize')) {
        object.container = this;
        if (object.prototype) {
          object.prototype.container = this;
        }
      }

      if (this.optionFor(parsedName.fullName, 'singleton')) {
        object = new object();
      }

      this.lookups.set(parsedName.fullName, object);
    }

    return this.lookups.get(parsedName.fullName);
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
   * Create a local clone of a container entry, which is what will be cached / handed back to the
   * consuming application. This avoids any cross-contamination between multiple containers due to
   * Node require's caching behavior.
   */
  private createLocalClone(object: any) {
    // For most types in JavaScript, cloning is simple. But functions are weird - you can't simply
    // clone them, since the clone would not be callable. You need to create a wrapper function that
    // invokes the original. Plus, in case the function is actually a class constructor, you need to
    // clone the prototype as well. One shortcoming here is that the produced function doesn't have
    // the correct arity.
    if (typeof object === 'function') {
      let original = object;
      function Containerized() {
        return original.apply(this, arguments);
      }
      Containerized.prototype = Object.assign(Object.create(Object.getPrototypeOf(original.prototype)), original.prototype);
      return Containerized;
    // Just return primitive values - passing through the function effectively clones them
    } else if (!isObject(object)) {
      return object;
    // For objects, create a new object that shares our source object's prototype. Then copy over
    // all the owned properties. From the outside, the result should be an identical object.
    } else {
      return Object.assign(Object.create(Object.getPrototypeOf(object)), object);
    }
  }

  /**
   * For a given type, returns the names of all the available modules under that
   * type. Primarily used for debugging purposes (i.e. to show available modules
   * when a lookup of that type fails).
   */
  availableForType(type: string): string[] {
    return this.lookupAll(type).keys();
  }
}

/**
 * Take the supplied name which can come in several forms, and normalize it.
 */
export function parseName(name: string): ParsedName {
  let [ type, modulePath ] = name.split(':');
  if (modulePath === undefined || modulePath === 'undefined') {
    throw new Error(`You tried to look up a ${ type } called undefined - did you pass in a variable that doesn't have the expected value?`);
  }
  return {
    fullName: name,
    type,
    modulePath,
    moduleName: camelCase(modulePath)
  };
}
