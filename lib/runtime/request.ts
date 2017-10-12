import { Dict } from '../utils/types';
import Route from './route';
import { AppConfig } from './config';
import { constant } from 'lodash';
import * as accepts from 'accepts';
import { isIP, Socket } from 'net';
import { TLSSocket } from 'tls';
import * as typeis from 'type-is';
import * as http from 'http';
import * as https from 'https';
import * as parseRange from 'range-parser';
import * as parse from 'parseurl';
import * as proxyaddr from 'proxy-addr';
import * as uuid from 'uuid';
import * as qs from 'querystring';

/**
 * The Request class represents an incoming HTTP request (specifically, Node's IncomingMessage).
 *
 * @package runtime
 * @since 0.1.0
 */
export default class Request {

  /**
   * A UUID generated unqiue to this request. Useful for tracing a request through the application.
   *
   * @since 0.1.0
   */
  id: string = uuid.v4();

  /**
   * The route parser route that was matched
   *
   * @since 0.1.0
   */
  route: Route;

  /**
   * The name of the original action that was invoked - useful for error actions to create
   * helpful debug messages.
   *
   * @since 0.1.0
   */
  _originalAction: string;

  /**
   * The underlying HTTP server's IncomingMessage instance
   *
   * @since 0.1.0
   */
  incomingMessage: http.IncomingMessage | https.IncomingMessage;

  /**
   * A subset of the app config, the `config.server` namespace
   *
   * @since 0.1.0
   */
  config: AppConfig['server'];

  /**
   * The uppercase method name for the request, i.e. GET, POST, HEAD
   *
   * @since 0.1.0
   */
  get method(): string {
    return this.incomingMessage.method.toUpperCase();
  }

  /**
   * The requested path name
   *
   * @since 0.1.0
   */
  get path(): string {
    return parse(this.incomingMessage).pathname;
  }

  /**
   * The params extracted from the router's dynamic segments
   *
   * @since 0.1.0
   */
  params: any;

  /**
   * The query string, parsed into an object
   *
   * @since 0.1.0
   */
  get query(): Dict<string> {
    return qs.parse(parse(this.incomingMessage).query);
  }

  /**
   * The headers for the incoming request
   *
   * @since 0.1.0
   */
  get headers(): Dict<string | string[]> {
    return this.incomingMessage.headers;
  }

  /**
   * Return subdomains as an array.
   *
   * Subdomains are the dot-separated parts of the host before the main domain
   * of the app. By default, the domain of the app is assumed to be the last
   * two parts of the host. This can be changed by setting
   * config.server.subdomainOffset
   *
   * For example, if the domain is "tobi.ferrets.example.com": If the subdomain
   * offset is not set, req.subdomains is `["ferrets", "tobi"]`. If the
   * subdomain offset is 3, req.subdomains is `["tobi"]`.
   *
   * @since 0.1.0
   */
  get subdomains(): string[] {
    let hostname = this.hostname;
    if (!hostname) {
      return [];
    }
    let offset = this.config.subdomainOffset;
    let subdomains = !isIP(hostname) ? hostname.split('.').reverse() : [ hostname ];
    return subdomains.slice(offset == null ? 2 : offset);
  }

  /**
   * Return the protocol string "http" or "https" when requested with TLS. When
   * the "server.trustProxy" setting trusts the socket address, the
   * "X-Forwarded-Proto" header field will be trusted and used if present.
   *
   * If you're running behind a reverse proxy that supplies https for you this
   * may be enabled.
   *
   * @since 0.1.0
   */
  get protocol(): 'http' | 'https' {
    let rawProtocol: 'http' | 'https' = (<TLSSocket>this.incomingMessage.connection).encrypted ? 'https' : 'http';
    let trustProxyConfig = this.config.trustProxy || constant(false);
    let ip = this.incomingMessage.connection.remoteAddress;

    if (trustProxyConfig) {
      if (typeof trustProxyConfig !== 'function') {
        trustProxyConfig = proxyaddr.compile(trustProxyConfig);
      }
      if (trustProxyConfig(ip, 0)) {
        let proxyClaimedProtocol = this.getHeader('X-Forwarded-Proto') || rawProtocol;
        return <'http' | 'https'>proxyClaimedProtocol.split(/\s*,\s*/)[0];
      }
    }
    return rawProtocol;
  }

