/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import ava, { RegisterContextual } from 'ava';
import { JSONParser, MockRequest, Request } from 'denali';

const test = <RegisterContextual<{ parser: JSONParser }>>ava;

function mockRequest(options?: any) {
  let mocked = new MockRequest(options);
  let req = new Request(mocked, {});
  return req;
}

test.beforeEach(async (t) => {
  t.context.parser = new JSONParser();
});

test('returns standard responder params with body untouched', async (t) => {
  let result = await t.context.parser.parse(mockRequest({ json: { foo: true } }));
  t.truthy(result.body);
  t.true(result.body.foo);
});
