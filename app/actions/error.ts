import * as assert from 'assert';
import Action from '../../lib/runtime/action';
import Logger from '../../lib/runtime/logger';
import JSONParser from '../../lib/parse/json';
import { lookup } from '../../lib/metal/container';

/**
 * The default error action. When Denali encounters an error while processing a request, it will
 * attempt to hand off that error to the `error` action, which can determine how to respond. This is
 * a good spot to do things like report the error to an error-tracking service, sanitize the error
 * response based on environment (i.e. a full stack trace in dev, but limited info in prod), etc.
 *
 * @export
 * @class ErrorAction
 * @extends {Action}
 */
export default class ErrorAction extends Action {

  get originalAction(): string {
    return this.request._originalAction;
  }

  logger = lookup<Logger>('app:logger');
  parser = lookup<JSONParser>('parser:json');

  /**
   * Respond with JSON by default
   */
  async respond({ params }: any) {
    let error = params.error;
    assert(error, 'Error action must be invoked with an error as a param');
    // Print the error to the logs
    if ((!error.status || error.status >= 500) && this.config.environment !== 'test') {
      this.logger.error(`Request ${ this.request.id } errored:\n${ error.stack || error.message }`);
    }
    // Ensure a default status code of 500
    error.status = error.statusCode = error.statusCode || 500;
    // If debugging info is allowed, attach some debugging info to standard
    // locations.
    if (this.config.getWithDefault('logging', 'showDebuggingInfo', this.config.environment !== 'production')) {
      error.meta = error.meta || {};
      Object.assign(error.meta, {
        stack: error.stack.split('\n'),
        action: this.originalAction
      });
    // Otherwise, sanitize the output
    } else {
      if (error.statusCode === 500) {
        error.message = 'Internal Error';
      }
      delete error.stack;
    }
    if (this.request.accepts('html') && this.config.environment !== 'production') {
      this.render(error.status, error, { view: 'error.html' });
    } else {
      this.render(error.status, error);
    }
  }

}
