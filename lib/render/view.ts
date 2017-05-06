import DenaliObject from '../metal/object';
import { ServerResponse } from 'http';
import Action, { RenderOptions } from '../runtime/action';

export default abstract class View extends DenaliObject {

  abstract async render(action: Action, response: ServerResponse, body: any, options: RenderOptions): Promise<void>;

}
