import test from 'ava';
import dedent from 'dedent-js';
import { CommandAcceptanceTest } from 'denali';

test('routes command > prints list of configured routes', async (t) => {
  let generate = new CommandAcceptanceTest('routes');

  let result = await generate.run();
  t.true(result.stdout.includes(dedent`
┌───────┬────────┐
│ URL   │ ACTION │
├───────┼────────┤
│ GET / │ index  │
└───────┴────────┘
  `));
});

test('routes command > prints list of configured routes', async (t) => {
  let generate = new CommandAcceptanceTest('routes --print-slow-trees');

  let result = await generate.run();
  t.true(result.stdout.includes(dedent`
    Slowest Trees                                 | Total
  `));
  t.true(result.stdout.includes(dedent`
┌───────┬────────┐
│ URL   │ ACTION │
├───────┼────────┤
│ GET / │ index  │
└───────┴────────┘
  `));
});
