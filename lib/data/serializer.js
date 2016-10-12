/**
 * Serializers allow you to customize what data is returned in the response and
 * apply simple transformations to it. They allow you to decouple what data is
 * sent from how that data is structured / rendered.
 *
 * @class Serializer
 * @static
 * @module denali
 * @submodule data
 */

export default class Serializer {

  static contentType = 'application/json';

  constructor() {
    throw new Error('Serializers are static classes - you should not instantiate them.');
  }

  /**
   * Take the supplied payload of record(s) or error(s) and the supplied options
   * and return a rendered a JSON response object.
   *
   * @method serialize
   * @param payload {Object[]|Error[]|Object|Error}
   * @param options {Object}
   * @return {Object} the JSON response object
   */
  static serialize() {
    throw new Error('You must implement the `serialize` method!');
  }

  /**
   * Take a serialized JSON document (i.e. an incoming request body), and
   * perform any normalization required.
   *
   * The return value of this method is entirely up to the specific serializer,
   * i.e. some may return the payload unchanged, others may tweak the structure,
   * or some could even return actual ORM model instances.
   *
   * This method is optional - the default implementation returns the payload
   * unchanged.
   *
   * @method parse
   * @param payload {Object}
   * @param options {Object}
   * @return {Object}
   */
  static parse(payload) {
    return payload;
  }

  /**
   * The list of attribute names that should be serialized. Attributes not
   * included in this list will be omitted from the final rendered payload.
   *
   * @property attributes
   * @type {String[]}
   */
  static attributes = [];

  /**
   * An object with configuration on how to serialize relationships.
   * Relationships that have no configuration present are omitted from the final
   * rendered payload.
   *
   * Out of the box, two options are supported:
   *
   * **strategy**
   *
   * It has one of four possible values:
   *
   *   * `records`: embed all related records (1-n relationships)
   *   * `record`: embed the related record (1-1 relationships)
   *   * `ids`: include only the ids of related records (1-n relationships)
   *   * `id`: include only the id of the related record (1-1 relationships)
   *
   * What the embedded records or ids look like is up to each serializer to
   * determine.
   *
   * **type**
   *
   * The model type of the related records.
   *
   * Specific serializers may also accept additional options in the relationship
   * configuration to customize their response format.
   *
   * @property relationships
   * @type {Object}
   */
  static relationships = {};

}
