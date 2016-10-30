import { filter, pluck, remove } from 'lodash';
import ORMAdapter from '../orm-adapter';

let guid = 0;

export default class MemoryAdapter extends ORMAdapter {

  static _typeKey = Symbol('memory-adapter-type');
  static _cache = {};

  static find(type, query) {
    if (typeof query === 'number' || typeof query === 'string') {
      return (this._cache[type] && this._cache[type][query]) || null;
    }
    return filter(this._cache[type] || {}, query);
  }

  static buildRecord(type, data) {
    this._cache[type] = this._cache[type] || {};
    data[this._typeKey] = type;
    return data;
  }

  static idFor(model) {
    return model.record.id;
  }

  static getAttribute(model, property) {
    return model.record[property];
  }

  static setAttribute(model, property, value) {
    model.record[property] = value;
    return true;
  }

  static deleteAttribute(model, property) {
    model.record[property] = null;
    return true;
  }

  static getRelated(model, relationship, descriptor) {
    let relatedCollection = this._cache[descriptor.type];
    if (descriptor.mode === 'hasMany') {
      return filter(relatedCollection, (relatedRecord) => {
        return model.record[`${ relationship }_ids`].contains(relatedRecord.id);
      });
    }
    return this.find(relatedCollection, { id: model.record[`${ relationship }_id`] });
  }

  static setRelated(model, relationship, descriptor, relatedRecords) {
    if (descriptor.mode === 'hasMany') {
      model.record[`${ relationship }_ids`] = pluck(relatedRecords, 'id');
    } else {
      model.record[`${ relationship }_id`] = relatedRecords.id;
    }
  }

  static addRelated(model, relationship, descriptor, relatedRecord) {
    model.record[`${ relationship }_ids`].push(relatedRecord.id);
  }

  static removeRelated(model, relationship, descriptor, relatedRecord) {
    remove(model.record[`${ relationship }_ids`], { id: relatedRecord.id });
  }

  static saveRecord(model) {
    let collection = this._cache[model.record[this._typeKey]];
    if (model.record.id == null) {
      guid += 1;
      model.record.id = guid;
    }
    collection[model.record.id] = model.record;
    return model.record;
  }

  static deleteRecord(model) {
    let collection = this._cache[model.record[this._typeKey]];
    delete collection[model.record.id];
  }

}
