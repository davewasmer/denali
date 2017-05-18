import {
  assign,
  isArray,
  isUndefined,
  kebabCase,
  uniqBy
} from 'lodash';
import * as assert from 'assert';
import * as path from 'path';
import { pluralize } from 'inflection';
import Serializer from './serializer';
import Model from '../data/model';
import Router from '../runtime/router';
import Action, { RenderOptions } from '../runtime/action';
import { RelationshipDescriptor } from '../data/descriptors';
import { RelationshipConfig } from './serializer';
import { map } from 'bluebird';
import setIfNotEmpty from '../utils/set-if-not-empty';

/**
 * Ensures that the value is only set if it exists, so we avoid creating iterable keys on obj for
 * undefined values.
 */
export interface JsonApiDocument {
  data?: JsonApiResourceObject | JsonApiResourceObject[] | JsonApiResourceIdentifier | JsonApiResourceIdentifier[];
  errors?: JsonApiError[];
  meta?: JsonApiMeta;
  jsonapi?: { version: string };
  links?: JsonApiLinks;
  included?: JsonApiResourceObject[];
}

export interface JsonApiError {
  /**
   * A unique identifier for this particular occurrence of the problem
   */
  id?: string;
  links?: {
    /**
     * A link that leads to further details about this particular occurrence of the problemA
     */
    about?: JsonApiLink;
  };
  /**
   * The HTTP status code applicable to this problem, expressed as a string value
   */
  status?: string;
  /**
   * An application-specific error code, expressed as a string value
   */
  code?: string;
  /**
   * A short, human-readable summary of the problem that SHOULD NOT change from occurrence to
   * occurrence of the problem, except for purposes of localization
   */
  title?: string;
  /**
   * A human-readable explanation specific to this occurrence of the problem. Like title, this
   * field’s value can be localized
   */
  detail?: string;
  /**
   * An object containing references to the source of the error
   */
  source?: {
    /**
     * A JSON Pointer [RFC6901] to the associated entity in the request document [e.g. "/data" for a
     * primary data object, or "/data/attributes/title" for a specific attribute]
     */
    pointer?: string;
    /**
     * A string indicating which URI query parameter caused the error
     */
    parameter?: string;
  };
  meta?: JsonApiMeta;
}

export interface JsonApiResourceObject {
  id: string;
  type: string;
  attributes?: JsonApiAttributes;
  relationships?: JsonApiRelationships;
  links?: JsonApiLinks;
  meta?: JsonApiMeta;
}

export interface JsonApiAttributes {
  [key: string]: any;
}

export interface JsonApiRelationships {
  [relationshipName: string]: JsonApiRelationship;
}

export interface JsonApiRelationship {
  /**
   * Links for this relationship. Should contain at least a "self" or "related" link.
   */
  links?: JsonApiLinks;
  data?: JsonApiRelationshipData;
  meta?: JsonApiMeta;
}

export type JsonApiRelationshipData = JsonApiResourceIdentifier | JsonApiResourceIdentifier[];

export interface JsonApiResourceIdentifier {
  id: string;
  type: string;
  meta?: JsonApiMeta;
}

export interface JsonApiMeta {
  [key: string]: any;
}

export interface JsonApiLinks {
  /**
   * A link for the resource or relationship itself. This link allows the client to directly
   * manipulate the resource or relationship. For example, removing an author through an article’s
   * relationship URL would disconnect the person from the article without deleting the people
   * resource itself. When fetched successfully, this link returns the linkage for the related
   * resources as its primary data
   */
  self?: JsonApiLink;
  /**
   * A “related resource link” provides access to resource objects linked in a relationship. When
   * fetched, the related resource object(s) are returned as the response’s primary data.
   */
  related?: JsonApiLink;
  [key: string]: JsonApiLink;
}

export type JsonApiLink = string | {
  href: string,
  meta: JsonApiMeta
};

export interface Options {
  /**
   * An array of Models you want to ensure are included in the "included" sideload. Note that the
   * spec requires "full-linkage" - i.e. any Models you include here must be referenced by a
   * resource identifier elsewhere in the payload - to maintain full compliance.
   */
  included?: Model[];
  /**
   * Any top level metadata to send with the response.
   */
  meta?: JsonApiMeta;
  /**
   * Any top level links to send with the response.
   */
  links?: JsonApiLinks;
  /**
   * Configuration for each relationship.
   */
  relationships?: any;
  [key: string]: any;
}

