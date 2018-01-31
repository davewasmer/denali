import { Writable } from 'stream';
import { Socket } from 'net';
import { ServerResponse as HttpServerResponse, OutgoingHttpHeaders, STATUS_CODES } from 'http';

/**
 * A mock response used to simluate the server response to mock requests during
 * tests. You shouldn't need to instantiate these directly - instead, use an
 * AppAcceptance test.
 *
 * @package test
 */
// tslint:disable:completed-docs member-access
export default class MockResponse extends Writable implements HttpServerResponse, Foobar {

  // Response data
  statusCode: number;
  get statusMessage(): string {
    return this._customStatusMessage || STATUS_CODES[this.statusCode];
  }
  _headers: OutgoingHttpHeaders = {};

  // Settings
  upgrading = false;
  chunkedEncoding = false;
  shouldKeepAlive = false;
  useChunkedEncodingByDefault = false;
  sendDate = true;

  // Response state
  finished = false;
  headersSent = false;

  connection = new Socket();

  protected _customStatusMessage: string;

  _body = '';
  _json: any;

  constructor(callback?: (result: { status: number, body: string, json: any }) => void) {
    super();
    this.on('finish', () => {
      try {
        this._json = JSON.parse(this._body);
      } catch (e) { /* don't care if we can't parse, just ignore it */ }
      if (callback) {
        callback({ status: this.statusCode, body: this._body, json: this._json });
      }
    });
  }

  write(chunk: Buffer | string, encoding?: string | Function, cb?: Function): boolean {
    if (Buffer.isBuffer(chunk)) {
      chunk = chunk.toString();
    }
    this._body += chunk;
    if (cb) {
      setImmediate(cb);
    }
    return true;
  }

  // Outgoing Message interface
  _implicitHeader(): void { /* noop */ }
  setHeader(name: string, value: number | string | string[]): void {
    this._headers[name] = value;
  }
  getHeader(name: string): string | number | string[] {
    return this._headers[name];
  }
  getHeaders(): OutgoingHttpHeaders {
    return this._headers;
  }
  getHeaderNames(): string[] {
    return Object.keys(this._headers);
  }
  hasHeader(name: string): boolean {
    return Boolean(this._headers[name]);
  }
  removeHeader(name: string): void {
    delete this._headers[name];
  }
  addTrailers(headers: OutgoingHttpHeaders | [string, string][]): void {
    throw new Error('Trailing headers are not supported on requests without chunked encoding, and MockResponse does not support chunked encoding yet.');
  }
  flushHeaders(): void { /* noop */ }

  writeHead(statusCode: number, statusMessage?: string | OutgoingHttpHeaders, headers?: OutgoingHttpHeaders): void {
    this.statusCode = statusCode;
    if (typeof statusMessage === 'string') {
      this._customStatusMessage = statusMessage;
      Object.assign(this._headers, headers);
    } else {
      Object.assign(this._headers, statusMessage);
    }
  }

  writeContinue() { /* noop - can be provided in options */ }

  assignSocket(socket: Socket): void { /* noop */ }
  detachSocket(socket: Socket): void { /* noop */ }
  setTimeout(msecs: number, callback?: () => void): this  {
    this.connection.setTimeout(msecs, callback);
    return this;
  }

}
