import {
  camelCase,
  upperFirst,
  omitBy
} from 'lodash';
import * as path from 'path';
import * as fs from 'fs';
import { parseSpecifier, ParsedSpecifier, ContainerOptions } from './container';
import * as tryRequire from 'try-require';
import { pluralize } from 'inflection';
import requireDir from '../utils/require-dir';

interface RetrieveMethod {
  (parsedName: ParsedSpecifier): any;
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
    this.registry.set(parseSpecifier(name).fullName, value);
  }

  /**
   * Fetch the member matching the given parsedName. First checks for any manually registered
   * members, then falls back to type specific retrieve methods that typically find the matching
   * file on the filesystem.
   */
  public retrieve(parsedSpecifier: ParsedSpecifier | string) {
    if (typeof parsedSpecifier === 'string') {
      parsedSpecifier = parseSpecifier(parsedSpecifier);
    }
    if (this.registry.has(parsedSpecifier.fullName)) {
      return this.registry.get(parsedSpecifier.fullName);
    }
    let retrieveMethod = <RetrieveMethod>this[`retrieve${ upperFirst(camelCase(parsedSpecifier.type)) }`];
    if (!retrieveMethod) {
      retrieveMethod = this.retrieveOther;
    }
    let result = retrieveMethod.call(this, parsedSpecifier);
    return result && result.default || result;
  }

  /**
   * Unknown types are assumed to exist underneath the `app/` folder
   */
  protected retrieveOther(parsedName: ParsedSpecifier) {
    return tryRequire(path.join(this.root, 'app', pluralize(parsedName.type), parsedName.modulePath));
  }

  /**
   * App files are found in `app/*`
   */
  protected retrieveApp(parsedName: ParsedSpecifier) {
    return tryRequire(path.join(this.root, 'app', parsedName.modulePath));
  }

  /**
   * Config files are found in `config/`
   */
  protected retrieveConfig(parsedName: ParsedSpecifier) {
    return tryRequire(path.join(this.root, 'config', parsedName.modulePath));
  }

  /**
   * Initializer files are found in `config/initializers/`
   */
  protected retrieveInitializer(parsedName: ParsedSpecifier) {
    return tryRequire(path.join(this.root, 'config', 'initializers', parsedName.modulePath));
  }

  /**
   * Retrieve all the members for a given type. First checks for all manual registrations matching
   * that type, then retrieves all members for that type (typically from the filesystem).
   */
  public retrieveAll(type: string) {
    let manualRegistrations: { [modulePath: string]: any } = {};
    this.registry.forEach((entry, fullName) => {
      let parsedName = parseSpecifier(fullName);
      if (parsedName.type === type) {
        manualRegistrations[parsedName.modulePath] = entry;
      }
    });
    let retrieveMethod = <RetrieveAllMethod>this[`retrieveAll${ upperFirst(camelCase(type)) }`];
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
    let typeDir = path.join(this.root, 'app', pluralize(type));
    if (fs.existsSync(typeDir)) {
      return requireDir(typeDir);
    }
    return {};
  }

  /**
   * App files are found in `app/*`
   */
  protected retrieveAllApp(parsedName: ParsedSpecifier) {
    let appDir = path.join(this.root, 'app');
    if (fs.existsSync(appDir)) {
      return requireDir(appDir, { recurse: false });
    }
    return {};
  }

  /**
   * Config files are found in the `config/` folder. Initializers are _not_ included in this group
   */
  protected retrieveAllConfig(type: string) {
    let configDir = path.join(this.root, 'config');
    if (fs.existsSync(configDir)) {
      return omitBy(requireDir(configDir), (mod, modulePath) => {
        return modulePath.startsWith('initializers');
      });
    }
    return {};
  }

  /**
   * Initializers files are found in the `config/initializers/` folder
   */
  protected retrieveAllInitializer(type: string) {
    let initializersDir = path.join(this.root, 'config', 'initializers');
    if (fs.existsSync(initializersDir)) {
      return requireDir(initializersDir);
    }
    return {};
  }

}