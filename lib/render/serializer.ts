import View from './view';
import { ServerResponse } from 'http';
import Action, { RenderOptions } from '../runtime/action';
import Errors from '../runtime/errors';
import result from '../utils/result';
import { lookup } from '../metal/container';

export interface RelationshipConfig {
  strategy?: 'embed' | 'id' | string;
  key?: string;
  serializer?: string;
}

export interface RelationshipConfigs {
  [relationshipName: string]: RelationshipConfig;
}

/**
 * Serializers allow you to customize what data is returned in the response and
 * apply simple transformations to it. They allow you to decouple what data is
 * sent from how that data is structured / rendered.
 *
 * @package data
 * @since 0.1.0
 */
export default abstract class Serializer extends View {

  /**
   * The content type header to send back with the response
   *
   * @since 0.1.0
   */
  protected contentType = 'application/json';

  /**
   * The list of attribute names that should be serialized. Attributes not
   * included in this list will be omitted from the final rendered payload.
   *
   * @since 0.1.0
   */
  protected abstract attributes: ((...args: any[]) => string[]) | string[];

  /**
   * An object with configuration on how to serialize relationships.
   * Relationships that have no configuration present are omitted from the
   * final rendered payload.
   *
   * Out of the box, one option is supported:
   *
   * **strategy**
   *
   * It has one of two possible values:
   *
   *   * `embed`: embed all related records in the response payload
   *   * `id`: include only the id of the related record(s)
   *
   * What the embedded records or ids look like is up to each serializer to
   * determine.
   *
   * @since 0.1.0
   */
  protected abstract relationships: ((...args: any[]) => RelationshipConfigs) | RelationshipConfigs;

  /**
   * Convenience method to encapsulate standard attribute whitelist behavior -
   * render options take precedence, then allow this.attributes to be a
   * function or straight definition
   *
   * @since 0.1.0
   */
  protected attributesToSerialize(action: Action, options: RenderOptions) {
    return options.attributes || result(this.attributes, action);
  }

  /**
   * Convenience method to encapsulate standard relationship whitelist behavior
   * - render options take precedence, then allow this.relationships to be a
   * function or straight definition
   *
   * @since 0.1.0
   */
  protected relationshipsToSerialize(action: Action, options: RenderOptions) {
    return options.relationships || result(this.relationships, action);
  }

  async render(action: Action, response: ServerResponse, body: any, options: RenderOptions): Promise<void> {
    response.setHeader('Content-type', this.contentType);
    if (body instanceof Errors) {
      response.statusCode = body.status;
    }
    body = await this.serialize(body, action, options);
    let isProduction = lookup('config:environment').environment === 'production';
    response.write(JSON.stringify(body , null, isProduction ? 0 : 2) || '');
    response.end();
  }

  protected abstract async serialize(body: any, action: Action, options: RenderOptions): Promise<any>;

}
