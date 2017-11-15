import { setupAcceptanceTest } from 'denali';

const test = setupAcceptanceTest();

test('hello world request', async (t) => {
  let { app } = t.context;
  let result = await app.get('/');
  t.is(result.status, 200);
  t.is(result.body.hello, 'world');
});
