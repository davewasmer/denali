/**
 * Services are typically used to represent either external systems (i.e. a
 * caching service) or a cross-cutting, reusable piece of application logic
 * (i.e. an authorization / roles service).
 *
 * Services are mostly conventional - they are just singletons with no
 * special behavior. The common base class ensures they are
 * singletons, makes user intent clear, and paves the way for introducing
 * additional common functionality in future versions of Denali.
 *
 * @class Service
 * @constructor
 * @module denali
 * @submodule runtime
 */
export default class Service {
  static singleton = true;
}