/**
 * Used internally to simplify passing arguments required by all functions.
 */
export interface Context {
  action: Action;
  body: any;
  options: Options;
  document: JsonApiDocument;
}

/**
 * Renders the payload according to the JSONAPI 1.0 spec, including related resources, included
 * records, and support for meta and links.
 *
 * @package data
 */
export default abstract class JSONAPISerializer extends Serializer {

  /**
   * The default content type to use for any responses rendered by this serializer.
   */
  contentType = 'application/vnd.api+json';

  /**
   * Take a response body (a model, an array of models, or an Error) and render it as a JSONAPI
   * compliant document
   */
  async serialize(action: Action, body: any, options: RenderOptions): Promise<JsonApiDocument> {
    let context: Context = {
      action,
      body,
      options,
      document: {}
    };
    await this.renderPrimary(context);
    await this.renderIncluded(context);
    this.renderMeta(context);
    this.renderLinks(context);
    this.renderVersion(context);
    this.dedupeIncluded(context);
    return context.document;
  }

  /**
   * Render the primary payload for a JSONAPI document (either a model or array of models).
   */
  protected async renderPrimary(context: Context): Promise<void> {
    let payload = context.body;
    if (isArray(payload)) {
      await this.renderPrimaryArray(context, payload);
    } else {
      await this.renderPrimaryObject(context, payload);
    }
  }

  /**
   * Render the primary data for the document, either a single Model or a single Error.
   */
  protected async renderPrimaryObject(context: Context, payload: any): Promise<void> {
    if (payload instanceof Error) {
      context.document.errors = [ await this.renderError(context, payload) ];
    } else {
      context.document.data = await this.renderRecord(context, payload);
    }
  }

  /**
   * Render the primary data for the document, either an array of Models or Errors
   */
  protected async renderPrimaryArray(context: Context, payload: any): Promise<void> {
    if (payload[0] instanceof Error) {
      context.document.errors = await map(payload, async (error: Error) => {
        assert(error instanceof Error, 'You passed a mixed array of errors and models to the JSON-API serializer. The JSON-API spec does not allow for both `data` and `errors` top level objects in a response');
        return await this.renderError(context, error);
      });
    } else {
      context.document.data = await map(payload, async (record: Model) => {
        assert(!(record instanceof Error), 'You passed a mixed array of errors and models to the JSON-API serializer. The JSON-API spec does not allow for both `data` and `errors` top level objects in a response');
        return await this.renderRecord(context, record);
      });
    }
  }

  /**
   * Render any included records supplied by the options into the top level of the document
   */
  protected async renderIncluded(context: Context): Promise<void> {
    if (context.options.included) {
      assert(isArray(context.options.included), 'included records must be passed in as an array');
      context.document.included = await map(context.options.included, async (includedRecord) => {
        return await this.renderRecord(context, includedRecord);
      });
    }
  }

  /**
   * Render top level meta object for a document. Default uses meta supplied in options call to
   * res.render().
   */
  protected renderMeta(context: Context): void {
    if (context.options.meta) {
      context.document.meta = context.options.meta;
    }
  }

  /**
   * Render top level links object for a document. Defaults to the links supplied in options.
   */
  protected renderLinks(context: Context): void {
    if (context.options.links) {
      context.document.links = context.options.links;
    }
  }

  /**
   * Render the version of JSONAPI supported.
   */
  protected renderVersion(context: Context): void {
    context.document.jsonapi = {
      version: '1.0'
    };
  }

  /**
   * Render the supplied record as a resource object.
   */
  protected async renderRecord(context: Context, record: Model): Promise<JsonApiResourceObject> {
    assert(record, `Cannot serialize ${ record }. You supplied ${ record } instead of a Model instance.`);
    let serializedRecord: JsonApiResourceObject = {
      type: pluralize(record.type),
      id: record.id
    };
    assert(serializedRecord.id != null, `Attempted to serialize a record (${ record }) without an id, but the JSON-API spec requires all resources to have an id.`);
    setIfNotEmpty(serializedRecord, 'attributes', this.attributesForRecord(context, record));
    setIfNotEmpty(serializedRecord, 'relationships', await this.relationshipsForRecord(context, record));
    setIfNotEmpty(serializedRecord, 'links', this.linksForRecord(context, record));
    setIfNotEmpty(serializedRecord, 'meta', this.metaForRecord(context, record));
    return serializedRecord;
  }

