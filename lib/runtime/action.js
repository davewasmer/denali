import Instrumentation from '../metal/instrumentation';
import Model from '../data/model';
import Response from './response';
import Promise from 'bluebird';
import assign from 'lodash/assign';
import capitalize from 'lodash/capitalize';
import isArray from 'lodash/isArray';
import noop from 'lodash/noop';
import uniq from 'lodash/uniq';
import flatten from 'lodash/flatten';
import map from 'lodash/map';
import assert from 'assert';


function PreemptiveRender() {}
PreemptiveRender.prototype = Object.create(Error.prototype);
PreemptiveRender.prototype.constructor = PreemptiveRender;


/**
 * Actions form the core of interacting with a Denali application. They are
 * the controller layer in the MVC architecture, taking in incoming requests,
 * performing business logic, and handing off to the renderer to send the
 * response.
 *
 * When a request comes in, Denali will invoke the `respond` method (or
 * `respondWith__` for content negotiated requests) on the
 * matching Action class. The return value (or resolved return value) of this
 * method is used to render the response.
 *
 * Actions also support filters. Simply define a method on your action, and add
 * the method name to the `before` or `after` array. Filters behave similar to
 * responders in that they receive the request params and can return a promise
 * which will be waited on before continuing. Filters are inheritable, so child
 * classes will run filters added by parent classes.
 *
 * @class Action
 * @constructor
 * @module denali
 * @submodule runtime
 */
export default class Action {

  /**
   * Cache the list of available formats this action can respond to.
   *
   * @method formats
   * @static
   * @return Array
   */
  static formats() {
    if (!this._formats) {
      let proto = this.prototype;
      this._formats = [];
      do {
        this._formats = this._formats.concat(Object.getOwnPropertyNames(proto));
        proto = Object.getPrototypeOf(proto);
      } while (proto);

      this._formats = this._formats.filter((prop) => {
        return /^respondWith/.test(prop);
      }).map((responder) => {
        return responder.match(/respondWith(.+)/)[1].toLowerCase();
      });
      this._formats = uniq(this._formats);
    }
    return this._formats;
  }

  /**
   * Invoked before the `respond()` method. The framework will invoke filters
   * from parent classes and mixins in the same order the mixins were
   * applied.
   *
   * Filters can be synchronous, or return a promise (which will pause the
   * before/respond/after chain until it resolves).
   *
   * If a before filter returns any value (or returns a promise which resolves
   * to any value) other than null or undefined, Denali will attempt to render
   * that response and halt further processing of the request (including
   * remaining before filters).
   *
   * @property before
   * @type {Array}
   * @default []
   */
  static before = [];

  /**
   * Invoked after the `respond()` method. The framework will invoke filters
   * from parent classes and mixins in the same order the mixins were
   * applied.
   *
   * Filters can be synchronous, or return a promise (which will pause the
   * before/respond/after chain until it resolves).
   *
   * @property after
   * @type {Array}
   * @default []
   */
  static after = [];

  /**
   * Force which serializer should be used for the rendering of the response.
   *
   * By default if the response is of type Error it will use the 'error' serializer.
   * On the other hand if it's a Model, it will use that model's serializer.
   * Otherwise, it will use the 'application' serializer.
   *
   * @property serializer
   * @type {String}
   * @default null
   */
  static serializer = null;

  /**
   * The application config
   *
   * @property config
   * @type {Object}
   */
  get config() {
    return this.container.lookup('config:environment');
  }


  constructor(options = {}) {
    this.request = options.request;
    this._response = options.response;
    this.logger = options.logger;
    this.container = options.container;
  }

  /**
   * Fetch a model class by it's type string, i.e. 'post' => PostModel
   *
   * @method modelFor
   * @param type {String} the model type string
   * @return {Model}
   */
  modelFor(type) {
    return this.container.lookup(`model:${ type }`);
  }

  /**
   * Fetch a service by it's container name, i.e. 'email' => 'services/email.js'
   *
   * @method service
   * @param type {String} the service name
   * @return {Service}
   */
  service(type) {
    return this.container.lookup(`service:${ type }`);
  }

  /**
   * Render some supplied data to the response. Data can be:
   *
   *   * a Model instance
   *   * an array of Model instances
   *   * a Denali.Response instance
   *
   * @method render
   * @param response {Model|Model[]|Response]}
   * @private
   */
  render(response) {
    if (!(response instanceof Response)) {
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
        type = sample.constructor.type;
      } else {
        type = 'application';
      }
      let serializer = this.container.lookup(`serializer:${ type }`);
      serializer.serialize(response, assign({ action: this }, response.options));
    }

