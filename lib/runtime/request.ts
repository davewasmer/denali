import {
  dropRight
} from 'lodash';
import * as accepts from 'accepts';
import * as typeis from 'type-is';
import * as url from 'url';
import * as http from 'http';
import * as uuid from 'uuid';
import { Socket } from 'net';
import { Readable, Writable } from 'stream';
import DenaliObject from '../metal/object';
import Route from './route';

/**
 * Available HTTP methods (lowercased)
 *
 * @package runtime
 * @since 0.1.0
 */
export type Method = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options';

/**
 * The Request class represents an incoming HTTP request (specifically, Node's IncomingMessage).
 * It's designed with an express-compatible interface to allow interop with existing express
 * middleware.
 *
 * @package runtime
 * @since 0.1.0
 */
export default class Request extends DenaliObject {

  /**
   * A UUID generated unqiue to this request. Useful for tracing a request through the application.
   *
   * @since 0.1.0
   */
  id: string;

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
   *
   * @since 0.1.0
   */
  route: Route;

  /**
   * The requests params extracted from the route parser (i.e. just the URL segement params)
   *
   * @since 0.1.0
   */
  params: any;

  /**
   * baseUrl of the app, needed to simulate Express request api
   *
   * @since 0.1.0
   */
  baseUrl = '/';

  /**
   * Url of the request -> can be modified
   *
   * @since 0.1.0
   */
  url: string;

  /**
   * The incoming request body, buffered and parsed by the serializer (if applicable)
   *
   * @since 0.1.0
   */
  get body(): any {
    return (<any>this._incomingMessage).body;
  }
  set body(value) {
    (<any>this._incomingMessage).body = value;
  }

  /**
   * The name of the original action that was invoked for this request. Used when an error occurs
   * so the error action can see the original action that was invoked.
   */
  _originalAction: string;

  constructor(incomingMessage: http.IncomingMessage) {
    super();
    this._incomingMessage = incomingMessage;
    this.parsedUrl = url.parse(incomingMessage.url, true);
    this.url = this.parsedUrl.pathname;
    this.id = uuid.v4();
  }

  /**
   * The HTTP method of the request, lowercased
   *
   * @since 0.1.0
   */
  get method(): Method {
    return <Method>this._incomingMessage.method.toLowerCase();
  }

  /**
   * The host name specified in the request (not including port number)
   *
   * @since 0.1.0
   */
  get hostname(): string {
    let host = this.get('host');
    return (host || '').split(':')[0];
  }

  /**
   * The IP address of the incoming request's connection
   *
   * @since 0.1.0
   */
  get ip(): string {
    return this._incomingMessage.socket.remoteAddress;
  }

  /**
   * The original path, without any modifications by middleware
   * or the router.
   *
   * TODO: when denali supports mounting on a subpath, this should
   *       be updated to reflect the full path, and the path variable
   *       in this class will be the path *after* the subpath
   *
   * @since 0.1.0
   */
  get originalUrl(): string {
    return this.parsedUrl.pathname;
  }

  /**
   * The path extracted from the URL of the incoming request.
   *
   * @since 0.1.0
   */
  get path(): string {
    return this.parsedUrl.pathname;
  }

  /**
   * The protocol extracted from the URL of the incoming request
   *
   * @since 0.1.0
   */
  get protocol(): string {
    return this.parsedUrl.protocol.toLowerCase();
  }

  /**
   * The query params supplied with the request URL, parsed into an object
   *
   * @since 0.1.0
   */
  get query(): { [key: string]: string } {
    return this.parsedUrl.query;
  }

  /**
   * Whether or not this request was made over https
   *
   * @since 0.1.0
   */
  get secure(): boolean {
    return this.protocol === 'https:';
  }

  /**
   * Whether or not this request was made by a client library
   *
   * @since 0.1.0
   */
  get xhr(): boolean {
    return this.get('x-requested-with') === 'XMLHttpRequest';
  }

  /**
   * The headers of the incoming request
   *
   * @since 0.1.0
   */
  get headers(): { [key: string]: string } {
    return this._incomingMessage.headers;
  }

  /**
   * An array of subdomains of the incoming request:
   *     // GET foo.bar.example.com
   *     request.subdomains  // [ 'foo', 'bar' ]
   *
   * @since 0.1.0
   */
  get subdomains(): string[] {
    // Drop the tld and root domain name
    return dropRight(this.hostname.split('.'), 2);
  }

