import {
  upperFirst,
  camelCase
} from 'lodash';
import { Blueprint, unwrap } from 'denali-cli';

/**
 * Generates a blank serializer
 *
 * @package blueprints
 */
export default class SerializerBlueprint extends Blueprint {

  /* tslint:disable:completed-docs typedef */
  static blueprintName = 'serializer';
  static description = 'Generates a blank serializer';
  static longDescription = unwrap`
    Usage: denali generate serializer <name> [options]

    Generates a blank serializer for the given model.

    Guides: http://denalijs.org/master/guides/data/serializers/
  `;

  static params = '<name>';

  locals(argv: any) {
    let name = argv.name;
    return {
      name,
      className: upperFirst(camelCase(name))
    };
  }
}
