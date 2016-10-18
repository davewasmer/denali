import Action from '../../lib/runtime/action';
import Response from '../../lib/runtime/response';

export default class IndexAction extends Action {

  respond() {
    return new Response(200, { hello: 'world' }, { raw: true });
  }

}
