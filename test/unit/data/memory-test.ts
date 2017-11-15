/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import { setupUnitTest, MemoryAdapter, hasOne, hasMany, Model, attr } from 'denali';

class BlogPost extends Model {
  static text = attr('string');
  static published = attr('boolean');
  static comments = hasMany('comment');
}

class Comment extends Model {
  static text = attr('string');
  static blogPost = hasOne('blog-post');
}

const test = setupUnitTest(() => {}, {
  'orm-adapter:application': MemoryAdapter,
  'model:blog-post': BlogPost,
  'model:comment': Comment
});

test('find returns record with given id', async (t) => {
  let { lookup } = t.context;
  let adapter = lookup<MemoryAdapter>('orm-adapter:application');
  let model = await BlogPost.create({ published: true });

  let result = await adapter.find('blog-post', model.record.id);
  t.deepEqual(result, model.record);
});

test('find returns null for non-existent id', async (t) => {
  let { lookup } = t.context;
  let adapter = lookup<MemoryAdapter>('orm-adapter:application');

  let result = await adapter.find('whatever', 0);
  t.is(result, null);
});

test('queryOne returns the first record that matches the given query', async (t) => {
  let { lookup } = t.context;
  let adapter = lookup<MemoryAdapter>('orm-adapter:application');
  await BlogPost.create({ published: false });
  await BlogPost.create({ published: false });
  let matchingModel = await BlogPost.create({ published: true });

  let result = await adapter.queryOne('blog-post', { published: true });
  t.deepEqual(result, matchingModel.record);
});

test('queryOne returns null if query does not match anything', async (t) => {
  let { lookup } = t.context;
  let adapter = lookup<MemoryAdapter>('orm-adapter:application');
  let result = await adapter.queryOne('blog-post', { whatever: true });
  t.is(result, null);
});

test('all returns all records', async (t) => {
  let { lookup } = t.context;
  let adapter = lookup<MemoryAdapter>('orm-adapter:application');
  let modelOne = await BlogPost.create({ text: 'alpha' });
  let modelTwo = await BlogPost.create({ text: 'bravo' });

  let result = await adapter.all('blog-post');
  t.deepEqual(result, [ modelOne.record, modelTwo.record ]);
});

test('query returns all records that match a given query', async (t) => {
  let { lookup } = t.context;
  let adapter = lookup<MemoryAdapter>('orm-adapter:application');
  let matchingOne = await BlogPost.create({ text: 'alpha', published: true });
  let matchingTwo = await BlogPost.create({ text: 'bravo', published: true });
  await BlogPost.create({ text: 'charlie', published: false });

  let result = await adapter.query('blog-post', { published: true });
  t.deepEqual(result, [ matchingOne.record, matchingTwo.record ]);
});

test('get and set attributes', async (t) => {
  let { lookup } = t.context;
  let adapter = lookup<MemoryAdapter>('orm-adapter:application');
  let blogPost = new BlogPost();

  t.is(adapter.getAttribute(blogPost, 'published'), null);
  t.is(adapter.getAttribute(blogPost, 'text'), null);

  t.is(adapter.setAttribute(blogPost, 'published', true), true);
  t.is(adapter.setAttribute(blogPost, 'text', 'alpha'), true);

  t.is(adapter.getAttribute(blogPost, 'published'), true);
  t.is(adapter.getAttribute(blogPost, 'text'), 'alpha');
});

test('getRelated returns related records', async (t) => {
  let { lookup } = t.context;
  let adapter = lookup<MemoryAdapter>('orm-adapter:application');
  let blogPost = await BlogPost.create();
  let comments = [ await Comment.create({ text: 'alpha' }), await Comment.create({ text: 'bravo' }) ];
  adapter.setRelated(blogPost, 'comments', BlogPost.comments, comments);

  let result = await adapter.getRelated(blogPost, 'comments', BlogPost.comments, null);
  t.deepEqual(result, [ comments[0].record, comments[1].record ]);
});

test('setRelated replaces related records', async (t) => {
  let { lookup } = t.context;
  let adapter = lookup<MemoryAdapter>('orm-adapter:application');
  let blogPost = await BlogPost.create();
  let comments = [ await Comment.create({ text: 'alpha' }), await Comment.create({ text: 'bravo' }) ];
  adapter.setRelated(blogPost, 'comments', BlogPost.comments, comments);

  let sanityCheck = await adapter.getRelated(blogPost, 'comments', BlogPost.comments, null);
  t.deepEqual(sanityCheck, comments.map((c) => c.record));

  let newComment = await Comment.create({ text: 'charlie' });
  adapter.setRelated(blogPost, 'comments', BlogPost.comments, [ newComment ]);

  let result = await adapter.getRelated(blogPost, 'comments', BlogPost.comments, null);
  t.deepEqual(result, [ newComment.record ]);
});

test('addRelated adds a related record to a has many relationship', async (t) => {
  let { lookup } = t.context;
  let adapter = lookup<MemoryAdapter>('orm-adapter:application');
  let blogPost = await BlogPost.create();
  let comments = [ await Comment.create({ text: 'alpha' }), await Comment.create({ text: 'bravo' }) ];
  adapter.setRelated(blogPost, 'comments', BlogPost.comments, comments);

  let sanityCheck = await adapter.getRelated(blogPost, 'comments', BlogPost.comments, null);
  t.deepEqual(sanityCheck, comments.map((c) => c.record));

  let newComment = await Comment.create({ text: 'charlie' });
  adapter.addRelated(blogPost, 'comments', BlogPost.comments, newComment);

  let result = await adapter.getRelated(blogPost, 'comments', BlogPost.comments, null);
  t.deepEqual(result, comments.concat(newComment).map((c) => c.record));
});

test('removeRelated destroys a relationship between related records', async (t) => {
  let { lookup } = t.context;
  let adapter = lookup<MemoryAdapter>('orm-adapter:application');
  let blogPost = await BlogPost.create();
  let comments = [ await Comment.create({ text: 'alpha' }), await Comment.create({ text: 'bravo' }) ];
  adapter.setRelated(blogPost, 'comments', BlogPost.comments, comments);

  let sanityCheck = await adapter.getRelated(blogPost, 'comments', BlogPost.comments, null);
  t.deepEqual(sanityCheck, comments.map((c) => c.record));

  adapter.removeRelated(blogPost, 'comments', BlogPost.comments, comments[0]);

  let result = await adapter.getRelated(blogPost, 'comments', BlogPost.comments, null);
  t.deepEqual(result, [ comments[1].record ]);
});
