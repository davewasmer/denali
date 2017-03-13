import { Blueprint } from 'denali-cli';
import unwrap from '../../lib/utils/unwrap';

/**
 * Generates a blank service
 *
 * @package blueprints
 */
export default class ServiceBlueprint extends Blueprint {

  /* tslint:disable:completed-docs typedef */
  public static blueprintName = 'service';
  public static description = 'Generates a blank service';
  public static longDescription = unwrap`
    Usage: denali generate service <name> [options]

    Generates a blank service class.

    Guides: http://denalijs.org/master/guides/application/services/
  `;

  public static params = '<name>';

}
