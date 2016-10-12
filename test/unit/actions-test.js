import 'babel-polyfill';
import expect from 'must';
import sleep from 'then-sleep';
import Action from '../../lib/runtime/action';
import Model from '../../lib/data/model';
import Response from '../../lib/runtime/response';
import Container from '../../lib/runtime/container';
import FlatSerializer from '../../lib/runtime/base/app/serializers/flat';
import merge from 'lodash/merge';

function mockReqRes(overrides) {
  let container = new Container();

  container.register('serializer:application', FlatSerializer);
  container.register('config:environment', {});

  return merge({
    container,
    request: {
      get(headerName) {
        return this.headers && this.headers[headerName.toLowerCase()];
      },
      headers: {
        'content-type': 'application/json'
      },
      query: {},
      body: {}
    },
    response: {
      write() {},
      setHeader() {},
      render() {},
      end() {}
    },
    next() {}
  }, overrides);
}

describe('Denali.Action', function() {
  it('should invoke respond() with params', function() {
    let responded = false;
    class TestAction extends Action {
      respond(params) {
        expect(params.query).to.be.true();
        expect(params.body).to.be.true();
        responded = true;
      }
    }
    let action = new TestAction(mockReqRes({
      request: {
        query: { query: true },
        body: { body: true }
      }
    }));

    return action.run().then(() => {
      expect(responded).to.be.true();
    });
  });

  it('should invoke async respond() with params', function() {
    let responded = false;
    class TestAction extends Action {
      async respond(params) {
        await sleep(5);
        expect(params.query).to.be.true();
        expect(params.body).to.be.true();
        responded = true;
      }
    }
    let action = new TestAction(mockReqRes({
      request: {
        query: { query: true },
        body: { body: true }
      }
    }));

    return action.run().then(() => {
      expect(responded).to.be.true();
    });
  });

  it('should not invoke the serializer if no response body was provided', function() {
    let responded = false;
    let serialized = false;
    class TestAction extends Action {
      serializer = 'foo';
      respond() {
        responded = true;
      }
    }
    let mock = mockReqRes();
    mock.container.register('serializer:foo', {
      serialize() {
        serialized = true;
      }
    });
    let action = new TestAction(mock);

    return action.run().then(() => {
      expect(responded).to.be.true();
      expect(serialized).to.be.false();
    });
  });

  it('should use the specified serializer type if provided', function() {
    let responded = false;
    let serialized = false;
    class TestAction extends Action {
      serializer = 'foo';
      respond() {
        responded = true;
        return {};
      }
    }
    let mock = mockReqRes();
    mock.container.register('serializer:foo', {
      serialize() {
        serialized = true;
      }
    });
    let action = new TestAction(mock);

    return action.run().then(() => {
      expect(responded).to.be.true();
      expect(serialized).to.be.true();
    });
  });

  it('should render with the error serializer if an error was rendered', function() {
    let responded = false;
    let serialized = false;
    class TestAction extends Action {
      respond() {
        responded = true;
        return new Error();
      }
    }
    let mock = mockReqRes();
    mock.container.register('serializer:error', {
      serialize() {
        serialized = true;
      }
    });
    let action = new TestAction(mock);

    return action.run().then(() => {
      expect(responded).to.be.true();
      expect(serialized).to.be.true();
    });
  });

  it('should render with the model type serializer if a model was rendered', function() {
    let responded = false;
    let serialized = false;
    let mock = mockReqRes();

    class TestAction extends Action {
      respond() {
        responded = true;
        return new Proxy({
          constructor: { type: 'foo' }
        }, {
          getPrototypeOf() {
            return Model.prototype;
          }
        });
      }
    }
    mock.container.register('serializer:foo', {
      serialize() {
        serialized = true;
      }
    });
    let action = new TestAction(mock);

    return action.run().then(() => {
      expect(responded).to.be.true();
      expect(serialized).to.be.true();
    });
  });

  describe('filters', function() {

    it('should invoke before filters prior to respond()', function() {
      let sequence = [];
      class TestAction extends Action {
        static before = [ 'before' ];
        static after = [ 'after' ];

        before() {
          sequence.push('before');
        }

        respond() {
          sequence.push('respond');
        }

        after() {
          sequence.push('after');
        }
      }
      let action = new TestAction(mockReqRes());

      return action.run().then(() => {
        expect(sequence).to.eql([ 'before', 'respond', 'after' ]);
      });
    });

    it('should invoke superclass filters before subclass filters', function() {
      let sequence = [];
      class ParentClass extends Action {
        static before = [ 'before' ];

        before() {
          sequence.push('parent');
        }

        respond() {}
      }
      class ChildClass extends ParentClass {
        static before = [ 'before', 'beforeChild' ];

        beforeChild() {
          sequence.push('child');
        }
      }
      let action = new ChildClass(mockReqRes());

      return action.run().then(() => {
        expect(sequence).to.eql([ 'parent', 'child' ]);
      });
    });

    it('should error out when an non-existent filter was specified', function() {
      class TestAction extends Action {
        static before = [ 'some-non-existent-method' ];
        respond() {}
      }
      let action = new TestAction(mockReqRes());

      return expect(action.run.bind(action)).to.throw();
    });

    it('should should render the returned value of a filter (if that value != null)', function() {
      let rendered;
      class TestAction extends Action {
        static before = [ 'preempt' ];
        respond() {
          return { never: 'reached' };
        }
        preempt() {
          return { hello: 'world' };
        }
        render(result) {
          rendered = result;
        }
      }
      let action = new TestAction(mockReqRes());

      return action.run().then(() => {
        expect(rendered).to.eql({ hello: 'world' });
      });
    });

  });

  describe('content negotiation', function() {

    it('should respond with the content-type specific responder', function() {
      let responded = false;
      let respondedWithHtml = false;
      class TestAction extends Action {
        respond() {
          responded = true;
        }
        respondWithHtml() {
          respondedWithHtml = true;
        }
      }
      let action = new TestAction(mockReqRes({
        request: {
          headers: {
            'Content-type': 'text/html'
          },
          accepts() {
            return 'html';
          }
        }
      }));

      return action.run().then(() => {
        expect(responded).to.be.false();
        expect(respondedWithHtml).to.be.true();
      });
    });

  });

  describe('when render is not called', function() {

    it('should autorender', function() {
      let rendered;
      class TestAction extends Action {
        respond() {
          return new Response(200, { foo: 'bar' }, { raw: true });
        }
      }
      let action = new TestAction(mockReqRes({
        response: {
          write(result) {
            rendered = JSON.parse(result);
          }
        }
      }));

      return action.run().then(() => {
        expect(rendered).to.eql({ foo: 'bar' });
      });
    });

  });

  describe('wrapper methods', function() {

    it('should return model when using modelFor', function() {
      let model;
      class TestAction extends Action {
        respond() {
          let User = this.modelFor('user');
          model = User;
          return User;
        }
      }
      let mock = mockReqRes();

      mock.container.register('model:user', { type: 'user' });

      let action = new TestAction(mock);

      return action.run().then(() => {
        expect(model.type).to.eql('user');
        expect(model.container).to.eql(action.container);
      });
    });

    it('should return service when using service(type)', function() {
      let service;
      class TestAction extends Action {
        respond() {
          let Mine = this.service('mine');
          service = Mine;
          return Mine;
        }
      }
      let mock = mockReqRes();

      mock.container.register('service:mine', { type: 'mine' });

      let action = new TestAction(mock);

      return action.run().then(() => {
        expect(service.type).to.eql('mine');
      });
    });

  });

});
