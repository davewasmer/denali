import {
  defaults
} from 'lodash';
import * as timing from 'response-time';
import * as compression from 'compression';
import * as cookies from 'cookie-parser';
import * as cors from 'cors';
import * as helmet from 'helmet';
import * as morgan from 'morgan';
import { IncomingMessage, ServerResponse } from 'http';
import Router from '../lib/runtime/router';
import Application from '../lib/runtime/application';

/**
 * Denali ships with several base middleware included, each of which can be enabled/disabled
 * individually through config options.
 */
export default function baseMiddleware(router: Router, application: Application): void {

  let config = application.config;

  /**
   * Returns true if the given property either does not exist on the config object, or it does exist
   * and it's `enabled` property is not `false`. All the middleware here are opt out, so to disable
   * you must define set that middleware's root config property to `{ enabled: false }`
   */
  function isEnabled(prop: string): boolean {
    return config.get(prop) == null || config.get(prop, 'enabled') !== false;
  }

  if (isEnabled('timing')) {
    router.use(timing());
  }

  if (isEnabled('logging')) {
    let defaultLoggingFormat = application.environment === 'production' ? 'combined' : 'dev';
    let defaultLoggingOptions = {
      // tslint:disable-next-line:completed-docs
      skip(): boolean {
        return application.environment === 'test';
      }
    };
    let format = config.getWithDefault('logging', 'format', defaultLoggingFormat);
    let options = defaults(config.getWithDefault('logging', {}), defaultLoggingOptions);
    router.use(morgan(format, options));

    // Patch morgan to read from our non-express response
    morgan.token('res', (req: IncomingMessage, res: ServerResponse, field: string) => {
      let header = res.getHeader(field);
      if (typeof header === 'number') {
        header = String(header);
      } else if (Array.isArray(header)) {
        header = header.join(', ');
      }
      return header;
    });
  }

  if (isEnabled('compression')) {
    router.use(compression());
  }

  if (isEnabled('cookies')) {
    router.use(cookies(config.get('cookies')));
  }

  if (isEnabled('cors')) {
    router.use(cors(config.get('cors')));
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

}
