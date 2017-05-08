import test from 'ava';
import * as fs from 'fs-extra';
import * as path from 'path';
import { CommandAcceptanceTest } from 'denali';


test.beforeEach('generate an action to destroy', async (t) => {
  let generate = new CommandAcceptanceTest('generate action foobar', { name: 'destroy-command' });
  t.context.dir = generate.dir;
  t.context.generatedFilepath = path.join(generate.dir, 'app', 'actions', 'foobar.js');
  await generate.run();
  t.true(fs.existsSync(t.context.generatedFilepath), 'file should be generated');
});

test('destroys a blueprint', async (t) => {
  let destroy = new CommandAcceptanceTest('destroy action foobar', { dir: t.context.dir, populateWithDummy: false });

  await destroy.run();
  t.false(fs.existsSync(t.context.generatedFilepath), 'file should be removed');
});

test('skips modified files', async (t) => {
  let destroy = new CommandAcceptanceTest('destroy action foobar', { dir: t.context.dir, populateWithDummy: false });
  fs.appendFileSync(t.context.generatedFilepath, 'foobar');

  await destroy.run();
  t.true(fs.existsSync(t.context.generatedFilepath), 'file should be generated');
});
