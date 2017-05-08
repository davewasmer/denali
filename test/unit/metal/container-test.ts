/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import test from 'ava';
import { Container, inject } from 'denali';
import * as path from 'path';

const dummyAppPath = path.join(__dirname, '..', 'dummy');

test('metaFor returns a container-scoped metadata object', async (t) => {
  let container = new Container(dummyAppPath);
  let key = {};
  let meta = container.metaFor(key);
  meta.foo = true;
  t.is(container.metaFor(key), meta);

  let otherContainer = new Container(dummyAppPath);
  t.not(otherContainer.metaFor(key), meta);
});

test('get/setOption allows options per type', async (t) => {
  let container = new Container(dummyAppPath);
  container.setOption('type', 'singleton', true);
  t.true(container.getOption('type', 'singleton'));
  t.true(container.getOption('type:entry', 'singleton'));
});

test('get/setOption allows options per specifier', async (t) => {
  let container = new Container(dummyAppPath);
  container.setOption('type:entry', 'singleton', true);
  t.true(container.getOption('type:entry', 'singleton'));
});

test('instantiate: true, singleton: true', async (t) => {
  let container = new Container(dummyAppPath);
  container.setOption('foo', 'singleton', true);
  container.setOption('foo', 'instantiate', true);

  class Foo {}
  container.register('foo:main', Foo);
  let result = container.lookup('foo:main');

  t.true(result instanceof Foo);
  t.is(result, container.lookup('foo:main'));
});

test('instantiate: false, singleton: true', async (t) => {
  let container = new Container(dummyAppPath);
  container.setOption('foo', 'singleton', true);
  container.setOption('foo', 'instantiate', false);

  let foo = {};
  container.register('foo:main', foo);
  let result = container.lookup('foo:main');

  t.is(result, foo);
  t.is(result, container.lookup('foo:main'));
});

test('instantiate: true, singleton: false', async (t) => {
  let container = new Container(dummyAppPath);
  container.setOption('foo', 'singleton', false);
  container.setOption('foo', 'instantiate', true);

  class Foo {}
  container.register('foo:main', Foo);
  let result = container.lookup('foo:main');

  t.true(result instanceof Foo);
  t.not(result, container.lookup('foo:main'));
});

test('register(type, value) registers a value on the container', async (t) => {
  let container = new Container(dummyAppPath);
  container.register('foo:bar', { buzz: true }, { singleton: true, instantiate: false });
  t.true(container.lookup<any>('foo:bar').buzz);
});

test('lookup(type) looks up a module', async (t) => {
  let container = new Container(dummyAppPath);
  container.register('foo:bar', { buzz: true }, { singleton: true, instantiate: false });
  t.true(container.lookup<any>('foo:bar').buzz);
});

test('lookupAll(type) returns an object with all the modules of the given type', async (t) => {
  let container = new Container(dummyAppPath);
  container.register('foo:bar', { isBar: true }, { singleton: true, instantiate: false });
  container.register('foo:buzz', { isBuzz: true }, { singleton: true, instantiate: false });
  let type = container.lookupAll<any>('foo');
  t.truthy(type.bar);
  t.true(type.bar.isBar);
  t.truthy(type.buzz);
  t.true(type.buzz.isBuzz);
});

test('instantiates a singleton', async (t) => {
  let container = new Container(dummyAppPath);
  class Class {}
  container.register('foo:bar', Class, { singleton: true, instantiate: true });

  let classInstance = container.lookup('foo:bar');
  let classInstanceTwo = container.lookup('foo:bar');
  t.true(classInstance instanceof Class);
  t.is(classInstanceTwo, classInstance);
});

test('lazily instantiates singletons (i.e. on lookup)', async (t) => {
  let container = new Container(dummyAppPath);
  function Class() {
    t.fail('Class should not have been instantiated.');
  }
  container.register('foo:bar', Class, { singleton: true });
  t.pass();
});

test('availableForType() returns all registered instances of a type', async (t) => {
  let container = new Container(dummyAppPath);

  container.register('foo:a', {a: true}, { singleton: true, instantiate: false });
  container.register('foo:b', {b: true}, { singleton: true, instantiate: false });
  container.register('foo:c', {c: true}, { singleton: true, instantiate: false });
  container.register('foo:d', {d: true}, { singleton: true, instantiate: false });

  t.deepEqual(container.availableForType('foo'), ['a', 'b', 'c', 'd']);
});

test('properties marked as injections are injected', async (t) => {
  let container = new Container(dummyAppPath);
  container.register('bar:main', { isPresent: true }, { singleton: true, instantiate: false });
  container.register('foo:main', { bar: inject('bar:main') }, { singleton: true, instantiate: false });
  let foo = container.lookup<any>('foo:main');

  t.true(foo.bar.isPresent, 'injection was applied');
});

test('eagerly injects static container reference', async (t) => {
  let container = new Container(dummyAppPath);
  container.register('foo:bar', {}, { singleton: false, instantiate: true });
  let foobar = container.factoryFor<any>('foo:bar');

  t.is((<any>foobar.class).container, container);
});