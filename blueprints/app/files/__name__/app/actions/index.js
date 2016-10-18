import ApplicationAction from './application';

export default class IndexAction extends ApplicationAction {

  serializer = false;

  respond() {
    return { message: 'Welcome to Denali!' };
  }

}
