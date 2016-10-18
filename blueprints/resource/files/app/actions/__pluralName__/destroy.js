import { Response } from 'denali';
import ApplicationAction from '../application';

export default class Destroy<%= className %> extends ApplicationAction {

  respond(params) {
    let <%= className %> = this.modelFor('<%= name %>');
    return <%= className %>.find(params.id)
      .then((<%= camelCased %>) => <%= camelCased %>.delete())
      .then(() => new Response(204));
  }

}
