import test from 'ava';
import {
  Router,
  MockRequest,
  MockResponse,
  Container,
  Action } from 'denali';

test('Router > runs middleware before determining routing', async (t) => {
  t.plan(2);
  let count = 0;
  let container = new Container();
  class TestAction extends Action {
    respond() {
      count += 1;
      t.is(count, 2);
    }
  }
  container.register('action:error', TestAction);
  let router = new Router({ container });
  router.use((req, res, next) => {
    count += 1;
    t.is(count, 1);
    next();
  });
  await router.handle(new MockRequest(), new MockResponse());
});

test('Router > does not attempt to serialize when action.serializer = false', async (t) => {
  t.plan(1);
  let container = new Container();
  container.register('action:index', class TestAction extends Action {
    serializer = false;
    respond() {
      t.pass();
    }
  });
  container.register('serializer:application', {
    parse() {
      t.fail('Router should not have attempted to parse this request with a serializer');
    },
    serialize() {
      t.fail('Router should not have attempted to serialize this response with a serializer');
    }
  });
  let router = new Router({ container });
  router.post('/', 'index');

  let req = new MockRequest({ url: '/', method: 'POST' });
  req.write('{}');
  await router.handle(req, new MockResponse());
});
