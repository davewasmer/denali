import DenaliObject from '../metal/object';
import Request from '../runtime/request';

export interface ParsedRequest {
  body: { [key: string]: any };
  query: { [param: string]: any };
  headers: { [headerName: string]: string };
  params: { [key: string]: any };
  [key: string]: any;
}

/**
 * Parsers allow to you parse incoming request body and normalize for use in your Actions. Parsers
 * are given the complete incoming request object, and should return a ParsedRequest output.
 *
 * @package data
 */
export default class Parser extends DenaliObject {

  /**
   * Parsers should be singletons
   */
  static singleton = true;

  /**
   * Take the supplied Request instance, parse the request body, query params, headers, etc, and
   * return a ParsedRequest object.
   */
  public parse(request: Request): ParsedRequest {
    return {
      body: request.body,
      query: request.query,
      headers: request.headers,
      params: request.params
    };
  }

}
