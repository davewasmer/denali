import assert from 'assert';
import isNumber from 'lodash/isNumber';

/**
 * The Response class represents a response to an incoming request. You can
 * return an instance of this class from your action's responder method to
 * render a response with a custom status code, headers, or body.
 *
 * @class Response
 * @constructor
 * @module denali
 * @submodule runtime
 */
export default class Response {

  /**
   * Create a Response instance. Accepts a status code, a body payload, and an
   * options hash.
   *
   * @method constructor
   * @param status {Number} HTTP status code for the response
   * @param [body] {Object} a payload for the response body
   * @param [options] {Object}
   * @param [options.headers] {Object} headers to send with the response
   * @param [options.contentType] {String} value for the Content-Type response
   * header
   * @return {Response}
   */
  constructor(status, body, options = {}) {
    assert(isNumber(status), 'You must at least supply a status code when creating a response');
    this.status = status;
    this.body = body;
    this.options = options;
  }

  /**
   * The content type of the response. Set via the `options` argument of the
   * Response constructor.
   *
   * @property contentType
   * @type {String}
   */
  get contentType() {
    return this.options.contentType || 'application/json';
  }
  set contentType(value) {
    this.options.contentType = value;
  }

}
