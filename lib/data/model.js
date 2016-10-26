import assert from 'assert';
import Promise from 'bluebird';
import { pluralize } from 'inflection';
import {
  kebabCase,
  isArray,
  startCase,
  keysIn,
  lowerFirst } from 'lodash';

/**
 * The Model class is the core of Denali's unique approach to data and ORMs.
 * It acts as a wrapper and translation layer that provides a unified interface
 * to access and manipulate data, but translates those interactions into ORM
 * specific operations via ORM adapters.
 *
 * Models are able to maintain their relatively clean interface thanks to the
 * way the constructor actually returns a Proxy which wraps the Model instance,
 * rather than the Model instance directly. This means you can directly get and
 * set properties on your records, and the record (which is a Proxy-wrapped
 * Model) will translate and forward those calls to the underlying ORM adapter.
 *
 * @class Model
 * @constructor
 * @module denali
 * @submodule data
 */
export default class Model {

  /**
   * An internal cache of all attributes defined on this model.
   * @type {Array}
   * @static
   * @private
   */
  static _attributesCache = null;

  /**
   * The type of the Model class. This string is used as the container name for
   * the model, as well as in several other areas of Denali (i.e. serializers,
   * ORM adapters, etc). Conventionally, types are dasherized versions of the
   * model name (i.e. the BlogPost model's type would be `"blog-post"`).
   *
   * @property type
   * @static
   * @type {String}
   */
  static get type() {
    let name = this.name;
    if (name.endsWith('Model')) {
      name = name.slice(0, -('Model').length);
    }
    return kebabCase(name);
  }

  /**
   * Find records by id, basic query, or query function.
   *
   * You can find single records by passing in the id:
   *
   *     BlogPost.find(1)
   *
   * You can query records using basic query syntax:
   *
   *     BlogPost.find({ title: 'foobar' })
   *
   * For more complex queries, you can use a query function to leverage the
   * specific syntax and strengths of your ORM and data store:
   *
   *     BlogPost.find((sql) => {
   *       return sql.where({ title: 'foobar' })
   *         .greaterThan('view_count', 10);
   *     });
   *
   * @method find
   * @static
   * @param query {Number|String|Object|Function}
   * @param options {Object} ORM-specific options
   * @return {Promise} resolves with the record(s) found, an empty array, or
   * null
   */
  static find(query, options) {
    return Promise.try(() => this.adapter.find(this.type, query, options))
      .then((records) => {
        if (isArray(records)) {
          return records.map((record) => {
            return new this(record);
          });
        } else if (records) {
          return new this(records);
        }
      });
  }

  /**
   * Create a new record and immediately persist it.
   *
   * @method create
   * @static
   * @param data {Object}
   * @param options {Object}
   * @return {Promise} resolves with the newly created record
   */
  static create(data, options) {
    return Promise.try(() => {
      let instance = new this({}, options);
      // We do this here, rather than in buildRecord, in case some of the data
      // supplied isn't an actual attribute (which means it will get set on
      // the wrapper proxy this way).
      Object.assign(instance, data);
      return instance.save();
    });
  }

  /**
   * The ORM adapter specific to this model type. Defaults to the application's
   * ORM adapter if none for this specific model type is found.
   *
   * @property adapter
   * @static
   * @type {ORMAdapter}
   * @private
   */
  static get adapter() {
    let adapter = this.container.lookup(`orm-adapter:${ this.type }`);
    assert(adapter, `No adapter found for ${ this.type }! Available adapters: ${ this.container.availableForType('orm-adapter') }`);
    return adapter;
  }

  /**
   * The id of the record
   *
   * @property id
   * @type {Number|String}
   */
  get id() {
    return this.adapter.idFor(this);
  }

  /**
   * The application container
   *
   * @property container
   * @type {Container}
   */
  get container() {
    return this.constructor.container;
  }

  /**
   * The ORM adapter specific to this model type. Defaults to the application's
   * ORM adapter if none for this specific model type is found.
   *
   * @property adapter
   * @type {ORMAdapter}
   */
  get adapter() {
    return this.constructor.adapter;
  }

  /**
   * The underlying ORM adapter record. An opaque value to Denali, handled
   * entirely by the ORM adapter.
   *
   * @property record
   * @type {Object}
   * @private
   */
  record = null;

  constructor(data, options) {
    if (!this.constructor.name) {
      throw new Error(`Missing model name for ${ this }: You must either define your model using named classes (i.e. class User extends Model {}) or define a 'name' class property`);
    }
    this.record = this.adapter.buildRecord(this.constructor.type, data, options);

    return new Proxy(this, {

      get(model, property) {
        if (typeof property === 'string') {
          // Return the attribute value if that's what is requested
          let descriptor = model.constructor[property];
          if (descriptor && descriptor.isAttribute) {
            return model.adapter.getAttribute(model, property);
          }
          // Forward relationship related methods to their generic counterparts
          let relatedMethodParts = property.match(/(get|set|add|remove)(\w+)/);
          if (relatedMethodParts) {
            let [ , operation, relationshipName ] = relatedMethodParts;
            relationshipName = lowerFirst(relationshipName);
            descriptor = this.constructor[relationshipName] || this.constructor[pluralize(relationshipName)];
            if (descriptor && descriptor.isRelationship) {
              return model[`${ operation }Related`].bind(model, relationshipName, descriptor);
            }
          }
        }
        // It's not an attribute or a relationship method, so let the model
        // respond normally
        return model[property];
      },

      set(model, property, value) {
        // Set attribute values
        let descriptor = model.constructor[property];
        if (descriptor && descriptor.isAttribute) {
          return model.adapter.setAttribute(model, property, value);
        }
        // Otherwise just set the model property directly
        model[property] = value;
        return true;
      },

      deleteProperty(model, property) {
        // Delete the attribute
        let descriptor = model.constructor[property];
        if (descriptor && descriptor.isAttribute) {
          return model.adapter.deleteAttribute(model, property);
        }
        // Otherwise just delete the model property directly
        return delete model[property];
      }

    });
  }

