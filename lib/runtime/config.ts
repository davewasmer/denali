import Service from './service';
import { get } from 'lodash';
import { lookup } from '../metal/container';

export default class ConfigService extends Service {

  protected _config = lookup<AppConfig>('config:environment');

  get environment(): string {
    return this._config.environment;
  }

  // This nonsense basically gets us type info for the static config object up to 6 levels deep in nesting
  get<S extends AppConfig, T1 extends keyof S>(p1: T1): S[T1];
  get<S extends AppConfig, T1 extends keyof S, T2 extends keyof S[T1]>(p1: T1, p2: T2): S[T1][T2];
  get<S extends AppConfig, T1 extends keyof S, T2 extends keyof S[T1], T3 extends keyof S[T1][T2]>(p1: T1, p2: T2, p3: T3): S[T1][T2][T3];
  get<S extends AppConfig, T1 extends keyof S, T2 extends keyof S[T1], T3 extends keyof S[T1][T2], T4 extends keyof S[T1][T2][T3]>(p1: T1, p2: T2, p3: T3, p4: T4): S[T1][T2][T3][T4];
  get<S extends AppConfig, T1 extends keyof S, T2 extends keyof S[T1], T3 extends keyof S[T1][T2], T4 extends keyof S[T1][T2][T3], T5 extends keyof S[T1][T2][T3][T4]>(p1: T1, p2: T2, p3: T3, p4: T4, p5: T5): S[T1][T2][T3][T4][T5];
  get<S extends AppConfig, T1 extends keyof S, T2 extends keyof S[T1], T3 extends keyof S[T1][T2], T4 extends keyof S[T1][T2][T3], T5 extends keyof S[T1][T2][T3][T4], T6 extends keyof S[T1][T2][T3][T4][T5]>(p1: T1, p2: T2, p3: T3, p4: T4, p5: T5, p6: T6): S[T1][T2][T3][T4][T5][T6];
  get<S extends AppConfig, T1 extends keyof S, T2 extends keyof S[T1], T3 extends keyof S[T1][T2], T4 extends keyof S[T1][T2][T3], T5 extends keyof S[T1][T2][T3][T4], T6 extends keyof S[T1][T2][T3][T4][T5], T7 extends keyof S[T1][T2][T3][T4][T5][T6]>(p1: T1, p2: T2, p3: T3, p4: T4, p5: T5, p6: T6, p7: T7): S[T1][T2][T3][T4][T5][T6][T7];
  get(...path: string[]): any {
    // Split on dots in path segments, allowing for `get('foo.bar')` as well as `get('foo', 'bar')`
    path = path.reduce((segments, nextSegment) => segments.concat(nextSegment.split('.')), []);
    return get(this._config, path);
  }

  // This nonsense basically gets us type info for the static config object up to 6 levels deep in nesting
  getWithDefault<S extends AppConfig, T1 extends keyof S>(p1: T1, defaultValue: any): S[T1];
  getWithDefault<S extends AppConfig, T1 extends keyof S, T2 extends keyof S[T1]>(p1: T1, p2: T2, defaultValue: any): S[T1][T2];
  getWithDefault<S extends AppConfig, T1 extends keyof S, T2 extends keyof S[T1], T3 extends keyof S[T1][T2]>(p1: T1, p2: T2, p3: T3, defaultValue: any): S[T1][T2][T3];
  getWithDefault<S extends AppConfig, T1 extends keyof S, T2 extends keyof S[T1], T3 extends keyof S[T1][T2], T4 extends keyof S[T1][T2][T3]>(p1: T1, p2: T2, p3: T3, p4: T4, defaultValue: any): S[T1][T2][T3][T4];
  getWithDefault<S extends AppConfig, T1 extends keyof S, T2 extends keyof S[T1], T3 extends keyof S[T1][T2], T4 extends keyof S[T1][T2][T3], T5 extends keyof S[T1][T2][T3][T4]>(p1: T1, p2: T2, p3: T3, p4: T4, p5: T5, defaultValue: any): S[T1][T2][T3][T4][T5];
  getWithDefault<S extends AppConfig, T1 extends keyof S, T2 extends keyof S[T1], T3 extends keyof S[T1][T2], T4 extends keyof S[T1][T2][T3], T5 extends keyof S[T1][T2][T3][T4], T6 extends keyof S[T1][T2][T3][T4][T5]>(p1: T1, p2: T2, p3: T3, p4: T4, p5: T5, p6: T6, defaultValue: any): S[T1][T2][T3][T4][T5][T6];
  getWithDefault<S extends AppConfig, T1 extends keyof S, T2 extends keyof S[T1], T3 extends keyof S[T1][T2], T4 extends keyof S[T1][T2][T3], T5 extends keyof S[T1][T2][T3][T4], T6 extends keyof S[T1][T2][T3][T4][T5], T7 extends keyof S[T1][T2][T3][T4][T5][T6]>(p1: T1, p2: T2, p3: T3, p4: T4, p5: T5, p6: T6, p7: T7, defaultValue: any): S[T1][T2][T3][T4][T5][T6][T7];
  getWithDefault(...args: any[]): any {
    let defaultValue = args.pop();
    let path = <string[]>args;
    // Split on dots in path segments, allowing for `get('foo.bar')` as well as `get('foo', 'bar')`
    path = path.reduce((segments, nextSegment) => segments.concat(nextSegment.split('.')), []);
    return get(this._config, path, defaultValue);
  }

}

export interface AppConfig {
  /**
   * The name of the current environment, i.e. 'developement', 'test', 'production'
   */
  environment: string;

  logging?: {

    /**
     * Should logs show debug information? If true, errors will log out as much detail as possible.
     */
    showDebuggingInfo?: boolean;

    /**
     * A morgan log format string to use
     */
    format?: string;

    /**
     * A function to determine whether or not logging should be skipped for a given request - see
     * morgan docs for details
     */
    skip?(): boolean;

  };

  /**
   * Cookie parser configuration - see cookie-parser for details
   */
  cookies?: any;

  /**
   * CORS configuration - see cors middleware package for details
   */
  cors?: any;

  migrations?: {

    /**
     * Knex configuration information for running migrations
     */
    db?: any;

  };

  server: {

    /**
     * THe port number that the application should start up on
     */
    port?: number;

    /**
     * Should the application start in detached mode? I.e. without attaching to a port?
     */
    detached?: boolean;

    /**
     * SSL/TLS certificate files. Note these should be the file contents, not the file paths
     */
    ssl?: {
      key: Buffer | string;
      cert: Buffer | string;
    }

    trustProxy?: string | string[] | ((addr?: string, i?: number) => boolean);

    subdomainOffset?: number;

  };

  /**
   * Connection and configuration for your ORM adapter - see your ORM adapter docs for
   * details
   */
  database?: any;

  [key: string]: any;
}
