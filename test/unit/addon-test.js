import test from 'ava';
import path from 'path';
import { Addon, Container, Service } from 'denali';

test('Addon > #loadApp > Singletons are instantiated', async (t) => {
  let dir = path.join(__dirname, '..', 'fixtures', 'addon');
  let container = new Container();
  let addon = new Addon({
    container,
    dir
  });

  addon.loadApp();
  let service = container.lookup('service:test');

  t.true(service instanceof Service, 'Has correct baseclass');
  t.is(service.name, 'test service', 'Is instantiated');
});
