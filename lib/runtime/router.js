import ware from 'ware';
import { pluralize } from 'inflection';
import Promise from 'bluebird';
import typeis from 'type-is';
import Errors from './errors';
import Route from 'route-parser';
import Request from './request';
import ensureArray from '../utils/ensure-array';
import find from 'lodash/find';
import forEach from 'lodash/forEach';

/**
 * The Router handles incoming requests, sending them to the appropriate action.
 * It's also responsible for defining routes in the first place - it's passed
 * into the `config/routes.js` file's exported function as the first argument.
 *
 * @class Router
 * @constructor
 * @private
 * @module denali
 * @submodule runtime
 */
export default class Router {

  /**
   * The cache of available routes.
   *
   * @property routes
   * @type {Object}
   * @private
   */
  routes = {
    get: [],
    post: [],
    put: [],
    patch: [],
    delete: [],
    head: [],
    options: []
  };

  /**
   * The generic middleware handler.
   *
   * @property middleware
   * @type {Ware}
   */
  middleware = ware();

  constructor(options) {
    this.container = options.container;
    this.logger = options.logger;
  }

  /**
   * Helper method to invoke the function exported by `config/routes.js` in the
   * context of the current router instance?
   *
   * @method map
   * @param fn {Function} the route definition function
   * @private
   */
  map(fn) {
    fn(this);
  }

  /**
   * Takes an incoming request and it's response from an HTTP server, prepares
   * them, runs the generic middleware first, and then hands them off
   * to the appropriate action given the incoming URL.
   *
   * @method handle
   * @param req {http.IncomingMessage} the incoming request object
   * from the node HTTP server
   * @param response {http.ServerResponse} the outgoing response
   * object from the node HTTP server
   * @private
   */
  handle(req, response) {
    let request = new Request(req);
    return new Promise((resolve, reject) => {
      this.middleware.run(req, response, (error) => {
        if (error) {
          return reject(error);
        }

        let routes = this.routes[request.method];
        for (let i = 0; i < routes.length; i += 1) {
          request.params = routes[i].match(request.path);
          if (request.params) {
            request.route = routes[i];
            break;
          }
        }
        if (!request.route) {
          return reject(new Errors.NotFound('Route not recognized'));
        }

        // eslint-disable-next-line new-cap
        let action = new request.route.action({
          request,
          response,
          logger: this.logger,
          container: this.container
        });

        let serializer;
        if (action.serializer != null) {
          if (typeof action.serializer === 'string') {
            serializer = this.container.lookup(`serializer:${ action.serializer }`);
          } else if (action.serializer === false) {
            serializer = null;
          } else {
            serializer = action.serializer;
          }
        } else {
          serializer = this.container.lookup('serializer:application');
        }

        Promise.try(() => {
          if (typeis.hasBody(request) && serializer) {
            request.body = serializer.parse(request.body);
          }
        }).then(() => {
          return action.run();
        }).then(resolve, reject);
      });
    }).catch((error) => {
      return this.handleError(request, response, error);
    });
  }

  /**
   * Takes a request, response, and an error and hands off to the generic
   * application level error action.
   *
   * @method handleError
   * @param request {Request}
   * @param response {Response}
   * @param error {Error}
   */
  handleError(request, response, error) {
    let ErrorAction = this.container.lookup('action:error');
    let errorAction = new ErrorAction({
      request,
      response,
      error,
      logger: this.logger,
      container: this.container
    });
    return errorAction.run();
  }

  /**
   * Add the supplied middleware function to the generic middleware stack that
   * runs prior to action handling.
   *
   * @method use
   * @param middleware {Function}
   */
  use(middleware) {
    this.middleware.use(middleware);
  }

  /**
   * Add a route to the application. Maps a method and URL pattern to an action,
   * with optional additional parameters.
   *
   * URL patterns can use:
   *
   *  * Dynamic segments, i.e. `'foo/:bar'`
   *  * Wildcard segments, i.e. `'foo/*bar'`, captures the rest of the URL up
   *    to the querystring
   *  * Optional groups, i.e. `'foo(/:bar)'`
   *
   * @method route
   * @param method {String} the HTTP method to match
   * @param rawPattern {String} the URL pattern to match
   * @param actionPath {String} the container name of the action to route to
   * @param [params] {Object} additional params to be merged into the action's
   * params argument
   */
  route(method, rawPattern, actionPath, params) {
    // Ensure leading slashes, remove trailing ones
    let normalizedPattern = rawPattern.replace(/^([^/])/, '/$1');
    normalizedPattern = normalizedPattern.replace(/\/$/, '');
    // Add route with and without trailing slash
    [ normalizedPattern, `${ normalizedPattern }/` ].forEach((pattern) => {
      let route = new Route(pattern);
      route.actionPath = actionPath;
      route.action = this.container.lookup(`action:${ actionPath }`);
      route.additionalParams = params;
      if (!route.action) {
        throw new Error(`No action found at ${ actionPath }`);
      }
      this.routes[method].push(route);
    });
  }

