import { Response } from 'denali';
import ApplicationAction from '../application';

export default class Destroy<%= singular.className %> extends ApplicationAction {

  async respond({ params }) {
    let <%= singular.className %> = this.modelFor('<%= singular.dasherized %>');
    let <%= singular.camelCased %> = await <%= singular.className %>.findOne(params.id);
    await <%= singular.camelCased %>.delete();
    return new Response(204);
  }

}
