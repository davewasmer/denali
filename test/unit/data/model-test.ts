/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import { isArray } from 'lodash';
import { setupUnitTest, Model, hasOne, hasMany, MemoryAdapter } from 'denali';

class Post extends Model {
  static comments = hasMany('comment');
}

class Comment extends Model {
  static post = hasOne('post');
}

const test = setupUnitTest(() => null, {
  'model:post': Post,
  'model:comment': Comment,
  'orm-adapter:application': MemoryAdapter
});

test('get<RelationshipName> invokes adapter', async (t) => {
  t.plan(1);
  let { inject } = t.context;
  inject('orm-adapter:application', class extends MemoryAdapter {
    getRelated(model: Model, relationship: string, descriptor: any, query: any) {
      t.pass();
      return super.getRelated(model, relationship, descriptor, query);
    }
  });
  let post = await Post.create();
  await post.getComments();
});

test('get<RelationshipName> throws for non-existent relationships', async (t) => {
  t.plan(1);
  let post = await Post.create();
  t.throws(function() {
    post.getAuthors();
  });
});

test('get<RelationshipName> returns related model instances', async (t) => {
  let post = await Post.create();
  await post.setComments([ await Comment.create() ]);

  let comments = await post.getComments();
  t.true(isArray(comments), 'comments is an array');
  t.is(comments.length, 1, 'has the correct number of comments');
});

test('set<RelationshipName> invokes adapter', async (t) => {
  t.plan(1);
  let { inject } = t.context;
  inject('orm-adapter:application', class extends MemoryAdapter {
    setRelated(model: Model, relationship: string, descriptor: any, relatedModels: Model|Model[]) {
      t.pass();
      return super.setRelated(model, relationship, descriptor, relatedModels);
    }
  });
  let post = await Post.create();
  await post.setComments([]);
});

test('set<RelationshipName> throws for non-existent relationships', async (t) => {
  t.plan(1);
  let post = new Post();
  t.throws(function() {
    post.setAuthors();
  });
});

test('add<RelationshipName> invokes adapter', async (t) => {
  t.plan(1);
  let { inject } = t.context;
  inject('orm-adapter:application', class extends MemoryAdapter {
    addRelated(model: Model, relationship: string, descriptor: any, relatedModel: Model) {
      t.pass();
      return super.setRelated(model, relationship, descriptor, relatedModel);
    }
  });
  let post = await Post.create();
  let comment = await Comment.create();
  await post.addComment(comment);
});

test('add<RelationshipName> throws for non-existent relationships', async (t) => {
  t.plan(1);
  let post = new Post();
  t.throws(function() {
    post.addAuthor();
  });
});

test('remove<RelationshipName> invokes adapter', async (t) => {
  t.plan(1);
  let { inject } = t.context;
  inject('orm-adapter:application', class extends MemoryAdapter {
    removeRelated(model: Model, relationship: string, descriptor: any, relatedModel: Model) {
      t.pass();
      return super.removeRelated(model, relationship, descriptor, relatedModel);
    }
  });
  let post = await Post.create();
  let comment = await Comment.create();
  await post.addComment(comment);
  await post.removeComment(comment);
});

test('remove<RelationshipName> throws for non-existent relationships', async (t) => {
  t.plan(1);
  let post = new Post();
  t.throws(function() {
    post.removeAuthor();
  });
});
