import test from 'ava';
import * as fs from 'fs-extra';
import * as path from 'path';
import { BlueprintAcceptanceTest } from 'denali';

test('app blueprint > generates correctly', async (t) => {
  let blueprint = new BlueprintAcceptanceTest('app');
  t.context.dir = blueprint.dir;
  t.context.gitignore = path.join(blueprint.dir, 'test', '.gitignore');

  await blueprint.generate('test');
  t.true(fs.existsSync(t.context.gitignore), '.gitignore file should exist');
});
