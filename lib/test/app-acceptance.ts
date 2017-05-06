import * as path from 'path';
import { all } from 'bluebird';
import {
  assign,
  forEach
} from 'lodash';
import MockRequest from './mock-request';
import MockResponse from './mock-response';
import DenaliObject from '../metal/object';
import Application from '../runtime/application';

/**
 * The AppAcceptance class represents an app acceptance test. It spins up an in-memory instance of
 * the application under test, and exposes methods to submit simulated requests to the application,
 * and get the response. This helps keep acceptance tests lightweight and easily parallelizable,
 * since they don't need to bind to an actual port.
 *
 * @package test
 * @since 0.1.0
 */
export class AppAcceptance extends DenaliObject {

  /**
   * The application instance under test
   */
  application: Application;

  /**
   * Default headers that are applied to each request. Useful for handling API-wide content-types,
   * sessions, etc.
   *
   * @since 0.1.0
   */
  headers: { [name: string]: string } = {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };

  /**
   * An internal registry of container injections.
   */
  protected _injections: { [fullName: string]: any } = {};

  constructor() {
    super();
    let compiledPath = process.cwd();
    let ApplicationClass: typeof Application = require(path.join(compiledPath, 'app/application')).default;
    let environment = process.env.NODE_ENV || 'test';
    this.application = new ApplicationClass({
      environment,
      dir: compiledPath,
      addons: <string[]>[]
    });
  }

  /**
   * Start the application (note: this won't actually start the HTTP server, but performs all the
   * other startup work for you).
   *
   * @since 0.1.0
   */
  async start(): Promise<void> {
    await this.application.runInitializers();
  }

  /**
   * Submit a simulated HTTP request to the application.
   *
   * @since 0.1.0
   */
  async request(options: { method: string, url: string, body?: any, headers?: { [key: string]: string } }): Promise<{ status: number, body: any }> {
    let body: any = null;
    if (options.body) {
      body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      options.headers = options.headers || {};
      options.headers['Transfer-Encoding'] = 'chunked';
    }
    let req = new MockRequest({
      method: options.method,
      url: options.url,
      headers: assign({}, this.headers, options.headers)
    });
    return new Promise<{ status: number, body: any }>((resolve, reject) => {
      let res = new MockResponse(() => {
        let resBody = res._getString();
        if (res.statusCode < 500) {
          try {
            resBody = res._getJSON();
          } finally {
            resolve({ status: res.statusCode, body: resBody });
          }
        } else {
          resBody = resBody.replace(/\\n/g, '\n');
          reject(new Error(`Request failed - ${ req.method.toUpperCase() } ${ req.url } returned a ${ res.statusCode }:\n${ resBody }`));
        }
      });

      // tslint:disable-next-line:no-floating-promises
      this.application.router.handle(<any>req, <any>res);

      let SIMULATED_WRITE_DELAY = 10;
      setTimeout(() => {
        if (body) {
          req.write(body);
        }
        req.end();
      }, SIMULATED_WRITE_DELAY);
    });
  }

  /**
   * Send a simulated GET request
   *
   * @since 0.1.0
   */
  async get(url: string, options = {}): Promise<{ status: number, body: any }> {
    return this.request(Object.assign(options, { url, method: 'get' }));
  }
  /**
   * Send a simulated HEAD request
   *
   * @since 0.1.0
   */
  async head(url: string, options = {}): Promise<{ status: number, body: any }> {
    return this.request(Object.assign(options, { url, method: 'head' }));
  }
  /**
   * Send a simulated DELETE request
   *
   * @since 0.1.0
   */
  async delete(url: string, options = {}): Promise<{ status: number, body: any }> {
    return this.request(Object.assign(options, { url, method: 'delete' }));
  }
  /**
   * Send a simulated POST request
   *
   * @since 0.1.0
   */
  async post(url: string, body: any, options = {}): Promise<{ status: number, body: any }> {
    return this.request(Object.assign(options, { url, body, method: 'post' }));
  }
  /**
   * Send a simulated PUT request
   *
   * @since 0.1.0
   */
  async put(url: string, body: any, options = {}): Promise<{ status: number, body: any }> {
    return this.request(Object.assign(options, { url, body, method: 'put' }));
  }
  /**
   * Send a simulated PATCH request
   *
   * @since 0.1.0
   */
  async patch(url: string, body: string, options = {}): Promise<{ status: number, body: any }> {
    return this.request(Object.assign(options, { url, body, method: 'patch' }));
  }

  /**
   * Get the current value of a default header
   *
   * @since 0.1.0
   */
  getHeader(name: string): string {
    return this.headers[name];
  }

  /**
   * Set a default header value
   *
   * @since 0.1.0
   */
  setHeader(name: string, value: string): void {
    this.headers[name] = value;
  }

  /**
   * Remove a default header value
   *
   * @since 0.1.0
   */
  removeHeader(name: string): void {
    delete this.headers[name];
  }

  /**
   * Lookup an entry in the test application container
   *
   * @since 0.1.0
   */
  lookup(name: string): any {
    return this.application.container.lookup(name);
  }

  /**
   * Overwrite an entry in the test application container. Use `restore()` to restore the original
   * container entry later.
   *
   * @since 0.1.0
   */
  inject(name: string, value: any): void {
    this._injections[name] = this.application.container.lookup(name);
    this.application.container.register(name, value);
  }

  /**
   * Restore the original container entry for an entry that was previously overwritten by `inject()`
   *
   * @since 0.1.0
   */
  restore(name: string): void {
    this.application.container.register(name, this._injections[name]);
    delete this._injections[name];
  }

  /**
   * Shut down the test application, cleaning up any resources in use
   *
   * @since 0.1.0
   */
  async shutdown(): Promise<void> {
    await this.application.shutdown();
  }

}

/**
 * A helper method for setting up an app acceptance test. Adds beforeEach/afterEach hooks to the
 * current ava test suite which will setup and teardown the acceptance test. They also setup a test
 * transaction and roll it back once the test is finished (for the ORM adapters that support it), so
 * your test data won't pollute the database.
 *
 * @package test
 * @since 0.1.0
 */
export default function appAcceptanceTest(ava: any) {

  ava.beforeEach(async (t: any) => {
    let app = t.context.app = new AppAcceptance();
    await app.start();
    let adapters = app.application.container.lookupAll('orm-adapter');
    let transactionInitializers: Promise<void>[] = [];
    forEach(adapters, (Adapter) => {
      if (typeof Adapter.startTestTransaction === 'function') {
        transactionInitializers.push(Adapter.startTestTransaction());
      }
    });
    await all(transactionInitializers);
  });

  ava.afterEach.always(async (t: any) => {
    let app = t.context.app;
    let transactionRollbacks: Promise<void>[] = [];
    let adapters = app.application.container.lookupAll('orm-adapter');
    forEach(adapters, (Adapter) => {
      if (typeof Adapter.rollbackTestTransaction === 'function') {
        transactionRollbacks.push(Adapter.rollbackTestTransaction());
      }
    });
    await all(transactionRollbacks);
    await app.shutdown();
  });

}
