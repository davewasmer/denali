import { Blueprint } from 'denali-cli';
import { singularize } from 'inflection';
import {
  upperFirst,
  camelCase
} from 'lodash';
import unwrap from '../../lib/utils/unwrap';

/**
 * Generates a blank ORM adapter with stubs for all the required methods
 *
 * @package blueprints
 */
export default class ORMAdapterBlueprint extends Blueprint {

  /* tslint:disable:completed-docs typedef */
  public static blueprintName = 'orm-adapter';
  public static description = 'Generates a blank ORM adapter with stubs for all the required methods';
  public static longDescription = unwrap`
    Usage: denali generate orm-adapter <name> [options]

    Generates a new ORM adapter with stubs for all the required adapter methods. Note: this is
    typically an advanced use case (i.e. using a niche, specialty database). You should check to
    make sure there isn't already a Denali addon that implements the ORM adapter you need.

    Guides: http://denalijs.org/master/guides/data/orm-adapters/
  `;

  public static params = '<name>';

  public locals(argv: any) {
    let name = argv.name;
    name = singularize(name);
    return {
      name,
      className: upperFirst(camelCase(name))
    };
  }

}
