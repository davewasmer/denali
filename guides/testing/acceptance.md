---
title: Acceptance
---

# Acceptance Testing

Denali comes with some testing helpers out of the box to make acceptance
testing simpler. Here's a quick sample of what an acceptance test might look
like:

```js
import { appAcceptanceTest } from 'denali';

const test = appAcceptanceTest();

test('GET /posts/:id returns the requested post', async (t) => {
  let app = t.context.app;
  let db = app.lookup('service:db');
  await db.create('post', { title: 'Hello World' }).save();

  let { status, body } = await app.get('/posts/1');

  t.is(body.title, 'Hello World');
});
```

## `appAcceptanceTest()`

This is the starting point of the Denali test helpers. When defining an
acceptance test suite, just add `const test = appAcceptanceTest()` to the top of the test file
to set up your test suite:

```js
import { appAcceptanceTest } from 'denali';

const test = appAcceptanceTest();

test('GET /posts/:id returns the requested post', async (t) => {
  // ...
```

`appAcceptanceTest()` will automatically handle the setup, initialization, and teardown
of an instance of your Application. It also adds the `t.context.app` property to the
test suite, and if your ORM adapters support test transactions, will automatically
start and rollback a transaction around your test.

## Making test requests

In your tests, `t.context.app` provides a simple API for interacting with your app in
the test environment. In particular, it exposes methods for each HTTP verb (i.e.
`app.get()`, `app.post()`, etc) which let you simulate a request to
your app.

To make a test request, it's as simple as:

```js
test('lists posts', async (t) => {
  let { status, body } = await t.context.app.get('/posts');
  t.is(status, 200);
  t.true(Array.isArray(body));
});
```

There's a few things to note here:

  * The request method (`app.get`) returns a Promise. Don't forget to
  await or return that Promise to make sure the test waits for your async
  activity to finish!
  * The promise resolves to an object with a `status` and `body` property
  * If the app responds with a status code >= 500, the request method will
  reject the promise. If it's < 500, it resolves it. This means that error
  responses from your API like 401 Unauthorized will result in the test request
  promise being _resolved_.

### Headers

Often when testing you'll need to manipulate the headers sent with the requests.
This is frequently done to manage login / logout state (via the Authorization
header). The test app provides a way to do this via `app.setHeader(name,
value)`.
