import DenaliObject from '../metal/object';
import Request from '../runtime/request';
import { ResponderParams } from '../runtime/action';

/**
 * Denali's Parsers are responsible for taking the incoming request body of an
 * HTTP request and transforming it into a consistent object structure that can
 * be used by Actions.
 *
 * For example, if your app uses JSON-API, you can use the JSON-API parser to
 * transform the incoming JSON-API request body structure into something easier
 * to work with in your Action layer.
 *
 * Other examples of common tasks include parsing and type casting query
 * params, and transforming keys (i.e. kebab-case to camelCase).
 *
 * @package parse
 * @since 0.1.0
 */
export default abstract class Parser extends DenaliObject {

  /**
   * Take an incoming request and return an object that will be passed in as
   * the argument to your Action.
   *
   * The object should include some common properties:
   *
   *    body    - usually the primary data payload of the incoming request
   *    query   - parsed and typecast query string parameters
   *    headers - the headers of the incoming HTTP request
   *    params  - parsed and typecast parameters from the dynamic segments of the
   *              incoming request URL
   *
   * Beyond that, each parser can add it's own additional properties based on
   * how it parses. For example, the JSON-API parser adds any sideloaded
   * records from the request body under the `included` property.
   *
   * @since 0.1.0
   */
  abstract async parse(request: Request): Promise<ResponderParams>;

}