  /**
   * Check if the request was an _XMLHttpRequest_.
   *
   * @since 0.1.0
   */
  get xhr(): boolean{
    let val = this.getHeader('X-Requested-With') || '';
    return val.toLowerCase() === 'xmlhttprequest';
  }

  /**
   * Parse the "Host" header field to a hostname.
   *
   * When the "trust proxy" setting trusts the socket address, the
   * "X-Forwarded-Host" header field will be trusted.
   *
   * @since 0.1.0
   */
  get hostname(): string {
    let host = this.getHeader('X-Forwarded-Host');
    let ip = this.incomingMessage.socket.remoteAddress;
    let trustProxyConfig = this.config.trustProxy || constant(false);

    if (typeof trustProxyConfig !== 'function') {
      trustProxyConfig = proxyaddr.compile(trustProxyConfig);
    }
    if (!host || !trustProxyConfig(ip, 0)) {
      host = this.getHeader('Host');
    }
    if (!host) {
      return;
    }
    // IPv6 literal support
    let offset = host[0] === '[' ? host.indexOf(']') + 1 : 0;
    let index = host.indexOf(':', offset);
    return index !== -1 ? host.substring(0, index) : host;
  }

  /**
   * Return the remote address from the trusted proxy.
   *
   * The is the remote address on the socket unless "trust proxy" is set.
   *
   * @since 0.1.0
   */

  get ip(): string {
    let trustProxyConfig = this.config.trustProxy || constant(false);
    return proxyaddr(this.incomingMessage, trustProxyConfig);
  }

  /**
   * When "trust proxy" is set, trusted proxy addresses + client.
   *
   * For example if the value were "client, proxy1, proxy2" you would receive
   * the array `["client", "proxy1", "proxy2"]` where "proxy2" is the furthest
   * down-stream and "proxy1" and "proxy2" were trusted.
   *
   * @since 0.1.0
   */
  get ips(): string[] {
    let trustProxyConfig = this.config.trustProxy || constant(false);
    let ips = proxyaddr.all(this.incomingMessage, trustProxyConfig);
    ips.reverse().pop();
    return ips;
  }

  /**
   * Does this request have a request body?
   */
  get hasBody(): boolean {
    return typeis.hasBody(this.incomingMessage);
  }

  get connection(): Socket {
    return this.incomingMessage.connection;
  }

  constructor(incomingMessage: http.IncomingMessage | https.IncomingMessage, serverConfig?: AppConfig['server']) {
    this.incomingMessage = incomingMessage;
    this.config = serverConfig || {};
  }

  /**
   * Return request header.
   *
   * The `Referrer` header field is special-cased, both `Referrer` and
   * `Referer` are interchangeable.
   *
   * Examples:
   *
   * req.get('Content-Type'); // => "text/plain"
   *
   * req.get('content-type'); // => "text/plain"
   *
   * req.get('Something'); // => undefined
   *
   * Aliased as `req.header()`.
   * @since 0.1.0
   */
  getHeader(name: string): string;
  getHeader(name: 'set-cookie' | 'Set-cookie' | 'Set-Cookie'): string[];
  getHeader(name: 'set-cookie' | 'Set-cookie' | 'Set-Cookie' | string): string | string[] {
    return this.incomingMessage.headers[name.toLowerCase()];
  }

