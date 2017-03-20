import {
  camelCase,
  upperFirst,
  omitBy
} from 'lodash';
import * as path from 'path';
import { parseName, ParsedName, ContainerOptions } from './container';
import * as tryRequire from 'try-require';
import requireDir from '../utils/require-dir';

interface RetrieveMethod {
  (parsedName: ParsedName): any;
}

export interface RetrieveAllMethod {
  (type: string): { [modulePath: string]: any };
}

export type Registry = Map<string, any>;

export default class Resolver {

  [key: string]: any;

  /**
   * The root directory for this resolver to start from when searching for files
   */
  root: string;

  /**
   * The internal cache of available references
   */
  private registry: Registry = new Map();

  constructor(root: string) {
    this.root = root;
  }

  /**
   * Manually add a member to this resolver. Manually registered members take precedence over any
   * retrieved from the filesystem.
   */
  public register(name: string, value: any) {
    this.registry.set(parseName(name).fullName, value);
  }

  /**
   * Fetch the member matching the given parsedName. First checks for any manually registered
   * members, then falls back to type specific retrieve methods that typically find the matching
   * file on the filesystem.
   */
  public retrieve(parsedName: ParsedName | string) {
    if (typeof parsedName === 'string') {
      parsedName = parseName(parsedName);
    }
    if (this.registry.has(parsedName.fullName)) {
      return this.registry.get(parsedName.fullName);
    }
    let retrieveMethod = <RetrieveMethod>this[`retrieve${ camelCase(upperFirst(parsedName.type)) }`];
    if (!retrieveMethod) {
      retrieveMethod = this.retrieveOther;
    }
    let result = retrieveMethod.call(this, parsedName);
    return result && result.default || result;
  }

  /**
   * Unknown types are assumed to exist underneath the `app/` folder
   */
  protected retrieveOther(parsedName: ParsedName) {
    return tryRequire(path.join(this.root, 'app', parsedName.type, parsedName.modulePath));
  }

  /**
   * App files are found in `app/*`
   */
  protected retrieveApp(parsedName: ParsedName) {
    return tryRequire(path.join(this.root, 'app', parsedName.modulePath));
  }

  /**
   * Config files are found in `config/`
   */
  protected retrieveConfig(parsedName: ParsedName) {
    return tryRequire(path.join(this.root, 'config', parsedName.modulePath));
  }

  /**
   * Initializer files are found in `config/initializers/`
   */
  protected retrieveInitializer(parsedName: ParsedName) {
    return tryRequire(path.join(this.root, 'config', 'initializers', parsedName.modulePath));
  }

  /**
   * Retrieve all the members for a given type. First checks for all manual registrations matching
   * that type, then retrieves all members for that type (typically from the filesystem).
   */
  public retrieveAll(type: string) {
    let manualRegistrations: { [modulePath: string]: any } = {};
    this.registry.forEach((entry, modulePath) => {
      if (parseName(modulePath).type === type) {
        manualRegistrations[modulePath] = entry;
      }
    });
    let retrieveMethod = <RetrieveAllMethod>this[`retrieve${ camelCase(upperFirst(type)) }`];
    if (!retrieveMethod) {
      retrieveMethod = this.retrieveAllOther;
    }
    let resolvedMembers = <{ [modulePath: string]: any }>retrieveMethod.call(this, type);
    return Object.assign(resolvedMembers, manualRegistrations);
  }

  /**
   * Unknown types are assumed to exist in the `app/` folder
   */
  protected retrieveAllOther(type: string) {
    return requireDir(path.join(this.root, 'app', type));
  }

  /**
   * App files are found in `app/*`
   */
  protected retrieveAllApp(parsedName: ParsedName) {
    return requireDir(path.join(this.root, 'app'), { recurse: false });
  }

  /**
   * Config files are found in the `config/` folder. Initializers are _not_ included in this group
   */
  protected retrieveAllConfig(type: string) {
    return omitBy(requireDir(path.join(this.root, 'config')), (mod, modulePath) => {
      return modulePath.startsWith('initializers');
    });
  }

  /**
   * Initializers files are found in the `config/initializers/` folder
   */
  protected retrieveAllInitializer(type: string) {
    return requireDir(path.join(this.root, 'config', 'initializers'));
  }

}