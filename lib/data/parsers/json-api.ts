import {
  isArray,
  isEmpty,
  set,
  mapKeys,
  camelCase,
} from 'lodash';
import * as assert from 'assert';
import { singularize } from 'inflection';
import Errors from '../../runtime/errors';
import Parser, { ParsedRequest } from '../parser';
import Request from '../../runtime/request';
import { JsonApiResourceObject, JsonApiAttributes, JsonApiRelationships } from '../serializers/json-api';

/**
 * Ensures that the value is only set if it exists, so we avoid creating iterable keys on obj for
 * undefined values.
 */
function setIfNotEmpty(obj: any, key: string, value: any): void {
  if (!isEmpty(value)) {
    set<any, string, any>(obj, key, value);
  }
}

/**
 * Parses the request body according to the JSONAPI 1.0 spec, with support for included records,
 * meta, and links.
 *
 * @package data
 */
export default class JSONAPIParser extends Parser {

  /**
   * The JSON-API parser extracts the incoming request body's data.attributes and uses that as the
   * ParsedRequest's `body` property. Any `included` records, `meta`, or `links` are added directly
   * to the ParsedRequest that is returned.
   */
  public parse(request: Request): ParsedRequest {
    let parsedRequest = super.parse(request);
    try {
      assert(request.body.data, 'Invalid JSON-API document (missing top level `data` object - see http://jsonapi.org/format/#document-top-level)');
      let parseResource = this.parseResource.bind(this);
      if (request.body.data) {
        if (!isArray(request.body.data)) {
          parsedRequest.body = parseResource(request.body.data);
        } else {
          parsedRequest.body = request.body.data.map(parseResource);
        }
      }
      if (request.body.included) {
        parsedRequest.included = request.body.included.map(parseResource);
      }
      if (request.body.meta) {
        parsedRequest.meta = request.body.meta;
      }
      if (request.body.links) {
        parsedRequest.links = request.body.links;
      }
    } catch (e) {
      if (e.name === 'AssertionError') {
        throw new Errors.BadRequest(e.message);
      }
      throw e;
    }
    return parsedRequest;
  }

  /**
   * Parse a single resource object from a JSONAPI document. The resource object could come from the
   * top level `data` payload, or from the sideloaded `included` records.
   */
  protected parseResource(resource: JsonApiResourceObject): any {
    setIfNotEmpty(resource, 'id', this.parseId(resource.id));
    setIfNotEmpty(resource, 'attributes', this.parseAttributes(resource.attributes));
    setIfNotEmpty(resource, 'relationships', this.parseRelationships(resource.relationships));
    return resource;
  }

  /**
   * Parse a resource object id
   */
  protected parseId(id: string): any {
    return id;
  }

  /**
   * Parse a resource object's type string
   */
  protected parseType(type: string): string {
    return singularize(type);
  }

  /**
   * Parse a resource object's attributes. By default, this converts from the JSONAPI recommended
   * dasheried keys to camelCase.
   */
  protected parseAttributes(attrs: JsonApiAttributes): any {
    return mapKeys(attrs, (value, key) => {
      return camelCase(key);
    });
  }

  /**
   * Parse a resource object's relationships. By default, this converts from the JSONAPI recommended
   * dasheried keys to camelCase.
   */
  protected parseRelationships(relationships: JsonApiRelationships): any {
    return mapKeys(relationships, (value, key) => {
      return camelCase(key);
    });
  }

}
