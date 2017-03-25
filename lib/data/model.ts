import * as assert from 'assert';
import * as createDebug from 'debug';
import { pluralize } from 'inflection';
import {
  kebabCase,
  startCase,
  lowerFirst } from 'lodash';
import * as Bluebird from 'bluebird';
import DenaliObject from '../metal/object';
import ORMAdapter from './orm-adapter';
import Service from '../runtime/service';
import Container from '../metal/container';
import { RelationshipDescriptor } from './descriptors';

const debug = createDebug('denali:model');

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
   * An internal cache of all attributes defined on this model.
   */
  private static _attributesCache: string[] = null;

  /**
   * The type of the Model class. This string is used as the container name for the model, as well
   * as in several other areas of Denali (i.e. serializers, ORM adapters, etc). Conventionally,
   * types are dasherized versions of the model name (i.e. the BlogPost model's type would be
   * `"blog-post"`).
   *
   * @readonly
   */
  public static get type(): string {
    let name = this.name;
    if (name.endsWith('Model')) {
      name = name.slice(0, -('Model').length);
    }
    return kebabCase(name);
  }

  /**
   * Alias for this.constructor.type
   *
   * @readonly
   */
  public get type(): string {
    return (<typeof Model>this.constructor).type;
  }

  /**
   * Find a single record by it's id.
   */
  public static async find(id: any, options?: any): Promise<Model> {
    debug(`${ this.type } find: ${ id }`);
    assert(id != null, `You must pass an id to Model.find(id)`);
    let result = await this.adapter.find(this.type, id, options);
    return new this(result);
  }

  /**
   * Find all records of this type.
   */
  public static async all(options?: any): Promise<Model[]> {
    debug(`${ this.type } all`);
    let result = await this.adapter.all(this.type, options);
    return result.map((record) => {
      return new this(record);
    });
  }

  /**
   * Query for records of this type that match the given criteria. The format of the criteria is
   * determined by the ORM adapter used for this model.
   */
  public static async query(query: any, options?: any): Promise<Model[]> {
    debug(`${ this.type } query: ${ query }`);
    assert(query != null, `You must pass a query to Model.query(conditions)`);
    let result = await this.adapter.query(this.type, query, options);
    return result.map((record) => {
      return new this(record);
    });
  }

  /**
   * Find a single record that matches the given criteria. The format of the criteria is determined
   * by the ORM adapter used for this model.
   */
  public static async findOne(query: any, options?: any): Promise<Model> {
    debug(`${ this.type } findOne: ${ query }`);
    assert(query != null, `You must pass a query to Model.findOne(conditions)`);
    let record = await this.adapter.findOne(this.type, query, options);
    if (record) {
      return new this(record);
    }
    return null;
  }

  /**
   * Create a new record and immediately persist it.
   */
  public static async create(data: any, options?: any): Promise<Model> {
    debug(`creating ${ this.type }`);
    let instance = new this({}, options);
    // We do this here, rather than in buildRecord, in case some of the data supplied isn't an
    // actual attribute (which means it will get set on the wrapper proxy this way).
    Object.assign(instance, data);
    return await instance.save();
  }

  /**
   * Marks the Model as an abstract base model, so ORM adapters can know not to create tables or
   * other supporting infrastructure.
   */
  public static abstract = false;

  /**
   * The ORM adapter specific to this model type. Defaults to the application's ORM adapter if none
   * for this specific model type is found.
   *
   * @readonly
   */
  public static get adapter(): ORMAdapter {
    let adapter = this.container.lookup(`orm-adapter:${ this.type }`);
    assert(adapter, `No adapter found for ${ this.type }! Available adapters: ${ this.container.availableForType('orm-adapter') }`);
    return adapter;
  }

  /**
   * The ORM adapter specific to this model type. Defaults to the application's ORM adapter if none
   * for this specific model type is found.
   *
   * @readonly
   */
  public get adapter(): ORMAdapter {
    return (<typeof Model>this.constructor).adapter;
  }

  /**
   * The id of the record
   */
  public get id(): any {
    return this.adapter.idFor(this);
  }
  public set id(value: any) {
    this.adapter.setId(this, value);
  }

  /**
   * The underlying ORM adapter record. An opaque value to Denali, handled entirely by the ORM
   * adapter.
   */
  public record: any = null;

  /**
   * Creates an instance of Model.
   */
  constructor(data: any = {}, options?: any) {
    super();
    this.record = this.adapter.buildRecord(this.type, data, options);

    // tslint:disable:completed-docs
    return new Proxy(this, {

      get(model: Model, property: string): any {
        if (typeof property === 'string') {
          // Return the attribute value if that's what is requested
          let descriptor = (<any>model.constructor)[property];
          if (descriptor && descriptor.isAttribute) {
            return model.adapter.getAttribute(model, property);
          }
          // Forward relationship related methods to their generic counterparts
          let relatedMethodParts = property.match(/^(get|set|add|remove)(\w+)/);
          if (relatedMethodParts) {
            let [ , operation, relationshipName ] = relatedMethodParts;
            relationshipName = lowerFirst(relationshipName);
            descriptor = (<any>model.constructor)[relationshipName] || (<any>model.constructor)[pluralize(relationshipName)];
            if (descriptor && descriptor.isRelationship) {
              return model[`${ operation }Related`].bind(model, relationshipName, descriptor);
            }
          }
        }
        // It's not an attribute or a relationship method, so let the model respond normally
        return model[property];
      },

      set(model: Model, property: string, value: any): boolean {
        // Set attribute values
        let descriptor = (<any>model.constructor)[property];
        if (descriptor && descriptor.isAttribute) {
          return model.adapter.setAttribute(model, property, value);
        }
        // Otherwise just set the model property directly
        model[property] = value;
        return true;
      },

      deleteProperty(model: Model, property: string): boolean {
        // Delete the attribute
        let descriptor = (<any>model.constructor)[property];
        if (descriptor && descriptor.isAttribute) {
          return model.adapter.deleteAttribute(model, property);
        }
        // Otherwise just delete the model property directly
        return delete model[property];
      }

    });
    // tslint:enable:completed-docs
  }

  /**
   * Persist this model.
   */
  public async save(options?: any): Promise<Model> {
    debug(`saving ${ this.type }`);
    await this.adapter.saveRecord(this, options);
    return this;
  }

  /**
   * Delete this model.
   */
  public async delete(options?: any): Promise<void> {
    await this.adapter.deleteRecord(this, options);
  }

  /**
   * Returns the related record(s) for the given relationship.
   */
  public async getRelated(relationshipName: string, query?: any, options?: any): Promise<Model|Model[]> {
    let descriptor = (<any>this.constructor)[relationshipName] || (<any>this.constructor)[pluralize(relationshipName)];
    assert(descriptor && descriptor.isRelationship, `You tried to fetch related ${ relationshipName }, but no such relationship exists on ${ this.type }`);
    if (descriptor.mode === 'hasOne') {
      options = query;
      query = null;
    }
    let results = await this.adapter.getRelated(this, relationshipName, descriptor, query, options);
    let RelatedModel = this.modelFor(descriptor.type);
    if (!Array.isArray(results)) {
      assert(descriptor.mode === 'hasOne', 'The ORM adapter returned an array for a hasOne relationship - it should return either the record or null');
      return results ? new RelatedModel(results) : null;
    }
    return results.map((record) => new RelatedModel(record));
  }

  /**
   * Replaces the related records for the given relationship with the supplied related records.
   */
  public async setRelated(relationshipName: string, relatedModels: Model|Model[], options?: any): Promise<void> {
    let descriptor = (<any>this.constructor)[relationshipName] || (<any>this.constructor)[pluralize(relationshipName)];
    await this.adapter.setRelated(this, relationshipName, descriptor, relatedModels, options);
  }

  /**
   * Add a related record to a hasMany relationship.
   */
  public async addRelated(relationshipName: string, relatedModel: Model, options?: any): Promise<void> {
    let descriptor = (<any>this.constructor)[relationshipName] || (<any>this.constructor)[pluralize(relationshipName)];
    await this.adapter.addRelated(this, relationshipName, descriptor, relatedModel, options);
  }

  /**
   * Remove the given record from the hasMany relationship
   */
  public async removeRelated(relationshipName: string, relatedModel: Model, options?: any): Promise<void> {
    let descriptor = (<any>this.constructor)[relationshipName] || (<any>this.constructor)[pluralize(relationshipName)];
    await this.adapter.removeRelated(this, relationshipName, descriptor, relatedModel, options);
  }

  /**
   * Call the supplied callback function for each attribute on this model, passing in the attribute
   * name and attribute instance.
   */
  public static eachAttribute<T>(fn: (attributeName: string, value: any) => T): T[] {
    if (!this.hasOwnProperty('_attributesCache') || this._attributesCache == null) {
      this._attributesCache = [];
      for (let key in this) {
        if ((<any>this)[key] && (<any>this)[key].isAttribute) {
          this._attributesCache.push(key);
        }
      }
    }
    return this._attributesCache.map((attributeName) => {
      return fn(attributeName, (<any>this)[attributeName]);
    });
  }

  /**
   * A list of relationships found on this model, so we can avoid iterating over all static
   * properties every time.
   */
  private static _relationshipsCache: string[];

  /**
   * Call the supplied callback function for each relationship on this model, passing in the
   * relationship name and relationship instance.
   */
  public static eachRelationship<T>(fn: (relationshipName: string, descriptor: RelationshipDescriptor) => T): T[] {
    if (!this.hasOwnProperty('_relationshipsCache') || this._relationshipsCache == null) {
      this._relationshipsCache = [];
      for (let key in this) {
        if ((<any>this)[key] && (<any>this)[key].isRelationship) {
          this._relationshipsCache.push(key);
        }
      }
    }
    return this._relationshipsCache.map((relationshipName) => {
      return fn(relationshipName, (<any>this)[relationshipName]);
    });
  }

  /**
   * Lookup a model class by type.
   */
  public modelFor(type: string): typeof Model {
    return this.container.lookup(`model:${ type }`);
  }

  /**
   * Lookup a model class by type.
   */
  public static modelFor(type: string): Model {
    return this.container.lookup(`model:${ type }`);
  }

  /**
   * Lookup a service by type
   */
  public service(type: string): Service {
    return this.container.lookup(`service:${ type }`);
  }

  /**
   * Lookup a service by type
   */
  public static service(type: string): Service {
    return this.container.lookup(`service:${ type }`);
  }

  /**
   * Return an human-friendly string representing this Model instance, with a summary of it's
   * attributes
   */
  public inspect(): string {
    let attributesSummary: string[] = (<typeof Model>this.constructor).eachAttribute((attr) => {
      return `${ attr }=${ JSON.stringify(this[attr]) }`;
    });
    return `<${ startCase(this.type) }:${ this.id == null ? '-new-' : this.id } ${ attributesSummary.join(', ') }>`;
  }

  /**
   * Return an human-friendly string representing this Model instance
   */
  public toString(): string {
    return `<${ startCase(this.type) }:${ this.id == null ? '-new-' : this.id }>`;
  }

}
