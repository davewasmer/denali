import {
  isArray,
  uniq,
  flatten,
  compact,
  map,
  clone
} from 'lodash';
import Instrumentation from '../metal/instrumentation';
import Model from '../data/model';
import Parser from '../parse/parser';
import * as createDebug from 'debug';
import * as assert from 'assert';
import eachPrototype from '../metal/each-prototype';
import DenaliObject from '../metal/object';
import Request from './request';
import Errors from './errors';
import View from '../render/view';
import { ServerResponse } from 'http';
import { Dict } from '../utils/types';
import inject from '../metal/inject';
import Serializer from '../render/serializer';
import DatabaseService from '../data/database';
import Logger from './logger';
import { RelationshipConfigs } from '../render/serializer';

const debug = createDebug('denali:action');

export interface Responder {
  (params: ResponderParams): any;
}

/**
 * The parser determines the exact shape and structure of the arguments object passed into your
 * Action's respond method. However, the common convention is to at least expose the properties
 * listed below.
 *
 * *Note for Typescript users:*
 *
 * It's possible to have a parser that returns a query object with non-string properties (i.e. your
 * parser automatically converts the `page=4` query param into a number). In that case, you should
 * probably define your own interface that extends from this, and use that interface to type your
 * respond method argument.
 */
export interface ResponderParams {
  body?: any;
  query?: Dict<string>;
  headers?: Dict<string>;
  params?: Dict<string>;
  [key: string]: any;
}

export interface RenderOptions {
  /**
   * The view class that should be used to render this response. Overrides the `serializer` setting.
   * This is useful if you want complete, low-level control over the rendering process - you'll have
   * direct access to the response object, and can use it to render however you want. Render with
   * a streaming JSON renderer, use an HTML templating engine, a binary protocol, etc.
   */
  view?: string;
  /**
   * Explicitly set the name of the serializer that should be used to render this response. If not
   * provided, and the response body is a Model or array of Models, it will try to find a matching
   * serializer and use that. If it can't find the matching serializer, or if the response body is
   * another kind of object, it will fall back to the application serializer.
   */
  serializer?: string;
  /**
   * Override which attributes should be serialized.
   */
  attributes?: string[];
  /**
   * Override which relationships should be serialized.
   */
  relationships?: RelationshipConfigs;
}

/**
 * Actions form the core of interacting with a Denali application. They are the controller layer in
 * the MVC architecture, taking in incoming requests, performing business logic, and handing off to
 * the renderer to send the response.
 *
 * When a request comes in, Denali will invoke the `respond` method (or `respondWith__` for content
 * negotiated requests) on the matching Action class. The return value (or resolved return value) of
 * this method is used to render the response.
 *
 * Actions also support filters. Simply define a method on your action, and add the method name to
 * the `before` or `after` array. Filters behave similar to responders in that they receive the
 * request params and can return a promise which will be waited on before continuing. Filters are
 * inheritable, so child classes will run filters added by parent classes.
 *
 * @package runtime
 * @since 0.1.0
 */
export default abstract class Action extends DenaliObject {

  /**
   * Invoked before the `respond()` method. The framework will invoke filters from parent classes
   * and mixins in the same order the mixins were applied.
   *
   * Filters can be synchronous, or return a promise (which will pause the before/respond/after
   * chain until it resolves).
   *
   * If a before filter returns any value (or returns a promise which resolves to any value) other
   * than null or undefined, Denali will attempt to render that response and halt further processing
   * of the request (including remaining before filters).
   *
   * Filters must be defined as static properties to allow Denali to extract the values. Instance
   * fields are not visible until instantiation, so there's no way to build an "accumulated" value
   * from each step in the inheritance chain.
   *
   * @since 0.1.0
   */
  static before: string[] = [];

  /**
   * Invoked after the `respond()` method. The framework will invoke filters from parent classes and
   * mixins in the same order the mixins were applied.
   *
   * Filters can be synchronous, or return a promise (which will pause the before/respond/after
   * chain until it resolves).
   *
   * Filters must be defined as static properties to allow Denali to extract the values. Instance
   * fields are not visible until instantiation, so there's no way to build an "accumulated" value
   * from each step in the inheritance chain.
   *
   * @since 0.1.0
   */
  static after: string[] = [];

  /**
   * Application config
   */
  config = inject<any>('config:environment');

  /**
   * Force which parser should be used for parsing the incoming request.
   *
   * By default it uses the application parser, but you can override with the name of the parser
   * you'd rather use instead.
   *
   * @since 0.1.0
   */
  parser = inject<Parser>('parser:application');

  /**
   * Automatically inject the db service into all actions
   *
   * @since 0.1.0
   */
  db = inject<DatabaseService>('service:db');

  /**
   * Automatically inject the logger into all actions
   *
   * @since 0.1.0
   */
  logger = inject<Logger>('app:logger');

  /**
   * The incoming Request that this Action is responding to.
   *
   * @since 0.1.0
   */
  request: Request;

  /**
   * The outgoing HTTP server response
   *
   * @since 0.1.0
   */
  response: ServerResponse;

  /**
   * Track whether or not we have rendered yet
   */
  private hasRendered = false;

  /**
   * The path to this action, i.e. 'users/create'
   */
  actionPath: string;

  /**
   * Automatically inject the db service
   */
  // db = inject<DatabaseService>('service:db');

  /**
   * Render the response body
   */

