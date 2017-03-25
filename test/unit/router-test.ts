/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import test from 'ava';
import { IncomingMessage } from 'http';
import {
  Logger,
  Router,
  MockRequest,
  MockResponse,
  Container,
  Serializer,
  Action } from 'denali';

test('Router > runs middleware before determining routing', async (t) => {
  t.plan(2);
  let count = 0;
  let container = new Container();
  container.register('app:router', Router);
  container.register('config:environment', { environment: 'development' });
  container.register('action:error', class TestAction extends Action {
    respond() {
      count += 1;
      t.is(count, 2);
    }
  });
  let router = <Router>container.lookup('app:router');
  router.use((req, res, next) => {
    count += 1;
    t.is(count, 1);
    next();
  });
  await router.handle(<any>(new MockRequest()), (<any>new MockResponse()));
});

test('Router > does not attempt to serialize when action.serializer = false', async (t) => {
  t.plan(1);
  let container = new Container();
  container.register('app:router', Router);
  container.register('config:environment', { environment: 'development' });
  container.register('action:error', class TestAction extends Action {
    serializer: false = false;
    respond(params: any) {
      t.fail(` Router should not have encountered an error:\n${ params.error.stack }`);
    }
  });
  container.register('action:index', class TestAction extends Action {
    serializer: false = false;
    respond() {
      t.pass();
    }
  });
  container.register('serializer:application', class extends Serializer {
    parse() {
      t.fail('Router should not have attempted to parse this request with a serializer');
    }
    serialize() {
      t.fail('Router should not have attempted to serialize this response with a serializer');
    }
  });
  let router = container.lookup('app:router');
  router.post('/', 'index');

  let req = new MockRequest({ url: '/', method: 'POST' });
  req.write('{}');
  await router.handle(<any>req, <any>new MockResponse());
});

test('Router > #urlFor works with string argument', (t) => {
  let container = new Container();

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

test('Router > #urlFor works with action argument', (t) => {
  let container = new Container();

  container.register('app:router', Router);
  container.register('action:index', class TestAction extends Action {
    serializer = false;
    respond() {
      // noop
    }
  });

  let router = container.lookup('app:router');
  router.get('/test/:id/', 'index');

  let TestAction = container.lookup('action:index');
  t.is(router.urlFor(TestAction, {id: 10}), '/test/10/', 'Router should return the correctly reversed url');
});
