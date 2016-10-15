import expect from 'must';
import Action from '../../lib/runtime/action';
import Router from '../../lib/runtime/router';
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

describe.only('Denali.Router', function() {

  it('should not invoke the default serializer if serializer=false in an action', function() {
    let success = false;
    let mock = mockReqRes({
      request: {
        headers: {
          'transfer-encoding': 'chunked'
        },
        method: 'post',
        url: '/a-path',
        body: { my: 'post-data' }
      }
    });
    class TestAction extends Action {
      serializer = false;
      run() {
        return new Promise((resolve) => {
          success = true;
          resolve();
        });
      }
    }

    // if we do run through this serializer, it will blow up with errors
    // about the data key which we don't have'
    mock.container.register('serializer:application', {
      parse() {
        throw new Error('Must not use the serializer');
      }
    });
    class TestRouter extends Router {
      routes = {
        post: [ {
          action: TestAction,
          match() {
            return true;
          }
        } ]
      }
      handleError(req, res, uncaughtError) {
        expect(uncaughtError).to.be.null();
      }
    }
    let router = new TestRouter(mock);

    router.handle(mock.request, mock.response).then(() => {
      expect(success).to.be.true();
    });
  });

});
