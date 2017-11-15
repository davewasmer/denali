import { camelCase, upperFirst, uniq, constant } from 'lodash';
import * as path from 'path';
import { pluralize } from 'inflection';
import * as assert from 'assert';
import * as createDebug from 'debug';
import Loader from '@denali-js/loader';

interface RetrieveMethod<T> {
  (type: string, entry: string): T;
}

export interface AvailableForTypeMethod {
  (type: string): string[];
}

export type Registry = Map<string, any>;

export default class Resolver {

  /**
   * The loader scope to retrieve from
   */
  loader: Loader;

  /**
   * The debug logger instance for this resolver - we create a separate
   * instance per resolver to make it easier to trace resolutions.
   */
  debug: any;

  /**
   * The name of this resolver - typically the addon name
   *
   * @since 0.1.0
   */
  name: string;

  /**
   * The internal cache of available references
   */
  protected registry: Registry = new Map();

  constructor(loader?: Loader) {
    assert(loader, 'You must supply a loader that the resolver should use to load from');
    this.name = loader.pkgName;
    this.debug = createDebug(`denali:resolver:${ this.name }`);
    this.loader = loader;
  }

  /**
   * Manually add a member to this resolver. Manually registered members take
   * precedence over any retrieved from the filesystem. This same pattern
   * exists at the container level, but having it here allows an addon to
   * specify a manual override _for it's own scope_, but not necessarily force
   * it onto the consuming application
   *
   * @since 0.1.0
   */
  register(specifier: string, value: any) {
    assert(specifier.includes(':'), 'Container specifiers must be in "type:entry" format');
    this.registry.set(specifier, value);
  }

  /**
   * Fetch the member matching the given parsedName. First checks for any
   * manually registered members, then falls back to type specific retrieve
   * methods that typically find the matching file on the filesystem.
   *
   * @since 0.1.0
   */
  retrieve<T>(specifier: string): T {
    assert(specifier.includes(':'), 'Container specifiers must be in "type:entry" format');
    this.debug(`retrieving ${ specifier }`);
    let [ type, entry ] = specifier.split(':');
    if (this.registry.has(specifier)) {
      this.debug(`cache hit, returning cached value`);
      return this.registry.get(specifier);
    }
    let retrieveMethod = <RetrieveMethod<T>>(<any>this)[`retrieve${ upperFirst(camelCase(type)) }`];
    if (!retrieveMethod) {
      retrieveMethod = <RetrieveMethod<T>>this.retrieveOther;
    }
    this.debug(`retrieving via retrieve${ upperFirst(camelCase(type)) }`);
    let result = retrieveMethod.call(this, type, entry);
    result = result && result.default || result;
    this.debug('retrieved %o', result);
    return result;
  }

  protected _retrieve(type: string, entry: string, relativepath: string) {
    this.debug(`attempting to retrieve ${ type }:${ entry } at ${ relativepath } from ${ this.name }`);
    return this.loader.loadRelative('/', relativepath, constant(false));
  }

  /**
   * Unknown types are assumed to exist underneath the `app/` folder
   */
  protected retrieveOther(type: string, entry: string) {
    return this._retrieve(type, entry, path.join('/app', pluralize(type), entry));
  }

  /**
   * App files are found in `app/*`
   */
  protected retrieveApp(type: string, entry: string) {
    return this._retrieve(type, entry, path.join('/app', entry));
  }

  /**
   * Config files are found in `config/`
   */
  protected retrieveConfig(type: string, entry: string) {
    return this._retrieve(type, entry, path.join('/config', entry));
  }

  /**
   * Initializer files are found in `config/initializers/`
   */
  protected retrieveInitializer(type: string, entry: string) {
    return this._retrieve(type, entry, path.join('/config', 'initializers', entry));
  }

  /**
   * Returns an array of entry names that are available from this resolver for
   * the given type.
   *
   * @since 0.1.0
   */
  availableForType(type: string) {
    let registeredForType: string[] = [];
    this.registry.forEach((entry, specifier) => {
      if (specifier.split(':')[0] === type) {
        registeredForType.push(specifier);
      }
    });
    let availableMethod = <AvailableForTypeMethod>(<any>this)[`availableFor${ upperFirst(camelCase(type)) }`];
    if (!availableMethod) {
      availableMethod = this.availableForOther;
    }
    let entries = <string[]>availableMethod.call(this, type);
    let resolvedEntries = entries.map((entry) => `${ type }:${ entry }`);
    return uniq(registeredForType.sort().concat(resolvedEntries.sort()));
  }

  protected _availableForType(prefix: string): string[] {
    let matchingFactories = Array.from(this.loader.factories.keys()).filter((moduleName) => {
      return moduleName.startsWith(prefix);
    });
    return matchingFactories.map((factoryPath) => factoryPath.substring(prefix.length + 1));
  }

  /**
   * Unknown types are assumed to exist in the `app/` folder
   */
  protected availableForOther(type: string) {
    return this._availableForType(path.join('/app', pluralize(type)));
  }

  /**
   * App files are found in `app/*`
   */
  protected availableForApp(type: string, entry: string) {
    return this._availableForType('/app');
  }

  /**
   * Config files are found in the `config/` folder. Initializers are _not_ included in this group
   */
  protected availableForConfig(type: string) {
    return this._availableForType('/config');
  }

  /**
   * Initializers files are found in the `config/initializers/` folder
   */
  protected availableForInitializer(type: string) {
    return this._availableForType(path.join('/config', 'initializers'));
  }

}
