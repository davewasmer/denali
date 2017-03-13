import {
  upperFirst,
  camelCase
} from 'lodash';
import { Blueprint } from 'denali-cli';
import unwrap from '../../lib/utils/unwrap';

/**
 * Generates a blank serializer
 *
 * @package blueprints
 */
export default class SerializerBlueprint extends Blueprint {

  /* tslint:disable:completed-docs typedef */
  public static blueprintName = 'serializer';
  public static description = 'Generates a blank serializer';
  public static longDescription = unwrap`
    Usage: denali generate serializer <name> [options]

    Generates a blank serializer for the given model.

    Guides: http://denalijs.org/master/guides/data/serializers/
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
