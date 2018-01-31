import mixin, { MixinApplicator } from './mixin';
import Container from './container';

/**
 * The base object class for Denali classes. Adds mixin support.
 *
 * @package metal
 */
export default class DenaliObject {

  /**
   * Prevent people from introducing subtle and difficult to diagnose bugs by sharing container
   * state statically
   */
  protected static set container(value: any) {
    throw new Error('You tried to set a `container` property on a class directly - this is generally a bad idea, since the static class is shared across multiple containers, likely resulting in leaky state and bizarre test failures.');
  }

  /**
   * Apply mixins using this class as the base class. Pure syntactic sugar for the `mixin` helper.
   */
  static mixin(...mixins: MixinApplicator<any, any>[]): any {
    return <any>mixin(this, ...mixins);
  }

  /**
   * The application container instance
   */
  protected container: Container;

  /**
   * A hook that users should override for constructor-time logic so they don't have to worry about
   * correctly handling super and container references.
   */
  init(...args: any[]): void {
    // Default is no-op
  }

  /**
   * A hook invoked when an application is torn down. Only invoked on singletons stored in the container.
   */
  teardown(): void {
    // Default is no-op
  }

}
