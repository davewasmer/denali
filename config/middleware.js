import defaults from 'lodash/defaults';
import defaultsDeep from 'lodash/defaultsDeep';

import timing from 'response-time';
import compression from 'compression';
import cookies from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import requestid from 'express-request-id';
import forceSSL from 'express-force-ssl';
import morgan from 'morgan';
import { json } from 'body-parser';

export default function baseMiddleware(router, application) {

  let config = application.config;

  function isEnabled(prop) {
    return !config[prop] || (config[prop] && config[prop].enabled !== false);
  }

  if (isEnabled('timing')) {
    router.use(timing());
  }

  if (isEnabled('requestid')) {
    router.use(requestid());
  }

  if (isEnabled('logging')) {
    let defaultLoggingFormat = application.environment === 'production' ? 'combined' : 'dev';
    let defaultLoggingOptions = {
      skip() {
        return application.environment === 'test';
      }
    };
    let format = (config.logging && config.logging.format) || defaultLoggingFormat;
    let options = defaults(config.logging || {}, defaultLoggingOptions);
    router.use(morgan(format, options));

    // Patch morgan to read from our non-express response
    morgan.token('res', (req, res, field) => {
      let header = res.getHeader(field);
      return Array.isArray(header) ? header.join(', ') : header;
    });
  }

  if (isEnabled('compression')) {
    router.use(compression());
  }

  if (isEnabled('cookies')) {
    router.use(cookies(config.cookies));
  }

  if (isEnabled('cors')) {
    router.use(cors(config.cors));
  }

  if (isEnabled('csp')) {
    let cspConfig = defaultsDeep(config.csp, {
      directives: { reportUri: '/_report-csp-violations' },
      reportOnly: application.environment === 'development',
      disableAndroid: true
    });
    router.use(helmet.contentSecurityPolicy(cspConfig));
    if (config.csp && config.csp.useDummyReportingEndpoint) {
      router.post(cspConfig.directives.reportUri, (req, res) => res.sendStatus(200));
    }
  }

  if (isEnabled('xssFilter')) {
    router.use(helmet.xssFilter());
  }

  if (isEnabled('frameguard')) {
    router.use(helmet.frameguard());
  }

  if (isEnabled('hidePoweredBy')) {
    router.use(helmet.hidePoweredBy());
  }

  if (isEnabled('ieNoOpen')) {
    router.use(helmet.ieNoOpen());
  }

  if (isEnabled('noSniff')) {
    router.use(helmet.noSniff());
  }

  if (config.server && config.server.ssl && config.server.ssl.required) {
    router.use((req, res, next) => {
      res.locals = res.locals || {};
      res.locals.forceSSLOptions = { enable301Redirects: config.server.ssl.required === 'redirect' };
      forceSSL(req, res, next);
    });
  }

  if (isEnabled('bodyParser')) {
    router.use(json({ type: (config.bodyParser && config.bodyParser.type) || 'application/json' }));
  }

}
