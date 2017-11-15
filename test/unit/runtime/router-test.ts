/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import {
  setupUnitTest,
  Router,
  MockRequest,
  MockResponse,
  Action } from 'denali';

const test = setupUnitTest(() => new Router(), {
  'app:logger': true,
  'service:config': true,
  'config:environment': true,
  'parser:application': true
});

test.todo('map creates routes');
test.todo('handle finds matching route & hands off to action');
test.todo('fails fast if action does not exist');
test.todo('method shortcuts define routes');
test.todo('resource() creates CRUD routes');
test.todo('resource(name, { related: false }) creates CRUD routes except relationship ones');
test.todo('resource(name, { except: [...] }) creates CRUD routes except listed ones');
test.todo('resource(name, { only: [...] }) creates only listed CRUD routes');
test.todo('namespace(name, ...) returns a wrapper to create routes under the namespace');

test('runs middleware before determining routing', async (t) => {
  let { inject, subject } = t.context;
  t.plan(1);
  let sequence: string[] = [];
  inject('action:error', class TestAction extends Action {
    respond() {
      sequence.push('error action');
    }
  });
  let router = subject();
  router.use((req: any, res: any , next: any) => {
    sequence.push('middleware');
    next();
  });

  await router.handle(<any>(new MockRequest()), (<any>new MockResponse()));
  t.deepEqual(sequence, [ 'middleware', 'error action' ]);
});

test('#urlFor works with string argument', (t) => {
  let { inject, subject } = t.context;
  inject('action:index', class TestAction extends Action {
    respond() {}
  });
  let router = subject();
  router.get('/test/:id/', 'index');
  t.is(router.urlFor('index', {id: 10}), '/test/10/', 'Router should return the correctly reversed url');
});
