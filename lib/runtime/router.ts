import * as ware from 'ware';
import { IncomingMessage, ServerResponse } from 'http';
import { pluralize } from 'inflection';
import { fromNode } from 'bluebird';
import * as typeis from 'type-is';
import * as createDebug from 'debug';
import Errors from './errors';
import Route from './route';
import Request, { Method } from './request';
import ensureArray = require('arrify');
import DenaliObject from '../metal/object';
import Container from '../metal/container';
import Action from './action';
import Serializer from '../data/serializer';
import {
  find,
  forEach
 } from 'lodash';

const debug = createDebug('denali:router');

export interface RoutesCache {
  get: Route[];
  post: Route[];
  put: Route[];
  patch: Route[];
  delete: Route[];
  head: Route[];
  options: Route[];
  [method: string]: Route[];
};

export interface MiddlewareFn {
  (req: IncomingMessage, res: ServerResponse, next: Function): void;
}

export interface ResourceOptions {
  /**
   * Should routes for related resources be generated? If true, routes will be generated following
   * the JSON-API recommendations for relationship URLs.
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
  get(pattern: string, action: string, params: {}): void;
  post(pattern: string, action: string, params: {}): void;
  put(pattern: string, action: string, params: {}): void;
  patch(pattern: string, action: string, params: {}): void;
  delete(pattern: string, action: string, params: {}): void;
  head(pattern: string, action: string, params: {}): void;
  options(pattern: string, action: string, params: {}): void;
  resource(resourceName: string, options: ResourceOptions): void;
}

/**
 * The Router handles incoming requests, sending them to the appropriate action. It's also
 * responsible for defining routes in the first place - it's passed into the `config/routes.js`
 * file's exported function as the first argument.
 *
 * @package runtime
 * @since 0.1.0
 */
export default class Router extends DenaliObject implements RouterDSL {

  /**
   * The cache of available routes.
   */
  public routes: RoutesCache = {
    get: [],
    post: [],
    put: [],
    patch: [],
    delete: [],
    head: [],
    options: []
  };

  /**
   * The internal generic middleware handler, responsible for building and executing the middleware
   * chain.
   */
  private middleware: any = (<() => any>ware)();

  /**
   * The application container
   */
  public container: Container;

  /**
   * Helper method to invoke the function exported by `config/routes.js` in the context of the
   * current router instance.
   *
   * @since 0.1.0
   */
  public map(fn: (router: Router) => void): void {
    debug('mapping routes');
    fn(this);
  }

  /**
   * Takes an incoming request and it's response from an HTTP server, prepares them, runs the
   * generic middleware first, hands them off to the appropriate action given the incoming URL, and
   * finally renders the response.
   */
  public async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let response;
    let request = new Request(req);
    try {

      debug(`[${ request.id }]: ${ request.method.toUpperCase() } ${ request.path }`);
      await fromNode((cb) => this.middleware.run(request, res, cb));

      debug(`[${ request.id }]: routing request`);
      let routes = this.routes[request.method];
      for (let i = 0; i < routes.length; i += 1) {
        request.params = routes[i].match(request.path);
        if (request.params) {
          request.route = routes[i];
          break;
        }
      }
      if (!request.route) {
        debug(`[${ request.id }]: ${ request.method } ${ request.path } did match any route. Available ${ request.method } routes:\n${ routes.map((r) => r.spec).join(',\n') }`);
        throw new Errors.NotFound('Route not recognized');
      }

      let action: Action = new (<any>request.route.action)({
        request,
        container: this.container
      });

      let serializer: Serializer | false;
      if (action.serializer != null) {
        if (typeof action.serializer === 'string') {
          serializer = this.container.lookup(`serializer:${ action.serializer }`);
        } else if (action.serializer === false) {
          serializer = null;
        } else {
          serializer = <Serializer | false>action.serializer;
        }
      } else {
        serializer = this.container.lookup('serializer:application');
      }

      if (typeis.hasBody(request) && request.body && serializer) {
        debug(`[${ request.id }]: parsing request body`);
        request.body = serializer.parse(request.body);
      }

      debug(`[${ request.id }]: running action`);
      response = await action.run();

    } catch (error) {
      response = await this.handleError(request, res, error);
    }

    debug(`[${ request.id }]: setting response status code to ${ response.status }`);
    res.statusCode = response.status;
    res.setHeader('X-Request-Id', request.id);

    if (response.body) {
      debug(`[${ request.id }]: writing response body`);
      res.setHeader('Content-type', response.contentType);
      if (this.container.lookup('app:main').environment !== 'production') {
        res.write(JSON.stringify(response.body, null, 2));
      } else {
        res.write(JSON.stringify(response.body));
      }
    }

    res.end();
    debug(`[${ request.id }]: response finished`);
  }

  /**
   * Takes a request, response, and an error and hands off to the generic application level error
   * action.
   */
  private async handleError(request: Request, res: ServerResponse, error: Error) {
    request.params = request.params || {};
    request.params.error = error;
    let ErrorAction = this.container.lookup('action:error');
    let errorAction = new ErrorAction({
      request,
      response: res,
      container: this.container
    });
    return errorAction.run();
  }