    this._response.statusCode = response.status;

    if (response.body) {
      this._response.setHeader('Content-type', response.contentType);
      if (this.config.environment !== 'production') {
        this._response.write(JSON.stringify(response.body, null, 2));
      } else {
        this._response.write(JSON.stringify(response.body));
      }
    }

    this._response.end();
  }

  /**
   * Invokes the action. Determines the best responder method for content
   * negotiation, then executes the filter/responder chain in sequence,
   * handling errors and rendering the response.
   *
   * You shouldn't invoke this directly - Denali will automatically wire up
   * your routes to this method.
   *
   * @method run
   * @return {Promise} resolves when the filter/responder chain is complete,
   * i.e. when the action is finished
   * @private
   */
  run() {
    // Merge all available params into a single convenience object. The
    // original params (query, body, url) can all be accessed at their original
    // locations still if you want.
    let paramSources = [
      (this.request.route && this.request.route.additionalParams) || {},
      this.request.params,
      this.request.query,
      this.request.body
    ];
    let params = assign({}, ...paramSources);

    // Content negotiation. Pick the best responder method based on the incoming
    // content type and the available responder types.
    let respond = this._pickBestResponder().bind(this, params);

    // Build the before and after filter chains
    let { beforeChain, afterChain } = this._buildFilterChains();

    let render = this.render.bind(this);

    return Instrumentation.instrument('action.run', {
      action: this.constructor.name,
      params,
      headers: this.request.headers
    }, () => {
      return this._invokeFilters(beforeChain, params, true)
        .then(respond)
        .then(render)
        .then(this._invokeFilters.bind(this, afterChain, params, false))
        .catch(PreemptiveRender, noop);
    });
  }

  /**
   * Find the best responder method for the incoming request, given the
   * incoming request's Accept header.
   *
   * If the Accept header is "Accept: * / *", then the generic `respond()`
   * method is selected. Otherwise, attempt to find the best responder method
   * based on the mime types.
   *
   * @method _pickBestResponder
   * @return {Function} the best match responder method
   * @private
   */
  _pickBestResponder() {
    let responder = this.respond;
    let bestFormat;
    assert(typeof responder === 'function', `Your '${ this.name }' action must define a respond method.`);
    if (this.request.get('accept') !== '*/*') {
      let formats = this.constructor.formats();
      if (formats.length > 0) {
        bestFormat = this.request.accepts(...formats);
        if (bestFormat) {
          responder = this[`respondWith${ capitalize(bestFormat) }`];
        }
      }
    }
    return responder;
  }

  /**
   * Walk the prototype chain of this Action instance to find all the `before`
   * and `after` arrays to build the complete filter chains.
   *
   * Caches the result on the child Action class to avoid the potentially
   * expensive prototype walk on each request.
   *
   * Throws if it encounters the name of a filter method that doesn't exist.
   *
   * @method _buildFilterChains
   * @return {Object} an object with `beforeChain` and `afterChain` arrays,
   * each containing the filter method names as strings
   * @private
   */
  _buildFilterChains() {
    if (!this.constructor._before) {
      let prototypeChain = [];
      let prototype = this.constructor;
      while (prototype !== Function.prototype) {
        prototypeChain.push(prototype);
        prototype = Object.getPrototypeOf(prototype);
      }
      [ 'before', 'after' ].forEach((stage) => {
        let filterNames = uniq(flatten(map(prototypeChain, stage)));
        filterNames.forEach((filterName) => {
          if (!this[filterName]) {
            throw new Error(`${ filterName } method not found on the ${ this.name } action.`);
          }
        });
        this.constructor[`_${ stage }`] = filterNames;
      });
    }
    return {
      beforeChain: this.constructor._before,
      afterChain: this.constructor._after
    };
  }

  /**
   * Invokes the filters in the supplied chain in sequence.
   *
   * @method _invokeFilters
   * @param chain {String[]} an array of filter method names to invoke in order
   * @param params {Object} the incoming request params
   * @return {Promise} resolves once the chain is complete, rejects if the
   * chain was halted.
   * @private
   */
  _invokeFilters(chain, params) {
    return Promise.resolve(chain)
      .each((filterName) => {
        let filter = Promise.method(this[filterName]);
        return Instrumentation.instrument('action.filter', {
          action: this.name,
          params,
          filter: filterName,
          headers: this.request.headers
        }, () => {
          return filter.call(this, params).then((result) => {
            if (result != null) {
              this.render(result);
              return Promise.reject(new PreemptiveRender());
            }
          });
        });
      });
  }

}
