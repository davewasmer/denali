import {
  upperFirst,
  camelCase
} from 'lodash';
import { Blueprint } from 'denali-cli';
import unwrap from '../../lib/utils/unwrap';

/**
 * Generates a blank model
 *
 * @package blueprints
 */
export default class ModelBlueprint extends Blueprint {

  /* tslint:disable:completed-docs typedef */
  public static blueprintName = 'model';
  public static description = 'Generates a blank model';
  public static longDescription = unwrap`
    Usage: denali generate model <name> [options]

    Generates a blank model, along with a serializer for that model, and unit tests for both.

    Guides: http://denalijs.org/master/guides/data/models/
  `;

  public static params = '<name>';

  public locals(argv: any) {
    let name = argv.name;
    return {
      name,
      className: upperFirst(camelCase(name))
    };
  }

}
