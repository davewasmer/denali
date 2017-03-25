import {
  assign,
  capitalize,
  isArray,
  uniq,
  flatten,
  compact,
  map
} from 'lodash';
import Instrumentation from '../metal/instrumentation';
import Model from '../data/model';
import Response from './response';
import * as http from 'http';
import * as createDebug from 'debug';
import * as assert from 'assert';
import eachPrototype from '../metal/each-prototype';
import DenaliObject from '../metal/object';
import Request from './request';
import Logger from './logger';
import Container from '../metal/container';
import Service from './service';
import Errors from './errors';
import Serializer from '../data/serializer';

const debug = createDebug('denali:action');

const cachedFormats = new WeakMap<typeof Action, string[]>();
const cachedFilters = {
  before: new WeakMap<typeof Action, string[]>(),
  after: new WeakMap<typeof Action, string[]>()
};

/**
 * An error used to break the chain of promises created by running filters. Indicates that a before
 * filter returned a value which will be rendered as the response, and that the remaining filters
 * and the responder method should not be run.
 */
class PreemptiveRender extends Error {
  public response: Response;
  constructor(response: Response) {
    super();
    this.response = response;
  }
}

/**
 * Constructor options for Action class
 *
 * @package runtime
 */
export interface ActionOptions {
  request: Request;
  response: http.ServerResponse;
  logger: Logger;
  container: Container;
}

export interface Responder {
  (params: any): Response | { [key: string]: any } | void;
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
abstract class Action extends DenaliObject {

  /**
   * Cache the list of available formats this action can respond to.
   */
  private static formats(): string[] {
    if (!cachedFormats.has(this)) {
      debug(`caching list of content types accepted by ${ this.name } action`);
      let formats: string[] = [];
      eachPrototype(this.prototype, (proto) => {
        formats = formats.concat(Object.getOwnPropertyNames(proto));
      });
      formats = formats.filter((prop) => {
        return /^respondWith/.test(prop);
      }).map((responder) => {
        return responder.match(/respondWith(.+)/)[1].toLowerCase();
      });
      formats = uniq(formats);
      cachedFormats.set(this, formats);
    }
    return cachedFormats.get(this);
  }

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
   * @since 0.1.0
   */
  public static before: string[] = [];

  /**
   * Invoked after the `respond()` method. The framework will invoke filters from parent classes and
   * mixins in the same order the mixins were applied.
   *
   * Filters can be synchronous, or return a promise (which will pause the before/respond/after
   * chain until it resolves).
   *
   * @since 0.1.0
   */
  public static after: string[] = [];

  /**
   * Force which serializer should be used for the rendering of the response.
   *
   * By default if the response is of type Error it will use the 'error' serializer. On the other
   * hand if it's a Model, it will use that model's serializer. Otherwise, it will use the
   * 'application' serializer.
   *
   * @since 0.1.0
   */
  public serializer: string | boolean = null;

  /**
   * The application config
   *
   * @since 0.1.0
   */
  public config: any;

  /**
   * The incoming Request that this Action is responding to.
   *
   * @since 0.1.0
   */
  public request: Request;

  /**
   * The application logger instance
   *
   * @since 0.1.0
   */
  public logger: Logger;

  /**
   * The application container
   *
   * @since 0.1.0
   */
  public container: Container;

  /**
   * Creates an Action that will respond to the given Request.
   */
  constructor(options: ActionOptions) {
    super();
    this.request = options.request;
    this.logger = options.logger;
    this.container = options.container;
    this.config = this.container.lookup('app:main').config;
  }

  /**
   * Fetch a model class by it's type string, i.e. 'post' => PostModel
   *
   * @since 0.1.0
   */
  public modelFor(type: string): Model {
    return this.container.lookup(`model:${ type }`);
  }

  /**
   * Fetch a service by it's container name, i.e. 'email' => 'services/email.js'
   *
   * @since 0.1.0
   */
  public service(type: string): Service {
    return this.container.lookup(`service:${ type }`);
  }

  /**
   * Render some supplied data to the response. Data can be:
   *
   *   * a Model instance
   *   * an array of Model instances
   *   * a Denali.Response instance
   */
  private async render(response: any): Promise<Response> {
    debug(`[${ this.request.id }]: rendering`);
    if (!(response instanceof Response)) {
      debug(`[${ this.request.id }]: wrapping returned value in a Response`);
      response = new Response(200, response);
    }

    response.options.action = this;

    if (response.body && response.options.raw !== true && this.serializer !== false) {
      let sample = isArray(response.body) ? response.body[0] : response.body;
      let type;
      if (this.serializer) {
        type = this.serializer;
      } else if (sample instanceof Error) {
        type = 'error';
      } else if (sample instanceof Model) {
        type = sample.type;
      } else {
        type = 'application';
      }
      let serializer: Serializer = this.container.lookup(`serializer:${ type }`);
      debug(`[${ this.request.id }]: serializing response body with ${ type } serializer`);
      await serializer.serialize(response, assign({ action: this }, response.options));
    }

    return response;
  }

