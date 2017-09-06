/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import test from 'ava';
import * as path from 'path';
import { Action, Resolver } from 'denali';

const dummyAppPath = path.join(__dirname, '..', '..', '..');

test('registered entries take precedence over resolved entries', async (t) => {
  let resolver = new Resolver(dummyAppPath);
  t.is(Object.getPrototypeOf(resolver.retrieve('action:application')), Action);
  resolver.register('action:application', { foo: true });
  t.true(resolver.retrieve<any>('action:application').foo);
});

test('retrieve tries type-specific retrieval methods if present', async (t) => {
  class TestResolver extends Resolver {
    retrieveFoo(type: string, entry: string) {
      t.pass();
    }
  }
  let resolver = new TestResolver(dummyAppPath);
  resolver.retrieve('foo:main');
});

test('availableForType returns array of available entries for given type', async (t) => {
  let resolver = new Resolver(dummyAppPath);
  resolver.register('foo:1', {});
  resolver.register('foo:2', {});
  resolver.register('foo:3', {});
  t.deepEqual(resolver.availableForType('foo'), [ 'foo:1', 'foo:2', 'foo:3' ]);
});

test('availableForType tries type-specific retrieval methods if present', async (t) => {
  t.plan(1);
  class TestResolver extends Resolver {
    availableForFoo(type: string): string[] {
      t.pass();
      return [];
    }
  }
  let resolver = new TestResolver(dummyAppPath);
  resolver.availableForType('foo');
});
