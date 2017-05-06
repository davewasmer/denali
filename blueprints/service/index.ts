import { Blueprint } from 'denali-cli';
import unwrap from '../../lib/utils/unwrap';

/**
 * Generates a blank service
 *
 * @package blueprints
 */
export default class ServiceBlueprint extends Blueprint {

  /* tslint:disable:completed-docs typedef */
  static blueprintName = 'service';
  static description = 'Generates a blank service';
  static longDescription = unwrap`
    Usage: denali generate service <name> [options]

    Generates a blank service class.

    Guides: http://denalijs.org/master/guides/application/services/
  `;

  static params = '<name>';

}
