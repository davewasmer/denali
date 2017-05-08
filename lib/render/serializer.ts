import View from './view';
import { ServerResponse } from 'http';
import Action, { RenderOptions } from '../runtime/action';

export interface RelationshipConfig {
  strategy?: 'embed' | 'id' | string;
  key?: string;
  serializer?: string;
}

/**
 * Serializers allow you to customize what data is returned in the response and apply simple
 * transformations to it. They allow you to decouple what data is sent from how that data is
 * structured / rendered.
 *
 * @package data
 */
export default abstract class Serializer extends View {

  protected contentType = 'application/json';

  /**
   * The list of attribute names that should be serialized. Attributes not included in this list
   * will be omitted from the final rendered payload.
   */
  protected abstract attributes: string[];

  /**
   * An object with configuration on how to serialize relationships. Relationships that have no
   * configuration present are omitted from the final rendered payload.
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
   * What the embedded records or ids look like is up to each serializer to determine.
   */
  protected abstract relationships: { [ relationshipName: string ]: RelationshipConfig };

  async render(action: Action, response: ServerResponse, body: any, options: RenderOptions): Promise<void> {
    response.setHeader('Content-type', this.contentType);
    body = await this.serialize(action, body, options);
    let isProduction = this.container.lookup('config:environment').environment === 'production';
    response.write(JSON.stringify(body , null, isProduction ? 0 : 2) || '');
    response.end();
  }

  protected abstract async serialize(action: Action, body: any, options: RenderOptions): Promise<any>;

}