  /**
   * Returns the URL for a given action. You can supply a params object which
   * will be used to fill in the dynamic segements of the action's route (if
   * any).
   *
   * @method urlFor
   * @param action {String|Action} the container name of the action, or the
   * action class itself
   * @param data {Object} params to fill in the dynamic segments
   * @return {String}
   */
  urlFor(action, data) {
    if (typeof action === 'string') {
      action = this.container.lookup(`action:${ action }`);
    }
    if (!action) {
      return null;
    }
    let route;
    forEach(this.routes, (routes) => {
      route = find(routes, { action: action.constructor });
      return !route; // kill the iterator if we found the match
    });
    return route ? route.reverse(data) : null;
  }

  /**
   * Shorthand for `this.route('get', ...arguments)`
   *
   * @method get
   */
  get(...args) {
    this.route('get', ...args);
  }

  /**
   * Shorthand for `this.route('post', ...arguments)`
   *
   * @method post
   */
  post(...args) {
    this.route('post', ...args);
  }

  /**
   * Shorthand for `this.route('put', ...arguments)`
   *
   * @method put
   */
  put(...args) {
    this.route('put', ...args);
  }

  /**
   * Shorthand for `this.route('patch', ...arguments)`
   *
   * @method patch
   */
  patch(...args) {
    this.route('patch', ...args);
  }

  /**
   * Shorthand for `this.route('delete', ...arguments)`
   *
   * @method delete
   */
  delete(...args) {
    this.route('delete', ...args);
  }

  /**
   * Create all the CRUD routes for a given resource and it's relationships.
   * Based on the JSON-API recommendations for URL design.
   *
   * The `options` argument lets you pass in `only` or `except` arrays to define
   * exceptions. Action names included in `only` will be the only ones
   * generated, while names included in `except` will be omitted.
   *
   * Set `options.related = false` to disable relationship routes.
   *
   * If no options are supplied, the following routes are generated (assuming a
   * 'books' resource as an example):
   *
   *   * `GET /books`
   *   * `POST /books`
   *   * `GET /books/:id`
   *   * `PATCH /books/:id`
   *   * `DELETE /books/:id`
   *   * `GET /books/:id/:relation`
   *   * `GET /books/:id/relationships/:relation`
   *   * `PATCH /books/:id/relationships/:relation`
   *   * `POST /books/:id/relationships/:relation`
   *   * `DELETE /books/:id/relationships/:relation`
   *
   * See http://jsonapi.org/recommendations/#urls for details.
   *
   * @method resource
   * @param resourceName {String} the name of the resource
   * @param [options] {Object} options for the resource
   */
  resource(resourceName, options = {}) {
    let plural = pluralize(resourceName);
    let collection = `/${ plural }`;
    let resource = `${ collection }/:id`;
    let relationship = `${ resource }/relationships/:relation`;
    let related = `${ resource }/:relation`;

    if (options.related === false) {
      options.except = [ 'related', 'fetch-related', 'replace-related', 'add-related', 'remove-related' ].concat(options.except);
    }

    let hasWhitelist = Boolean(options.only);
    options.only = ensureArray(options.only);
    options.except = ensureArray(options.except);

    function include(action) {
      let whitelisted = options.only.includes(action);
      let blacklisted = options.except.includes(action);
      return !blacklisted && (
        (hasWhitelist && whitelisted) ||
        !hasWhitelist
      );
    }

    [
      [ 'list', 'get', collection ],
      [ 'create', 'post', collection ],
      [ 'show', 'get', resource ],
      [ 'update', 'patch', resource ],
      [ 'destroy', 'delete', resource ],
      [ 'related', 'get', related ],
      [ 'fetch-related', 'get', relationship ],
      [ 'replace-related', 'patch', relationship ],
      [ 'add-related', 'post', relationship ],
      [ 'remove-related', 'delete', relationship ]
    ].forEach(([ action, method, url ]) => {
      if (include(action)) {
        this[method](url, `${ plural }/${ action }`);
      }
    });
  }

  /**
   * Enables easy route namespacing. You can supply a method which takes a
   * single argument that works just like the `router` argument in your
   * `config/routes.js`, or you can use the return value just like the router.
   *
   *   router.namespace('users', (namespace) => {
   *     namespace.get('sign-in');
   *   });
   *   // or ...
   *   let namespace = router.namespace('users');
   *   namespace.get('sign-in');
   *
   * @method namespace
   * @param namespace {String} the URL prefix to use as the namespace
   * @param [fn] {Function} a function that accepts a namespace as it's argument
   * @return {Object} an object that wraps the router methods with namespaces
   */
  namespace(namespace, fn) {
    // eslint-disable-next-line consistent-this
    let router = this;
    if (namespace.endsWith('/')) {
      namespace = namespace.slice(0, namespace.length - 1);
    }
    // TODO add sanitization in case `pattern` has leading slash, or `namespace` has trailing
    let wrapper = {
      get(pattern, ...args) {
        router.route('get', `${ namespace }/${ pattern }`, ...args);
      },
      post(pattern, ...args) {
        router.route('post', `${ namespace }/${ pattern }`, ...args);
      },
      put(pattern, ...args) {
        router.route('put', `${ namespace }/${ pattern }`, ...args);
      },
      patch(pattern, ...args) {
        router.route('patch', `${ namespace }/${ pattern }`, ...args);
      },
      delete(pattern, ...args) {
        router.route('delete', `${ namespace }/${ pattern }`, ...args);
      },
      resource(resourceName, options) {
        router.resource.call(this, resourceName, options);
      }
    };
    if (fn) {
      fn(wrapper);
    } else {
      return wrapper;
    }
  }

}