  /*
   * Additional public properties of the IncomingMessage object
   */

  get httpVersion(): string {
    return this._incomingMessage.httpVersion;
  }

  get rawHeaders(): string[] {
    return this._incomingMessage.rawHeaders;
  }

  get rawTrailers(): string[] {
    return this._incomingMessage.rawTrailers;
  }

  get socket(): Socket {
    return this._incomingMessage.socket;
  }

  get statusCode(): number {
    return this._incomingMessage.statusCode;
  }

  get statusMessage(): string {
    return this._incomingMessage.statusMessage;
  }

  get trailers(): { [key: string]: string } {
    return this._incomingMessage.trailers;
  }

  get connection(): Socket {
    return this._incomingMessage.connection;
  }

  /**
   * Returns the best match for content types, or false if no match is possible. See the docs for
   * the `accepts` module on npm for more details.
   *
   * @since 0.1.0
   */
  accepts(serverAcceptedTypes: string[]): string | boolean {
    return accepts(this._incomingMessage).type(serverAcceptedTypes);
  }

  /**
   * Gets the value of a header.
   *
   * @since 0.1.0
   */
  get(header: string): string {
    return this._incomingMessage.headers[header.toLowerCase()];
  }

  /**
   * Checks if the request matches the supplied content types. See type-is module for details.
   *
   * @since 0.1.0
   */
  is(...types: string[]): string | boolean {
    return <string|boolean>typeis(this._incomingMessage, types);
  }

  /*
   * Below are methods from the IncomingMessage class, which includes the public methods
   * of the Readable & EventEmitter interfaces as well
   */

  /*
   * EventEmitter methods
   */

  addListener(eventName: any, listener: Function): Request {
    this._incomingMessage.addListener(eventName, listener);
    return this;
  }

  emit(eventName: any, ...args: any[]): boolean {
    return this._incomingMessage.emit(eventName, ...args);
  }

  eventNames(): any[] {
    return this._incomingMessage.eventNames();
  }

  getMaxListeners(): number {
    return this._incomingMessage.getMaxListeners();
  }

  listenerCount(eventName: any): number {
    return this._incomingMessage.listenerCount(eventName);
  }

  listeners(eventName: any): Function[] {
    return this._incomingMessage.listeners(eventName);
  }

  on(eventName: any, listener: Function): Request {
    this._incomingMessage.on(eventName, listener);
    return this;
  }

  once(eventName: any, listener: Function): Request {
    this._incomingMessage.once(eventName, listener);
    return this;
  }

  prependListener(eventName: any, listener: Function): Request {
    this._incomingMessage.prependListener(eventName, listener);
    return this;
  }

  prependOnceListener(eventName: any, listener: Function): Request {
    this._incomingMessage.prependOnceListener(eventName, listener);
    return this;
  }

  removeAllListeners(eventName?: any): Request {
    this._incomingMessage.removeAllListeners(eventName);
    return this;
  }

  removeListener(eventName: any, listener: Function): Request {
    this._incomingMessage.removeListener(eventName, listener);
    return this;
  }

  setMaxListeners(n: number): Request {
    this._incomingMessage.setMaxListeners(n);
    return this;
  }

  /*
   * Readable methods
   */

  isPaused(): boolean {
    return this._incomingMessage.isPaused();
  }

  pause(): Request {
    this._incomingMessage.pause();
    return this;
  }

  pipe(destination: Writable, options?: Object): Writable {
    return this._incomingMessage.pipe(destination, options);
  }

  read(size?: number): string | Buffer | null {
    return this._incomingMessage.read(size);
  }

  resume(): Request {
    this._incomingMessage.resume();
    return this;
  }

  setEncoding(encoding: string): Request {
    this._incomingMessage.setEncoding(encoding);
    return this;
  }

  unpipe(destination?: Writable) {
    return this._incomingMessage.unpipe(destination);
  }

  unshift(chunk: Buffer | string | any) {
    return this._incomingMessage.unshift(chunk);
  }

  wrap(stream: Readable) {
    return this._incomingMessage.wrap(stream);
  }

  /*
   * IncomingMessage methods
   */

  destroy(error: Error) {
    return this._incomingMessage.destroy(error);
  }

  setTimeout(msecs: number, callback: Function): Request {
    this._incomingMessage.setTimeout(msecs, callback);
    return this;
  }
}
