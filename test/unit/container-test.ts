/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import test from 'ava';
import { Container, inject } from 'denali';

test('register(type, value) registers a value on the container', async (t) => {
  let container = new Container();
  container.register('foo:bar', { buzz: true });
  t.true(container.lookup('foo:bar').buzz);
});

test('lookup(type) looks up a module', async (t) => {
  let container = new Container();
  container.register('foo:bar', { buzz: true });
  t.true(container.lookup('foo:bar').buzz);
});

test('lookupAll(type) returns an object with all the modules of the given type', async (t) => {
  let container = new Container();
  container.register('foo:bar', { isBar: true });
  container.register('foo:buzz', { isBuzz: true });
  let type = container.lookupAll('foo');
  t.truthy(type.bar);
  t.true(type.bar.isBar);
  t.truthy(type.buzz);
  t.true(type.buzz.isBuzz);
});

test('instantiates a singleton', async (t) => {
  let container = new Container();
  class Class {
    static singleton = true;
  }
  container.registerOptions('foo', { singleton: true });
  container.register('foo:bar', Class);

  let classInstance = container.lookup('foo:bar');
  let classInstanceTwo = container.lookup('foo:bar');
  t.true(classInstance instanceof Class);
  t.is(classInstanceTwo, classInstance);
});

test('lazily instantiates singletons (i.e. on lookup)', async (t) => {
  let container = new Container();
  function Class() {
    t.fail('Class should not have been instantiated.');
  }
  (<any>Class).singleton = true;
  container.register('foo:bar', Class);
});

test('availableForType() returns all registered instances of a type', async (t) => {
  let container = new Container();

  container.register('foo:a', {a: true});
  container.register('foo:b', {b: true});
  container.register('foo:c', {c: true});
  container.register('foo:d', {d: true});

  t.deepEqual(container.availableForType('foo'), ['a', 'b', 'c', 'd']);
});

test('properties marked as injections are injected', async (t) => {
  let container = new Container();
  container.register('bar:main', { isPresent: true });
  container.register('foo:main', {
    bar: inject('bar:main')
  });
  let foo = container.lookup('foo:main');

  t.true(foo.bar.isPresent, 'injection was applied');
});

test('prototype properties marked as injections are injected', async (t) => {
  let container = new Container();
  container.register('bar:main', { isPresent: true });
  container.register('foo:main', class Foo {
    bar = inject('bar:main');
  });
  let FooClass = container.lookup('foo:main');
  let foo = new FooClass();

  t.true(foo.bar.isPresent, 'injection was applied');
});