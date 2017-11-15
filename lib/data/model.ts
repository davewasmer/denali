import * as assert from 'assert';
import * as util from 'util';
import * as createDebug from 'debug';
import { pluralize, singularize } from 'inflection';
import { forEach, startCase, kebabCase, upperFirst } from 'lodash';
import DenaliObject from '../metal/object';
import { lookup } from '../metal/container';
import ORMAdapter from './orm-adapter';
import { AttributeDescriptor, HasOneRelationshipDescriptor, HasManyRelationshipDescriptor, Descriptor, RelationshipDescriptor } from './descriptors';

const debug = createDebug('denali:model');

const augmentedWithAccessors = Symbol();

export interface ModelSchema {
  [field: string]: AttributeDescriptor | HasOneRelationshipDescriptor | HasManyRelationshipDescriptor;
}

/**
 * The Model class is the core of Denali's unique approach to data and ORMs. It
 * acts as a wrapper and translation layer that provides a unified interface to
 * access and manipulate data, but translates those interactions into ORM
 * specific operations via ORM adapters.
 *
 * The primary purpose of having Models in Denali is to allow Denali addons to
 * access a common interface for manipulating data. Importantly, the goal is
 * **not** to let you swap different ORMs / databases with little effort. Don't
 * be surprised if you find your app littered with ORM specific code - that is
 * expected and even encouraged. For more on this concept, check out the Denali
 * blog.
 *
 * TODO: link to blog post on ^
 *
 * @package data
 * @since 0.1.0
 */
export default class Model extends DenaliObject {

  /**
   * Marks the Model as an abstract base model, so ORM adapters can know not to
   * create tables or other supporting infrastructure.
   *
   * @since 0.1.0
   */
  static abstract = false;

  /**
   * The schema definition for this model. Keys are the field names, and values
   * should be either `attr(...)', `hasOne(...)`, or `hasMany(...)`
   */
  static schema: ModelSchema = {};

  private static _augmentWithSchemaAccessors() {
    if (this.prototype[augmentedWithAccessors]) {
      return;
    }
    this.prototype[augmentedWithAccessors] = true;
    forEach(this, (descriptor, name) => {
      if (!(descriptor instanceof Descriptor)) {
        return;
      }

      if ((<any>descriptor).isAttribute) {
        Object.defineProperty(this.prototype, name, {
          configurable: true,
          get() {
            return (<typeof Model>this.constructor).adapter.getAttribute(this, name);
          },
          set(newValue) {
            return (<typeof Model>this.constructor).adapter.setAttribute(this, name, newValue);
          }
        });

      } else {

        // author => "Author"
        let methodRoot = upperFirst(name);
        // getAuthor(options?)
        Object.defineProperty(this.prototype, `get${methodRoot}`, {
          configurable: true,
          value(options?: any) { return (<Model>this).getRelated(name, options); }
        });
        // setAuthor(comments, options?)
        Object.defineProperty(this.prototype, `set${methodRoot}`, {
          configurable: true,
          value(relatedModels: Model | Model[], options?: any) {
            return (<Model>this).setRelated(name, relatedModels, options);
          }
        });

        if ((<any>descriptor).mode === 'hasMany') {
          let singularRoot = singularize(methodRoot);
          // addComment(comment, options?)
          Object.defineProperty(this.prototype, `add${singularRoot}`, {
            configurable: true,
            value(relatedModel: Model, options?: any) {
              return (<Model>this).addRelated(name, relatedModel, options);
            }
          });
          // removeComment(comment, options?)
          Object.defineProperty(this.prototype, `remove${singularRoot}`, {
            configurable: true,
            value(relatedModel: Model, options?: any) {
              return (<Model>this).removeRelated(name, relatedModel, options);
            }
          });
        }

      }
    });
  }

  /**
   * Builds a new Model instance from an already existing ORM record reference
   *
   * @param record The ORM adapter record object
   */
  static build(record: any) {
    let model = new this();
    model.record = record;
    return model;
  }

  /**
   * Retrieve a single record by it's id
   *
   * @param id The id of the record you want to lookup
   * @param options Options passed through to the ORM adapter
   * @since 0.1.0
   */
  static async find(id: any, options?: any): Promise<Model|null> {
    assert(id != null, `You must pass an id to Model.find(id)`);
    debug(`${ this.modelName } find: ${ id }`);
    let record = await this.adapter.find(this.modelName, id, options);
    if (!record) {
      return null;
    }
    return this.build(record);
  }

  /**
   * Retrieve the first record matching the given query
   *
   * @param query The query to pass through to the ORM adapter
   * @param options An options object passed through to the ORM adapter
   * @since 0.1.0
   */
  static async queryOne(query: any, options?: any): Promise<Model|null> {
    assert(query != null, `You must pass a query to Model.queryOne(conditions)`);
    debug(`${ this.modelName } queryOne: ${ util.inspect(query) }`);
    let record = await this.adapter.queryOne(this.modelName, query, options);
    if (!record) {
      return null;
    }
    return this.build(record);
  }

  /**
   * Fetch all records matching the given query
   *
   * @param query The query to pass through to the ORM adapter
   * @param options An options object passed through to the ORM adapter
   * @since 0.1.0
   */
  static async query(query: any, options?: any): Promise<Model[]> {
    assert(query != null, `You must pass a query to Model.query(conditions)`);
    debug(`${ this.modelName } query: ${ util.inspect(query) }`);
    let records = await this.adapter.query(this.modelName, query, options);
    return records.map((record) => this.build(record));
  }

  /**
   * Fetch all records of this type
   *
   * @param options An options object passed through to the ORM adapter
   * @since 0.1.0
   */
  static async all(options?: any): Promise<Model[]> {
    debug(`${ this.modelName } all`);
    let result = await this.adapter.all(this.modelName, options);
    return result.map((record) => this.build(record));
  }

