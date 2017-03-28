import ApplicationAction from '../application';

export default class Update<%= singular.className %> extends ApplicationAction {

  async respond({ params, body }) {
    let <%= singular.className %> = this.modelFor('<%= singular.name %>');
    let <%= singular.camelCased %> = await <%= singular.className %>.findOne(params.id);
    Object.assign(<%= singular.camelCased %>, body);
    return <%= singular.camelCased %>.save();
  }

}
