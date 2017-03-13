import { Blueprint } from 'denali-cli';
import * as moment from 'moment';
import * as assert from 'assert';
import unwrap from '../../lib/utils/unwrap';

/**
 * Generates a database schema migration
 *
 * @package blueprints
 */
export default class MigrationBlueprint extends Blueprint {

  /* tslint:disable:completed-docs typedef */
  public static blueprintName = 'migration';
  public static description = 'Generates a database schema migration';
  public static longDescription = unwrap`
    Usage: denali generate migration <name> [options]

    Generates a new blank migration. The filename will include the current Unix timestamp to ensure
    proper sorting and execution order when running migrations.

    Guides: http://denalijs.org/master/guides/data/migrations/
  `;

  public static params = '<name>';

  public locals(argv: any) {
    let name = argv.name;
    assert(name, 'You must provide a name for this migration');
    let filename = `${ moment().format('X') }-${ name }`;
    return { name, filename };
  }

}
