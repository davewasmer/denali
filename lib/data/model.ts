import * as assert from 'assert';
import * as createDebug from 'debug';
import { pluralize } from 'inflection';
import {
  kebabCase,
  startCase,
  lowerFirst } from 'lodash';
import DenaliObject from '../metal/object';
import ORMAdapter from './orm-adapter';
import { RelationshipDescriptor } from './descriptors';
import Container from '../metal/container';

const debug = createDebug('denali:model');

/**
 * List of private properties on the Denali model class itself. Used for
 * determining which properties should or shouldn't be returned by the proxy.
 */
const privateProps: String[] = [ 'record' ];

/**
 * The Model class is the core of Denali's unique approach to data and ORMs. It acts as a wrapper
 * and translation layer that provides a unified interface to access and manipulate data, but
 * translates those interactions into ORM specific operations via ORM adapters.
 *
 * Models are able to maintain their relatively clean interface thanks to the way the constructor
 * actually returns a Proxy which wraps the Model instance, rather than the Model instance directly.
 * This means you can directly get and set properties on your records, and the record (which is a
 * Proxy-wrapped Model) will translate and forward those calls to the underlying ORM adapter.
 *
 * @package data
 */
export default class Model extends DenaliObject {

  [key: string]: any;

  /**
   * The type of the Model class. This string is used as the container name for the model, as well
   * as in several other areas of Denali (i.e. serializers, ORM adapters, etc). Conventionally,
   * types are dasherized versions of the model name (i.e. the BlogPost model's type would be
   * `"blog-post"`).
   */
  static get type(): string {
    let name = this.name;
    if (name.endsWith('Model')) {
      name = name.slice(0, -('Model').length);
    }
    return kebabCase(name);
  }

  /**
   * Alias for this.constructor.type
   */
  get type(): string {
    return (<typeof Model>this.constructor).type;
  }

  /**
   * Marks the Model as an abstract base model, so ORM adapters can know not to create tables or
   * other supporting infrastructure.
   */
  static abstract = false;

  /**
   * Find a single record by it's id.
   */
  static async find(container: Container, id: any, options?: any): Promise<Model> {
    debug(`${ this.type } find: ${ id }`);
    assert(id != null, `You must pass an id to Model.find(id)`);
    let adapter = this.getAdapter(container);
    let result = await adapter.find(this.type, id, options);
    if (!result) {
      return null;
    }
    let Factory = container.factoryFor<Model>(`model:${ this.type }`);
    return Factory.create(container, result);
  }

  /**
   * Find all records of this type.
   */
  static async all(container: Container, options?: any): Promise<Model[]> {
    debug(`${ this.type } all`);
    let adapter = this.getAdapter(container);
    let result = await adapter.all(this.type, options);
    let Factory = container.factoryFor<Model>(`model:${ this.type }`);
    return result.map((record) => {
      return Factory.create(container, record);
    });
  }

  /**
   * Query for records of this type that match the given criteria. The format of the criteria is
   * determined by the ORM adapter used for this model.
   */
  static async query(container: Container, query: any, options?: any): Promise<Model[]> {
    debug(`${ this.type } query: ${ query }`);
    assert(query != null, `You must pass a query to Model.query(conditions)`);
    let adapter = this.getAdapter(container);
    let result = await adapter.query(this.type, query, options);
    let Factory = container.factoryFor<Model>(`model:${ this.type }`);
    return result.map((record) => {
      return Factory.create(container, record);
    });
  }

  /**
   * Find a single record that matches the given criteria. The format of the criteria is determined
   * by the ORM adapter used for this model.
   */
  static async queryOne(container: Container, query: any, options?: any): Promise<Model> {
    debug(`${ this.type } queryOne: ${ query }`);
    assert(query != null, `You must pass a query to Model.queryOne(conditions)`);
    let adapter = this.getAdapter(container);
    let record = await adapter.queryOne(this.type, query, options);
    if (record) {
      let Factory = container.factoryFor<Model>(`model:${ this.type }`);
      return Factory.create(container, record);
    }
    return null;
  }

  /**
   * The ORM adapter specific to this model type. Defaults to the application's ORM adapter if none
   * for this specific model type is found.
   *
   * @readonly
   */
  static getAdapter(container: Container): ORMAdapter {
    assert(container instanceof Container, `You must supply a container to lookup this model's adapter instead`);
    let adapter = container.lookup(`orm-adapter:${ this.type }`, { loose: true });
    if (!adapter) {
      adapter = container.lookup('orm-adapter:application', { loose: true });
    }
    assert(adapter, `No orm-adapter found for "${ this.type }", and no fallback "application" orm-adapter found either. Available adapters: ${ container.availableForType('orm-adapter') }`);
    return adapter;
  }

  /**
   * The ORM adapter specific to this model type. Defaults to the application's ORM adapter if none
   * for this specific model type is found.
   *
   * @readonly
   */
  get adapter(): ORMAdapter {
    return (<typeof Model>this.constructor).getAdapter(this.container);
  }

  /**
   * The id of the record
   */
  get id(): any {
    return this.adapter.idFor(this);
  }
  set id(value: any) {
    this.adapter.setId(this, value);
  }

  /**
   * The underlying ORM adapter record. An opaque value to Denali, handled entirely by the ORM
   * adapter.
   */
  record: any = null;

