import {
  upperFirst,
  camelCase,
} from 'lodash';
import { Blueprint } from 'denali-cli';
import unwrap from '../../lib/utils/unwrap';

export default class ActionBlueprint extends Blueprint {

  static blueprintName = 'action';
  static description = "Generates an action and it's unit & integration tests";
  static longDescription = unwrap`
    Usage: denali generate action <name> [options]

    Generates an action with the given name (can be a deeply nested path), along with unit test
    stubs.

    Guides: http://denali.js.org/master/guides/application/actions/
  `;

  static params = '<name>';

  static flags = {
    method: {
      description: 'The HTTP method to use for the route to this action',
      default: 'post',
      type: <any>'string'
    }
  };

  locals(argv: any): any {
    let name = argv.name;
    let levels = name.split('/').map(() => '..');
    levels.pop();
    let nesting: string;
    if (levels.length > 0) {
      nesting = levels.join('/');
    } else {
      nesting = '.';
    }
    return {
      name,
      className: upperFirst(camelCase(name)),
      nesting
    };
  }

  async postInstall(argv: any): Promise<void> {
    let name = argv.name;
    let method = argv.method || 'post';
    this.addRoute(method.toLowerCase(), `/${ name }`, name);
  }

  async postUninstall(argv: any): Promise<void> {
    let name = argv.name;
    let method = argv.method || 'post';
    this.removeRoute(method.toLowerCase(), `/${ name }`, name);
  }
}