  /**
   * Returns the JSONAPI attributes object representing this record's relationships
   */
  protected attributesForRecord(context: Context, record: Model): JsonApiAttributes {
    let serializedAttributes: JsonApiAttributes = {};
    this.attributes.forEach((attributeName) => {
      let key = this.serializeAttributeName(context, attributeName);
      let rawValue = record[attributeName];
      if (!isUndefined(rawValue)) {
        let value = this.serializeAttributeValue(context, rawValue, key, record);
        serializedAttributes[key] = value;
      }
    });
    return serializedAttributes;
  }

  /**
   * The JSONAPI spec recommends (but does not require) that property names be dasherized. The
   * default implementation of this serializer therefore does that, but you can override this method
   * to use a different approach.
   */
  protected serializeAttributeName(context: Context, name: string): string {
    return kebabCase(name);
  }

  /**
   * Take an attribute value and return the serialized value. Useful for changing how certain types
   * of values are serialized, i.e. Date objects.
   *
   * The default implementation returns the attribute's value unchanged.
   */
  protected serializeAttributeValue(context: Context, value: any, key: string, record: Model): any {
    return value;
  }

  /**
   * Returns the JSONAPI relationships object representing this record's relationships
   */
  protected async relationshipsForRecord(context: Context, record: Model): Promise<JsonApiRelationships> {
    let serializedRelationships: JsonApiRelationships = {};

    // The result of this.relationships is a whitelist of which relationships should be serialized,
    // and the configuration for their serialization
    let relationshipNames = Object.keys(this.relationships);
    for (let name of relationshipNames) {
      let config = this.relationships[name];
      let key = config.key || this.serializeRelationshipName(context, name);
      let descriptor = (<any>record.constructor)[name];
      assert(descriptor, `You specified a '${ name }' relationship in your ${ record.type } serializer, but no such relationship is defined on the ${ record.type } model`);
      serializedRelationships[key] = await this.serializeRelationship(context, name, config, descriptor, record);
    }

    return serializedRelationships;
  }

  /**
   * Convert the relationship name to it's "over-the-wire" format. Defaults to dasherizing it.
   */
  protected serializeRelationshipName(context: Context, name: string): string {
    return kebabCase(name);
  }

  /**
   * Takes the serializer config and the model's descriptor for a relationship, and returns the
   * serialized relationship object. Also sideloads any full records if the relationship is so
   * configured.
   */
  protected async serializeRelationship(context: Context, name: string, config: RelationshipConfig, descriptor: RelationshipDescriptor, record: Model): Promise<JsonApiRelationship> {
    let relationship: JsonApiRelationship = {};
    setIfNotEmpty(relationship, 'links', this.linksForRelationship(context, name, config, descriptor, record));
    setIfNotEmpty(relationship, 'meta', this.metaForRelationship(context, name, config, descriptor, record));
    setIfNotEmpty(relationship, 'data', await this.dataForRelationship(context, name, config, descriptor, record));
    return relationship;
  }

  /**
   * Returns the serialized form of the related Models for the given record and relationship.
   */
  protected async dataForRelationship(context: Context, name: string, config: RelationshipConfig, descriptor: RelationshipDescriptor, record: Model): Promise<JsonApiRelationshipData> {
    let relatedData = await record.getRelated(name);
    if (descriptor.mode === 'hasMany') {
      return await map(<Model[]>relatedData, async (relatedRecord) => {
        return await this.dataForRelatedRecord(context, name, relatedRecord, config, descriptor, record);
      });
    }
    return await this.dataForRelatedRecord(context, name, <Model>relatedData, config, descriptor, record);
  }

  /**
   * Given a related record, return the resource object for that record, and sideload the record as
   * well.
   */
  protected async dataForRelatedRecord(context: Context, name: string, relatedRecord: Model, config: RelationshipConfig, descriptor: RelationshipDescriptor, record: Model): Promise<JsonApiResourceIdentifier> {
    await this.includeRecord(context, name, relatedRecord, config, descriptor);
    return {
      type: pluralize(relatedRecord.type),
      id: relatedRecord.id
    };
  }