  /**
   * Check if the given `type(s)` is acceptable, returning the best match when
   * true, otherwise `undefined`, in which case you should respond with 406
   * "Not Acceptable".
   *
   * The `type` value may be a single MIME type string such as
   * "application/json", an extension name such as "json", a comma-delimited
   * list such as "json, html, text/plain", an argument list such as `"json",
   * "html", "text/plain"`, or an array `["json", "html", "text/plain"]`. When
   * a list or array is given, the _best_ match, if any is returned.
   *
   * Examples:
   *
   *     // Accept: text/html
   *     req.accepts('html');
   *     // => "html"
   *
   *     // Accept: text/*, application/json
   *     req.accepts('html');
   *     // => "html"
   *     req.accepts('text/html');
   *     // => "text/html"
   *     req.accepts('json, text');
   *     // => "json"
   *     req.accepts('application/json');
   *     // => "application/json"
   *
   *     // Accept: text/*, application/json
   *     req.accepts('image/png');
   *     req.accepts('png');
   *     // => undefined
   *
   *     // Accept: text/*;q=.5, application/json
   *     req.accepts(['html', 'json']);
   *     req.accepts('html', 'json');
   *     req.accepts('html, json');
   *     // => "json"
   *
   * @since 0.1.0
   */
  accepts(): string[];
  accepts(...type: string[]): string[] | string | false;
  accepts(...type: string[]): string[] | string | false {
    let accept = accepts(this.incomingMessage);
    return accept.types(...type);
  }

  /**
   * Check if the given `encoding`s are accepted.
   *
   * @since 0.1.0
   */
  acceptsEncodings(): string[];
  acceptsEncodings(...encoding: string[]): string | false;
  acceptsEncodings(...encoding: string[]): string[] | string | false {
    let accept = accepts(this.incomingMessage);
    return accept.encodings(...encoding);
  }

  /**
   * Check if the given `charset`s are acceptable, otherwise you should respond
   * with 406 "Not Acceptable".
   *
   * @since 0.1.0
   */
  acceptsCharsets(): string[];
  acceptsCharsets(...charset: string[]): string | false;
  acceptsCharsets(...charset: string[]): string[] | string | false {
    let accept = accepts(this.incomingMessage);
    return accept.charsets(...charset);
  }

  /**
   * Check if the given `lang`s are acceptable, otherwise you should respond
   * with 406 "Not Acceptable".
   *
   * @since 0.1.0
   */
  acceptsLanguages(): string[];
  acceptsLanguages(...lang: string[]): string | false;
  acceptsLanguages(...lang: string[]): string[] | string | false {
    let accept = accepts(this.incomingMessage);
    return accept.languages(...lang);
  }

  /**
   * Parse Range header field, capping to the given `size`.
   *
   * Unspecified ranges such as "0-" require knowledge of your resource length.
   * In the case of a byte range this is of course the total number of bytes. If
   * the Range header field is not given `undefined` is returned, `-1` when
   * unsatisfiable, and `-2` when syntactically invalid.
   *
   * When ranges are returned, the array has a "type" property which is the type
   * of range that is required (most commonly, "bytes"). Each array element is
   * an object with a "start" and "end" property for the portion of the range.
   *
   * The "combine" option can be set to `true` and overlapping & adjacent ranges
   * will be combined into a single range.
   *
   * NOTE: remember that ranges are inclusive, so for example "Range: users=0-3"
   * should respond with 4 users when available, not 3.
   *
   * @since 0.1.0
   */
  range(size: number, options?: parseRange.Options): parseRange.Result | parseRange.Ranges {
    let range = this.getHeader('Range');
    if (!range) {
      return;
    }
    return parseRange(size, range, options);
  }

  /**
   * Check if the incoming request contains the "Content-Type" header field,
   * and it contains the give mime `type`.
   *
   * Examples:
   *
   *      // With Content-Type: text/html; charset=utf-8
   *      req.is('html');
   *      req.is('text/html');
   *      req.is('text/*');
   *      // => true
   *
   *      // When Content-Type is application/json
   *      req.is('json');
   *      req.is('application/json');
   *      req.is('application/*');
   *      // => true
   *
   *      req.is('html');
   *      // => false
   *
   * @since 0.1.0
   */
  is(...types: string[]): string | false {
    if (Array.isArray(types[0])) {
      types = <any>types[0];
    }
    return typeis(this.incomingMessage, types);
  }

}
