/* globals before */
import fs from 'fs';
import path from 'path';
import assign from 'lodash/assign';
import MockRequest from './mock-request';
import MockResponse from './mock-response';

export default function setupApp(options = {}) {
  let defaultContentType = options.contentType || 'application/json';

  before(function() {

    // When testing apps, use app/application as the base application instance;
    // but when testing addons, use the dummy app (test/dummy) as the base
    // application
    let applicationRoot;
    let addons = [];
    let pkg = require('package.json');
    if (pkg.keywords.includes('denali-addon')) {
      applicationRoot = path.join(process.cwd(), 'test/dummy');
      addons.push(process.cwd());
    } else {
      applicationRoot = process.cwd();
    }

    let Application = require(path.join(applicationRoot, 'app/application')).default;
    let environment = process.env.DENALI_ENV || process.env.NODE_ENV || 'test';
    let application = new Application({
      environment,
      addons,
      dir: applicationRoot
    });

    // Create test app API wrapper
    let wrapper = {
      _injections: {},
      headers: {
        Accept: 'application/json'
      },
      request(req) {
        return new Promise((resolve, reject) => {
          let res = new MockResponse(() => {
            let body = res._getString();
            if (res.statusCode < 500) {
              try {
                body = res._getJSON();
              } catch (e) {} // eslint-disable-line no-empty
              resolve({ status: res.statusCode, body });
            } else {
              body = body.replace(/\\n/g, '\n');
              reject(new Error(`Request failed - ${ req.method.toUpperCase() } ${ req.url } returned a ${ res.statusCode }:\n${ body }`));
            }
          });
          application.router.handle(req, res);
        });
      },
      getHeader(name) {
        return wrapper.headers[name];
      },
      setHeader(name, value) {
        wrapper.headers[name] = value;
      },
      removeHeader(name) {
        delete wrapper.headers[name];
      },
      lookup() {
        return application.container.lookup(...arguments);
      },
      inject(name, value) {
        this._injections[name] = application.container.lookup(name);
        application.container.register(name, value);
      },
      restore(name) {
        application.container.register(name, this._injections[name]);
        delete this._injections[name];
      }
    };

    // Add request helper methods
    [ 'get', 'head', 'delete' ].forEach((method) => {
      wrapper[method] = function(url, headers) {
        let req = new MockRequest({
          method,
          url,
          headers: assign({}, wrapper.headers, headers)
        });
        // Ensure async request handling
        setTimeout(() => {
          req.end();
        }, 10);
        return wrapper.request(req);
      };
    });
    [ 'post', 'put', 'patch' ].forEach((method) => {
      wrapper[method] = function(url, body, headers = {}) {
        headers['Content-type'] = headers['Content-type'] || defaultContentType;
        body = typeof body === 'string' ? body : JSON.stringify(body);
        headers['Content-length'] = Buffer.byteLength(body);

        let req = new MockRequest({
          method,
          url,
          headers: assign({}, wrapper.headers, headers)
        });
        // Ensure async request handling
        setTimeout(() => {
          req.write(body);
          req.end();
        }, 10);
        return wrapper.request(req);
      };
    });

    this.app = wrapper; // eslint-disable-line no-invalid-this

    return application.runInitializers();

  });
}
