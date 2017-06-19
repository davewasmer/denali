import {
  lowerCase
} from 'lodash';
import { Blueprint, unwrap } from 'denali-cli';

/**
 * Generates a model, serializer, CRUD actions, and tests for a resource
 *
 * @package blueprints
 */
export default class ResourceBlueprint extends Blueprint {

  /* tslint:disable:completed-docs typedef */
  static blueprintName = 'acceptance-test';
  static description = 'Generates a blank acceptance test';
  static longDescription = unwrap`
    Usage: denali generate acceptance-test <name>

    Generates a blank acceptance test, suitable for testing your app end-to-end with simulated HTTP
    requests and responses.
  `;

  static params = '<name>';

  locals(argv: any) {
    let name = argv.name;
    return { name, humanizedName: lowerCase(name) };
  }

}
