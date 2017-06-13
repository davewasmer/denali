/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import test from 'ava';
import {
  Action,
  Model,
  Container,
  Serializer,
  Request,
  MockRequest,
  MockResponse,
  FlatParser,
  RawSerializer } from 'denali';
import { RenderOptions, ResponderParams } from 'lib/runtime/action';

function mockRequest(options?: any) {
  return new Request(<any>new MockRequest(options));
}

test.beforeEach((t) => {
  let container = t.context.container = new Container(__dirname);
  container.register('parser:application', FlatParser);
  container.register('serializer:application', RawSerializer);
  container.register('service:db', {}, { instantiate: false });
  container.register('config:environment', {});
  t.context.runAction = async (options?: any) => {
    let response = new MockResponse();
    let action = await container.lookup<Action>('action:test');
    action.actionPath = 'test';
    await action.run(mockRequest(options), <any>response);
    // If we can parse a response, return that, otherwise just return false (lots of these tests
    // don't care about the response bod);
    try {
      return response._getJSON();
    } catch (e) {
      return false;
    }
  };
});

test.todo('renders with a custom view if provided');
test.todo('throws if nothing renders');

test('invokes respond() with params', async (t) => {
  t.plan(2);
  let container: Container = t.context.container;
  container.register('action:test', class TestAction extends Action {
    async respond({ query }: ResponderParams) {
      t.is(query.foo, 'bar');
      t.pass();
      return {};
    }
  });

  await t.context.runAction({ url: '/?foo=bar' });
});

test('does not invoke the serializer if no response body was provided', async (t) => {
  t.plan(1);
  let container: Container = t.context.container;
  container.register('serializer:application', class TestSerializer extends Serializer {
    attributes: string[] = [];
    relationships = {};
    async serialize(action: Action, body: any, options: RenderOptions) {
      t.fail('Serializer should not be invoked');
    }
  });
  container.register('action:test', class TestAction extends Action {
    respond() {
      t.pass();
      this.render(200);
    }
  });

  await t.context.runAction();
});

test('uses a specified serializer type when provided', async (t) => {
  t.plan(2);
  let container: Container = t.context.container;
  container.register('serializer:foo', class TestSerializer extends Serializer {
    attributes: string[] = [];
    relationships = {};
    async serialize(action: Action, body: any, options: RenderOptions) {
      t.pass();
    }
  });
  container.register('action:test', class TestAction extends Action {
    async respond() {
      t.pass();
      await this.render(200, {}, { serializer: 'foo' });
    }
  });

  await t.context.runAction();
});

test('renders with the model type serializer if a model was rendered', async (t) => {
  t.plan(2);
  let container: Container = t.context.container;
  container.register('serializer:foo', class FooSerializer extends Serializer {
    attributes: string[] = [];
    relationships = {};
    async serialize(action: Action, body: any, options: RenderOptions) {
      t.pass();
    }
  });
  container.register('action:test', class TestAction extends Action {
    respond() {
      t.pass();
      return new Proxy({
        constructor: { type: 'foo' },
        type: 'foo'
      }, {
        getPrototypeOf() {
          return Model.prototype;
        }
      });
    }
  });

  await t.context.runAction();
});

test('renders with the application serializer if all options exhausted', async (t) => {
  t.plan(2);
  let container: Container = t.context.container;
  container.register('serializer:application', class TestSerializer extends Serializer {
    attributes: string[] = [];
    relationships = {};
    async serialize(action: Action, body: any, options: RenderOptions) {
      t.pass();
    }
  });
  container.register('action:test', class TestAction extends Action {
    respond() {
      t.pass();
      return {};
    }
  });

  await t.context.runAction();
});

test('invokes before filters prior to respond()', async (t) => {
  let sequence: string[] = [];
  let container: Container = t.context.container;
  container.register('action:test', class TestAction extends Action {
    static before = [ 'beforeFilter' ];
    static after = [ 'afterFilter' ];

    beforeFilter() { sequence.push('before'); }
    respond() { sequence.push('respond'); return {}; }
    afterFilter() { sequence.push('after'); }
  });

  await t.context.runAction();
  t.deepEqual(sequence, [ 'before', 'respond', 'after' ]);
});

test('invokes superclass filters before subclass filters', async (t) => {
  let sequence: string[] = [];
  let container: Container = t.context.container;
  abstract class ParentClass extends Action {
    static before = [ 'parentBefore' ];

    parentBefore() { sequence.push('parent'); }
  }
  container.register('action:test', class ChildClass extends ParentClass {
    static before = [ 'childBefore' ];

    childBefore() { sequence.push('child'); }
    respond() { return {}; }
  });

  await t.context.runAction();
  t.deepEqual(sequence, [ 'parent', 'child' ]);
});

test('error out when an non-existent filter was specified', async (t) => {
  let container: Container = t.context.container;
  container.register('action:test', class TestAction extends Action {
    static before = [ 'some-non-existent-method' ];
    respond() {}
  });

  // tslint:disable-next-line:no-floating-promises
  await t.throws(t.context.runAction());
});

test('before filters that render block the responder', async (t) => {
  t.plan(1);
  let container: Container = t.context.container;
  container.register('action:test', class TestAction extends Action {
    static before = [ 'preempt' ];
    respond() {
      t.fail('Filter should have preempted this responder method');
    }
    preempt() {
       this.render(200, { hello: 'world' });
    }
  });
  let response = await t.context.runAction();
  t.deepEqual(response, { hello: 'world' });
});

test('after filters run after responder, even if responder renders', async (t) => {
  t.plan(1);
  let container: Container = t.context.container;
  container.register('action:test', class TestAction extends Action {
    static after = [ 'afterFilter' ];
    respond() { return {}; }
    afterFilter() { t.pass(); }
  });
  await t.context.runAction();
});

test('after filters run even if a before filter renders', async (t) => {
  t.plan(2);
  let container: Container = t.context.container;
  container.register('action:test', class TestAction extends Action {
    static before = [ 'beforeFilter' ];
    static after = [ 'afterFilter' ];
    respond() { t.fail(); }
    beforeFilter() {
      t.pass();
      this.render(200);
    }
    afterFilter() { t.pass(); }
  });
  await t.context.runAction();
});
