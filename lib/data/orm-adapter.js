/**
 * The ORMAdapter class is responsible for enabling Denali to communicate with
 * the ORM of your choice. It does this by boiling down the possible actions
 * that a user might before against a Model that would involve persistence into
 * a set of basic operations. Your adapter then implements these operations, and
 * Denali can build on top of that.
 *
 * @class ORMAdapter
 * @constructor
 * @module denali
 * @submodule data
 */
export default class ORMAdapter {

  /**
   * Find a record by ID, basic query, or adapter-specific query.
   *
   * To find a single record by it's id, just call:
   *
   *     Post.find(1)
   *
   * Denali also allows users to supply simple queries in a universal format
   * of an object with properties:
   *
   *     Post.find({ title: 'foo' })
   *
   * This allows basic querying regardless of the ORM used. However, for more
   * advanced use cases, rather than trying to design a single interface that
   * could support all ORMs, Denali simply defers to ORM specific syntax via
   * a query function:
   *
   *     Post.find((myQueryBuilder) => {
   *       return myQueryBuilder.foo('bar');
   *     });
   *
   * This approach allows you to provide ultimately flexibility for querying
   * (the arguments to the query function are supplied by you and can be ORM
   * specific).
   *
   * The `options` argument allows for additional, orthogonal options in case
   * your ORM needs it. It's treated as an opaque, pass through value by Deanli.
   *
   * @method find
   * @static
   * @param type {String} the model type
   * @param query {String|Number|Object|Function} the id of the record to
   * lookup, a basic query object, or a query function
   * @param options {Object} user supplied options, unique to your ORM
   * @return {Promise} resolves with the query results. Empty sets should
   * resolve to empty arrays (not rejections), or `null` if a single record was
   * requested by id.
   */
  static find(/* type, query, options */) {
    throw new Error('You must implement this method');
  }

  /**
   * Return the id for the given record.
   *
   * @method idFor
   * @static
   * @param record {Object}
   * @return {String|Number}
   */
  static idFor(/* record */) {
    throw new Error('You must implement this method');
  }

  /**
   * Return the value for the given attribute on the given record.
   *
   * @method getAttribute
   * @static
   * @param record {Object}
   * @param attribute {String}
   * @return {any}
   */
  static getAttribute(/* record, attribute */) {
    throw new Error('You must implement this method');
  }

  /**
   * Set the value for the given attribute on the given record.
   *
   * @method setAttribute
   * @static
   * @param record {Object}
   * @param attribute {String}
   * @param value {any}
   * @return {Boolean} return true if the set was successful, false if not
   */
  static setAttribute(/* record, attribute, value */) {
    throw new Error('You must implement this method');
  }

  /**
   * Delete the value for the given attribute on the given record. The
   * semantics of this may behave slightly differently depending on backend -
   * SQL databases may NULL out the value, while document stores like Mongo may
   * actually delete the key from the document (rather than just nulling it out)
   *
   * @method setAttribute
   * @static
   * @param record {Object}
   * @param attribute {String}
   * @return {Boolean} return true if the delete was successful, false if not
   */
  static deleteAttribute(/* record, property */) {
    throw new Error('You must implement this method');
  }

  /**
   * Return the related record(s) for the given relationship.
   *
   * @method getRelated
   * @static
   * @param record {Object}
   * @param relationship {String} the name of the relationship
   * @param descriptor {Object} the descriptor object for the relationship
   * @return {Object|Array} the related record(s)
   */
  static getRelated(/* record, relationship, descriptor */) {
    throw new Error('You must implement this method');
  }

  /**
   * Set the related record(s) for the given relationship.
   *
   * @method setRelated
   * @static
   * @param record {Object}
   * @param relationship {String} the name of the relationship
   * @param descriptor {Object} the descriptor object for the relationship
   * @param related {Object|Array}
   */
  static setRelated(/* record, relationship, descriptor, related */) {
    throw new Error('You must implement this method');
  }

  /**
   * Add a related record to a hasMany relationship.
   *
   * @method addRelated
   * @static
   * @param record {Object}
   * @param relationship {String} the name of the relationship
   * @param descriptor {Object} the descriptor object for the relationship
   * @param related {Object}
   */
  static addRelated(/* record, relationship, descriptor, related */) {
    throw new Error('You must implement this method');
  }

  /**
   * Remove a related record from a hasMany relationship.
   *
   * @method removeRelated
   * @static
   * @param record {Object}
   * @param relationship {String} the name of the relationship
   * @param descriptor {Object} the descriptor object for the relationship
   * @param related {Object}
   */
  static removeRelated(/* record, relationship, descriptor, related */) {
    throw new Error('You must implement this method');
  }

  /**
   * Persist the supplied record.
   *
   * @method saveRecord
   * @static
   * @param record {Object}
   * @param options {Object} ORM specific options
   * @return {Promise} resolves with the saved record once the save operation
   * is complete
   */
  static saveRecord(/* record, options */) {
    throw new Error('You must implement this method');
  }

  /**
   * Delete the supplied record from the persistent data store.
   *
   * @method deleteRecord
   * @static
   * @param record {Object}
   * @param options {Object} ORM specific options
   * @return {Promise} resolves once the delete operation is complete
   */
  static deleteRecord(/* record, options */) {
    throw new Error('You must implement this method');
  }

  /**
   * Takes a Denali Model class and defines an ORM specific model class, and/or
   * any other ORM specific setup that might be required for that Model.
   *
   * @method define
   * @static
   * @param Model {Model} the Denali Model class
   * @return {Promise} resolves once all the ORM specific setup for the given
   * Model is complete
   */
  static define(/* Model */) {
    throw new Error('You must implement this method');
  }

}
