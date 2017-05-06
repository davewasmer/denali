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

test('Router > runs middleware before determining routing', async (t) => {
  t.plan(2);
  let count = 0;
  let container = new Container(dummyAppPath);
  container.register('app:router', Router);
  container.register('parser:application', FlatParser);
  container.register('config:environment', { environment: 'development' });
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

test('Router > #urlFor works with string argument', (t) => {
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
