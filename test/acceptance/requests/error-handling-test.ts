import { setupAcceptanceTest } from 'denali';
import { inspect } from 'util';

const test = setupAcceptanceTest();

test('exceptions are handled', async (t) => {
  let { app } = t.context;
  let result;
  try {
    result = await app.get('/throws-an-exception');
    t.fail(`Route should have thrown an exception and returned a 500, instead returned: ${ result.status } ${ inspect(result.body, { depth: 3 }) }`);
  } catch ({ status, body}) {
    t.is(status, 500);
    t.regex(body, /some-error/, 'renders error message');
  }
});
