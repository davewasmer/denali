/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import test from 'ava';
import { Container } from 'denali';

test('Container > #register(type, value) > registers a value on the container', async (t) => {
  let container = new Container();
  container.register('foo:bar', { buzz: true });
  t.true(container.lookup('foo:bar').buzz);
});

test('Container > #lookup(type) > looks up a module', async (t) => {
  let container = new Container();
  container.register('foo:bar', { buzz: true });
  t.true(container.lookup('foo:bar').buzz);
});

test('Container > #lookupAll(type) > returns an object with all the modules of the given type', async (t) => {
  let container = new Container();
  container.register('foo:bar', { buzz: true });
  container.register('foo:buzz', { bat: true });
  let type = (<any> container.lookupAll('foo'));
  t.truthy(type.bar);
  t.true(type.bar.buzz);
  t.truthy(type.buzz);
  t.true(type.buzz.bat);
});

test('Container > singletons > should instantiate a singleton', async (t) => {
  let container = new Container();
  class Class {
    static singleton = true;
  }
  container.register('foo:bar', new Class());

  let classInstance = container.lookup('foo:bar');
  let classInstanceTwo = container.lookup('foo:bar');
  t.true(classInstance instanceof Class);
  t.is(classInstanceTwo, classInstance);
});

test('Container > singletons > lazily instantiates singletons (i.e. on lookup)', async (t) => {
  let container = new Container();
  function Class() {
    t.fail('Class should not have been instantiated.');
  }
  (<any>Class).singleton = true;
  container.register('foo:bar', Class);
});

test('Container > #availableForType() > returns all registered instances of a type', async (t) => {
  let container = new Container();

  container.register('foo:a', {a: true});
  container.register('foo:b', {b: true});
  container.register('foo:c', {c: true});
  container.register('foo:d', {d: true});

  t.deepEqual(container.availableForType('foo'), ['a', 'b', 'c', 'd']);
});

test.todo('Container > #lookupSerializer() > injects all serializer singletons into each serializer');
// let container = new Container();
// class SerializerOne {
//   static singleton = true
// }
// class SerializerTwo {
//   static singleton = true
// }
// container.register('serializer:one', new SerializerOne());
// container.register('serializer:two', new SerializerTwo());
//
// let serializerOne = container.lookup('serializer:one');
// expect(serializerOne).to.be.an.instanceof(SerializerOne);
// expect(serializerOne.serializers).to.have.keys([ 'one', 'two' ]);
// expect(serializerOne.serializers.two).to.be.an.instanceof(SerializerTwo);

test.todo('Container > #lookupAdapter > injects all adapter singletons into each adapter');
// let container = new Container();
// class AdapterOne {
//   static singleton = true
// }
// class AdapterTwo {
//   static singleton = true
// }
// container.register('adapter:one', new AdapterOne());
// container.register('adapter:two', new AdapterTwo());
//
// let adapterOne = container.lookup('adapter:one');
// expect(adapterOne).to.be.an.instanceof(AdapterOne);
// expect(adapterOne.adapters).to.have.keys([ 'one', 'two' ]);
// expect(adapterOne.adapters.two).to.be.an.instanceof(AdapterTwo);
