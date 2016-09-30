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

  static idFor(record) {
    return record.id;
  }

  static getAttribute(record, property) {
    return record[property];
  }

  static setAttribute(record, property, value) {
    record[property] = value;
    return true;
  }

  static deleteAttribute(record, property) {
    record[property] = null;
  }

  static getRelated(record, relationship, descriptor) {
    let relatedCollection = this._cache[descriptor.type];
    if (descriptor.mode === 'hasMany') {
      return filter(relatedCollection, (relatedRecord) => {
        return record[`${ relationship }_ids`].contains(relatedRecord.id);
      });
    }
    return this.find(relatedCollection, { id: record[`${ relationship }_id`] });
  }

  static setRelated(record, relationship, descriptor, relatedRecords) {
    if (descriptor.mode === 'hasMany') {
      record[`${ relationship }_ids`] = pluck(relatedRecords, 'id');
    } else {
      record[`${ relationship }_id`] = relatedRecords.id;
    }
  }

  static addRelated(record, relationship, descriptor, relatedRecord) {
    record[`${ relationship }_ids`].push(relatedRecord.id);
  }

  static removeRelated(record, relationship, descriptor, relatedRecord) {
    remove(record[`${ relationship }_ids`], { id: relatedRecord.id });
  }

  static saveRecord(model) {
    let collection = this._cache[model.record[this._typeKey]];
    if (model.record.id == null) {
      guid += 1;
      model.record.id = guid;
    }
    collection[model.record.id] = model.record;
    return model;
  }

  static deleteRecord(model) {
    let collection = this._cache[model.record[this._typeKey]];
    delete collection[model.record.id];
  }

}
