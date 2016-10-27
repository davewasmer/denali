import upperFirst from 'lodash/upperFirst';
import camelCase from 'lodash/camelCase';
import lowerCase from 'lodash/lowerCase';
import { singularize, pluralize } from 'inflection';
import Blueprint from '../../lib/cli/blueprint';

export default class ResourceBlueprint extends Blueprint {

  static blueprintName = 'resource';
  static description = 'Generates a model, serializer, CRUD actions, and tests for a resource';

  params = [ 'name' ];

  locals({ name }) {
    name = pluralize(name);
    return {
      name: singularize(name),
      camelCased: camelCase(name),
      className: upperFirst(camelCase(name)),
      pluralName: pluralize(name),
      pluralHumanizedName: lowerCase(name)
    };
  }
}
