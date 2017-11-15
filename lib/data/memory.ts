import {
  find,
  filter,
  map,
  remove,
  values
} from 'lodash';
import ORMAdapter from './orm-adapter';
import Model from './model';
import { RelationshipDescriptor } from './descriptors';
import * as assert from 'assert';
import { singularize } from 'inflection';

let guid = 0;

/**
 * An in-memory ORM adapter for getting started quickly, testing, and
 * debugging. Should **not** be used for production data.
 *
 * @package data
 * @since 0.1.0
 */
export default class MemoryAdapter extends ORMAdapter {


  /**
   * An in-memory cache of records. Top level objects are collections of
   * records by type, indexed by record id.
   */
  _cache: { [type: string]: { [id: number]: any } } = {};

  /**
   * Get the collection of records for a given type, indexed by record id. If
   * the collection doesn't exist yet, create it and return the empty
   * collection.
   */
  _cacheFor(type: string): { [id: number]: any } {
    if (!this._cache[type]) {
      this._cache[type] = {};
    }
    return this._cache[type];
  }

  // tslint:disable:completed-docs

  async find(type: string, id: number): Promise<any> {
    return this._cacheFor(type)[id] || null;
  }

  async queryOne(type: string, query: any): Promise<any> {
    return find(this._cacheFor(type), query) || null;
  }

  async all(type: string): Promise<any[]> {
    return values(this._cacheFor(type));
  }

  async query(type: string, query: any): Promise<any[]> {
    return filter(this._cacheFor(type), query);
  }

  buildRecord(type: string, data: any = {}): any {
    this._cacheFor(type);
    return data;
  }

  idFor(model: Model) {
    return model.record.id;
  }

  setId(model: Model, value: number) {
    let collection = this._cacheFor(model.modelName);
    delete collection[model.record.id];
    model.record.id = value;
    collection[value] = model.record;
  }

  getAttribute(model: Model, property: string): any {
    return model.record[property] === undefined ? null : model.record[property];
  }

  setAttribute(model: Model, property: string, value: any): true {
    model.record[property] = value;
    return true;
  }

  deleteAttribute(model: Model, property: string): true {
    model.record[property] = null;
    return true;
  }

  async getRelated(model: Model, relationship: string, descriptor: RelationshipDescriptor, query: any): Promise<any|any[]> {
    let relatedCollection = this._cacheFor(descriptor.relatedModelName);
    if (descriptor.mode === 'hasMany') {
      let related = filter(relatedCollection, (relatedRecord: any) => {
        let relatedIds = model.record[`${ singularize(relationship) }_ids`];
        return relatedIds && relatedIds.includes(relatedRecord.id);
      });
      if (query) {
        related = filter(related, query);
      }
      return related;
    }
    return this.queryOne(descriptor.relatedModelName, { id: model.record[`${ relationship }_id`] });
  }

  async setRelated(model: Model, relationship: string, descriptor: RelationshipDescriptor, relatedModels: Model|Model[]): Promise<void> {
    if (Array.isArray(relatedModels)) {
      assert(descriptor.mode === 'hasMany', `You tried to set ${ relationship } to an array of related records, but it is a hasOne relationship`);
      model.record[`${ singularize(relationship) }_ids`] = map(relatedModels, 'record.id');
    } else {
      model.record[`${ relationship }_id`] = relatedModels.record.id;
    }
  }

  async addRelated(model: Model, relationship: string, descriptor: RelationshipDescriptor, relatedModel: Model): Promise<void> {
    let relatedIds = model.record[`${ singularize(relationship) }_ids`];
    if (!relatedIds) {
      relatedIds = model.record[`${ singularize(relationship) }_ids`] = [];
    }
    relatedIds.push(relatedModel.id);
  }

  async removeRelated(model: Model, relationship: string, descriptor: RelationshipDescriptor, relatedModel: Model): Promise<void> {
    remove(model.record[`${ singularize(relationship) }_ids`], (id) => id === relatedModel.id);
  }

  async saveRecord(model: Model): Promise<void> {
    let collection = this._cacheFor(model.modelName);
    if (model.record.id == null) {
      guid += 1;
      model.record.id = guid;
    }
    collection[model.record.id] = model.record;
    return model.record;
  }

  async deleteRecord(model: Model): Promise<void> {
    let collection = this._cacheFor(model.modelName);
    delete collection[model.record.id];
  }

}
