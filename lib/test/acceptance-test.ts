import * as path from 'path';
import { sync as glob } from 'glob';
import { all } from 'bluebird';
import { assign, forEach, mapKeys } from 'lodash';
import { RegisterContextual } from 'ava';
import { IncomingHttpHeaders } from 'http';
import MockRequest from './mock-request';
import MockResponse from './mock-response';
import Application from '../runtime/application';
import ORMAdapter from '../data/orm-adapter';
import { ContainerOptions, Container } from '../metal/container';

export interface AcceptanceTestContext {
  app: AcceptanceTest;
}

/**
 * The AppAcceptance class represents an app acceptance test. It spins up an
 * in-memory instance of the application under test, and exposes methods to
 * submit simulated requests to the application, and get the response. This
 * helps keep acceptance tests lightweight and easily parallelizable, since
 * they don't need to bind to an actual port.
 *
 * @package test
 * @since 0.1.0
 */
export class AcceptanceTest {

  /**
   * A helper method for setting up an app acceptance test. Adds
   * beforeEach/afterEach hooks to the current ava test suite which will setup
   * and teardown the acceptance test. They also setup a test transaction and
   * roll it back once the test is finished (for the ORM adapters that support
   * it), so your test data won't pollute the database.
   *
   * @package test
   * @since 0.1.0
   */
  static setupTest() {
    let ava = <RegisterContextual<AcceptanceTestContext>>require('ava');
    ava.beforeEach(async (t) => {
      let acceptanceTest = new AcceptanceTest();
      await acceptanceTest.setup(t.context);
    });
    ava.afterEach.always(async (t) => {
      await t.context.app.teardown();
    });
    return ava;
  }

  /**
   * The application instance under test
   */
  application: Application;

  /**
   * The container instance for this test
   */
  container: Container;

  /**
   * Default headers that are applied to each request. Useful for handling
   * API-wide content-types, sessions, etc.
   *
   * @since 0.1.0
   */
  headers: IncomingHttpHeaders = {
    accept: 'application/json',
    'content-type': 'application/json'
  };

  /**
   * An internal registry of container injections.
   */
  protected _injections: { [fullName: string]: any } = {};

  constructor() {
    let compiledPath = path.join(process.cwd(), process.env.DENALI_TEST_BUILD_DIR);
    let bundleFile = glob(path.join(compiledPath, '*.bundle.js'))[0];
    let bundle = require(bundleFile);
    this.container = bundle();
    let Application = this.container.lookup('app:application');
    this.application = new Application(this.container.loader, { environment: process.env.NODE_ENV || 'test' });
  }

  async setup(context: AcceptanceTestContext) {
    context.app = this;
    await this.start();
    let adapters = this.container.lookupAll<ORMAdapter>('orm-adapter');
    let transactionInitializers: Promise<void>[] = [];
    forEach(adapters, (Adapter) => {
      if (typeof Adapter.startTestTransaction === 'function') {
        transactionInitializers.push(Adapter.startTestTransaction());
      }
    });
    await all(transactionInitializers);
  }

  async teardown() {
    let transactionRollbacks: Promise<void>[] = [];
    let adapters = this.container.lookupAll<ORMAdapter>('orm-adapter');
    forEach(adapters, (Adapter) => {
      if (typeof Adapter.rollbackTestTransaction === 'function') {
        transactionRollbacks.push(Adapter.rollbackTestTransaction());
      }
    });
    await all(transactionRollbacks);
    await this.shutdown();
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
    options.headers = mapKeys(options.headers, (value, key) => key.toLowerCase()) || {};
    if (options.body) {
      body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      options.headers['transfer-encoding'] = 'chunked';
    }
    let req = new MockRequest({
      method: options.method.toUpperCase(),
      url: options.url,
      headers: assign({}, this.headers, options.headers)
    });
    return new Promise<{ status: number, body: any }>((resolve, reject) => {
      let res = new MockResponse(({ status, body, json }) => {
        if (status < 500) {
          resolve({ status: res.statusCode, body: json || body });
        } else {
          reject({ response: res, status, body, json });
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
    return this.request(Object.assign(options, { url, method: 'GET' }));
  }
  /**
   * Send a simulated HEAD request
   *
   * @since 0.1.0
   */
  async head(url: string, options = {}): Promise<{ status: number, body: any }> {
    return this.request(Object.assign(options, { url, method: 'HEAD' }));
  }
  /**
   * Send a simulated DELETE request
   *
   * @since 0.1.0
   */
  async delete(url: string, options = {}): Promise<{ status: number, body: any }> {
    return this.request(Object.assign(options, { url, method: 'DELETE' }));
  }
  /**
   * Send a simulated POST request
   *
   * @since 0.1.0
   */
  async post(url: string, body: any, options = {}): Promise<{ status: number, body: any }> {
    return this.request(Object.assign(options, { url, body, method: 'POST' }));
  }
  /**
   * Send a simulated PUT request
   *
   * @since 0.1.0
   */
  async put(url: string, body: any, options = {}): Promise<{ status: number, body: any }> {
    return this.request(Object.assign(options, { url, body, method: 'PUT' }));
  }
  /**
   * Send a simulated PATCH request
   *
   * @since 0.1.0
   */
  async patch(url: string, body: any, options = {}): Promise<{ status: number, body: any }> {
    return this.request(Object.assign(options, { url, body, method: 'PATCH' }));
  }

  /**
   * Get the current value of a default header
   *
   * @since 0.1.0
   */
  getHeader<T extends keyof IncomingHttpHeaders>(name: T) {
    name = <T>name.toLowerCase();
    return this.headers[name];
  }

  /**
   * Set a default header value
   *
   * @since 0.1.0
   */
  setHeader<T extends keyof IncomingHttpHeaders, U extends IncomingHttpHeaders[T]>(name: T, value: U): void {
    this.headers[name.toLowerCase()] = value;
  }

  /**
   * Remove a default header value
   *
   * @since 0.1.0
   */
  removeHeader(name: string): void {
    delete this.headers[name.toLowerCase()];
  }

  /**
   * Lookup an entry in the test application container
   *
   * @since 0.1.0
   */
  lookup(name: string): any {
    return this.container.lookup(name);
  }

  /**
   * Overwrite an entry in the test application container. Use `restore()` to
   * restore the original container entry later.
   *
   * @since 0.1.0
   */
  inject(name: string, value: any, options?: ContainerOptions): void {
    this._injections[name] = this.container.lookup(name);
    this.container.register(name, value, options);
    this.container.clearCache(name);
  }

  /**
   * Restore the original container entry for an entry that was previously
   * overwritten by `inject()`
   *
   * @since 0.1.0
   */
  restore(name: string): void {
    this.container.register(name, this._injections[name]);
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

export default <typeof AcceptanceTest.setupTest>AcceptanceTest.setupTest.bind(AcceptanceTest);
