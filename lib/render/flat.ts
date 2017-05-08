import {
  isArray,
  assign,
  isUndefined } from 'lodash';
import * as assert from 'assert';
import { all } from 'bluebird';
import Serializer, { RelationshipConfig } from './serializer';
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
  protected async renderPrimary(payload: Model|Model[], options?: any): Promise<any> {
    if (isArray(payload)) {
      return await all(payload.map(async (model) => {
        return await this.renderModel(model, options);
      }));
    }
    return await this.renderModel(payload, options);
  }

  /**
   * Renders an individual model
   */
  async renderModel(model: Model, options?: any): Promise<any> {
    let id = model.id;
    let attributes = this.serializeAttributes(model, options);
    let relationships = await this.serializeRelationships(model, options);
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
  protected async serializeRelationships(model: any, options?: any): Promise<{ [key: string]: any }> {
    let serializedRelationships: { [key: string ]: any } = {};

    // The result of this.relationships is a whitelist of which relationships
    // should be serialized, and the configuration for their serialization
    for (let relationshipName in this.relationships) {
      let config = this.relationships[relationshipName];
      let key = config.key || this.serializeRelationshipName(relationshipName);
      let descriptor = model.constructor[relationshipName];
      assert(descriptor, `You specified a '${ relationshipName }' relationship in your ${ model.constructor.type } serializer, but no such relationship is defined on the ${ model.constructor.type } model`);
      serializedRelationships[key] = await this.serializeRelationship(relationshipName, config, descriptor, model, options);
    }

    return serializedRelationships;
  }

  /**
   * Serializes a relationship
   */
  protected async serializeRelationship(relationship: string, config: RelationshipConfig, descriptor: RelationshipDescriptor, model: Model, options?: any) {
    let relatedSerializer = this.container.lookup<FlatSerializer>(`serializer:${ descriptor.type }`, { loose: true }) || this.container.lookup<FlatSerializer>(`serializer:application`, { loose: true });
    assert(relatedSerializer, `No serializer found for ${ descriptor.type }, and no fallback application serializer found either`);
    if (descriptor.mode === 'hasMany') {
      let relatedModels = <Model[]>await model.getRelated(relationship);
      return await all(relatedModels.map(async (relatedModel: Model) => {
        if (config.strategy === 'embed') {
          return await relatedSerializer.renderModel(relatedModel, options);
        } else if (config.strategy === 'id') {
          return relatedModel.id;
        }
      }));
    } else {
      let relatedModel = <Model>await model.getRelated(relationship);
      if (config.strategy === 'embed') {
        return await relatedSerializer.renderModel(relatedModel, options);
      } else if (config.strategy === 'id') {
        return relatedModel.id;
      }
    }
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
