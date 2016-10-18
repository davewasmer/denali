import ApplicationAction from '../application';

export default class Update<%= className %> extends ApplicationAction {

  respond(params) {
    let <%= className %> = this.modelFor('<%= name %>');
    return <%= className %>.find(params.id)
      .then((<%= camelCased %>) => {
        Object.assign(<%= camelCased %>, params);
        return <%= camelCased %>.save();
      });
  }

}
