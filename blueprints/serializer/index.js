import upperFirst from 'lodash/upperFirst';
import camelCase from 'lodash/camelCase';
import Blueprint from '../../lib/cli/blueprint';

export default class SerializerBlueprint extends Blueprint {

  static blueprintName = 'serializer';
  static description = 'Generates a blank serializer';

  params = [ 'name' ];

  locals({ name }) {
    return {
      name,
      className: upperFirst(camelCase(name))
    };
  }
}