  /**
   * Persist this model.
   *
   * @method save
   * @param options {Object} ORM-specific options
   * @return {Promise}
   */
  save(options) {
    return Promise.try(() => this.adapter.saveRecord(this, options))
      .return(this);
  }

  /**
   * Delete this model.
   *
   * @method delete
   * @param options {Object} ORM-specific options
   * @return {Promise}
   */
  delete(options) {
    return Promise.try(() => this.adapter.deleteRecord(this, options));
  }

  /**
   * Returns the related record(s) for the given relationship.
   *
   * @method getRelated
   * @param relationshipName {String}
   * @param options {Object} ORM-specific options
   * @return {Promise} resolves with the related model (for hasOne
   * relationships), or an array of models (for hasMany relationships)
   */
  getRelated(relationshipName, options) {
    let descriptor = this.constructor[relationshipName] || this.constructor[pluralize(relationshipName)];
    assert(descriptor && descriptor.isRelationship, `You tried to fetch related ${ relationshipName }, but no such relationship exists on ${ this.constructor.type }`);
    return Promise.try(() => this.adapter.getRelated(this, relationshipName, descriptor, options))
      .then((results) => {
        let RelatedModel = this.modelFor(descriptor.type);
        if (descriptor.mode === 'hasOne') {
          return new RelatedModel(results);
        }
        return results.map((record) => new RelatedModel(record));
      });
  }

  /**
   * Replaces the related records for the given relationship with the supplied
   * related records.
   *
   * @method setRelated
   * @param relationshipName {String}
   * @param relatedModels {Object|Array}
   * @param options {Object} ORM-specific options
   * @return {Promise} resolves once the change is persisted
   */
  setRelated(relationshipName, relatedModels, options) {
    let descriptor = this.constructor[relationshipName] || this.constructor[pluralize(relationshipName)];
    return Promise.try(() => this.adapter.setRelated(this, relationshipName, descriptor, relatedModels, options));
    // TODO force a null return?
  }

  /**
   * Add a related record to a hasMany relationship.
   *
   * @method addRelated
   * @param relationshipName {String}
   * @param relatedModel {Object}
   * @param options {Object} ORM-specific options
   * @return {Promise} resolves once the change has been persisted
   */
  addRelated(relationshipName, relatedModel, options) {
    let descriptor = this.constructor[relationshipName] || this.constructor[pluralize(relationshipName)];
    return Promise.try(() => this.adapter.addRelated(this, relationshipName, descriptor, relatedModel, options))
      .then((results) => {
        let RelatedModel = this.modelFor(descriptor.type);
        return results.map((record) => new RelatedModel(record));
      });
  }

  /**
   * Remove the given record from the hasMany relationship
   *
   * @method removeRelated
   * @param relationshipName {String}
   * @param relatedModel {Object}
   * @param options {Object} ORM-specific options
   * @return {Promise} resolves once the change is persisted
   */
  removeRelated(relationshipName, relatedModel, options) {
    let descriptor = this.constructor[relationshipName] || this.constructor[pluralize(relationshipName)];
    return Promise.try(() => this.adapter.removeRelated(this, relationshipName, descriptor, relatedModel, options))
      .then((results) => {
        let RelatedModel = this.modelFor(descriptor.type);
        return results.map((record) => new RelatedModel(record));
      });
  }

  /**
   * Lookup a model class by type.
   *
   * @method modelFor
   * @static
   * @param type {String}
   * @return {Model}
   */
  static modelFor(type) {
    return this.container.lookup(`model:${ type }`);
  }

  /**
   * Call the supplied callback function for each attribute on this model,
   * passing in the attribute name and attribute instance.
   *
   * @method eachAttribute
   * @static
   * @param fn {Function}
   * @return {Array}
   */
  static eachAttribute(fn) {
    if (!this.hasOwnProperty('_attributesCache') || this._attributesCache == null) {
      this._attributesCache = [];
      for (let key in this) {
        if (this[key] && this[key].isAttribute) {
          this._attributesCache.push(key);
        }
      }
    }
    return this._attributesCache.map((attributeName) => {
      return fn(attributeName, this[attributeName]);
    });
  }

  /**
   * Lookup a model class by type.
   *
   * @method modelFor
   * @param type {String}
   * @return {Model}
   */
  modelFor(type) {
    return this.constructor.modelFor(type);
  }

  /**
   * Lookup a service by type
   *
   * @method service
   * @param type {String}
   * @return {Service}
   */
  service(type) {
    return this.container.lookup(`service:${ type }`);
  }

  inspect() {
    let attributes = keysIn(this.constructor).filter((key) => {
      return this.constructor[key].isAttribute;
    });
    let attributesSummary = attributes.map((attr) => {
      return `${ attr }=${ JSON.stringify(this[attr]) }`;
    }).join(', ');
    return `<${ startCase(this.constructor.type) }:${ this.id == null ? '-new-' : this.id } ${ attributesSummary }>`;
  }

  toString() {
    return `<${ startCase(this.constructor.type) }:${ this.id == null ? '-new-' : this.id }>`;
  }

}