  /**
   * Add the supplied middleware function to the generic middleware stack that runs prior to action
   * handling.
   *
   * @since 0.1.0
   */
  public use(middleware: MiddlewareFn): void {
    this.middleware.use(middleware);
  }

  /**
   * Add a route to the application. Maps a method and URL pattern to an action, with optional
   * additional parameters.
   *
   * URL patterns can use:
   *
   * * Dynamic segments, i.e. `'foo/:bar'` * Wildcard segments, i.e. `'foo/*bar'`, captures the rest
   * of the URL up
   *    to the querystring
   * * Optional groups, i.e. `'foo(/:bar)'`
   *
   * @since 0.1.0
   */
  public route(method: Method, rawPattern: string, actionPath: string, params?: any) {
    // Ensure leading slashes
    let normalizedPattern = rawPattern.replace(/^([^/])/, '/$1');
    // Remove hardcoded trailing slashes
    normalizedPattern = normalizedPattern.replace(/\/$/, '');
    // Ensure optional trailing slashes
    normalizedPattern = `${ normalizedPattern }(/)`;
    // Add route
    let ActionClass = this.container.lookup(`action:${ actionPath }`);
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
  public urlFor(action: string | Action, data: any): string | boolean {
    if (typeof action === 'string') {
      action = this.container.lookup(`action:${ action }`);
    }
    if (!action) {
      return false;
    }

    let route: Route;
    forEach(this.routes, (routes) => {
      route = find(routes, { action: <Action>action });
      return !route; // kill the iterator if we found the match
    });

    return route && route.reverse(data);
  }

  /**
   * Shorthand for `this.route('get', ...arguments)`
   *
   * @since 0.1.0
   */
  public get(rawPattern: string, actionPath: string, params?: any): void {
    this.route('get', rawPattern, actionPath, params);
  }

  /**
   * Shorthand for `this.route('post', ...arguments)`
   *
   * @since 0.1.0
   */
  public post(rawPattern: string, actionPath: string, params?: any): void {
    this.route('post', rawPattern, actionPath, params);
  }

  /**
   * Shorthand for `this.route('put', ...arguments)`
   *
   * @since 0.1.0
   */
  public put(rawPattern: string, actionPath: string, params?: any): void {
    this.route('put', rawPattern, actionPath, params);
  }

  /**
   * Shorthand for `this.route('patch', ...arguments)`
   *
   * @since 0.1.0
   */
  public patch(rawPattern: string, actionPath: string, params?: any): void {
    this.route('patch', rawPattern, actionPath, params);
  }

  /**
   * Shorthand for `this.route('delete', ...arguments)`
   *
   * @since 0.1.0
   */
  public delete(rawPattern: string, actionPath: string, params?: any): void {
    this.route('delete', rawPattern, actionPath, params);
  }

  /**
   * Shorthand for `this.route('head', ...arguments)`
   *
   * @since 0.1.0
   */
  public head(rawPattern: string, actionPath: string, params?: any): void {
    this.route('head', rawPattern, actionPath, params);
  }

  /**
   * Shorthand for `this.route('options', ...arguments)`
   *
   * @since 0.1.0
   */
  public options(rawPattern: string, actionPath: string, params?: any): void {
    this.route('options', rawPattern, actionPath, params);
  }

  /**
   * Create all the CRUD routes for a given resource and it's relationships. Based on the JSON-API
   * recommendations for URL design.
   *
   * The `options` argument lets you pass in `only` or `except` arrays to define exceptions. Action
   * names included in `only` will be the only ones generated, while names included in `except` will
   * be omitted.
   *
   * Set `options.related = false` to disable relationship routes.
   *
   * If no options are supplied, the following routes are generated (assuming a 'books' resource as
   * an example):
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
  public resource(resourceName: string, options: ResourceOptions = {}): void {
    let plural = pluralize(resourceName);
    let collection = `/${ plural }`;
    let resource = `${ collection }/:id`;
    let relationship = `${ resource }/relationships/:relation`;
    let related = `${ resource }/:relation`;

    if (!options.related) {
      options.except = [ 'related', 'fetch-related', 'replace-related', 'add-related', 'remove-related' ].concat(options.except);
    }

    let hasWhitelist = Boolean(options.only);
    options.only = ensureArray(options.only);
    options.except = ensureArray(options.except);

    /**
     * Check if the given action should be generated based on the whitelist/blacklist options
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
    ].forEach((routeTemplate: [ string, Method, string ]) => {
      let [ action, method, url ] = routeTemplate;
      if (include(action)) {
        let routeMethod = <(url: string, action: string) => void>this[method];
        routeMethod.call(this, url, `${ plural }/${ action }`);
      }
    });
  }

  [methodName: string]: any;

  /**
   * Enables easy route namespacing. You can supply a method which takes a single argument that
   * works just like the `router` argument in your `config/routes.js`, or you can use the return
   * value just like the router.
   *
   *   router.namespace('users', (namespace) => {
   *     namespace.get('sign-in');
   *   });
   *   // or ...
   *   let namespace = router.namespace('users');
   *   namespace.get('sign-in');
   */
  public namespace(namespace: string, fn: (wrapper: RouterDSL) => void): void {
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
