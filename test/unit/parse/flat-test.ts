/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import test from 'ava';
import { FlatParser, MockRequest, Request } from 'denali';

function mockRequest(options?: any, body?: any) {
  let mocked = new MockRequest(options);
  let req = new Request(<any>mocked);
  req.body = body;
  return req;
}

test('returns standard responder params with body untouched', async (t) => {
  let parser = new FlatParser();
  let result = parser.parse(mockRequest({}, { foo: true }));
  t.true(result.body.foo);
});
