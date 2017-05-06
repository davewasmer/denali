import mixin, { MixinApplicator } from './mixin';
import Container from './container';

/**
 * The base object class for Denali classes. Adds mixin support.
 *
 * @package metal
 */
export default class DenaliObject {

  /**
   * The application container instance
   */
  protected static container: Container;

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

}
