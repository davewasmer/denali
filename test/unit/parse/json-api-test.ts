/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import test from 'ava';
import { JSONAPIParser, MockRequest, Request } from 'denali';

function mockRequest(body?: any) {
  let mocked = new MockRequest({
    method: 'POST',
    headers: {
      'Content-type': 'application/vnd.api+json'
    }
  });
  let req = new Request(<any>mocked);
  req.body = body;
  return req;
}

test('returns responder params with primary request data flattened', async (t) => {
  let parser = new JSONAPIParser();
  let result = parser.parse(mockRequest({
    data: {
      type: 'bar',
      attributes: {
        foo: true
      }
    }
  }));
  t.true(result.body.foo);
});

test('returns responder params with included records', async (t) => {
  let parser = new JSONAPIParser();
  let result = parser.parse(mockRequest({
    data: {
      type: 'bar',
      attributes: {
        foo: true
      }
    },
    included: [
      {
        type: 'fizz',
        attributes: {
          buzz: true
        }
      }
    ]
  }));
  t.true(result.body.foo);
  t.true(result.included[0].buzz);
});

test('doesn\'t attempt to parse and returns no body if request body empty', (t) => {
  let parser = new JSONAPIParser();
  let mocked = new MockRequest({
    method: 'GET'
  });
  let req = new Request(<any>mocked);
  let result = parser.parse(req);
  t.true(typeof result.body === 'undefined');
});