  async render(body: any, options?: RenderOptions): Promise<void>;
  async render(status: number, body?: any, options?: RenderOptions): Promise<void>;
  async render(status: number, body?: any, options?: RenderOptions): Promise<void> {
    if (typeof status !== 'number') {
      options = body;
      body = status;
      status = 200;
    }
    if (!options) {
      options = {};
    }

    this.hasRendered = true;

    debug(`[${ this.request.id }]: rendering`);
    this.response.setHeader('X-Request-Id', this.request.id);

    debug(`[${ this.request.id }]: setting response status code to ${ status }`);
    this.response.statusCode = status;

    if (!body) {
      debug(`[${ this.request.id }]: no response body to render, response finished`);
      this.response.end();
      return;
    }

    // Render with a custom view if requested
    if (options.view) {
      let view = this.container.lookup<View>(`view:${ options.view }`);
      assert(view, `No such view: ${ options.view }`);
      debug(`[${ this.request.id }]: rendering response body with the ${ options.view } view`);
      return await view.render(this, this.response, body, options);
    }

    // Pick the serializer to use
    let serializerLookup = 'application';
    if (options.serializer) {
      serializerLookup = options.serializer;
    } else {
      let sample = isArray(body) ? body[0] : body;
      if (sample instanceof Model) {
        serializerLookup = sample.type;
      }
    }

    // Render with the serializer
    let serializer = this.container.lookup<Serializer>(`serializer:${ serializerLookup }`);
    debug(`[${ this.request.id }]: rendering response body with the ${ serializerLookup } serializer`);
    return await serializer.render(this, this.response, body, options);
  }

  /**
   * Invokes the action. Determines the best responder method for content negotiation, then executes
   * the filter/responder chain in sequence, handling errors and rendering the response.
   *
   * You shouldn't invoke this directly - Denali will automatically wire up your routes to this
   * method.
   */
  async run(request: Request, response: ServerResponse) {
    this.request = request;
    this.response = response;

    // Parse the incoming request based on the action's chosen parser
    debug(`[${ request.id }]: parsing request`);
    assert(typeof this.parser.parse === 'function', 'The parser you supply must define a `parse(request)` method. See the parser docs for details');
    let parsedRequest: ResponderParams = this.parser.parse(request);

    // Build the before and after filter chains
    let { beforeChain, afterChain } = this._buildFilterChains();

    let instrumentation = Instrumentation.instrument('action.run', {
      action: this.actionPath,
      parsed: parsedRequest
    });

    // Before filters
    debug(`[${ this.request.id }]: running before filters`);
    await this._invokeFilters(beforeChain, parsedRequest);

    // Responder
    if (!this.hasRendered) {
      debug(`[${ this.request.id }]: running responder`);
      let result = await this.respond(parsedRequest);
      // Autorender if render has not been manually called and a value was returned
      if (!this.hasRendered) {
        debug(`[${ this.request.id }]: autorendering`);
        await this.render(result);
      }
    }

    // After filters
    debug(`[${ this.request.id }]: running after filters`);
    await this._invokeFilters(afterChain, parsedRequest);

    // If no one has rendered, bail
    if (!this.hasRendered) {
      throw new Errors.InternalServerError(`${ this.actionPath } did not render anything`);
    }

    instrumentation.finish();
  }

  /**
   * The default responder method. You should override this method with whatever logic is needed to
   * respond to the incoming request.
   *
   * @since 0.1.0
   */
  abstract respond(params: ResponderParams): any;

  /**
   * Invokes the filters in the supplied chain in sequence.
   */
  private async _invokeFilters(chain: string[], parsedRequest: ResponderParams): Promise<any> {
    chain = clone(chain);
    while (chain.length > 0) {
      let filterName = chain.shift();
      let filter = <Responder>(<any>this)[filterName];
      let instrumentation = Instrumentation.instrument('action.filter', {
        action: this.actionPath,
        request: parsedRequest,
        filter: filterName
      });
      debug(`[${ this.request.id }]: running '${ filterName }' filter`);
      let filterResult = await filter.call(this, parsedRequest);
      instrumentation.finish();
      if (!this.hasRendered && filterResult) {
        return this.render(200, filterResult);
      }
    }
  }

  /**
   * Walk the prototype chain of this Action instance to find all the `before` and `after` arrays to
   * build the complete filter chains.
   *
   * Caches the result on the child Action class to avoid the potentially expensive prototype walk
   * on each request.
   *
   * Throws if it encounters the name of a filter method that doesn't exist.
   */
  private _buildFilterChains(): { beforeChain: string[], afterChain: string[] } {
    let meta = this.container.metaFor(this.constructor);
    if (!meta.beforeFiltersCache) {
      let prototypeChain: Action[] = [];
      eachPrototype(<typeof Action>this.constructor, (prototype) => {
        prototypeChain.push(prototype);
      });
      prototypeChain = prototypeChain.reverse();
      [ 'before', 'after' ].forEach((stage) => {
        let cache: string[] = meta[`${ stage }FiltersCache`] = [];
        let filterNames = compact(uniq(flatten(map<Action, string[]>(prototypeChain, stage))));
        filterNames.forEach((filterName) => {
          if (!(<any>this)[filterName]) {
            throw new Error(`${ filterName } method not found on the ${ this.actionPath } action.`);
          }
          cache.push(filterName);
        });
      });
    }
    return {
      beforeChain: meta.beforeFiltersCache,
      afterChain: meta.afterFiltersCache
    };
  }

}
