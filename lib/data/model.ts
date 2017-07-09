import * as assert from 'assert';
import * as createDebug from 'debug';
import { pluralize, singularize } from 'inflection';
import { startCase, upperFirst } from 'lodash';
import DenaliObject from '../metal/object';
import Container, { onLoad } from '../metal/container';
import ORMAdapter from './orm-adapter';
import { RelationshipDescriptor, AttributeDescriptor } from './descriptors';

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

  /**
   * Marks the Model as an abstract base model, so ORM adapters can know not to create tables or
   * other supporting infrastructure.
   */
  static abstract = false;

  /**
   * When this class is loaded into a container, inspect the class defintion and add the appropriate
   * getters and setters for each attribute defined, and the appropriate relationship methods for
   * each relationship defined. These will delegate activity to the underlying ORM instance.
   */
  static [onLoad](ModelClass: typeof Model) {
    // Skip defining on abstract classes
    if (ModelClass.hasOwnProperty('abstract') && ModelClass.abstract) {
      return;
    }
    let proto = ModelClass.prototype;
    // Define attribute getter/settters
    ModelClass.mapAttributeDescriptors((descriptor, attributeName) => {
      Object.defineProperty(proto, attributeName, {
        configurable: true,
        get() {
          return this.adapter.getAttribute(this, attributeName);
        },
        set(newValue) {
          return this.adapter.setAttribute(this, attributeName, newValue);
        }
      });
    });
    // Define relationship operations
    ModelClass.mapRelationshipDescriptors((descriptor, relationshipName) => {
      let methodRoot = upperFirst(relationshipName);
      // getAuthor(options?)
      Object.defineProperty(proto, `get${methodRoot}`, {
        configurable: true,
        value(options?: any) {
          return (<Model>this).getRelated(relationshipName, options);
        }
      });
      // setAuthor(comments, options?)
      Object.defineProperty(proto, `set${methodRoot}`, {
        configurable: true,
        value(relatedModels: Model | Model[], options?: any) {
          return (<Model>this).setRelated(relationshipName, relatedModels, options);
        }
      });
      if (descriptor.mode === 'hasMany') {
        let singularRoot = singularize(methodRoot);
        // addComment(comment, options?)
        Object.defineProperty(proto, `add${singularRoot}`, {
          configurable: true,
          value(relatedModel: Model, options?: any) {
            return (<Model>this).addRelated(relationshipName, relatedModel, options);
          }
        });
        // removeComment(comment, options?)
        Object.defineProperty(proto, `remove${singularRoot}`, {
          configurable: true,
          value(relatedModel: Model, options?: any) {
            return (<Model>this).removeRelated(relationshipName, relatedModel, options);
          }
        });
      }
    });
  }

  /**
   * Call the supplied callback function for each attribute on this model, passing in the attribute
   * name and attribute descriptor.
   */
  static mapAttributeDescriptors<T>(fn: (descriptor: AttributeDescriptor, name: string) => T): T[] {
    let klass = <any>this;
    let result: T[] = [];
    for (let key in klass) {
      if (klass[key] && klass[key].isAttribute) {
        result.push(fn(klass[key], key));
      }
    }
    return result;
  }

  /**
   * Call the supplied callback function for each relationship on this model, passing in the
   * relationship name and relationship descriptor.
   */
  static mapRelationshipDescriptors<T>(fn: (descriptor: RelationshipDescriptor, name: string) => T): T[] {
    let klass = <any>this;
    let result: T[] = [];
    for (let key in klass) {
      if (klass[key] && klass[key].isRelationship) {
        result.push(fn(klass[key], key));
      }
    }
    return result;
  }

  /**
   * Get the type string for this model class. You must supply a container instance so we can lookup
   * the container name for this model class.
   */
  static getType(container: Container): string {
    return container.metaFor(this).containerName;
  }

  [key: string]: any;

  /**
   * The underlying ORM adapter record. An opaque value to Denali, handled entirely by the ORM
   * adapter.
   */
  record: any = null;

  /**
   * Get the type of this model based on the container name for it
   */
  get type(): string {
    return this.container.metaFor(this.constructor).containerName;
  }

  /**
   * The ORM adapter specific to this model type. Defaults to the application's ORM adapter if none
   * for this specific model type is found.
   */
  get adapter(): ORMAdapter {
    return this.container.lookup(`orm-adapter:${ this.type }`, { loose: true })
        || this.container.lookup('orm-adapter:application');
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
   * Tell the underlying ORM to build this record
   */
  init(data: any, options: any) {
    super.init(...arguments);
    this.record = this.adapter.buildRecord(this.type, data, options);
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
  async getRelated(relationshipName: string, options?: any): Promise<Model|Model[]> {
    let descriptor = (<any>this.constructor)[relationshipName];
    assert(descriptor && descriptor.isRelationship, `You tried to fetch related ${ relationshipName }, but no such relationship exists on ${ this.type }`);
    let RelatedModel = this.container.factoryFor<Model>(`model:${ descriptor.type }`);
    let results = await this.adapter.getRelated(this, relationshipName, descriptor, options);
    if (descriptor.mode === 'hasOne') {
      assert(!Array.isArray(results), `The ${ this.type } ORM adapter returned an array for the hasOne '${ relationshipName }' relationship - it should return either an ORM record or null.`);
      return results ? RelatedModel.create(results) : null;
    }
    assert(Array.isArray(results), `The ${ this.type } ORM adapter did not return an array for the hasMany '${ relationshipName }' relationship - it should return an array (empty if no related records exist).`);
    return results.map((record: any) => RelatedModel.create(record));
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
    let attributesSummary: string[] = (<typeof Model>this.constructor).mapAttributeDescriptors((descriptor, attributeName) => {
      return `${ attributeName }=${ JSON.stringify(this[attributeName]) }`;
    });
    return `<${ startCase(this.type) }:${ this.id == null ? '-new-' : this.id } ${ attributesSummary.join(', ') }>`;
  }

  /**
   * Return an human-friendly string representing this Model instance
   */
  toString(): string {
    return `<${ startCase(this.type) }:${ this.id == null ? '-new-' : this.id }>`;
  }

}

