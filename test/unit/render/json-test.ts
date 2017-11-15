/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import { isArray } from 'lodash';
import { setupUnitTest, JSONSerializer, Model, attr, hasMany, Errors, hasOne } from 'denali';

// test.beforeEach((t) => {
//   t.context.container = new Container();
//   t.context.container.register('orm-adapter:application', MemoryAdapter);
// });

class Post extends Model {
  static title = attr('string');
  static content = attr('string');
  static author = hasOne('user');
  static comments = hasMany('comment');
}

class Comment extends Model {
  static text = attr('string');
  static publishedAt = attr('string');
}

const test = setupUnitTest('serializer:json-api', {
  'orm-adapter:application': true,
  'serializer:application': JSONSerializer,
  'model:post': Post,
  'model:comment': Comment
});

test('renders models as flat json structures', async (t) => {
  class TestSerializer extends JSONSerializer {
    attributes = [ 'title' ];
    relationships = {};
  }
  let serializer = new TestSerializer();
  let post = await Post.create({ title: 'foo' });

  let result = await serializer.serialize(post, <any>{}, {});
  t.is(result.title, 'foo');
});

test('renders related records as embedded objects', async (t) => {
  let { inject } = t.context;
  class PostSerializer extends JSONSerializer {
    attributes = [ 'title' ];
    relationships = {
      comments: {
        strategy: 'embed'
      }
    };
  }
  inject('serializer:comment', class CommentSerializer extends JSONSerializer {
    attributes = [ 'text' ];
    relationships = {};
  });
  let serializer = new PostSerializer();
  debugger;
  let post = await Post.create({ title: 'foo' });
  await post.addComment(await Comment.create({ text: 'bar' }));

  let result = await serializer.serialize(post, <any>{}, {});
  t.true(isArray(result.comments));
  t.is(result.comments[0].text, 'bar');
});

test('renders related records as embedded ids', async (t) => {
  let { inject } = t.context;
  class PostSerializer extends JSONSerializer {
    attributes = [ 'title' ];
    relationships = {
      comments: {
        strategy: 'id'
      }
    };
  }
  inject('serializer:comment', class CommentSerializer extends JSONSerializer {
    attributes = [ 'text' ];
    relationships = {};
  });
  let serializer = new PostSerializer();
  let post = await Post.create({ title: 'foo' });
  let comment = await Comment.create({ text: 'bar' });
  await post.addComment(comment);

  let result = await serializer.serialize(post, <any>{}, {});
  t.true(isArray(result.comments));
  t.is(result.comments[0], comment.id);
});

test('renders errors', async (t) => {
  class PostSerializer extends JSONSerializer {
    attributes: string[] = [];
    relationships = {};
  }
  let serializer = new PostSerializer();

  let result = await serializer.serialize(new Errors.InternalServerError('foo'), <any>{}, {});
  t.is(result.status, 500);
  t.is(result.code, 'InternalServerError');
  t.is(result.message, 'foo');
});

test('only renders whitelisted attributes', async (t) => {
  class PostSerializer extends JSONSerializer {
    attributes = [ 'title' ];
    relationships = {};
  }
  let serializer = new PostSerializer();
  let post = await Post.create({ title: 'foo', content: 'bar' });

  let result = await serializer.serialize(post, <any>{}, {});
  t.is(result.title, 'foo');
  t.falsy(result.content);
});

test('only renders whitelisted relationships', async (t) => {
  let { inject } = t.context;
  class PostSerializer extends JSONSerializer {
    attributes = [ 'title' ];
    relationships = {
      comments: {
        strategy: 'id'
      }
    };
  }
  inject('serializer:comment', class CommentSerializer extends JSONSerializer {
    attributes = [ 'text' ];
    relationships = {};
  });
  let serializer = new PostSerializer();
  let post = await Post.create({ title: 'foo' });

  let result = await serializer.serialize(post, <any>{}, {});
  t.true(isArray(result.comments));
  t.falsy(result.author);
});

test('uses related serializers to render related records', async (t) => {
  let { inject } = t.context;
  class PostSerializer extends JSONSerializer {
    attributes = [ 'title' ];
    relationships = {
      comments: {
        strategy: 'embed'
      }
    };
  }
  inject('serializer:comment', class CommentSerializer extends JSONSerializer {
    attributes = [ 'text' ];
    relationships = {};
  });
  let serializer = new PostSerializer();
  let post = await Post.create({ title: 'foo' });
  await post.addComment(await Comment.create({ text: 'bar', publishedAt: 'fizz' }));

  let result = await serializer.serialize(post, <any>{}, {});
  t.true(isArray(result.comments));
  t.is(result.comments[0].text, 'bar');
  t.falsy(result.comments[0].publishedAt);
});
