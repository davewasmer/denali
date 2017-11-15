import { assign, isArray, isUndefined, kebabCase, uniqBy } from 'lodash';
import * as assert from 'assert';
import * as path from 'path';
import { pluralize } from 'inflection';
import Serializer from './serializer';
import Model from '../data/model';
import Router from '../runtime/router';
import Action, { RenderOptions } from '../runtime/action';
import { RelationshipDescriptor } from '../data/descriptors';
import { lookup } from '../metal/container';
import { RelationshipConfig } from './serializer';
import { map } from 'bluebird';
import setIfNotEmpty from '../utils/set-if-not-empty';
import * as JSONAPI from '../utils/json-api';

export interface Options extends RenderOptions {
  /**
   * An array of Models you want to ensure are included in the "included" sideload. Note that the
   * spec requires "full-linkage" - i.e. any Models you include here must be referenced by a
   * resource identifier elsewhere in the payload - to maintain full compliance.
   */
  included?: Model[];
  /**
   * Any top level metadata to send with the response.
   */
  meta?: JSONAPI.Meta;
  /**
   * Any top level links to send with the response.
   */
  links?: JSONAPI.Links;
  [key: string]: any;
}

/**
 * Used internally to simplify passing arguments required by all functions.
 */
export interface Context {
  action: Action;
  body: any;
  options: Options;
  document: JSONAPI.Document;
}

/**
 * Renders the payload according to the JSONAPI 1.0 spec, including related
 * resources, included records, and support for meta and links.
 *
 * @package data
 * @since 0.1.0
 */
export default abstract class JSONAPISerializer extends Serializer {

  /**
   * The default content type to use for any responses rendered by this serializer.
   *
   * @since 0.1.0
   */
  contentType = 'application/vnd.api+json';

