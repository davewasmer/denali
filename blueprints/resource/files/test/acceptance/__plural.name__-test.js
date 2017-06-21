import test from 'ava';
import { appAcceptanceTest } from 'denali';

appAcceptanceTest(test);

test('POST /<%= plural.dasherized %> > creates a <%= singular.humanized %>', async (t) => {
  let result = await t.context.app.post('/<%= plural.name %>', {
    // Add the <%= singular.humanized %> payload here
  });

  t.is(result.status, 201);
  // t.is(result.body.foo, 'bar');
});

test('GET /<%= plural.dasherized %> > should list <%= plural.humanized %>', async (t) => {
  let result = await t.context.app.get('/<%= plural.name %>');

  t.is(result.status, 200);
  // t.is(result.body.foo, 'bar');
});

test('GET /<%= plural.dasherized %>/:id > should show a <%= singular.humanized %>', async (t) => {
  let { body } = await t.context.app.post('/<%= plural.name %>', {
    // Add the <%= singular.humanized %> payload here
  });
  let id = body.data.id;

  let result = await t.context.app.get(`/<%= plural.name %>/${ id }`);

  t.is(result.status, 200);
  // t.is(result.body.foo, 'bar');
});

test('PATCH /<%= plural.dasherized %>/:id > should update a <%= singular.humanized %>', async (t) => {
  let { body } = await t.context.app.post('/<%= plural.name %>', {
    // Add the <%= singular.humanized %> payload here
  });
  let id = body.data.id;

  let result = await t.context.app.patch(`/<%= plural.name %>/${ id }`, {
    // Add the <%= singular.humanized %> payload here
  });

  t.is(result.status, 200);
  // t.is(result.body.foo, 'bar');
});

test('DELETE /<%= plural.dasherized %>/:id > should delete a <%= singular.humanized %>', async (t) => {
  let { body } = await t.context.app.post('/<%= plural.name %>', {
    // Add the <%= singular.humanized %> payload here
  });
  let id = body.data.id;

  let result = await t.context.app.delete(`/<%= plural.name %>/${ id }`);

  t.is(result.status, 204);
});
