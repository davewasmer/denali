import { IncomingMessage as IncomingHttpMessage, IncomingHttpHeaders } from 'http';
import { PassThrough, Readable } from 'stream';
import * as url from 'url';
import { Socket } from 'net';
import { Dict } from '../utils/types';
import { mapKeys, toPairs, flatten } from 'lodash';


export interface MockMessageOptions {
  method?: string;
  url?: string;
  headers?: IncomingHttpHeaders;
  trailers?: Dict<string>;
  httpVersion?: string;
  json?: any;
  body?: Readable | Buffer | string;
}

/**
 * A mock request used to simluate an HTTP request to the application during
 * tests. You shouldn't need to instantiate these directly - instead, use an
 * AppAcceptance test.
 *
 * @package test
 */
export default class MockRequest extends PassThrough implements IncomingHttpMessage {

  httpVersion = '1.1';
  get httpVersionMajor() {
    return Number(this.httpVersion.split('.')[0]);
  }
  get httpVersionMinor() {
    return Number(this.httpVersion.split('.')[1]);
  }

  connection: Socket;
  get socket(): Socket {
    return this.connection;
  }

  headers: IncomingHttpHeaders = {};
  get rawHeaders(): string[] {
    return flatten(toPairs(this.headers));
  }

  method = 'GET';
  url = '/';

  trailers: Dict<string> = {};
  get rawTrailers(): string[] {
    return flatten(toPairs(this.trailers));
  }

  readable = true;

  constructor(options: MockMessageOptions = {}) {
    super();

    this.method = options.method || this.method;

    let parsedUrl = url.parse(options.url || this.url);
    this.url = parsedUrl.path;

    if (options.headers) {
      this.headers = mapKeys(options.headers, (value, key) => key.toLowerCase());
    }
    if (options.trailers) {
      this.trailers = mapKeys(options.trailers, (value, key) => key.toLowerCase());
    }

    this.httpVersion = options.httpVersion || this.httpVersion;
    this.connection = new Socket();
    Object.defineProperty(this.connection, 'remoteAddress', {
      value: '192.168.1.1'
    });
    Object.defineProperty(this.connection, 'encrypted', {
      get: () => {
        return parsedUrl.protocol === 'https:';
      }
    });

    let json = options.json;
    if (json) {
      options.body = JSON.stringify(options.json);
      this.headers['content-type'] = this.headers['content-type'] || 'application/json';
    }

    let body = options.body;
    if (body) {
      if (isReadableStream(body)) {
        body.pipe(this);
      } else {
        if (!this.headers['content-length']) {
          this.headers['content-length'] = String(body.length);
        }
        this.write(body);
        this.end();
      }
    }
  }

  setTimeout(msecs: number, callback: () => void): this {
    return this;
  }
  destroy() {
    // noop
  }

}

function isReadableStream(stream: any): stream is Readable {
  return typeof stream.pipe === 'function';
}
