import Action from '../../../action';
import Response from '../../../response';

export default class IndexAction extends Action {

  respond() {
    return new Response(200, { hello: 'world' }, { raw: true });
  }

}
