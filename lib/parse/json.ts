import Parser from './parser';
import Request from '../runtime/request';
import { json } from 'body-parser';
import { Response, RequestHandler } from 'express';
import { fromNode } from 'bluebird';
import { ResponderParams } from '../runtime/action';

declare module 'body-parser' {
  interface OptionsJson {
    verify(req: Request, res: any, buf: Buffer, encoding: string): void;
  }
}

/**
 * Parses incoming request bodies as JSON payloads.
 *
 * @package parse
 * @since 0.1.0
 */
export default class JSONParser extends Parser {

  /**
   * When set to true, then deflated (compressed) bodies will be inflated; when
   * false, deflated bodies are rejected. Defaults to true.
   *
   * @since 0.1.0
   */
  inflate = true;

  /**
   * Controls the maximum request body size. If this is a number, then the
   * value specifies the number of bytes; if it is a string, the value is
   * passed to the bytes library for parsing. Defaults to '100kb'.
   *
   * @since 0.1.0
   */
  limit = '100kb';

  /**
   * The reviver option is passed directly to JSON.parse as the second
   * argument.
   *
   * @since 0.1.0
   */
  reviver: (key: string, value: any) => any;

  /**
   * When set to true, will only accept arrays and objects; when false will
   * accept anything JSON.parse accepts. Defaults to true.
   *
   * @since 0.1.0
   */
  strict = true;

  /**
   * The type option is used to determine what media type the middleware will
   * parse. This option can be a function or a string. If a string, type option
   * is passed directly to the type-is library and this can be an extension
   * name (like json), a mime type (like application/json), or a mime type with
   * a wildcard. If a function, the type option is called as fn(req) and the
   * request is parsed if it returns a truthy value. Defaults to
   * application/json.
   *
   * @since 0.1.0
   */
  type = 'application/json';

  /**
   * The verify option, if supplied, is called as verify(req, res, buf,
   * encoding), where buf is a Buffer of the raw request body and encoding is
   * the encoding of the request. The parsing can be aborted by throwing an
   * error.
   *
   * @since 0.1.0
   */
  verify: (req: Request, res: Response, buf: Buffer, encoding: string) => void;

  protected jsonParserMiddleware: RequestHandler;

  protected async bufferAndParseBody(request: Request) {
    await fromNode((cb) => {
      if (!this.jsonParserMiddleware) {
        this.jsonParserMiddleware = json({
          inflate: this.inflate,
          limit: this.limit,
          reviver: this.reviver,
          strict: this.strict,
          type: this.type,
          verify: this.verify
        });
      }
      this.jsonParserMiddleware(<any>request.incomingMessage, <any>{}, cb)
    });
    return (<any>request.incomingMessage).body;
  }

  async parse(request: Request) {
    let body = await this.bufferAndParseBody(request);

    return <ResponderParams>{
      body,
      query: request.query,
      headers: request.headers,
      params: request.params
    };
  }


}
