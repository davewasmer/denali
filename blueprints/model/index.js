import upperFirst from 'lodash/upperFirst';
import camelCase from 'lodash/camelCase';
import Blueprint from '../../lib/cli/blueprint';

export default class ModelBlueprint extends Blueprint {

  static blueprintName = 'model';
  static description = 'Generates a blank model';

  params = [ 'name' ];

  locals({ name }) {
    return {
      name,
      className: upperFirst(camelCase(name))
    };
  }

}
