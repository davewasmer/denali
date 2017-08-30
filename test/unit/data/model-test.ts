/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import { isArray } from 'lodash';
import test from 'ava';
import { attr, Model, hasMany, Container, MemoryAdapter } from 'denali';

test.beforeEach((t) => {
  t.context.container = new Container(__dirname);
});

test('type returns the container name of the model', async (t) => {
  let container: Container = t.context.container;
  container.register('orm-adapter:application', MemoryAdapter);
  container.register('model:foo/bar/buzz', class Post extends Model {});
  let post = container.factoryFor<Model>('model:foo/bar/buzz').create();
  t.is(post.type, 'foo/bar/buzz');
});

test('adapter uses model-specific one if found', async (t) => {
  t.plan(1);
  let container: Container = t.context.container;
  container.register('model:post', class Post extends Model {});
  class ApplicationAdapter extends MemoryAdapter {}
  container.register('orm-adapter:application', ApplicationAdapter);
  class PostAdapter extends MemoryAdapter {}
  container.register('orm-adapter:post', PostAdapter);

  let post = container.factoryFor<Model>('model:post').create();
  t.true(post.adapter instanceof PostAdapter);
});

test('adapter falls back to application if model specific not found', async (t) => {
  t.plan(1);
  let container: Container = t.context.container;
  container.register('model:post', class Post extends Model {});
  class ApplicationAdapter extends MemoryAdapter {}
  container.register('orm-adapter:application', ApplicationAdapter);

  let post = container.factoryFor<Model>('model:post').create();
  t.true(post.adapter instanceof ApplicationAdapter);
});

test('set attribute on model sets it on the record', async (t) => {
  t.plan(2);
  let container: Container = t.context.container;
  container.register('model:post', class Post extends Model {
    static test = attr('text');
  });
  class ApplicationAdapter extends MemoryAdapter {}
  container.register('orm-adapter:application', ApplicationAdapter);

  let post = container.factoryFor<Model>('model:post').create();
  t.is(post.record.test, undefined);
  post.test = 'test';
  t.is(post.record.test, 'test');
});

test('get<RelationshipName> invokes adapter', async (t) => {
  t.plan(1);
  let container: Container = t.context.container;
  container.register('model:post', class Post extends Model {
    static comments = hasMany('comment');
  });
  container.register('model:comment', class Comment extends Model {});
  container.register('orm-adapter:application', class extends MemoryAdapter {
    getRelated(model: Model, relationship: string, descriptor: any, query: any) {
      t.pass();
      return super.getRelated(model, relationship, descriptor, query);
    }
  });
  let Post = container.factoryFor<Model>('model:post');
  let post = await Post.create().save();
  await post.getComments();
});

test('get<RelationshipName> throws for non-existent relationships', async (t) => {
  t.plan(1);
  let container: Container = t.context.container;
  container.register('model:post', class Post extends Model {});
  container.register('orm-adapter:application', class extends MemoryAdapter {});
  let Post = container.factoryFor<Model>('model:post');
  let post = await Post.create().save();
  t.throws(function() {
    post.getComments();
  });
});

test('get<RelationshipName> returns related model instances', async (t) => {
  let container: Container = t.context.container;
  container.register('model:post', class Post extends Model {
    static comments = hasMany('comment');
  });
  container.register('model:comment', class Comment extends Model {});
  container.register('orm-adapter:application', class extends MemoryAdapter {});
  let Post = container.factoryFor<Model>('model:post');
  let Comment = container.factoryFor<Model>('model:comment');
  let post = await Post.create().save();
  await post.setComments([ await Comment.create().save() ]);
  let comments = await post.getComments();
  t.true(isArray(comments), 'comments is an array');
  t.is(comments.length, 1, 'has the correct number of comments');
});

test('set<RelationshipName> invokes adapter', async (t) => {
  t.plan(1);
  let container: Container = t.context.container;
  container.register('model:post', class Post extends Model {
    static comments = hasMany('comment');
  });
  container.register('model:comment', class Comment extends Model {});
  container.register('orm-adapter:application', class extends MemoryAdapter {
    setRelated(model: Model, relationship: string, descriptor: any, relatedModels: Model|Model[]) {
      t.pass();
      return super.setRelated(model, relationship, descriptor, relatedModels);
    }
  });
  let Post = container.factoryFor<Model>('model:post');
  let post = await Post.create().save();
  await post.setComments([]);
});

test('set<RelationshipName> throws for non-existent relationships', async (t) => {
  t.plan(1);
  let container: Container = t.context.container;
  container.register('model:post', class Post extends Model {});
  container.register('orm-adapter:application', class extends MemoryAdapter {});
  let Post = container.factoryFor<Model>('model:post');
  let post = await Post.create().save();
  t.throws(function() {
    post.setComments();
  });
});

test('add<RelationshipName> invokes adapter', async (t) => {
  t.plan(1);
  let container: Container = t.context.container;
  container.register('model:post', class Post extends Model {
    static comments = hasMany('comment');
  });
  container.register('model:comment', class Comment extends Model {});
  container.register('orm-adapter:application', class extends MemoryAdapter {
    addRelated(model: Model, relationship: string, descriptor: any, relatedModel: Model) {
      t.pass();
      return super.setRelated(model, relationship, descriptor, relatedModel);
    }
  });
  let Post = container.factoryFor<Model>('model:post');
  let Comment = container.factoryFor<Model>('model:comment');
  let post = await Post.create().save();
  let comment = await Comment.create().save();
  await post.addComment(comment);
});

test('add<RelationshipName> throws for non-existent relationships', async (t) => {
  t.plan(1);
  let container: Container = t.context.container;
  container.register('model:post', class Post extends Model {});
  container.register('orm-adapter:application', class extends MemoryAdapter {});
  let Post = container.factoryFor<Model>('model:post');
  let post = await (<any>Post).create();
  t.throws(function() {
    post.addComment();
  });
});

test('remove<RelationshipName> invokes adapter', async (t) => {
  t.plan(1);
  let container: Container = t.context.container;
  container.register('model:post', class Post extends Model {
    static comments = hasMany('comment');
  });
  container.register('model:comment', class Comment extends Model {});
  container.register('orm-adapter:application', class extends MemoryAdapter {
    removeRelated(model: Model, relationship: string, descriptor: any, relatedModel: Model) {
      t.pass();
      return super.removeRelated(model, relationship, descriptor, relatedModel);
    }
  });
  let Post = container.factoryFor<Model>('model:post');
  let Comment = container.factoryFor<Model>('model:comment');
  let post = await Post.create().save();
  let comment = await Comment.create().save();
  await post.addComment(comment);
  await post.removeComment(comment);
});

test('remove<RelationshipName> throws for non-existent relationships', async (t) => {
  t.plan(1);
  let container: Container = t.context.container;
  container.register('model:post', class Post extends Model {});
  container.register('orm-adapter:application', class extends MemoryAdapter {});
  let Post = container.factoryFor<Model>('model:post');
  let post = await (<any>Post).create();
  t.throws(function() {
    post.removeComment();
  });
});

test.todo('Model.mapRelationshipDescriptors maps over relationship descriptors');
test.todo('Model.mapAttributeDescriptors maps over attribute descriptors');
