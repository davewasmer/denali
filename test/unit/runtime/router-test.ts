/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import test from 'ava';
import * as path from 'path';
import {
  Router,
  MockRequest,
  MockResponse,
  Container,
  Action,
  FlatParser} from 'denali';

const dummyAppPath = path.join(__dirname, '..', 'dummy');

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
  t.plan(2);
  let count = 0;
  let container = new Container(dummyAppPath);
  container.register('app:router', Router);
  container.register('parser:application', FlatParser);
  container.register('config:environment', { environment: 'development' });
  container.register('service:db', {}, { instantiate: false });
  container.register('action:error', class TestAction extends Action {
    respond() {
      count += 1;
      t.is(count, 2);
    }
  }, { singleton: false, instantiate: true });
  let router = container.lookup<Router>('app:router');
  router.use((req, res, next) => {
    count += 1;
    t.is(count, 1);
    next();
  });
  await router.handle(<any>(new MockRequest()), (<any>new MockResponse()));
});

test('#urlFor works with string argument', (t) => {
  let container = new Container(dummyAppPath);

  container.register('app:router', Router);
  container.register('action:index', class TestAction extends Action {
    serializer = false;
    respond() {
      // noop
    }
  });

  let router = container.lookup('app:router');
  router.get('/test/:id/', 'index');

  t.is(router.urlFor('index', {id: 10}), '/test/10/', 'Router should return the correctly reversed url');
});
