import assert from 'assert';
import path from 'path';
import { singularize, pluralize } from 'inflection';
import Serializer from '../serializer';
import Model from '../model';
import Errors from '../../runtime/errors';
import isArray from 'lodash/isArray';
import isUndefined from 'lodash/isUndefined';
import isEmpty from 'lodash/isEmpty';
import set from 'lodash/set';
import mapKeys from 'lodash/mapKeys';
import capitalize from 'lodash/capitalize';
import camelCase from 'lodash/camelCase';
import kebabCase from 'lodash/kebabCase';
import forEach from 'lodash/forEach';
import uniq from 'lodash/uniq';

function setIfNotEmpty(obj, key, value) {
  if (!isEmpty(value)) {
    set(obj, key, value);
  }
}

/**
 * Renders the payload according to the JSONAPI 1.0 spec, including related
 * resources, included records, and support for meta and links.
 *
 * @class JSONAPISerializer
 * @static
 * @module denali
 * @submodule data
 */

export default class JSONAPISerializer extends Serializer {

  /**
   * Take a resposne body (a model, an array of models, or an Error) and render
   * it as a JSONAPI compliant document
   *
   * @method serialize
   * @param  {Response}   response
   * @param  {Object}     options
   */
  static serialize(response, options = {}) {
    let document = {};
    this.renderPrimary(response.body, document, options);
    this.renderIncluded(response.body, document, options);
    this.renderMeta(response.body, document, options);
    this.renderLinks(response.body, document, options);
    this.renderVersion(response.body, document, options);
    this.dedupeIncluded(document);
    response.body = document;
  }

  /**
   * Render the primary payload for a JSONAPI document (either a model or array
   * of models).
   *
   * @method renderPrimary
   * @see {@link http://jsonapi.org/format/#document-top-level|JSONAPI spec}
   * @param  {Object|Array}   payload    errors or models to render
   * @param  {Object}         document   top level document to render into
   * @param  {Object}         options
   */
  static renderPrimary(payload, document, options) {
    if (isArray(payload)) {
      this.renderPrimaryArray(payload, document, options);
    } else {
      return this.renderPrimaryObject(payload, document, options);
    }
  }

  static renderPrimaryObject(payload, document, options) {
    if (payload instanceof Error) {
      document.errors = [ this.renderError(payload, options) ];
    } else {
      document.data = this.renderRecord(payload, document, options);
    }
  }

  static renderPrimaryArray(payload, document, options) {
    if (payload[0] instanceof Error) {
      document.errors = payload.map((error) => {
        assert(error instanceof Error, 'You passed a mixed array of errors and models to the JSON-API serializer. The JSON-API spec does not allow for both `data` and `errors` top level objects in a response');
        return this.renderError(error, options);
      });
    } else {
      document.data = payload.map((record) => {
        assert(!(record instanceof Error), 'You passed a mixed array of errors and models to the JSON-API serializer. The JSON-API spec does not allow for both `data` and `errors` top level objects in a response');
        return this.renderRecord(record, document, options);
      });
    }
  }

  /**
   * Render any included records into the top level of the document
   *
   * @method renderIncluded
   * @param  {Object|Array} payload
   * @param  {Object}       document  top level JSONAPI document
   * @param  {Object}       options
   * @param  {Object}       options.included  array of records to sideload
   */
  static renderIncluded(payload, document, options) {
    if (options.included) {
      assert(isArray(options.included), 'included records must be passed in as an array');
      document.included = options.included.map((includedRecord) => {
        return this.renderRecord(includedRecord, options);
      });
    }
  }

  /**
   * Render top level meta object for a document. Default uses meta supplied in
   * options call to res.render().
   *
   * @method renderMeta
   * @param  {Object|Array}   payload
   * @param  {Object}         document  top level JSONAPI document
   * @param  {Object}         options
   * @param  {Object}         options.meta
   */
  static renderMeta(payload, document, options) {
    if (options.meta) {
      document.meta = options.meta;
    }
  }