  /**
   * Create a new Model instance with the supplied data, and immediately
   * persist it
   *
   * @param data Data to populate the new Model instance with
   * @param options An options object passed through to the ORM adapter
   * @since 0.1.0
   */
  static async create(data: any = {}, options?: any): Promise<Model> {
    let model = new this(data, options);
    return model.save();
  }

  /**
   * The ORM adapter specific to this model type. Defaults to the application's
   * ORM adapter if none for this specific model type is found.
   *
   * @since 0.1.0
   */
  static get adapter(): ORMAdapter {
    return lookup<ORMAdapter>(`orm-adapter:${ this.modelName }`);
  }

  /**
   * The name of this Model type. Used in a variety of use cases, including
   * serialization.
   *
   * @since 0.1.0
   */
  static get modelName(): string {
    let name = this.name;
    if (name.endsWith('Model')) {
      name = name.substring(0, name.length - 'Model'.length);
    }
    name = kebabCase(name);
    return name;
  }

  [key: string]: any;

  /**
   * The underlying ORM adapter record. An opaque value to Denali, handled
   * entirely by the ORM adapter.
   *
   * @since 0.1.0
   */
  record: any = null;

  /**
   * The name of this Model type. Used in a variety of use cases, including
   * serialization.
   *
   * @since 0.1.0
   */
  get modelName(): string {
    return (<typeof Model>this.constructor).modelName;
  }

  /**
   * The id of the record
   *
   * @since 0.1.0
   */
  get id(): any {
    return (<typeof Model>this.constructor).adapter.idFor(this);
  }
  set id(value: any) {
    (<typeof Model>this.constructor).adapter.setId(this, value);
  }

  /**
   * Tell the underlying ORM to build this record
   */
  constructor(data?: any, options?: any) {
    super(...arguments);
    (<typeof Model>this.constructor)._augmentWithSchemaAccessors();
    this.record = (<typeof Model>this.constructor).adapter.buildRecord(this.modelName, data, options);
  }

  /**
   * Persist this model.
   *
   * @since 0.1.0
   */
  async save(options?: any): Promise<Model> {
    debug(`saving ${ this.toString()}`);
    await (<typeof Model>this.constructor).adapter.saveRecord(this, options);
    return this;
  }

  /**
   * Delete this model.
   *
   * @since 0.1.0
   */
  async delete(options?: any): Promise<void> {
    debug(`deleting ${ this.toString() }`);
    await (<typeof Model>this.constructor).adapter.deleteRecord(this, options);
  }

  /**
   * Returns the related record(s) for the given relationship.
   *
   * @since 0.1.0
   */
  async getRelated(relationshipName: string, options?: any): Promise<Model|Model[]> {
    let descriptor: RelationshipDescriptor = (<any>this.constructor)[relationshipName];
    assert(descriptor && descriptor.isRelationship, `You tried to fetch related ${ relationshipName }, but no such relationship exists on ${ this.modelName }`);
    let RelatedModel = lookup<typeof Model>(`model:${ descriptor.relatedModelName }`);
    let results = await (<typeof Model>this.constructor).adapter.getRelated(this, relationshipName, descriptor, options);
    if (descriptor.mode === 'hasOne') {
      assert(!Array.isArray(results), `The ${ this.modelName } ORM adapter returned an array for the hasOne '${ relationshipName }' relationship - it should return either an ORM record or null.`);
      return results ? RelatedModel.create(results) : null;
    }
    assert(Array.isArray(results), `The ${ this.modelName } ORM adapter did not return an array for the hasMany '${ relationshipName }' relationship - it should return an array (empty if no related records exist).`);
    return results.map((record: any) => RelatedModel.build(record));
  }

  /**
   * Replaces the related records for the given relationship with the supplied
   * related records.
   *
   * @since 0.1.0
   */
  async setRelated(relationshipName: string, relatedModels: Model|Model[], options?: any): Promise<void> {
    let descriptor = (<any>this.constructor)[relationshipName];
    await (<typeof Model>this.constructor).adapter.setRelated(this, relationshipName, descriptor, relatedModels, options);
  }

  /**
   * Add a related record to a hasMany relationship.
   *
   * @since 0.1.0
   */
  async addRelated(relationshipName: string, relatedModel: Model, options?: any): Promise<void> {
    let descriptor = (<any>this.constructor)[pluralize(relationshipName)];
    await (<typeof Model>this.constructor).adapter.addRelated(this, relationshipName, descriptor, relatedModel, options);
  }

  /**
   * Remove the given record from the hasMany relationship
   *
   * @since 0.1.0
   */
  async removeRelated(relationshipName: string, relatedModel: Model, options?: any): Promise<void> {
    let descriptor = (<any>this.constructor)[pluralize(relationshipName)];
    await (<typeof Model>this.constructor).adapter.removeRelated(this, relationshipName, descriptor, relatedModel, options);
  }

  /**
   * Return an human-friendly string representing this Model instance, with a
   * summary of it's attributes
   *
   * @since 0.1.0
   */
  inspect(): string {
    let attributesSummary: string[] = [];
    forEach((<typeof Model>this.constructor).schema, (descriptor, name) => {
      attributesSummary.push(`${ name }=${ util.inspect(this[name]) }`);
    });
    return `<${ startCase(this.modelName) }:${ this.id == null ? '-new-' : this.id } ${ attributesSummary.join(', ') }>`;
  }

  /**
   * Return an human-friendly string representing this Model instance
   *
   * @since 0.1.0
   */
  toString(): string {
    return `<${ startCase(this.modelName) }:${ this.id == null ? '-new-' : this.id }>`;
  }
}
