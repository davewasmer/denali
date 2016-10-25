import test from 'ava';
import { AppAcceptanceTest } from 'denali';

test.beforeEach('setup app', (t) => {
  t.context.app = new AppAcceptanceTest();
});

test('POST /<%= pluralHumanizedName %> > creates a <%= name %>', async (t) => {
  let result = await t.context.app.post('/<%= pluralName %>', {
      // Add the <%= name %> payload here
  });

  t.equal(result.status, 201);
  // t.equal(result.body.foo, 'bar');
});

test('GET /<%= pluralHumanizedName %> > should list <%= pluralHumanizedName %>', async (t) => {
  let result = await t.context.app.get('/<%= pluralName %>');

  t.equal(result.status, 200);
  // t.equal(result.body.foo, 'bar');
});

test('GET /<%= pluralHumanizedName %>/:id > should show a <%= name %>', async (t) => {
  let { body } = await t.context.app.post('/<%= pluralName %>', {
      // Add the <%= name %> payload here
  });
  let id = body.data.id;

  let result = await t.context.app.get(`/<%= pluralName %>/${ id }`);

  t.equal(result.status, 200);
  // t.equal(result.body.foo, 'bar');
});

test('PATCH /<%= pluralHumanizedName %>/:id > should update a <%= name %>', async (t) => {
  let { body } = await t.context.app.post('/<%= pluralName %>', {
      // Add the <%= name %> payload here
  });
  let id = body.data.id;

  let result = await t.context.app.patch(`/<%= pluralName %>/${ id }`, {
      // Add the <%= name %> payload here
  });

  t.equal(result.status, 200);
  // t.equal(result.body.foo, 'bar');
});

test('DELETE /<%= pluralHumanizedName %>/:id > should delete a <%= name %>', async (t) => {
  let { body } = await t.context.app.post('/<%= pluralName %>', {
      // Add the <%= name %> payload here
  });
  let id = body.data.id;

  let result = await t.context.app.delete(`/<%= pluralName %>/${ id }`);

  t.equal(result.status, 204);
});
