import { Response } from 'denali';
import ApplicationAction from '../application';

export default class Create<%= singular.className %> extends ApplicationAction {

  async respond({ body }) {
    let <%= singular.className %> = this.modelFor('<%= singular.name %>');
    let <%= singular.camelCased %> = await <%= singular.className %>.create(body);
    return new Response(201, <%= singular.camelCased %>);
  }

}
