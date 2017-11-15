/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import { setupUnitTest, JSONAPIParser, MockRequest, Request } from 'denali';

const test = setupUnitTest<JSONAPIParser>('parser:json-api');

function mockRequest(json?: any) {
  let mocked = new MockRequest({
    method: 'POST',
    headers: {
      'Content-type': 'application/vnd.api+json'
    },
    json
  });
  return new Request(mocked, <any>{});
}

test('returns responder params with primary request data flattened', async (t) => {
  let parser = t.context.subject();
  let result = await parser.parse(mockRequest({
    data: {
      type: 'bar',
      attributes: {
        foo: true
      }
    }
  }));
  t.truthy(result.body);
  t.true(result.body.foo);
});

test('returns responder params with included records', async (t) => {
  let parser = t.context.subject();
  let result = await parser.parse(mockRequest({
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
  t.truthy(result.body);
  t.true(result.body.foo);
  t.truthy(result.included);
  t.true(result.included[0].buzz);
});

test("doesn't attempt to parse and returns no body if request body empty", async (t) => {
  let parser = t.context.subject();
  let mocked = new MockRequest({ method: 'GET' });
  let req = new Request(<any>mocked, <any>{});
  let result = await parser.parse(req);
  t.true(typeof result.body === 'undefined');
});
