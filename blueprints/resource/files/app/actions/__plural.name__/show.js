import ApplicationAction from '../application';

export default class Show<%= singular.className %> extends ApplicationAction {

  async respond({ params }) {
    let <%= singular.className %> = this.modelFor('<%= singular.dasherized %>');
    return <%= singular.className %>.findOne(params.id);
  }

}
