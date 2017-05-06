import {
  isArray,
  assign,
  mapValues,
  forEach,
  isUndefined } from 'lodash';
import * as assert from 'assert';
import Serializer from './serializer';
import Model from '../data/model';
import Action, { RenderOptions } from '../runtime/action';
import { RelationshipDescriptor } from '../data/descriptors';

/**
 * Renders the payload as a flat JSON object or array at the top level. Related
 * models are embedded.
 *
 * @package data
 */
export default abstract class FlatSerializer extends Serializer {

  /**
   * The default content type to apply to responses formatted by this serializer
   */
  contentType = 'application/json';

  /**
   * Renders the payload, either a primary data model(s) or an error payload.
   */
  async serialize(action: Action, body: any, options: RenderOptions = {}): Promise<any> {
    if (body instanceof Error) {
      return this.renderError(body);
    }
    return this.renderPrimary(body, options);
  }

  /**
   * Renders a primary data payload (a model or array of models).
   */
  protected renderPrimary(payload: Model|Model[], options?: any): any {
    if (isArray(payload)) {
      return payload.map((model) => {
        return this.renderModel(model, options);
      });
    }
    return this.renderModel(payload, options);
  }

  /**
   * Renders an individual model
   */
  renderModel(model: Model, options?: any): any {
    let id = model.id;
    let attributes = this.serializeAttributes(model, options);
    let relationships = this.serializeRelationships(model, options);
    relationships = mapValues(relationships, (relationship) => {
      return relationship.data;
    });
    return assign({ id }, attributes, relationships);
  }

  /**
   * Serialize the attributes for a given model
   */
  protected serializeAttributes(model: Model, options?: any): any {
    let serializedAttributes: any = {};
    this.attributes.forEach((attributeName) => {
      let key = this.serializeAttributeName(attributeName);
      let rawValue = model[attributeName];
      if (!isUndefined(rawValue)) {
        let value = this.serializeAttributeValue(rawValue, key, model);
        serializedAttributes[key] = value;
      }
    });
    return serializedAttributes;
  }

  /**
   * Transform attribute names into their over-the-wire representation. Default
   * behavior uses the attribute name as-is.
   */
  protected serializeAttributeName(attributeName: string): string {
    return attributeName;
  }

  /**
   * Take an attribute value and return the serialized value. Useful for
   * changing how certain types of values are serialized, i.e. Date objects.
   *
   * The default implementation returns the attribute's value unchanged.
   */
  protected serializeAttributeValue(value: any, key: string, model: any): any {
    return value;
  }

  /**
   * Serialize the relationships for a given model
   */
  protected serializeRelationships(model: any, options?: any): { [key: string]: any } {
    let serializedRelationships: { [key: string ]: any } = {};

    // The result of this.relationships is a whitelist of which relationships
    // should be serialized, and the configuration for their serialization
    forEach(this.relationships, (config, relationshipName) => {
      let key = config.key || this.serializeRelationshipName(relationshipName);
      let descriptor = model.constructor[relationshipName];
      assert(descriptor, `You specified a '${ relationshipName }' relationship in your ${ model.constructor.type } serializer, but no such relationship is defined on the ${ model.constructor.type } model`);
      serializedRelationships[key] = this.serializeRelationship(config, descriptor, model, options);
    });

    return serializedRelationships;
  }

  /**
   * Serializes a relationship
   */
  protected serializeRelationship(config: any, descriptor: RelationshipDescriptor, model: any, options?: any) {
    if (isArray(model)) {
      if (model[0] instanceof Model) {
        let relatedSerializer = this.container.lookup(`serializer:${ descriptor.type }`);
        return model.map((relatedRecord) => {
          return relatedSerializer.renderRecord(relatedRecord, options);
        });
      }
      return model;
    }
    if (model instanceof Model) {
      let relatedSerializer = this.container.lookup(`serializer:${ descriptor.type }`);
      return relatedSerializer.renderRecord(model, options);
    }
    return model;
  }

  /**
   * Transform relationship names into their over-the-wire representation. Default
   * behavior uses the relationship name as-is.
   *
   * @protected
   * @param {string} name
   * @returns {string}
   */
  protected serializeRelationshipName(name: string): string {
    return name;
  }

  /**
   * Render an error payload
   */
  protected renderError(error: any): any {
    return {
      status: error.status || 500,
      code: error.code || 'InternalServerError',
      message: error.message
    };
  }

}
