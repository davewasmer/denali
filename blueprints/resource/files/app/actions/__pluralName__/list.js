import ApplicationAction from '../application';

export default class List<%= className %> extends ApplicationAction {

  respond() {
    let <%= className %> = this.modelFor('<%= name %>');
    return <%= className %>.find();
  }

}
