/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import {
  setupUnitTest,
  Action,
  Model,
  Serializer,
  Request,
  MockRequest,
  MockResponse,
  RenderOptions,
  ResponderParams } from 'denali';

function mockRequest(options?: any) {
  return new Request(<any>new MockRequest(options), <any>{});
}

async function run(ActionClass: any, options?: any) {
  let response = new MockResponse();
  let action: Action = new ActionClass();
  action.actionPath = 'test';
  await action.run(mockRequest(options), <any>response);
  return response._json;
}

const test = setupUnitTest(() => {}, {
  'app:logger': true,
  'config:environment': true,
  'orm-adapter:application': true,
  'parser:application': true,
  'serializer:application': class DummySerializer extends Serializer {
    attributes: any[] = [];
    relationships = {};
    serialize(body: any, action: Action, options: RenderOptions) {
      return body;
    }
  },
  'service:config': true
});

test('invokes respond() with params', async (t) => {
  t.plan(2);
  class TestAction extends Action {
    async respond({ query }: ResponderParams) {
      t.truthy(query);
      t.is(query.foo, 'bar');
    }
  }

  await run(TestAction, { url: '/?foo=bar' });
});

test('does not invoke the serializer if no response body was provided', async (t) => {
  let { inject } = t.context;
  t.plan(1);
  inject('serializer:application', class TestSerializer extends Serializer {
    attributes: string[] = [];
    relationships = {};
    async serialize(action: Action, body: any, options: RenderOptions) {
      t.fail('Serializer should not be invoked');
    }
  });
  class TestAction extends Action {
    respond() {
      t.pass();
      this.render(200);
    }
  }

  await run(TestAction);
});

test('uses a specified serializer type when provided', async (t) => {
  let { inject } = t.context;
  t.plan(2);
  inject('serializer:foo', class TestSerializer extends Serializer {
    attributes: string[] = [];
    relationships = {};
    async serialize(action: Action, body: any, options: RenderOptions) {
      t.pass();
    }
  });
  class TestAction extends Action {
    async respond() {
      t.pass();
      await this.render(200, {}, { serializer: 'foo' });
    }
  }

  await run(TestAction);
});

test('renders with the model type serializer if a model was rendered', async (t) => {
  let { inject } = t.context;
  t.plan(2);
  inject('serializer:post', class FooSerializer extends Serializer {
    attributes: string[] = [];
    relationships = {};
    async serialize(action: Action, body: any, options: RenderOptions) {
      t.pass();
    }
  });
  class Post extends Model {}
  class TestAction extends Action {
    respond() {
      t.pass();
      return new Post();
    }
  }

  await run(TestAction);
});

test('renders with the application serializer if all options exhausted', async (t) => {
  let { inject } = t.context;
  t.plan(2);
  inject('serializer:application', class TestSerializer extends Serializer {
    attributes: string[] = [];
    relationships = {};
    async serialize(action: Action, body: any, options: RenderOptions) {
      t.pass();
    }
  });
  class TestAction extends Action {
    respond() {
      t.pass();
      return {};
    }
  }

  await run(TestAction);
});

test('invokes before filters prior to respond()', async (t) => {
  let sequence: string[] = [];
  class TestAction extends Action {
    static before = [ 'beforeFilter' ];
    static after = [ 'afterFilter' ];

    beforeFilter() { sequence.push('before'); }
    respond() { sequence.push('respond'); }
    afterFilter() { sequence.push('after'); }
  }

  await run(TestAction);
  t.deepEqual(sequence, [ 'before', 'respond', 'after' ]);
});

test('invokes superclass filters before subclass filters', async (t) => {
  let sequence: string[] = [];
  abstract class ParentClass extends Action {
    static before = [ 'parentBefore' ];

    parentBefore() { sequence.push('parent'); }
  }
  class ChildClass extends ParentClass {
    static before = [ 'childBefore' ];

    childBefore() { sequence.push('child'); }
    respond() {}
  }

  await run(ChildClass);
  t.deepEqual(sequence, [ 'parent', 'child' ]);
});

test('error out when an non-existent filter was specified', async (t) => {
  class TestAction extends Action {
    static before = [ 'some-non-existent-method' ];
    respond() {}
  }

  // tslint:disable-next-line:no-floating-promises
  await t.throws(run(TestAction));
});

test('before filters that render block the responder', async (t) => {
  t.plan(1);
  class TestAction extends Action {
    static before = [ 'preempt' ];
    respond() {
      t.fail('Filter should have preempted this responder method');
    }
    preempt() {
      this.render(200, { hello: 'world' });
    }
  }

  let response = await run(TestAction);
  t.deepEqual(response, { hello: 'world' });
});

test('before filters that return block the responder', async (t) => {
  t.plan(1);
  class TestAction extends Action {
    static before = [ 'preempt' ];
    respond() {
      t.fail('Filter should have preempted this responder method');
    }
    preempt() {
       return { hello: 'world' };
    }
  }
  let response = await run(TestAction);
  t.deepEqual(response, { hello: 'world' });
});

test('after filters run after responder, even if responder renders', async (t) => {
  t.plan(1);
  class TestAction extends Action {
    static after = [ 'afterFilter' ];
    respond() { return {}; }
    afterFilter() { t.pass(); }
  }
  await run(TestAction);
});

test('after filters run even if a before filter renders', async (t) => {
  t.plan(2);
  class TestAction extends Action {
    static before = [ 'beforeFilter' ];
    static after = [ 'afterFilter' ];
    respond() { t.fail(); }
    beforeFilter() {
      t.pass();
      this.render(200);
    }
    afterFilter() { t.pass(); }
  }
  await run(TestAction);
});

test.todo('renders with a custom view if provided');
test.todo('throws if nothing renders');
