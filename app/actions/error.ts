import Action from '../../lib/runtime/action';
import * as assert from 'assert';
import Logger from 'lib/runtime/logger';
import inject from 'lib/metal/inject';

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

  logger = inject<Logger>('app:logger');

  /**
   * Respond with JSON by default
   */
  async respond({ error }: any) {
    assert(error, 'Error action must be invoked with an error as a param');
    // Print the error to the logs
    if (this.config.environment !== 'test') {
      this.logger.error(`Request ${ this.request.id } errored:`);
      this.logger.error(error.stack || error.message);
    }
    // Ensure a default status code of 500
    error.status = error.statusCode = error.statusCode || 500;
    // If debugging info is allowed, attach some debugging info to standard
    // locations.
    if (this.config.logging && this.config.logging.showDebuggingInfo) {
      error.meta = {
        stack: error.stack,
        action: this.originalAction
      };
    // Otherwise, sanitize the output
    } else {
      if (error.statusCode === 500) {
        error.message = 'Internal Error';
      }
      delete error.stack;
    }
    if (this.request.accepts([ 'html' ]) && this.container.lookup('application:main').environment !== 'production') {
      this.render(error.status, error, { view: 'error.html' });
    } else {
      this.render(error.status, error);
    }
  }

}
