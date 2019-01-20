/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import { setupUnitTest, Container, Resolver } from '@denali-js/core';
import { constant } from 'lodash';

const test = setupUnitTest(() => new Container());

test('get/setOption allows options per type', async (t) => {
  let container: Container = t.context.subject();
  container.setOption('type', 'singleton', true);
  t.true(container.getOption('type', 'singleton'));
  t.true(container.getOption('type:entry', 'singleton'));
});

test('get/setOption allows options per specifier', async (t) => {
  let container: Container = t.context.subject();
  container.setOption('type:entry', 'singleton', true);
  t.true(container.getOption('type:entry', 'singleton'));
});

test('Option: singleton = true', async (t) => {
  let container: Container = t.context.subject();
  container.setOption('foo', 'singleton', true);

  class Foo {}
  container.register('foo:main', Foo);
  let result = container.lookup('foo:main');

  t.true(result instanceof Foo);
  t.is(result, container.lookup('foo:main'));
});

test('Option: singleton = false', async (t) => {
  let container: Container = t.context.subject();
  container.setOption('foo', 'singleton', false);

  let foo = { bar: true };
  container.register('foo:main', foo);
  let result = container.lookup('foo:main');

  t.is(result, foo);
});

test('register(type, value) registers a value on the container', async (t) => {
  let container: Container = t.context.subject();
  container.register('foo:bar', { buzz: true }, { singleton: false });
  t.true(container.lookup<any>('foo:bar').buzz);
});

test('lookup(type) looks up a module', async (t) => {
  let container: Container = t.context.subject();
  container.register('foo:bar', { buzz: true }, { singleton: false });
  t.true(container.lookup<any>('foo:bar').buzz);
});

test('lookupAll(type) returns an object with all the modules of the given type', async (t) => {
  let container: Container = t.context.subject();
  container.register('foo:bar', { isBar: true }, { singleton: false });
  container.register('foo:buzz', { isBuzz: true }, { singleton: false });
  let type = container.lookupAll<any>('foo');
  t.truthy(type.bar);
  t.true(type.bar.isBar);
  t.truthy(type.buzz);
  t.true(type.buzz.isBuzz);
});

test('lazily instantiates singletons (i.e. on lookup)', async (t) => {
  let container: Container = t.context.subject();
  function Class() {
    t.fail('Class should not have been instantiated.');
  }
  container.register('foo:bar', Class, { singleton: true });
  t.pass();
});

test('availableForType() returns all registered instances of a type', async (t) => {
  let container: Container = t.context.subject();

  container.register('foo:a', {a: true}, { singleton: false });
  container.register('foo:b', {b: true}, { singleton: false });
  container.register('foo:c', {c: true}, { singleton: false });
  container.register('foo:d', {d: true}, { singleton: false });

  t.deepEqual(container.availableForType('foo'), ['a', 'b', 'c', 'd']);
});

test('the resolver order should not be changed by lookup methods', async (t) => {
  const container: Container = t.context.subject();

  const loaderMock = (name : string) => ({
    retrieve: () => name,
    loadRelative: () => name,
    factories: new Map(),
  }) as any;

  container.loadBundleScope(loaderMock('l1'));
  container.loadBundleScope(loaderMock('l2'));

  t.deepEqual(container.lookup('foo:l1', { raw: true }), 'l1');
  container.availableForType('foo');
  t.deepEqual(container.lookup('foo:l1', { raw: true }), 'l1');
  t.deepEqual(container.lookup('foo:l1', { raw: true }), 'l1');
});

test('falls back to `fallbacks` specifiers if original specifier is not found', async (t) => {
  let container: Container = t.context.subject();
  container.setOption('foo', 'fallbacks', [ 'foo:application' ]);
  container.register('foo:application', 'application', { singleton: false });

  t.is(container.lookup('foo:non-existent-entry'), 'application');
});

test('the container adds a resolver for each loader bundle scope, in breadth-first search order', async (t) => {
  let container: Container = t.context.subject();
  function mockLoader(name: string, ...children: any[]) {
    let childrenMap = new Map(<any>children.map((c: any) => [ c._name, c ]));
    return { load: constant(constant({ name })), children: childrenMap, _name: name };
  }
  let barLoader = mockLoader('bar');
  let fooLoader = mockLoader('foo', barLoader);
  let quuxLoader = mockLoader('quux');
  let topLoader = mockLoader('top', fooLoader, quuxLoader);
  container.loadBundle(<any>topLoader);

  let resolvers = <Resolver[]>(<any>container).resolvers;
  t.deepEqual(resolvers.map((r) => r.name), [ 'top', 'quux', 'foo', 'bar' ]);
});