import test from 'ava';
import * as path from 'path';
import { Logger, Addon, Container, Service } from 'denali';

test('Addon > #loadApp > Singletons are instantiated', async (t) => {
  let dir = path.join(__dirname, '..', 'fixtures', 'addon');
  let container = new Container();
  let addon = new Addon({
    environment: 'development',
    container,
    dir
  });

  (<any>addon).loadApp();
  let service = container.lookup('service:test');

  t.true(service instanceof Service, 'Has correct baseclass');
});
