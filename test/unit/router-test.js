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
