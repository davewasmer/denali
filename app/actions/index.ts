import Action from '../../lib/runtime/action';

export default class IndexAction extends Action {

  respond() {
    return this.render(200, { hello: 'world' }, { serializer: 'raw' });
  }

}
