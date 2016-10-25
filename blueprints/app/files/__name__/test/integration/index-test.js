import test from 'ava';
import { AppAcceptanceTest } from 'denali';

test('GET / > should return a welcome message', async (t) => {
  let app = new AppAcceptanceTest();
  let { body } = await app.get('/');
  t.equal(body.message, 'Welcome to Denali!');
});