  /**
   * Takes a relationship descriptor and the record it's for, and returns any links for that
   * relationship for that record. I.e. '/books/1/author'
   */
  protected linksForRelationship(context: Context, name: string, config: RelationshipConfig, descriptor: RelationshipDescriptor, record: Model): JsonApiLinks {
    let recordSelfLink = this.linksForRecord(context, record).self;
    let recordURL: string;
    if (typeof recordSelfLink === 'string') {
      recordURL = recordSelfLink;
    } else {
      recordURL = recordSelfLink.href;
    }
    return {
      self: path.join(recordURL, `relationships/${ name }`),
      related: path.join(recordURL, name)
    };
  }

  /**
   * Returns any meta for a given relationship and record. No meta included by default.
   */
  protected metaForRelationship(context: Context, name: string, config: RelationshipConfig, descriptor: RelationshipDescriptor, record: Model): JsonApiMeta | void {
    // defaults to no meta content
  }

  /**
   * Returns links for a particular record, i.e. self: "/books/1". Default implementation assumes
   * the URL for a particular record maps to that type's `show` action, i.e. `books/show`.
   */
  protected linksForRecord(context: Context, record: Model): JsonApiLinks {
    let router: Router = this.container.lookup('app:router');
    let url = router.urlFor(`${ pluralize(record.type) }/show`, record);
    return typeof url === 'string' ? { self: url } : null;
  }

  /**
   * Returns meta for a particular record.
   */
  protected metaForRecord(context: Context, record: Model): void | JsonApiMeta {
    // defaults to no meta
  }

  /**
   * Sideloads a record into the top level "included" array
   */
  protected async includeRecord(context: Context, name: string, relatedRecord: Model, config: RelationshipConfig, descriptor: RelationshipDescriptor): Promise<void> {
    if (!isArray(context.document.included)) {
      context.document.included = [];
    }
    let relatedOptions = (context.options.relationships && context.options.relationships[name]) || context.options;
    let relatedSerializer: JSONAPISerializer = config.serializer || this.container.lookup(`serializer:${ relatedRecord.type }`);
    let relatedContext: Context = assign({}, context, { options: relatedOptions });
    context.document.included.push(await relatedSerializer.renderRecord(relatedContext, relatedRecord));
  }

  /**
   * Render the supplied error
   */
  protected renderError(context: Context, error: any): JsonApiError {
    let renderedError = {
      status: error.status || 500,
      code: error.code || error.name || 'InternalServerError',
      detail: error.message
    };
    setIfNotEmpty(renderedError, 'id', this.idForError(context, error));
    setIfNotEmpty(renderedError, 'title', this.titleForError(context, error));
    setIfNotEmpty(renderedError, 'source', this.sourceForError(context, error));
    setIfNotEmpty(renderedError, 'meta', this.metaForError(context, error));
    setIfNotEmpty(renderedError, 'links', this.linksForError(context, error));
    return renderedError;
  }

  /**
   * Given an error, return a unique id for this particular occurence of the problem.
   */
  protected idForError(context: Context, error: any): string {
    return error.id;
  }

  /**
   * A short, human-readable summary of the problem that SHOULD NOT change from occurrence to
   * occurrence of the problem, except for purposes of localization.
   */
  protected titleForError(context: Context, error: any): string {
    return error.title;
  }

  /**
   * Given an error, return a JSON Pointer, a URL query param name, or other info indicating the
   * source of the error.
   */
  protected sourceForError(context: Context, error: any): string {
    return error.source;
  }

  /**
   * Return the meta for a given error object. You could use this for example, to return debug
   * information in development environments.
   */
  protected metaForError(context: Context, error: any): JsonApiMeta | void {
    return error.meta;
  }

  /**
   * Return a links object for an error. You could use this to link to a bug tracker report of the
   * error, for example.
   */
  protected linksForError(context: Context, error: any): JsonApiLinks | void {
    // defaults to no links
  }

  /**
   * Remove duplicate entries from the sideloaded data.
   */
  protected dedupeIncluded(context: Context): void {
    if (isArray(context.document.included)) {
      context.document.included = uniqBy(context.document.included, (resource) => {
        return `${ resource.type }/${ resource.id }`;
      });
    }
  }


}
