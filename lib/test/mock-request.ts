import { Transform } from 'stream';
import { without, toString, mapValues, mapKeys, flatten, toPairs } from 'lodash';

/**
 * A mock request used to simluate an HTTP request to the application during tests. You shouldn't
 * need to instantiate these directly - instead, use an AppAcceptance test.
 *
 * @package test
 */
export default class MockRequest extends Transform {

  // Mock internals of IncomingMessage
  // tslint:disable:completed-docs member-access
  method: string;
  url: string;
  headers: {
    [key: string]: string
  };
  rawHeaders: string[];

  _writableState: any;
  _readableState: any;

  socket = {
    remoteAddress: '123.45.67.89'
  };

  constructor(options: { method?: string, url?: string, headers?: { [key: string]: string } } = {}) {
    super();
    this._writableState.objectMode = true;
    this._readableState.objectMode = false;

    this.method = options.method || 'GET';
    this.url = options.url || '';
    this.headers = options.headers || {};

    this.method = this.method.toUpperCase();

    if ([ 'POST', 'PUT', 'PATCH' ].indexOf(this.method) > -1) {
      this.headers['Transfer-Encoding'] = 'chunked';
    }

    this.headers = mapValues(this.headers, toString);
    this.headers = mapKeys(this.headers, (value, key) => {
      return key.toLowerCase();
    });
    this.rawHeaders = flatten(toPairs(this.headers));

    if ([ 'POST', 'PUT', 'PATCH' ].indexOf(this.method) === -1) {
      delete this.headers['content-type'];
      this.rawHeaders = without(this.rawHeaders, 'content-type');
    }
  }

  _transform(chunk: string | Buffer | {}, encoding: string, next: () => void) {
    if (typeof chunk !== 'string' && !Buffer.isBuffer(chunk)) {
      chunk = JSON.stringify(chunk);
    }
    this.push(chunk);
    next();
  }
  // tslint:enable:completed-docs

}
