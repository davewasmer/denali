import * as ware from 'ware';
import { IncomingMessage, ServerResponse } from 'http';
import { pluralize } from 'inflection';
import { fromNode } from 'bluebird';
import * as createDebug from 'debug';
import Errors from './errors';
import Route from './route';
import Request from './request';
import DenaliObject from '../metal/object';
import { lookup } from '../metal/container';
import ConfigService from './config';
import { Constructor } from '../utils/types';
import Action from './action';
import {
  find,
  forEach,
  castArray
 } from 'lodash';

const debug = createDebug('denali:router');

export interface RoutesCache {
  GET: Route[];
  POST: Route[];
  PUT: Route[];
  PATCH: Route[];
  DELETE: Route[];
  HEAD: Route[];
  OPTIONS: Route[];
  [method: string]: Route[];
}

export interface MiddlewareFn {
  (req: IncomingMessage, res: ServerResponse, next: Function): void;
}

export interface ResourceOptions {
  /**
   * Should routes for related resources be generated? If true, routes will be
   * generated following the JSON-API recommendations for relationship URLs.
   *
   * @see {@link http://jsonapi.org/recommendations/#urls-relationships|JSON-API URL
   * Recommendatiosn}
   */
  related?: boolean;
  /**
   * A list of action types to _not_ generate.
   */
  except?: string[];
  /**
   * A list of action types that should be the _only_ ones generated.
   */
  only?: string[];
}

export interface RouterDSL {
  get(pattern: string, action: string, params?: {}): void;
  post(pattern: string, action: string, params?: {}): void;
  put(pattern: string, action: string, params?: {}): void;
  patch(pattern: string, action: string, params?: {}): void;
  delete(pattern: string, action: string, params?: {}): void;
  head(pattern: string, action: string, params?: {}): void;
  options(pattern: string, action: string, params?: {}): void;
  resource(resourceName: string, options?: ResourceOptions): void;
}

/**
 * The Router handles incoming requests, sending them to the appropriate
 * action. It's also responsible for defining routes in the first place - it's
 * passed into the `config/routes.js` file's exported function as the first
 * argument.
 *
 * @package runtime
 * @since 0.1.0
 */
export default class Router extends DenaliObject implements RouterDSL {

  /**
   * The cache of available routes.
   */
  routes: RoutesCache = {
    GET: [],
    POST: [],
    PUT: [],
    PATCH: [],
    DELETE: [],
    HEAD: [],
    OPTIONS: []
  };

  /**
   * The internal generic middleware handler, responsible for building and
   * executing the middleware chain.
   */
  protected middleware: any = (<() => any>ware)();

  get config() {
    return lookup<ConfigService>('service:config');
  }

  /**
   * Helper method to invoke the function exported by `config/routes.js` in the
   * context of the current router instance.
   *
   * @since 0.1.0
   */
  map(fn: (router: Router) => void): void {
    debug('mapping routes');
    fn(this);
  }