  /**
   * Render top level links object for a document. Defaults to the links
   * supplied in options, or the URL for the invoking action if no links are
   * supplied.
   *
   * @method renderLinks
   * @param  {Object|Array}   payload
   * @param  {Object}         document  top level JSONAPI document
   * @param  {Object}         options
   * @param  {Object}         options.links
   */
  static renderLinks(payload, document, options) {
    if (options.links) {
      document.links = options.links;
    }
  }

  /**
   * Render the version of JSONAPI supported.
   *
   * @method renderVersion
   * @param  {Object|Array}   payload
   * @param  {Object}         document  top level JSONAPI document
   * @param  {Object}         options
   */
  static renderVersion(payload, document) {
    document.jsonapi = {
      version: '1.0'
    };
  }

  /**
   * Render the supplied record as a resource object.
   *
   * @method renderRecord
   * @see {@link http://jsonapi.org/format/#document-resource-objects|JSONAPI spec}
   * @param  {Object}     options
   * @param  {Object}     record
   * @return {Object}             a resource object representing the record
   */
  static renderRecord(record, document, options = {}) {
    assert(record, `Cannot serialize ${ record }. You supplied ${ record } instead of a Model instance.`);
    let serializedRecord = {
      type: pluralize(record.constructor.type),
      id: record.id
    };
    assert(serializedRecord.id != null, `Attempted to serialize a record (${ record }) without an id, but the JSON-API spec requires all resources to have an id.`);
    // Makes it a little less onerous than passing these three args everywhere
    let context = { record, document, options };
    setIfNotEmpty(serializedRecord, 'attributes', this.attributesForRecord(context));
    setIfNotEmpty(serializedRecord, 'relationships', this.relationshipsForRecord(context));
    setIfNotEmpty(serializedRecord, 'links', this.linksForRecord(context));
    setIfNotEmpty(serializedRecord, 'meta', this.metaForRecord(context));
    return serializedRecord;
  }

  /**
   * Returns the JSONAPI attributes object representing this record's
   * relationships
   *
   * @method attributesForRecord
   * @see {@link http://jsonapi.org/format/#document-resource-object-attributes|JSONAPI spec}
   * @param  {Object}            record
   * @param  {Object}            options
   * @return {Object}                    the JSONAPI attributes object
   */
  static attributesForRecord({ record }) {
    let serializedAttributes = {};
    this.attributes.forEach((attributeName) => {
      let key = this.serializeAttributeName(attributeName);
      let rawValue = record[attributeName];
      if (!isUndefined(rawValue)) {
        let value = this.serializeAttributeValue(rawValue, key, record);
        serializedAttributes[key] = value;
      }
    });
    return serializedAttributes;
  }

  /**
   * The JSONAPI spec recommends (but does not require) that property names be
   * dasherized. The default implementation of this serializer therefore does
   * that, but you can override this method to use a different approach.
   *
   * @method serializeAttributeName
   * @param  {name}               name the attribute name to serialize
   * @return {String}                    the attribute name, dasherized
   */
  static serializeAttributeName(name) {
    return kebabCase(name);
  }

  /**
   * Take an attribute value and return the serialized value. Useful for
   * changing how certain types of values are serialized, i.e. Date objects.
   *
   * The default implementation returns the attribute's value unchanged.
   *
   * @method serializeAttributeValue
   * @param  {*}            value
   * @param  {String}       key
   * @param  {Object}       record
   * @return {*}             the value that should be rendered
   */
  static serializeAttributeValue(value/* , key, record */) {
    return value;
  }