  /**
   * Creates an instance of Model.
   */
  constructor(container: Container, data: any = {}, options?: any) {
    super();
    assert(container instanceof Container, 'You must supply a container to new Model instances. If you are directly instantiating this Model instance, try using the db service instead');
    this.container = container;
    this.record = this.adapter.buildRecord(this.type, data, options);

    // tslint:disable:completed-docs
    return new Proxy(this, {

      get(model: Model, property: string): any {
        if (isAttribute(model, property)) {
          return model.adapter.getAttribute(model, property);
        }

        let relatedMethodParts = property.match(/^(get|set|add|remove)(\w+)/);
        if (relatedMethodParts) {
          let [ , operation, relationshipName ] = relatedMethodParts;
          relationshipName = lowerFirst(relationshipName);
          if (isRelationship(model, relationshipName)) {
            return model[`${ operation }Related`].bind(model, relationshipName);
          }
        }

        if (isModelProperty(model, property)) {
          return model[property];
        }

        return model.adapter.getAttribute(model, property);
      },

      set(model: Model, property: string, value: any): boolean {
        if (isAttribute(model, property)) {
          return model.adapter.setAttribute(model, property, value);
        }
        model[property] = value;
        return true;
      },

      deleteProperty(model: Model, property: string): boolean {
        if (isAttribute(model, property)) {
          return model.adapter.deleteAttribute(model, property);
        }
        return delete model[property];
      }

    });
    // tslint:enable:completed-docs
  }

  /**
   * Persist this model.
   */
  async save(options?: any): Promise<Model> {
    debug(`saving ${ this.type }`);
    await this.adapter.saveRecord(this, options);
    return this;
  }

  /**
   * Delete this model.
   */
  async delete(options?: any): Promise<void> {
    await this.adapter.deleteRecord(this, options);
  }

  /**
   * Returns the related record(s) for the given relationship.
   */
  async getRelated(relationshipName: string, query?: any, options?: any): Promise<Model|Model[]> {
    let descriptor = (<any>this.constructor)[relationshipName];
    assert(descriptor && descriptor.isRelationship, `You tried to fetch related ${ relationshipName }, but no such relationship exists on ${ this.type }`);
    if (descriptor.mode === 'hasOne') {
      options = query;
      query = null;
    }
    let results = await this.adapter.getRelated(this, relationshipName, descriptor, query, options);
    let RelatedModel = this.container.factoryFor<Model>(`model:${ descriptor.type }`);
    if (!Array.isArray(results)) {
      assert(descriptor.mode === 'hasOne', 'The ORM adapter returned an array for a hasOne relationship - it should return either the record or null');
      return results ? RelatedModel.create(this.container, results) : null;
    }
    return results.map((record) => RelatedModel.create(this.container, record));
  }

  /**
   * Replaces the related records for the given relationship with the supplied related records.
   */
  async setRelated(relationshipName: string, relatedModels: Model|Model[], options?: any): Promise<void> {
    let descriptor = (<any>this.constructor)[relationshipName];
    await this.adapter.setRelated(this, relationshipName, descriptor, relatedModels, options);
  }

  /**
   * Add a related record to a hasMany relationship.
   */
  async addRelated(relationshipName: string, relatedModel: Model, options?: any): Promise<void> {
    let descriptor = (<any>this.constructor)[pluralize(relationshipName)];
    await this.adapter.addRelated(this, relationshipName, descriptor, relatedModel, options);
  }

  /**
   * Remove the given record from the hasMany relationship
   */
  async removeRelated(relationshipName: string, relatedModel: Model, options?: any): Promise<void> {
    let descriptor = (<any>this.constructor)[pluralize(relationshipName)];
    await this.adapter.removeRelated(this, relationshipName, descriptor, relatedModel, options);
  }

  /**
   * Return an human-friendly string representing this Model instance, with a summary of it's
   * attributes
   */
  inspect(): string {
    let attributesSummary: string[] = this.mapAttributes((value, attributeName) => {
      return `${ attributeName }=${ JSON.stringify(value) }`;
    });
    return `<${ startCase(this.type) }:${ this.id == null ? '-new-' : this.id } ${ attributesSummary.join(', ') }>`;
  }

  /**
   * Return an human-friendly string representing this Model instance
   */
  toString(): string {
    return `<${ startCase(this.type) }:${ this.id == null ? '-new-' : this.id }>`;
  }

  /**
   * Call the supplied callback function for each attribute on this model, passing in the attribute
   * name and attribute instance.
   */
  mapAttributes<T>(fn: (value: any, attributeName: string) => T): T[] {
    let meta = this.container.metaFor(this.constructor);
    if (meta.attributesCache == null) {
      meta.attributesCache = [];
      let klass = <any>this.constructor;
      for (let key in klass) {
        if (klass[key] && klass[key].isAttribute) {
          meta.attributesCache.push(key);
        }
      }
    }
    return meta.attributesCache.map((attributeName: string) => {
      return fn((<any>this)[attributeName], attributeName);
    });
  }

  /**
   * Call the supplied callback function for each relationship on this model, passing in the
   * relationship name and relationship instance.
   */
  mapRelationships<T>(fn: (descriptor: RelationshipDescriptor, relationshipName: string) => T): T[] {
    let meta = this.container.metaFor(this.constructor);
    let klass = <any>this.constructor;
    if (meta.relationshipsCache == null) {
      meta.relationshipsCache = [];
      for (let key in klass) {
        if (klass[key] && klass[key].isRelationship) {
          meta.relationshipsCache.push(key);
        }
      }
    }
    return meta.relationshipsCache.map((relationshipName: string) => {
      return fn((<any>this)[relationshipName], relationshipName);
    });
  }

}

export function isAttribute(model: Model, property: string): boolean {
  let descriptor = (<any>model.constructor)[property];
  return descriptor && descriptor.isAttribute;
}

export function isRelationship(model: Model, property: string): boolean {
  let descriptor = (<any>model.constructor)[property] || (<any>model.constructor)[pluralize(property)];
  return descriptor && descriptor.isRelationship;
}

export function isModelProperty(model: Model, property: string): boolean {
  return model[property] !== undefined && !privateProps.includes(property);
}