  /**
   * Takes an incoming request and it's response from an HTTP server, prepares
   * them, runs the generic middleware first, hands them off to the appropriate
   * action given the incoming URL, and finally renders the response.
   */
  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let serverConfig = this.config.get('server');
    let request = new Request(req, serverConfig);
    try {

      debug(`[${ request.id }]: ${ request.method.toUpperCase() } ${ request.path }`);

      // Middleware
      await fromNode((cb) => this.middleware.run(request, res, cb));

      // Find the matching route
      debug(`[${ request.id }]: routing request`);
      let routes = this.routes[request.method];
      if (routes) {
        /* tslint:disable-next-line prefer-for-of */
        for (let i = 0; i < routes.length; i += 1) {
          request.params = routes[i].match(request.path);
          if (request.params) {
            request.route = routes[i];
            break;
          }
        }
      }
      // Handle 404s
      if (!request.route) {
        let availableRoutes =  routes && routes.map((r) => r.spec);
        debug(`[${ request.id }]: ${ request.method } ${ request.path } did match any route. Available ${ request.method } routes:\n${ availableRoutes.join(',\n') || 'none' }`);
        let error = new Errors.NotFound('Route not recognized');
        error.meta = { availableRoutesForMethod: routes || [] };
        throw error;
      }

      // Create our action to handle the response
      let action: Action = new request.route.action();

      // Run the action
      debug(`[${ request.id }]: running action`);
      await action.run(request, res);

    } catch (error) {
      await this.handleError(request, res, error);
    }
  }

  /**
   * Takes a request, response, and an error and hands off to the generic
   * application level error action.
   */
  protected async handleError(request: Request, res: ServerResponse, error: Error) {
    request.params = request.params || {};
    request.params.error = error;
    let ErrorAction = lookup<Constructor<Action>>('action:error');
    let errorAction = new ErrorAction();
    return errorAction.run(request, res);
  }

  /**
   * Add the supplied middleware function to the generic middleware stack that
   * runs prior to action handling.
   *
   * @since 0.1.0
   */
  use(middleware: MiddlewareFn): void {
    this.middleware.use(middleware);
  }

  /**
   * Add a route to the application. Maps a method and URL pattern to an
   * action, with optional additional parameters.
   *
   * URL patterns can use:
   *
   * * Dynamic segments, i.e. `'foo/:bar'` * Wildcard segments, i.e.
   *   `'foo/*bar'`, captures the rest of the URL up to the querystring
   * * Optional groups, i.e. `'foo(/:bar)'`
   *
   * @since 0.1.0
   */
  route(method: string, rawPattern: string, actionPath: string, params?: any) {
    method = method.toUpperCase();
    // Ensure leading slashes
    let normalizedPattern = rawPattern.replace(/^([^/])/, '/$1');
    // Remove hardcoded trailing slashes
    normalizedPattern = normalizedPattern.replace(/\/$/, '');
    // Ensure optional trailing slashes
    normalizedPattern = `${ normalizedPattern }(/)`;
    // Add route
    let ActionClass = lookup<Constructor<Action>>(`action:${ actionPath }`);
    let route = new Route(normalizedPattern);
    route.actionPath = actionPath;
    route.action = ActionClass;
    route.additionalParams = params;
    if (!route.action) {
      throw new Error(`No action found at ${ actionPath }`);
    }
    this.routes[method].push(route);
  }

  /**
   * Returns the URL for a given action. You can supply a params object which
   * will be used to fill in the dynamic segements of the action's route (if
   * any).
   */
  urlFor(actionPath: string, data: any): string | boolean {
    let actionEntry = lookup<Constructor<Action>>(`action:${ actionPath }`, { loose: true });
    if (actionEntry === false) {
      return false;
    }

    let action = actionEntry; // because TS won't narrow the type in the forEach below
    let route: Route;
    forEach(this.routes, (routes) => {
      route = find(routes, { action });
      return !route; // kill the iterator if we found the match
    });

    return route && route.reverse(data);
  }

  /**
   * Shorthand for `this.route('get', ...arguments)`
   *
   * @since 0.1.0
   */
  get(rawPattern: string, actionPath: string, params?: any): void {
    this.route('get', rawPattern, actionPath, params);
  }

  /**
   * Shorthand for `this.route('post', ...arguments)`
   *
   * @since 0.1.0
   */
  post(rawPattern: string, actionPath: string, params?: any): void {
    this.route('post', rawPattern, actionPath, params);
  }

  /**
   * Shorthand for `this.route('put', ...arguments)`
   *
   * @since 0.1.0
   */
  put(rawPattern: string, actionPath: string, params?: any): void {
    this.route('put', rawPattern, actionPath, params);
  }

  /**
   * Shorthand for `this.route('patch', ...arguments)`
   *
   * @since 0.1.0
   */
  patch(rawPattern: string, actionPath: string, params?: any): void {
    this.route('patch', rawPattern, actionPath, params);
  }

  /**
   * Shorthand for `this.route('delete', ...arguments)`
   *
   * @since 0.1.0
   */
  delete(rawPattern: string, actionPath: string, params?: any): void {
    this.route('delete', rawPattern, actionPath, params);
  }

  /**
   * Shorthand for `this.route('head', ...arguments)`
   *
   * @since 0.1.0
   */
  head(rawPattern: string, actionPath: string, params?: any): void {
    this.route('head', rawPattern, actionPath, params);
  }

  /**
   * Shorthand for `this.route('options', ...arguments)`
   *
   * @since 0.1.0
   */
  options(rawPattern: string, actionPath: string, params?: any): void {
    this.route('options', rawPattern, actionPath, params);
  }

  /**
   * Create all the CRUD routes for a given resource and it's relationships.
   * Based on the JSON-API recommendations for URL design.
   *
   * The `options` argument lets you pass in `only` or `except` arrays to
   * define exceptions. Action names included in `only` will be the only ones
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
   * @since 0.1.0
   */
  resource(resourceName: string, options: ResourceOptions = {}): void {
    let plural = pluralize(resourceName);
    let collection = `/${ plural }`;
    let resource = `${ collection }/:id`;
    let relationship = `${ resource }/relationships/:relation`;
    let related = `${ resource }/:relation`;

    if (!options.related) {
      options.except = [ 'related', 'fetch-related', 'replace-related', 'add-related', 'remove-related' ].concat(options.except);
    }

    let hasWhitelist = Boolean(options.only);
    options.only = castArray(options.only);
    options.except = castArray(options.except);

    /**
     * Check if the given action should be generated based on the
     * whitelist/blacklist options
     */
    function include(action: string) {
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
    ].forEach((routeTemplate: [ string, string, string ]) => {
      let [ action, method, url ] = routeTemplate;
      if (include(action)) {
        let routeMethod = <(url: string, action: string) => void>this[method];
        routeMethod.call(this, url, `${ plural }/${ action }`);
      }
    });
  }

  [methodName: string]: any;

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
   */
  namespace(namespace: string, fn: (wrapper: RouterDSL) => void): void {
    let router = this;
    if (namespace.endsWith('/')) {
      namespace = namespace.slice(0, namespace.length - 1);
    }
    // tslint:disable:completed-docs
    let wrapper: RouterDSL = {
      get(pattern: string, actionPath, params) {
        router.route('get', `${ namespace }/${ pattern.replace(/^\//, '') }`, actionPath, params);
      },
      post(pattern: string, actionPath, params) {
        router.route('post', `${ namespace }/${ pattern.replace(/^\//, '') }`, actionPath, params);
      },
      put(pattern: string, actionPath, params) {
        router.route('put', `${ namespace }/${ pattern.replace(/^\//, '') }`, actionPath, params);
      },
      patch(pattern: string, actionPath, params) {
        router.route('patch', `${ namespace }/${ pattern.replace(/^\//, '') }`, actionPath, params);
      },
      delete(pattern: string, actionPath, params) {
        router.route('delete', `${ namespace }/${ pattern.replace(/^\//, '') }`, actionPath, params);
      },
      head(pattern: string, actionPath, params) {
        router.route('head', `${ namespace }/${ pattern.replace(/^\//, '') }`, actionPath, params);
      },
      options(pattern: string, actionPath, params) {
        router.route('options', `${ namespace }/${ pattern.replace(/^\//, '') }`, actionPath, params);
      },
      resource(resourceName: string, options: ResourceOptions) {
        router.resource.call(this, resourceName, options);
      }
    };
    // tslint:enable:completed-docs
    if (fn) {
      fn(wrapper);
    }
  }

}
