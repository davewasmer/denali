/**
 *
 * This is the main module exported by Denali when it is loaded via
 * `require/import`.
 *
 * This exports convenient shortcuts to other modules within Denali.
 * Rather than having to `import Addon from 'denali/dist/lib/runtime/addon'`,
 * you can just `import { Addon } from 'denali'`.
 *
 * ## Exports
 *
 * ### `Serializer`
 *
 * Serializers are responsible for determining what data gets sent over the
 * wire, and how that data is rendered into a JSON response. Check out the
 * [guides](serializers) for details.
 *
 * ### `Errors`
 *
 * An errors module based on
 * [http-errors](https://github.com/jshttp/http-errors). Useful for
 * standardizing how you handle error responses. Check out the [guides](errors)
 * or the [http-errors docs](https://github.com/jshttp/http-errors) for details.
 *
 * @module denali
 * @main denali
 */
import 'babel-polyfill';

// Data
export { default as attr } from './data/attribute';
export { default as hasMany } from './data/has-many';
export { default as hasOne } from './data/has-one';
export { default as Model } from './data/model';
export { default as ORMAdapter } from './data/orm-adapter';
export { default as Serializer } from './data/serializer';
export { default as FlatSerializer } from './data/serializers/flat';
export { default as JSONAPISerializer } from './data/serializers/json-api';

// Metal
export { default as Instrumentation } from './metal/instrumentation';
export { default as mixin, createMixin } from './metal/mixin';
export { default as eachPrototype } from './metal/each-prototype';

// Runtime
export { default as Action } from './runtime/action';
export { default as Addon } from './runtime/addon';
export { default as Application } from './runtime/application';
export { default as Container } from './runtime/container';
export { default as Errors } from './runtime/errors';
export { expect } from './runtime/errors';
export { default as Logger } from './runtime/logger';
export { default as Response } from './runtime/response';
export { default as Service } from './runtime/service';

// Test
export { default as setupApp } from './test/setup-app';
export { version } from '../../package.json';
