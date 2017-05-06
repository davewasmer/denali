import Parser from './parser';
import Request from '../runtime/request';
import { ResponderParams } from '../runtime/action';

export default class FlatParser extends Parser {

  parse(request: Request): ResponderParams {
    return {
      body: request.body,
      query: request.query,
      headers: request.headers,
      params: request.params
    };
  }

}