  /**
   * Returns the JSONAPI relationships object representing this record's
   * relationships
   *
   * @method relationshipsForRecord
   * @see http://jsonapi.org/format/#document-resource-object-relationships
   * @param  {Object}            record
   * @param  {Object}            options
   * @return {Object}                    the JSONAPI relationships object
   */
  static relationshipsForRecord(context) {
    let { record, options } = context;
    let serializedRelationships = {};

    // The result of this.relationships is a whitelist of which relationships
    // should be serialized, and the configuration for their serialization
    let relationships = typeof this.relationships === 'function' ? this.relationships.call(options.action) : this.relationships;
    forEach(relationships, (config) => {
      let key = config.key || this.serializeRelationshipName(config.name);
      let descriptor = record.constructor[config.name];
      assert(descriptor, `You specified a '${ config.name }' relationship in your ${ record.constructor.type } serializer, but no such relationship is defined on the ${ record.constructor.type } model`);
      serializedRelationships[key] = this.serializeRelationship(config, descriptor, context);
    });

    return serializedRelationships;
  }

  /**
   * Takes the serializer config and the model's descriptor for a relationship,
   * and returns the serialized relationship object. Also sideloads any full
   * records found for the relationship.
   *
   * @static
   * @method serializeRelationship
   * @param  {Object} config  the options provided at the serializer for this relationship
   * @param  {Object} descriptor  the model's descriptor for this relationship
   * @param  {Object} context
   * @return  {Object} the serialized relationship object
   */
  static serializeRelationship(config, descriptor, context) {
    let relationship = {};
    let dataMethod = this[`dataFor${ capitalize(descriptor.mode) }`];
    setIfNotEmpty(relationship, 'links', this.linksForRelationship(config, descriptor, context));
    setIfNotEmpty(relationship, 'data', dataMethod.call(this, config, descriptor, context));
    setIfNotEmpty(relationship, 'meta', this.metaForRelationship(config, descriptor, context));
    return relationship;
  }

  /**
   * Given the serializer config and the model descriptor for a hasOne
   * relationship, returns the data for that relationship (the resource object
   * with type and id). Sideloads the related record if present.
   *
   * @static
   * @method dataForHasOne
   * @param  {Object} config  the options provided at the serializer for this relationship
   * @param  {Object} descriptor  the model's descriptor for this relationship
   * @param  {Object} context
   * @return  {Object} the serialized data object for the relationship
   */
  static dataForHasOne(config, descriptor, context) {
    let { record } = context;
    let relatedRecordOrId = record.getRelated(config.name);
    return this.dataForRelatedRecord(config, descriptor, context, relatedRecordOrId);
  }

  /**
   * Given the serializer config and the model descriptor for a hasMany
   * relationship, returns the data for that relationship (the resource objects
   * with type and id). Sideloads the related records if present.
   *
   * @static
   * @method dataForHasMany
   * @param  {Object} config  the options provided at the serializer for this relationship
   * @param  {Object} descriptor  the model's descriptor for this relationship
   * @param  {Object} context
   * @return  {Object} the serialized data array for the relationship
   */
  static dataForHasMany(config, descriptor, context) {
    let { record } = context;
    let relatedRecords = record.getRelated(config.name);
    return relatedRecords.map(this.dataForRelatedRecord.bind(this, config, descriptor, context));
  }

  /**
   * Given a related record or it's id, return the resource object for that
   * record (or id). If it's a full record, sideload the record as well.
   *
   * @static
   * @method dataForRelatedRecord
   * @param  {Model|Number|String} relatedRecordOrId the related record or it's id
   * @param  {Object} config the options provided at the serializer for this relationship
   * @param  {Object} descriptor the model's descriptor for this relationship
   * @param  {Object} context
   * @return {Object} the serialized resource object for the given related record or id
   */
  static dataForRelatedRecord(relatedRecordOrId, { name, type }, descriptor, context) {
    if (relatedRecordOrId instanceof Model) {
      this.includeRecord(name, relatedRecordOrId, descriptor, context);
      return {
        type: pluralize(relatedRecordOrId.constructor.type),
        id: relatedRecordOrId.id
      };
    }
    return {
      type,
      id: relatedRecordOrId
    };
  }

