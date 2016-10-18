import Blueprint from '../../lib/blueprint';
import upperFirst from 'lodash/upperFirst';
import camelCase from 'lodash/camelCase';

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
