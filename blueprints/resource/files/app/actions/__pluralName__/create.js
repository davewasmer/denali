import { Response } from 'denali';
import ApplicationAction from '../application';

export default class Create<%= className %> extends ApplicationAction {

  respond(params) {
    let <%= className %> = this.modelFor('<%= name %>');
    return <%= className %>.create(params).then((<%= camelCased %>) => {
      return new Response(201, <%= camelCased %>);
    });
  }

}