  /**
   * Takes a relationship descriptor and the record it's for, and returns any
   * links for that relationship for that record. I.e. '/books/1/author'
   *
   * @method linksForRelationship
   * @param  {String}             name       name of the relationship
   * @param  {Object}             descriptor descriptor for the relationship
   * @param  {Object}             record     parent record containing the
   *                                         relationships
   * @return {Object}                        the links object for the supplied
   *                                         relationship
   */
  static linksForRelationship({ name }, descriptor, context) {
    let recordURL = this.linksForRecord(context).self;
    return {
      self: path.join(recordURL, `relationships/${ name }`),
      related: path.join(recordURL, name)
    };
  }

  /**
   * Returns any meta for a given relationship and record. No meta included by
   * default.
   *
   * @method metaForRelationship
   * @param  {String}            name       name of the relationship
   * @param  {Object}            descriptor descriptor for the relationship
   * @param  {Object}            record     parent record containing the
   *                                        relationship
   * @param  {Object}            options
   * @return {Object}
   */
  static metaForRelationship() {}

  /**
   * Returns links for a particular record, i.e. self: "/books/1". Default
   * implementation assumes the URL for a particular record maps to that type's
   * `show` action, i.e. `books/show`.
   *
   * @method linksForRecord
   * @param  {Object}       record  [description]
   * @param  {Object}       options [description]
   * @return {Object}               [description]
   */
  static linksForRecord({ record }) {
    let router = this.container.lookup('router:main');
    let url = router.urlFor(`${ pluralize(record.constructor.type) }/show`, record);
    return url ? { self: url } : null;
  }

  /**
   * Returns meta for a particular record.
   *
   * @method metaForRecord
   * @param  {Object}      record
   * @param  {Object}      options
   * @return {Object}
   */
  static metaForRecord() {}

  /**
   * Sideloads a record into the top level "included" array
   *
   * @method includeRecord
   * @private
   * @param  {Object}      record   the record to sideload
   * @param  {Object}      descriptor
   * @param  {Object}      descriptor.config
   * @param  {Object}      descriptor.config.type
   * @param  {Object}      descriptor.config.strategy
   * @param  {Object}      descriptor.data
   * @param  {Object}      document the top level JSONAPI document
   * @param  {Object}      options
   */
  static includeRecord(config, descriptor, context) {
    let { record, document, options } = context;
    if (!isArray(document.included)) {
      document.included = [];
    }
    let relatedOptions = (options.relationships && options.relationships[config.name]) || options;
    let relatedSerializer = config.serializer || this.container.lookup(`serializer:${ record.constructor.type }`);
    document.included.push(relatedSerializer.renderRecord(record, document, relatedOptions));
  }

  /**
   * Render the supplied error
   *
   * @method renderError
   * @param  {Error}    error
   * @return {Object}          the JSONAPI error object
   */
  static renderError(error) {
    let renderedError = {
      id: error.id,
      status: error.status || 500,
      code: error.code || error.name || 'InternalServerError',
      title: error.title,
      detail: error.message
    };
    setIfNotEmpty(renderedError, 'source', this.sourceForError(error));
    setIfNotEmpty(renderedError, 'meta', this.metaForError(error));
    setIfNotEmpty(renderedError, 'links', this.linksForError(error));
    return renderedError;
  }

  /**
   * Given an error, return a JSON Pointer, a URL query param name, or other
   * info indicating the source of the error.
   *
   * @method sourceForError
   * @see {@link http://jsonapi.org/format/#error-objects|JSONAPI spec}
   * @param  {Error}      error
   * @return {Object}            an error source object, optionally including a
   *                             "pointer" JSON Pointer or "parameter" for the
   *                             query param that caused the error.
   */
  static sourceForError(error) {
    return error.source;
  }

  /**
   * Return the meta for a given error object. You could use this for example,
   * to return debug information in development environments.
   *
   * @method metaForError
   * @param  {Error}     error
   * @return {Object}
   */
  static metaForError(error) {
    return error.meta;
  }

  /**
   * Return a links object for an error. You could use this to link to a bug
   * tracker report of the error, for example.
   *
   * @method linksForError
   * @param  {Error}      error
   * @return {Object}
   */
  static linksForError() {}

