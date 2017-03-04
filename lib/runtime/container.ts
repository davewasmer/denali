import {
  findKey,
  upperFirst,
  camelCase,
  keys,
  merge
} from 'lodash';
import DenaliObject from '../metal/object';
import Logger from './logger';
import Model from '../data/model';
import Serializer from '../data/serializer';
import OrmAdapter from '../data/orm-adapter';
import Service from './service';

interface ParsedName {
  fullName: string;
  type: string;
  modulePath: string;
  moduleName: string;
}

interface FallbackGetter {
  (): string;
}

interface LookupOptions {
  containerize?: boolean;
  singleton?: boolean;
  fallback?: string | FallbackGetter;
  original?: ParsedName;
}

interface ModuleRegistry {
  [moduleName: string]: any;
}

type Constructor<T> = new(...args: any[]) => T;

/**
 * The Container houses all the various classes that makeup a Denali app's
 *
 * runtime. It holds references to the modules themselves, as well as managing lookup logic (i.e.
 * some types of classes fall back to a generic "application" class if a more specific one is not
 * found.
 *
 * @package runtime
 */
export default class Container extends DenaliObject {

  /**
   * An internal cache of lookups and their resolved values
   */
  private _cache: ModuleRegistry = {};

  /**
   * The internal cache of available references
   */
  private _registry: ModuleRegistry = {};

  /**
   * A reference to the application config
   */
  public get config(): any {
    return this.lookup('config:environment');
  }

  /**
   * A reference to the application logger
   */
  public get logger(): Logger {
    return this.lookup('logger:main');
  }

  /**
   * Register a value under the given `fullName` for later use.
   */
  public register(name: string, value: any): void {
    let parsedName = this.parseName(name);
    this._registry[parsedName.fullName] = value;
  }

  /**
   * Lookup a value in the container. Uses type specific lookup logic if available.
   */
  public lookup(name: string): any {
    let parsedName = this.parseName(name);
    let lookupMethod = this[`lookup${ upperFirst(camelCase(parsedName.type)) }`] || this._lookupOther;
    return lookupMethod.call(this, parsedName);
  }

  [key: string]: any;

  /**
   * Lookup all modules of a specific type in the container. Returns an object of all the modules
   * keyed by their module path (i.e. `role:employees/manager` would be found under
   * `lookupAll('role')['employees/manager']`
   */
  public lookupAll(type: string): { [moduleName: string]: any } {
    return keys(this._registry).filter((fullName) => {
      return this.parseName(fullName).type === type;
    }).reduce((typeMap: ModuleRegistry, fullName) => {
      typeMap[this.parseName(fullName).modulePath] = this.lookup(fullName);
      return typeMap;
    }, {});
  }

  /**
   * The base lookup method that most other lookup methods delegate to. Attempts to lookup a cached
   * resolution for the parsedName provided. If none is found, performs the lookup and caches it
   * for future retrieval
   */
  private _lookupOther(parsedName: ParsedName, options: LookupOptions = { containerize: false, singleton: false }) {
    // Cache all this containerization / singleton instantiation, etc
    if (!this._cache[parsedName.fullName]) {
      let Class = this._registry[parsedName.fullName];

      // If lookup succeeded, handle any first-time lookup chores
      if (Class) {
        if (Class.containerize || options.containerize) {
          Class.container = this;
          Class.prototype.container = this;
        }
        if (Class.singleton || options.singleton) {
          Class = new Class();
        }

      // If the lookup failed, allow for a fallback
      } else if (options.fallback) {
        let fallback = result(options.fallback);
        let fallbackOptions = merge(options, {
          fallback: null,
          original: parsedName
        });
        Class = this._lookupOther(this.parseName(fallback), fallbackOptions);

      // If the lookup and fallback failed, bail
      } else {
        let message = `No such ${ parsedName.type } found: '${ parsedName.moduleName }'`;
        if (options.original) {
          message += `. Fallback lookup '${ options.original.fullName }' was also not found.`;
        }
        message += `\nAvailable "${ parsedName.type }" container entries:\n`;
        message += Object.keys(this.lookupAll(parsedName.type));
        throw new Error(message);
      }

      // Update the cache with either the successful lookup, or the fallback
      this._cache[parsedName.fullName] = Class;
    }
    return this._cache[parsedName.fullName];
  }

  /**
   * Lookup an ORM adapter. If not found, falls back to the application ORM adapter as determined
   * by the `ormAdapter` config property.
   */
  private lookupOrmAdapter(parsedName: ParsedName): OrmAdapter {
    return this._lookupOther(parsedName, {
      fallback: () => {
        if (!this.config.ormAdapter) {
          throw new Error('No default ORM adapter was defined in supplied in config.ormAdapter!');
        }
        return `orm-adapter:${ this.config.ormAdapter }`;
      }
    });
  }

  /**
   * Lookup a serializer. Falls back to the application serializer if not found.
   */
  private lookupSerializer(parsedName: ParsedName): Serializer {
    return this._lookupOther(parsedName, {
      fallback: 'serializer:application'
    });
  }

  /**
   * Take the supplied name which can come in several forms, and normalize it.
   */
  private parseName(name: string): ParsedName {
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

  /**
   * For a given type, returns the names of all the available modules under that
   * type. Primarily used for debugging purposes (i.e. to show available modules
   * when a lookup of that type fails).
   */
  availableForType(type: string): string[] {
    return Object.keys(this._registry).filter((key) => {
      return key.split(':')[0] === type;
    }).map((key) => {
      return key.split(':')[1];
    });
  }
}


/**
 * If the value is a function, execute it and return the value, otherwise, return the value itself.
 */
function result(value: any): any {
  if (typeof value === 'function') {
    return value();
  }
  return value;
}