  /**
   * Take a response body (a model, an array of models, or an Error) and render
   * it as a JSONAPI compliant document
   *
   * @since 0.1.0
   */
  async serialize(body: any, action: Action, options: RenderOptions): Promise<JSONAPI.Document> {
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
   * Render the primary payload for a JSONAPI document (either a model or array
   * of models).
   *
   * @since 0.1.0
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
   * Render the primary data for the document, either a single Model or a
   * single Error.
   *
   * @since 0.1.0
   */
  protected async renderPrimaryObject(context: Context, payload: any): Promise<void> {
    if (payload instanceof Error) {
      context.document.errors = [ await this.renderError(context, payload) ];
    } else {
      context.document.data = await this.renderRecord(context, payload);
    }
  }

  /**
   * Render the primary data for the document, either an array of Models or
   * Errors
   *
   * @since 0.1.0
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
   * Render any included records supplied by the options into the top level of
   * the document
   *
   * @since 0.1.0
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
   * Render top level meta object for a document. Default uses meta supplied in
   * options call to res.render().
   *
   * @since 0.1.0
   */
  protected renderMeta(context: Context): void {
    if (context.options.meta) {
      context.document.meta = context.options.meta;
    }
  }

  /**
   * Render top level links object for a document. Defaults to the links
   * supplied in options.
   *
   * @since 0.1.0
   */
  protected renderLinks(context: Context): void {
    if (context.options.links) {
      context.document.links = context.options.links;
    }
  }

  /**
   * Render the version of JSONAPI supported.
   *
   * @since 0.1.0
   */
  protected renderVersion(context: Context): void {
    context.document.jsonapi = {
      version: '1.0'
    };
  }

  /**
   * Render the supplied record as a resource object.
   *
   * @since 0.1.0
   */
  protected async renderRecord(context: Context, record: Model): Promise<JSONAPI.ResourceObject> {
    assert(record, `Cannot serialize ${ record }. You supplied ${ record } instead of a Model instance.`);
    let serializedRecord: JSONAPI.ResourceObject = {
      type: pluralize(record.modelName),
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
   * Returns the JSONAPI attributes object representing this record's
   * relationships
   *
   * @since 0.1.0
   */
  protected attributesForRecord(context: Context, record: Model): JSONAPI.Attributes {
    let serializedAttributes: JSONAPI.Attributes = {};
    let attributes = this.attributesToSerialize(context.action, context.options);
    attributes.forEach((attributeName) => {
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
   * The JSONAPI spec recommends (but does not require) that property names be
   * dasherized. The default implementation of this serializer therefore does
   * that, but you can override this method to use a different approach.
   *
   * @since 0.1.0
   */
  protected serializeAttributeName(context: Context, name: string): string {
    return kebabCase(name);
  }

  /**
   * Take an attribute value and return the serialized value. Useful for
   * changing how certain types of values are serialized, i.e. Date objects.
   *
   * The default implementation returns the attribute's value unchanged.
   *
   * @since 0.1.0
   */
  protected serializeAttributeValue(context: Context, value: any, key: string, record: Model): any {
    return value;
  }

  /**
   * Returns the JSONAPI relationships object representing this record's
   * relationships
   *
   * @since 0.1.0
   */
  protected async relationshipsForRecord(context: Context, record: Model): Promise<JSONAPI.Relationships> {
    let serializedRelationships: JSONAPI.Relationships = {};
    let relationships = this.relationshipsToSerialize(context.action, context.options);

    // The result of this.relationships is a whitelist of which relationships should be serialized,
    // and the configuration for their serialization
    let relationshipNames = Object.keys(relationships);
    for (let name of relationshipNames) {
      let config = relationships[name];
      let key = config.key || this.serializeRelationshipName(context, name);
      let descriptor = (<any>record.constructor)[name];
      assert(descriptor, `You specified a '${ name }' relationship in your ${ record.modelName } serializer, but no such relationship is defined on the ${ record.modelName } model`);
      serializedRelationships[key] = await this.serializeRelationship(context, name, config, descriptor, record);
    }

    return serializedRelationships;
  }

  /**
   * Convert the relationship name to it's "over-the-wire" format. Defaults to
   * dasherizing it.
   *
   * @since 0.1.0
   */
  protected serializeRelationshipName(context: Context, name: string): string {
    return kebabCase(name);
  }

  /**
   * Takes the serializer config and the model's descriptor for a relationship,
   * and returns the serialized relationship object. Also sideloads any full
   * records if the relationship is so configured.
   *
   * @since 0.1.0
   */
  protected async serializeRelationship(context: Context, name: string, config: RelationshipConfig, descriptor: RelationshipDescriptor, record: Model): Promise<JSONAPI.Relationship> {
    let relationship: JSONAPI.Relationship = {};
    setIfNotEmpty(relationship, 'links', this.linksForRelationship(context, name, config, descriptor, record));
    setIfNotEmpty(relationship, 'meta', this.metaForRelationship(context, name, config, descriptor, record));
    setIfNotEmpty(relationship, 'data', await this.dataForRelationship(context, name, config, descriptor, record));
    return relationship;
  }

  /**
   * Returns the serialized form of the related Models for the given record and
   * relationship.
   *
   * @since 0.1.0
   */
  protected async dataForRelationship(context: Context, name: string, config: RelationshipConfig, descriptor: RelationshipDescriptor, record: Model): Promise<JSONAPI.RelationshipData> {
    let relatedData = await record.getRelated(name);
    if (descriptor.mode === 'hasMany') {
      return await map(<Model[]>relatedData, async (relatedRecord) => {
        return await this.dataForRelatedRecord(context, name, relatedRecord, config, descriptor, record);
      });
    }
    return await this.dataForRelatedRecord(context, name, <Model>relatedData, config, descriptor, record);
  }

  /**
   * Given a related record, return the resource object for that record, and
   * sideload the record as well.
   *
   * @since 0.1.0
   */
  protected async dataForRelatedRecord(context: Context, name: string, relatedRecord: Model, config: RelationshipConfig, descriptor: RelationshipDescriptor, record: Model): Promise<JSONAPI.ResourceIdentifier> {
    await this.includeRecord(context, name, relatedRecord, config, descriptor);
    return {
      type: pluralize(relatedRecord.modelName),
      id: relatedRecord.id
    };
  }

  /**
   * Takes a relationship descriptor and the record it's for, and returns any
   * links for that relationship for that record. I.e. '/books/1/author'
   *
   * @since 0.1.0
   */
  protected linksForRelationship(context: Context, name: string, config: RelationshipConfig, descriptor: RelationshipDescriptor, record: Model): JSONAPI.Links {
    let recordLinks = this.linksForRecord(context, record);
    let recordURL: string;
    if (recordLinks) {
      if (typeof recordLinks.self === 'string') {
        recordURL = recordLinks.self;
      } else {
        recordURL = recordLinks.self.href;
      }
      return {
        self: path.join(recordURL, `relationships/${ name }`),
        related: path.join(recordURL, name)
      };
    }
    return null;
  }

  /**
   * Returns any meta for a given relationship and record. No meta included by
   * default.
   *
   * @since 0.1.0
   */
  protected metaForRelationship(context: Context, name: string, config: RelationshipConfig, descriptor: RelationshipDescriptor, record: Model): JSONAPI.Meta | void {
    // defaults to no meta content
  }

  /**
   * Returns links for a particular record, i.e. self: "/books/1". Default
   * implementation assumes the URL for a particular record maps to that type's
   * `show` action, i.e. `books/show`.
   *
   * @since 0.1.0
   */
  protected linksForRecord(context: Context, record: Model): JSONAPI.Links {
    let router = lookup<Router>('app:router');
    let url = router.urlFor(`${ pluralize(record.modelName) }/show`, record);
    return typeof url === 'string' ? { self: url } : null;
  }

  /**
   * Returns meta for a particular record.
   *
   * @since 0.1.0
   */
  protected metaForRecord(context: Context, record: Model): void | JSONAPI.Meta {
    // defaults to no meta
  }

  /**
   * Sideloads a record into the top level "included" array
   *
   * @since 0.1.0
   */
  protected async includeRecord(context: Context, name: string, relatedRecord: Model, config: RelationshipConfig, descriptor: RelationshipDescriptor): Promise<void> {
    assert(relatedRecord, 'You tried to sideload an included record, but the record itself was not provided.');
    if (!isArray(context.document.included)) {
      context.document.included = [];
    }
    let relatedOptions = (context.options.relationships && context.options.relationships[name]) || context.options;
    let relatedSerializer = lookup<JSONAPISerializer>(`serializer:${ config.serializer || relatedRecord.modelName }`);
    let relatedContext: Context = assign({}, context, { options: relatedOptions });
    context.document.included.push(await relatedSerializer.renderRecord(relatedContext, relatedRecord));
  }

  /**
   * Render the supplied error
   *
   * @since 0.1.0
   */
  protected renderError(context: Context, error: any): JSONAPI.ErrorObject {
    let renderedError = {
      status: String(error.status) || '500',
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
   * Given an error, return a unique id for this particular occurence of the
   * problem.
   *
   * @since 0.1.0
   */
  protected idForError(context: Context, error: any): string {
    return error.id;
  }

  /**
   * A short, human-readable summary of the problem that SHOULD NOT change from
   * occurrence to occurrence of the problem, except for purposes of
   * localization.
   *
   * @since 0.1.0
   */
  protected titleForError(context: Context, error: any): string {
    return error.title;
  }

  /**
   * Given an error, return a JSON Pointer, a URL query param name, or other
   * info indicating the source of the error.
   *
   * @since 0.1.0
   */
  protected sourceForError(context: Context, error: any): string {
    return error.source;
  }

  /**
   * Return the meta for a given error object. You could use this for example,
   * to return debug information in development environments.
   *
   * @since 0.1.0
   */
  protected metaForError(context: Context, error: any): JSONAPI.Meta | void {
    return error.meta;
  }

  /**
   * Return a links object for an error. You could use this to link to a bug
   * tracker report of the error, for example.
   *
   * @since 0.1.0
   */
  protected linksForError(context: Context, error: any): JSONAPI.Links | void {
    // defaults to no links
  }

  /**
   * Remove duplicate entries from the sideloaded data.
   *
   * @since 0.1.0
   */
  protected dedupeIncluded(context: Context): void {
    if (isArray(context.document.included)) {
      context.document.included = uniqBy(context.document.included, (resource) => {
        return `${ resource.type }/${ resource.id }`;
      });
    }
  }

}