  /**
   * Remove duplicate entries from the sideloaded data.
   *
   * @method dedupeIncluded
   * @private
   * @param  {Object}       document  the top level JSONAPI document
   */
  static dedupeIncluded(document) {
    if (isArray(document.included)) {
      document.included = uniq(document.included, (resource) => {
        return `${ resource.type }/${ resource.id }`;
      });
    }
  }

  /**
   * Unlike the other serializers, the default parse implementation does modify
   * the incoming payload. It converts the default dasherized attribute names
   * into camelCase.
   *
   * The parse method here retains the JSONAPI document structure (i.e. data,
   * included, links, meta, etc), only modifying resource objects in place.
   *
   * @method parse
   * @param payload {Object} the JSONAPI document to parse
   * @return {Object} the parsed payload
   */
  static parse(payload) {
    try {
      assert(payload.data, 'Invalid JSON-API document (missing top level `data` object - see http://jsonapi.org/format/#document-top-level)');
      let parseResource = this._parseResource.bind(this);
      if (payload.data) {
        if (!isArray(payload.data)) {
          payload.data = parseResource(payload.data);
        } else {
          payload.data = payload.data.map(parseResource);
        }
      }
      if (payload.included) {
        payload.included = payload.included.map(parseResource);
      }
    } catch (e) {
      if (e.name === 'AssertionError') {
        throw new Errors.BadRequest(e.message);
      }
      throw e;
    }
    return payload;
  }


  /**
   * Takes a JSON-API resource object and hands it off for parsing to the
   * serializer specific to that object's type.
   *
   * @method _parseResource
   * @param resource {Object} a JSON-API resource object POJO
   * @return {Object} the parsed result
   * @private
   */
  static _parseResource(resource) {
    assert(typeof resource.type === 'string', 'Invalid resource object encountered (missing `type` - see http://jsonapi.org/format/#document-resource-object-identification)');
    resource.type = this.parseType(resource.type);
    let relatedSerializer = this.container.lookup(`serializer:${ resource.type }`);
    return relatedSerializer.parseResource(resource);
  }

  /**
   * Parse a single resource object from a JSONAPI document. The resource object
   * could come from the top level `data` payload, or from the sideloaded
   * `included` records.
   *
   * @method parseResource
   * @param resource {Object} a JSONAPI resource object
   * @return {Object} the parsed resource object. Note: do not return an ORM
   * instance from this method - that is handled separately.
   */
  static parseResource(resource) {
    setIfNotEmpty(resource, 'id', this.parseId(resource.id));
    setIfNotEmpty(resource, 'attributes', this.parseAttributes(resource.attributes));
    setIfNotEmpty(resource, 'relationships', this.parseRelationships(resource.relationships));
    return resource;
  }

  /**
   * Parse a resource object id
   *
   * @method parseId
   * @param  {String|Number} id
   * @return {String|Number} the parsed id
   */
  static parseId(id) {
    return id;
  }

  /**
   * Parse a resource object's type string
   *
   * @method parseType
   * @param  {String} type
   * @return {String} the parsed type
   */
  static parseType(type) {
    return singularize(type);
  }

  /**
   * Parse a resource object's attributes. By default, this converts from the
   * JSONAPI recommended dasheried keys to camelCase.
   *
   * @method parseAttributes
   * @param  {Object} attrs
   * @return {Object} the parsed attributes
   */
  static parseAttributes(attrs) {
    return mapKeys(attrs, (value, key) => {
      return camelCase(key);
    });
  }

  /**
   * Parse a resource object's relationships. By default, this converts from the
   * JSONAPI recommended dasheried keys to camelCase.
   *
   * @method parseRelationships
   * @param  {Object} relationships
   * @return {Object} the parsed relationships
   */
  static parseRelationships(relationships) {
    return mapKeys(relationships, (value, key) => {
      return camelCase(key);
    });
  }

}
