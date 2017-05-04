/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import test from 'ava';
import { Container, inject } from 'denali';
import * as path from 'path';

const dummyAppPath = path.join(__dirname, '..', 'dummy');

test('register(type, value) registers a value on the container', async (t) => {
  let container = new Container(dummyAppPath);
  container.register('foo:bar', { buzz: true });
  t.true(container.lookup<any>('foo:bar').buzz);
});

test('lookup(type) looks up a module', async (t) => {
  let container = new Container(dummyAppPath);
  container.register('foo:bar', { buzz: true });
  t.true(container.lookup<any>('foo:bar').buzz);
});

test('lookupAll(type) returns an object with all the modules of the given type', async (t) => {
  let container = new Container(dummyAppPath);
  container.register('foo:bar', { isBar: true });
  container.register('foo:buzz', { isBuzz: true });
  let type = container.lookupAll<any>('foo');
  t.truthy(type.bar);
  t.true(type.bar.isBar);
  t.truthy(type.buzz);
  t.true(type.buzz.isBuzz);
});

test('instantiates a singleton', async (t) => {
  let container = new Container(dummyAppPath);
  class Class {
    static singleton = true;
  }
  container.setOption('foo', 'singleton', true);
  container.register('foo:bar', Class);

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
  container.setOption('foo', 'singleton', true);
  container.register('foo:bar', Class);
  t.pass();
});

test('availableForType() returns all registered instances of a type', async (t) => {
  let container = new Container(dummyAppPath);

  container.register('foo:a', {a: true});
  container.register('foo:b', {b: true});
  container.register('foo:c', {c: true});
  container.register('foo:d', {d: true});

  t.deepEqual(container.availableForType('foo'), ['a', 'b', 'c', 'd']);
});

test('properties marked as injections are injected', async (t) => {
  let container = new Container(dummyAppPath);
  container.register('bar:main', { isPresent: true });
  container.register('foo:main', {
    bar: inject('bar:main')
  });
  let foo = container.lookup<any>('foo:main');

  t.true(foo.bar.isPresent, 'injection was applied');
});