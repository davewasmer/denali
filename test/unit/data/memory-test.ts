/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import test from 'ava';
import { MemoryAdapter, hasMany } from 'denali';

async function buildAndSave(adapter: MemoryAdapter, type: string, data: any) {
  let record = adapter.buildRecord(type, data);
  let model = <any>{
    type,
    record,
    get id() {
      return this.record.id;
    }
  };
  await adapter.saveRecord(model);
  return model;
}

test.beforeEach(async (t) => {
  t.context.adapter = new MemoryAdapter();
});

test('find returns record with given id', async (t) => {
  let adapter: MemoryAdapter = t.context.adapter;
  let model = await buildAndSave(adapter, 'foo', { bar: true });

  let result = await adapter.find('foo', model.record.id);
  t.deepEqual(result, model.record);
});

test('find returns null for non-existent id', async (t) => {
  let adapter: MemoryAdapter = t.context.adapter;

  t.is(await adapter.find('whatever', 0), null);
});

test('findOne returns the first record that matches the given query', async (t) => {
  let adapter: MemoryAdapter = t.context.adapter;
  let type = 'foo';
  let matching = await buildAndSave(adapter, type, { number: 'one', bar: true });
  await buildAndSave(adapter, type, { number: 'two', bar: true });
  await buildAndSave(adapter, type, { number: 'three', bar: false });

  let result = await adapter.findOne(type, { bar: true });
  t.deepEqual(result, matching.record);
});

test('findOne returns null if query does not match anything', async (t) => {
  let adapter: MemoryAdapter = t.context.adapter;

  t.is(await adapter.findOne('whatever', { whatever: true }), null);
});

test('all returns all records', async (t) => {
  let adapter: MemoryAdapter = t.context.adapter;
  let type = 'foo';
  let modelOne = await buildAndSave(adapter, type, { number: 'one' });
  let modelTwo = await buildAndSave(adapter, type, { number: 'two' });

  let result = await adapter.all(type);
  t.deepEqual(result, [ modelOne.record, modelTwo.record ]);
});

test('query returns all records that match a given query', async (t) => {
  let adapter: MemoryAdapter = t.context.adapter;
  let type = 'foo';
  let matchingOne = await buildAndSave(adapter, type, { number: 'one', bar: true });
  let matchingTwo = await buildAndSave(adapter, type, { number: 'two', bar: true });
  await buildAndSave(adapter, type, { number: 'three', bar: false });

  let result = await adapter.query(type, { bar: true });
  t.deepEqual(result, [ matchingOne.record, matchingTwo.record ]);
});

test('get and set attributes', async (t) => {
  let adapter: MemoryAdapter = t.context.adapter;
  let record = adapter.buildRecord('foo', { bar: true });
  let model = <any>{ record };
  adapter.setAttribute(model, 'bar', false);
  adapter.setAttribute(model, 'fizz', 'buzz');

  t.is(adapter.getAttribute(model, 'bar'), false);
  t.is(adapter.getAttribute(model, 'fizz'), 'buzz');
});

test('getRelated returns related records', async (t) => {
  let adapter: MemoryAdapter = t.context.adapter;
  let post = await buildAndSave(adapter, 'post', {});
  let comment = await buildAndSave(adapter, 'comment', { text: 'great post!' });
  let descriptor = hasMany('comment');
  adapter.setRelated(post, 'comments', descriptor, [ comment ]);

  let result = await adapter.getRelated(post, 'comments', descriptor, null);
  t.deepEqual(result, [ comment.record ]);
});

test('setRelated replaces related records', async (t) => {
  let adapter: MemoryAdapter = t.context.adapter;
  let post = await buildAndSave(adapter, 'post', {});
  let comment = await buildAndSave(adapter, 'comment', { text: 'great post!' });
  let descriptor = hasMany('comment');
  adapter.setRelated(post, 'comments', descriptor, [ comment ]);
  let sanityCheck = await adapter.getRelated(post, 'comments', descriptor, null);
  t.deepEqual(sanityCheck, [ comment.record ]);

  let newComment = await buildAndSave(adapter, 'comment', { text: 'even greater post!' });
  adapter.setRelated(post, 'comments', descriptor, [ newComment ]);

  let result = await adapter.getRelated(post, 'comments', descriptor, null);
  t.deepEqual(result, [ newComment.record ]);
});

test('addRelated adds a related record to a has many relationship', async (t) => {
  let adapter: MemoryAdapter = t.context.adapter;
  let post = await buildAndSave(adapter, 'post', {});
  let comment = await buildAndSave(adapter, 'comment', { text: 'great post!' });
  let descriptor = hasMany('comment');
  adapter.setRelated(post, 'comments', descriptor, [ comment ]);
  let sanityCheck = await adapter.getRelated(post, 'comments', descriptor, null);
  t.deepEqual(sanityCheck, [ comment.record ]);

  let newComment = await buildAndSave(adapter, 'comment', { text: 'even greater post!' });
  adapter.addRelated(post, 'comments', descriptor, newComment);

  let result = await adapter.getRelated(post, 'comments', descriptor, null);
  t.deepEqual(result, [ comment.record, newComment.record ]);
});

test('removeRelated destroys a relationship between related records', async (t) => {
  let adapter: MemoryAdapter = t.context.adapter;
  let post = await buildAndSave(adapter, 'post', {});
  let comment = await buildAndSave(adapter, 'comment', { text: 'great post!' });
  let descriptor = hasMany('comment');
  adapter.setRelated(post, 'comments', descriptor, [ comment ]);
  let sanityCheck = await adapter.getRelated(post, 'comments', descriptor, null);
  t.deepEqual(sanityCheck, [ comment.record ]);

  adapter.removeRelated(post, 'comments', descriptor, comment);

  let result = await adapter.getRelated(post, 'comments', descriptor, null);
  t.deepEqual(result, []);
});