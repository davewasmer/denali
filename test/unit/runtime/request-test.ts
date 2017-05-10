/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import test from 'ava';
import { Request, MockRequest } from 'denali';

function mockRequest(options?: any) {
  return new Request(<any>new MockRequest(options));
}

test('method returns correct method', (t) => {
  let request = mockRequest({
    method: 'put'
  });
  t.is(request.method, 'put');
});

test('hostname returns Host header without port number', (t) => {
  let request = mockRequest({
    headers: {
      Host: 'example.com:1234'
    }
  });
  t.is(request.hostname, 'example.com');
});

test('ip returns remote address of socket', (t) => {
  let request = mockRequest();
  t.is(request.ip, '123.45.67.89');
});

test('originalUrl returns the pathname of the url', (t) => {
  let request = mockRequest({
    url: 'https://example.com/a/b/c/d/'
  });
  t.is(request.originalUrl, '/a/b/c/d/');
});

test('protocol', (t) => {
  let request = mockRequest({
    url: 'https://example.com/'
  });
  let request2 = mockRequest({
    url: 'http://example.com/'
  });

  t.is(request.protocol, 'https:');
  t.is(request2.protocol, 'http:');
});

test('secure returns true for https', (t) => {
  let request = mockRequest({
    url: 'https://example.com/'
  });

  t.is(request.secure, true);
});

test('xhr returns true for ajax requests', (t) => {
  let request = mockRequest({
    headers: {
      'x-requested-with': 'XMLHttpRequest'
    }
  });

  t.is(request.xhr, true);
});

test('subdomains return an array of subdomains from request url', (t) => {
  let request = mockRequest({
    headers: {
      host: 'a.example.com'
    }
  });
  let request2 = mockRequest({
    headers: {
      host: 'a.b.c.example.com'
    }
  });

  t.deepEqual(request.subdomains, ['a']);
  t.deepEqual(request2.subdomains, ['a', 'b', 'c']);
});

test('get returns header value', (t) => {
  let request = mockRequest({
    headers: {
      foo: 'bar',
      baz: 'qux'
    }
  });

  t.is(request.get('foo'), 'bar');
  t.is(request.get('baz'), 'qux');
});

test('headers returns all request headers', (t) => {
  let request = mockRequest({
    headers: {
      foo: 'bar',
      baz: 'qux'
    }
  });

  t.deepEqual(request.headers, {
    foo: 'bar',
    baz: 'qux'
  });
});

test('accepts returns correct type', (t) => {
  let request = mockRequest({
    headers: {
      accept: 'text/html'
    }
  });
  let request2 = mockRequest({
    headers: {
      accept: 'application/json'
    }
  });

  t.is(request.accepts(['json', 'html']), 'html');
  t.is(request2.accepts(['json', 'html']), 'json');
});

test('is returns correct values', (t) => {
  let request = mockRequest({
    method: 'post',
    headers: {
      'content-type': 'application/json',
      'content-length': 2
    }
  });
  let request2 = mockRequest({
    method: 'post',
    headers: {
      'content-type': 'text/html',
      'content-length': 7
    }
  });

  t.is(request.is('html'), false);
  t.is(request.is('json'), 'json');
  t.is(request2.is('json'), false);
});