  /**
   * Invokes the action. Determines the best responder method for content negotiation, then executes
   * the filter/responder chain in sequence, handling errors and rendering the response.
   *
   * You shouldn't invoke this directly - Denali will automatically wire up your routes to this
   * method.
   */
  public async run(): Promise<Response> {
    // Merge all available params into a single convenience object. The original params (query,
    // body, url) can all be accessed at their original locations still if you want.
    let paramSources = [
      (this.request.route && this.request.route.additionalParams) || {},
      this.request.params,
      this.request.query,
      this.request.body
    ];
    let params = assign<any>({}, ...paramSources);

    // Content negotiation. Pick the best responder method based on the incoming content type and
    // the available responder types.
    let respond = this._pickBestResponder();
    debug(`[${ this.request.id }]: content negotiation picked \`${ respond.name }()\` responder method`);
    respond = respond.bind(this, params);

    // Build the before and after filter chains
    let { beforeChain, afterChain } = this._buildFilterChains();

    let render = this.render.bind(this);

    let instrumentation = Instrumentation.instrument('action.run', {
      action: this.constructor.name,
      params,
      headers: this.request.headers
    });

    let response: Response;
    try {
      debug(`[${ this.request.id }]: running before filters`);
      await this._invokeFilters(beforeChain, params, true);
      debug(`[${ this.request.id }]: running responder`);
      let result = await respond(params);
      response = await render(result);
      debug(`[${ this.request.id }]: running after filters`);
      await this._invokeFilters(afterChain, params, false);
    } catch (error) {
      if (error instanceof PreemptiveRender) {
        response = error.response;
      } else {
        throw error;
      }
    } finally {
      instrumentation.finish();
    }
    return response;
  }

  /**
   * Find the best responder method for the incoming request, given the incoming request's Accept
   * header.
   *
   * If the Accept header is "Accept: * / *", then the generic `respond()` method is selected.
   * Otherwise, attempt to find the best responder method based on the mime types.
   */
  public _pickBestResponder(): Responder {
    let responder: Responder = this.respond;
    let bestFormat;
    assert(typeof responder === 'function', `Your '${ this.constructor.name }' action must define a respond method.`);
    if (this.request.get('accept') !== '*/*') {
      let ActionClass = <typeof Action>this.constructor;
      let formats = ActionClass.formats();
      if (formats.length > 0) {
        bestFormat = this.request.accepts(formats);
        if (bestFormat === false) {
          throw new Errors.NotAcceptable();
        }
        responder = <Responder>this[`respondWith${ capitalize(<string>bestFormat) }`];
      }
    }
    return responder;
  }

  [key: string]: any;

  /**
   * The default responder method. You should override this method with whatever logic is needed to
   * respond to the incoming request.
   *
   * @since 0.1.0
   */
  public abstract respond(params: any): Response | { [key: string]: any } | void;

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
    let ActionClass = <typeof Action>this.constructor;
    if (!cachedFilters.before.has(ActionClass)) {
      let prototypeChain: Action[] = [];
      eachPrototype(ActionClass, (prototype) => {
        prototypeChain.push(prototype);
      });
      [ 'before', 'after' ].forEach((stage: 'before' | 'after') => {
        let filterNames = <string[]>compact(uniq(flatten(map(prototypeChain, stage))));
        filterNames.forEach((filterName) => {
          if (!this[filterName]) {
            throw new Error(`${ filterName } method not found on the ${ ActionClass.name } action.`);
          }
        });
        cachedFilters[stage].set(ActionClass, filterNames);
      });
    }
    return {
      beforeChain: cachedFilters.before.get(ActionClass),
      afterChain: cachedFilters.after.get(ActionClass)
    };
  }

  /**
   * Invokes the filters in the supplied chain in sequence.
   */
  private async _invokeFilters(chain: string[], params: any, haltable: boolean): Promise<void> {
    chain = chain.slice(0);
    let ActionClass = <typeof Action>this.constructor;
    while (chain.length > 0) {
      let filterName = chain.shift();
      let filter = this[filterName];
      let instrumentation = Instrumentation.instrument('action.filter', {
        action: ActionClass.name,
        params,
        filter: filterName,
        headers: this.request.headers
      });
      debug(`[${ this.request.id }]: running \`${ filterName }\` filter`);
      let filterResult = await filter.call(this, params);
      if (haltable && filterResult != null) {
        debug(`[${ this.request.id }]: \`${ filterName }\` preempted the action, rendering the returned value`);
        let response = await this.render(filterResult);
        throw new PreemptiveRender(response);
      }
      instrumentation.finish();
    }
  }

}

export default Action;
