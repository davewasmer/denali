/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import test from 'ava';
import * as fs from 'fs-extra';
import * as path from 'path';
import { CommandAcceptanceTest } from 'denali-cli';

test('generates a blueprint', async (t) => {
  let generate = new CommandAcceptanceTest('generate action foobar --skip-post-install', { name: 'generate-command' });
  let generatedFilepath = path.join(generate.dir, 'app', 'actions', 'foobar.js');

  await generate.run({ failOnStderr: true });
  t.true(fs.existsSync(generatedFilepath), 'file should be generated');
});
