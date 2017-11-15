import {
  isArray,
  mapKeys,
  camelCase
} from 'lodash';
import * as assert from 'assert';
import JSONParser from './json';
import Errors from '../runtime/errors';
import { ResponderParams } from '../runtime/action';
import Request from '../runtime/request';
import setIfNotEmpty from '../utils/set-if-not-empty';
import { singularize } from 'inflection';
import {
  ResourceObject as JSONAPIResourceObject,
  AttributesObject as JSONAPIAttributesObject,
  RelationshipsObject as JSONAPIRelationshipsObject
} from 'jsonapi-typescript';

/**
 * Parses incoming request bodies according to the JSON-API specification. For
 * incoming payloads with `included` arrays, the primary `data` is returned
 * under the `body` key, and `included` is moved to it's own property.
 *
 * @package parse
 * @since 0.1.0
 */
export default class JSONAPIParser extends JSONParser {

  /**
   * The media type for JSON-API requests. If the incoming request doesn't have
   * this Content Type, the parser will immediately render a 400 Bad Request response
   */
  type = 'application/vnd.api+json';

  async parse(request: Request) {
    let body = await this.bufferAndParseBody(request);

    let result: ResponderParams = {
      query: request.query,
      headers: request.headers,
      params: request.params
    };

    if (!request.hasBody) {
      return result;
    }

    try {
      assert(request.getHeader('content-type') === 'application/vnd.api+json', 'Invalid content type - must have `application/vnd.api+json` as the request content type');
      assert(body.data, 'Invalid JSON-API document (missing top level `data` object - see http://jsonapi.org/format/#document-top-level)');

      let parseResource = this.parseResource.bind(this);

      if (body.data) {
        if (!isArray(body.data)) {
          result.body = parseResource(body.data);
        } else {
          result.body = body.data.map(parseResource);
        }
      }

      if (body.included) {
        result.included = body.included.map(parseResource);
      }

      return result;
    } catch (e) {
      if (e.name === 'AssertionError') {
        throw new Errors.BadRequest(e.message);
      }
      throw e;
    }
  }


  /**
   * Parse a single resource object from a JSONAPI document. The resource
   * object could come from the top level `data` payload, or from the
   * sideloaded `included` records.
   *
   * @since 0.1.0
   */
  protected parseResource(resource: JSONAPIResourceObject): any {
    let parsedResource = {};
    setIfNotEmpty(parsedResource, 'id', this.parseId(resource.id));
    Object.assign(parsedResource, this.parseAttributes(resource.attributes));
    Object.assign(parsedResource, this.parseRelationships(resource.relationships));
    return parsedResource;
  }

  /**
   * Parse a resource object id
   *
   * @since 0.1.0
   */
  protected parseId(id: string): any {
    return id;
  }

  /**
   * Parse a resource object's type string
   *
   * @since 0.1.0
   */
  protected parseType(type: string): string {
    return singularize(type);
  }

  /**
   * Parse a resource object's attributes. By default, this converts from the
   * JSONAPI recommended dasheried keys to camelCase.
   *
   * @since 0.1.0
   */
  protected parseAttributes(attrs: JSONAPIAttributesObject): any {
    return mapKeys(attrs, (value, key) => {
      return camelCase(key);
    });
  }

  /**
   * Parse a resource object's relationships. By default, this converts from
   * the JSONAPI recommended dasheried keys to camelCase.
   *
   * @since 0.1.0
   */
  protected parseRelationships(relationships: JSONAPIRelationshipsObject): any {
    return mapKeys(relationships, (value, key) => {
      return camelCase(key);
    });
  }

}
