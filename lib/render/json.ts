import {
  isArray,
  assign,
  isUndefined
} from 'lodash';
import * as assert from 'assert';
import { all } from 'bluebird';
import Serializer, { RelationshipConfig } from './serializer';
import Model from '../data/model';
import Action, { RenderOptions } from '../runtime/action';
import { RelationshipDescriptor } from '../data/descriptors';
import { lookup } from '../metal/container';

/**
 * Renders the payload as a flat JSON object or array at the top level. Related
 * models are embedded.
 *
 * @package data
 * @since 0.1.0
 */
export default abstract class JSONSerializer extends Serializer {

  /**
   * The default content type to apply to responses formatted by this
   * serializer
   *
   * @since 0.1.0
   */
  contentType = 'application/json';

  /**
   * Renders the payload, either a primary data model(s) or an error payload.
   *
   * @since 0.1.0
   */
  async serialize(body: any, action: Action, options: RenderOptions = {}): Promise<any> {
    if (body instanceof Error) {
      return this.renderError(body, action, options);
    }
    return this.renderPrimary(body, action, options);
  }

  /**
   * Renders a primary data payload (a model or array of models).
   *
   * @since 0.1.0
   */
  protected async renderPrimary(payload: any, action: Action, options: RenderOptions): Promise<any> {
    if (isArray(payload)) {
      return await all(payload.map(async (item) => {
        return await this.renderItem(item, action, options);
      }));
    }
    return await this.renderItem(payload, action, options);
  }

  /**
   * If the primary data isn't a model, just render whatever it is directly
   *
   * @since 0.1.0
   */
  async renderItem(item: any, action: Action, options: RenderOptions) {
    if (item instanceof Model) {
      return await this.renderModel(item, action, options);
    }
    return item;
  }

  /**
   * Renders an individual model
   *
   * @since 0.1.0
   */
  async renderModel(model: Model, action: Action, options: RenderOptions): Promise<any> {
    let id = model.id;
    let attributes = this.serializeAttributes(model, action, options);
    let relationships = await this.serializeRelationships(model, action, options);
    return assign({ id }, attributes, relationships);
  }

  /**
   * Serialize the attributes for a given model
   *
   * @since 0.1.0
   */
  protected serializeAttributes(model: Model, action: Action, options: RenderOptions): any {
    let serializedAttributes: any = {};
    let attributes = this.attributesToSerialize(action, options);
    attributes.forEach((attributeName) => {
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
   *
   * @since 0.1.0
   */
  protected serializeAttributeName(attributeName: string): string {
    return attributeName;
  }

  /**
   * Take an attribute value and return the serialized value. Useful for
   * changing how certain types of values are serialized, i.e. Date objects.
   *
   * The default implementation returns the attribute's value unchanged.
   *
   * @since 0.1.0
   */
  protected serializeAttributeValue(value: any, key: string, model: any): any {
    return value;
  }

  /**
   * Serialize the relationships for a given model
   *
   * @since 0.1.0
   */
  protected async serializeRelationships(model: any, action: Action, options: RenderOptions): Promise<{ [key: string]: any }> {
    let serializedRelationships: { [key: string ]: any } = {};
    let relationships = this.relationshipsToSerialize(action, options);

    // The result of this.relationships is a whitelist of which relationships
    // should be serialized, and the configuration for their serialization
    for (let relationshipName in this.relationships) {
      let config = relationships[relationshipName];
      let key = config.key || this.serializeRelationshipName(relationshipName);
      let descriptor = model.constructor[relationshipName];
      assert(descriptor, `You specified a '${ relationshipName }' relationship in your ${ model.constructor.type } serializer, but no such relationship is defined on the ${ model.constructor.type } model`);
      serializedRelationships[key] = await this.serializeRelationship(relationshipName, config, descriptor, model, action, options);
    }

    return serializedRelationships;
  }

  /**
   * Serializes a relationship
   *
   * @since 0.1.0
   */
  protected async serializeRelationship(relationship: string, config: RelationshipConfig, descriptor: RelationshipDescriptor, model: Model, action: Action, options: RenderOptions) {
    let relatedSerializer = lookup<JSONSerializer>(`serializer:${ descriptor.relatedModelName }`, { loose: true }) || lookup<JSONSerializer>(`serializer:application`, { loose: true });
    if (typeof relatedSerializer === 'boolean') {
      throw new Error(`No serializer found for ${ descriptor.relatedModelName }, and no fallback application serializer found either`);
    }
    if (descriptor.mode === 'hasMany') {
      let relatedModels = <Model[]>await model.getRelated(relationship);
      return await all(relatedModels.map(async (relatedModel: Model) => {
        if (config.strategy === 'embed') {
          return await (<JSONSerializer>relatedSerializer).renderModel(relatedModel, action, options);
        } else if (config.strategy === 'id') {
          return relatedModel.id;
        }
      }));
    } else {
      let relatedModel = <Model>await model.getRelated(relationship);
      if (config.strategy === 'embed') {
        return await relatedSerializer.renderModel(relatedModel, action, options);
      } else if (config.strategy === 'id') {
        return relatedModel.id;
      }
    }
  }

  /**
   * Transform relationship names into their over-the-wire representation.
   * Default behavior uses the relationship name as-is.
   *
   * @since 0.1.0
   */
  protected serializeRelationshipName(name: string): string {
    return name;
  }

  /**
   * Render an error payload
   *
   * @since 0.1.0
   */
  protected renderError(error: any, action: Action, options: any): any {
    return {
      status: error.status || 500,
      code: error.code || 'InternalServerError',
      message: error.message
    };
  }

}
