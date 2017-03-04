import {
  dropRight,
  uniq,
  isArray
} from 'lodash';
import * as accepts from 'accepts';
import typeis from 'type-is';
import * as url from 'url';
import * as http from 'http';
import * as uuid from 'uuid';
import DenaliObject from '../metal/object';
import Route from './route';

/**
 * Available HTTP methods (lowercased)
 *
 * @package runtime
 */
export type Method = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';

/**
 * The Request class represents an incoming HTTP request (specifically, Node's IncomingMessage).
 * It's designed with an express-compatible interface to allow interop with existing express
 * middleware.
 *
 * @package runtime
 */
export default class Request extends DenaliObject {

  /**
   * A UUID generated unqiue to this request. Useful for tracing a request through the application.
   */
  public id: string;

  /**
   * The parsed URL of the IncomingMessage
   */
  private parsedUrl: url.Url;

  /**
   * The original IncomingMessage from the HTTP library.
   */
  private _incomingMessage: http.IncomingMessage;

  /**
   * The route parser route that was matched
   */
  public route: Route;

  /**
   * The requests params extracted from the route parser (i.e. just the URL segement params)
   */
  public params: any;

  /**
   * The incoming request body, buffered and parsed by the serializer (if applicable)
   */
  public body: any;

  /**
   * The name of the original action that was invoked for this request. Used when an error occurs
   * so the error action can see the original action that was invoked.
   */
  public _originalAction: string;

  constructor(incomingMessage: http.IncomingMessage) {
    super();
    this._incomingMessage = incomingMessage;
    this.parsedUrl = url.parse(incomingMessage.url, true);
    this.id = uuid.v4();
  }

  /**
   * The HTTP method of the request, lowercased
   */
  public get method(): Method {
    return <Method>this._incomingMessage.method.toLowerCase();
  }

  /**
   * The host name specified in the request (not including port number)
   */
  public get hostname(): string {
    let host = this._incomingMessage.headers.Host;
    return (host || '').split(':')[0];
  }

  /**
   * The IP address of the incoming request's connection
   */
  public get ip(): string {
    return this._incomingMessage.socket.remoteAddress;
  }

  /**
   * The path extracted from the URL of the incoming request.
   */
  public get path(): string {
    return this.parsedUrl.pathname;
  }

  /**
   * The query params supplied with the request URL, parsed into an object
   */
  public get query(): { [key: string]: string } {
    return this.parsedUrl.query;
  }

  /**
   * The headers of the incoming request
   */
  public get headers(): { [key: string]: string } {
    return this._incomingMessage.headers;
  }

  /**
   * An array of subdomains of the incoming request:
   *     // GET foo.bar.example.com
   *     request.subdomains  // [ 'foo', 'bar' ]
   */
  public get subdomains(): string[] {
    // Drop the tld and root domain name
    return dropRight(this.hostname.split('.'), 2);
  }

  /**
   * Returns the best match for content types, or false if no match is possible. See the docs for
   * the `accepts` module on npm for more details.
   */
  public accepts(serverAcceptedTypes: string[]): string | boolean {
    return accepts(this._incomingMessage).type(serverAcceptedTypes);
  }

  /**
   * Gets the value of a header.
   */
  public get(header: string): string {
    return this._incomingMessage.headers[header.toLowerCase()];
  }

  /**
   * Checks if the request matches the supplied content types. See type-is module for details.
   */
  public is(...types: string[]): string | boolean {
    return <string|boolean>typeis(this._incomingMessage, types);
  }

}
