import upperFirst from 'lodash/upperFirst';
import camelCase from 'lodash/camelCase';
import Blueprint from '../../lib/cli/blueprint';

export default class ActionBlueprint extends Blueprint {

  static blueprintName = 'action';
  static description = "Generates an action and it's unit & integration tests";

  params = [ 'name' ];

  locals({ name }) {
    let levels = name.split('/').map(() => '..');
    levels.pop();
    if (levels.length > 0) {
      levels = levels.join('/');
    } else {
      levels = '.';
    }
    return {
      name,
      className: upperFirst(camelCase(name)),
      nesting: levels
    };
  }
}
