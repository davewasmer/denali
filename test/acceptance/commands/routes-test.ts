import test from 'ava';
import * as dedent from 'dedent-js';
import { CommandAcceptanceTest } from 'denali-cli';

test('prints list of configured routes', async (t) => {
  let generate = new CommandAcceptanceTest('routes', { name: 'routes-command' });

  let result = await generate.run({ failOnStderr: true });
  t.true(result.stdout.trim().endsWith(dedent`
┌───────┬────────┐
│ URL   │ ACTION │
├───────┼────────┤
│ GET / │ index  │
└───────┴────────┘
  `.trim()));
});
