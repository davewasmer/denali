/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import test from 'ava';
// import ErrorView from '../../../app/views/error.html';
import { /*Container,*/ MockResponse } from 'denali';

test.beforeEach(async (t) => {
  // let container = t.context.container = new Container(__dirname);
  // t.context.view = new ErrorView(container);
});

test.skip('it renders the error view correctly', (t) => {
  let response = new MockResponse();
  let error = new Error();
  response.write = () => {
    t.pass();
    return true;
  };

  t.context.view.render(null, response, error, {});
});
