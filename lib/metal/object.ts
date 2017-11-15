import mixin, { MixinApplicator } from './mixin';

/**
 * The base object class for Denali classes. Adds mixin support and a stubbed
 * `teardown` method.
 *
 * @package metal
 * @since 0.1.0
 */
export default class DenaliObject {

  /**
   * Apply mixins using this class as the base class. Pure syntactic sugar for
   * the `mixin` helper.
   */
  static mixin(...mixins: MixinApplicator<any, any>[]): any {
    return <any>mixin(this, ...mixins);
  }

  /**
   * A hook invoked when an application is torn down. Only invoked on
   * singletons stored in the container.
   */
  teardown(): void {
    // Default is no-op
  }

}
