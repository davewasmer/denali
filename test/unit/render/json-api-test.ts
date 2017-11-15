/* tslint:disable:completed-docs no-empty no-invalid-this member-access */
import { isArray } from 'lodash';
import {
  setupUnitTest,
  JSONAPISerializer,
  Model,
  attr,
  hasMany,
  Errors,
  hasOne } from 'denali';
import { ResourceObject, RelationshipsWithData } from 'jsonapi-typescript';

class Post extends Model {
  static title = attr('string');
  static content = attr('string');
  static publishedAt = attr('date');
  static author = hasOne('user');
  static comments = hasMany('comment');
}

class User extends Model {}

class Comment extends Model {
  static text = attr('string');
  static publishedAt = attr('string');
}

const test = setupUnitTest('serializer:json-api', {
  'app:router': true,
  'orm-adapter:application': true,
  'serializer:application': JSONAPISerializer,
  'model:post': Post,
  'model:comment': Comment,
  'model:user': User
});

test('renders models as JSON-API resource objects', async (t) => {
  let model = await Post.create({ title: 'foo' });
  class TestSerializer extends JSONAPISerializer {
    attributes = [ 'title' ];
    relationships = {};
  }
  let serializer = new TestSerializer();

  let result = await serializer.serialize(model, <any>{}, {});
  t.is((<ResourceObject>result.data).attributes.title, 'foo');
});

test('renders errors according to spec', async (t) => {
  class TestSerializer extends JSONAPISerializer {
    attributes: string[] = [];
    relationships = {};
  }
  let serializer = new TestSerializer();

  let result = await serializer.serialize(new Errors.InternalServerError('foo'), <any>{}, {});
  t.is(result.errors[0].status, '500');
  t.is(result.errors[0].code, 'InternalServerError');
  t.is(result.errors[0].detail, 'foo');
});

test('renders validation errors with additional details', async (t) => {
  class TestSerializer extends JSONAPISerializer {
    attributes: string[] = [];
    relationships = {};
  }
  let serializer = new TestSerializer();
  let error = new Errors.UnprocessableEntity('Email cannot be blank');
  error.title = 'presence';
  error.source = { pointer: '/data/attributes/email' };

  let result = await serializer.serialize(error, <any>{}, {});
  t.is(result.errors[0].status, '422');
  t.is(result.errors[0].code, 'UnprocessableEntityError');
  t.is(result.errors[0].title, 'presence');
  t.is(result.errors[0].source.pointer, '/data/attributes/email');
  t.is(result.errors[0].detail, 'Email cannot be blank');
});

test('sideloads related records', async (t) => {
  let { inject } = t.context;
  class PostSerializer extends JSONAPISerializer {
    attributes = [ 'title' ];
    relationships = {
      comments: {
        strategy: 'embed'
      }
    };
  }
  inject('serializer:comment', class CommentSerializer extends JSONAPISerializer {
    attributes = [ 'text' ];
    relationships = {};
  });
  inject('model:post', class Post extends Model {
    static title = attr('string');
    static comments = hasMany('comment');
  });
  inject('model:comment', class Comment extends Model {
    static text = attr('string');
  });
  let serializer = new PostSerializer();

  let post = await Post.create({ title: 'foo' });
  let comment = await Comment.create({ text: 'bar' });
  await post.addComment(comment);

  let result = await serializer.serialize(post, <any>{}, {});
  t.true(isArray(result.included));
  t.is(result.included[0].attributes.text, 'bar');
});

test.todo('dedupes sideloaded related records');

test('embeds related records as resource linkage objects', async (t) => {
  let { inject } = t.context;
  class PostSerializer extends JSONAPISerializer {
    attributes = [ 'title' ];
    relationships = {
      comments: {
        strategy: 'id'
      }
    };
  }
  inject('serializer:comment', class CommentSerializer extends JSONAPISerializer {
    attributes = [ 'text' ];
    relationships = {};
  });
  let serializer = new PostSerializer();
  let post = await Post.create({ title: 'foo' });
  let comment = await Comment.create({ text: 'bar' });
  await post.addComment(comment);

  let result = await serializer.serialize(post, <any>{}, {});
  t.true(isArray(result.included));
  t.is(result.included[0].id, comment.id);
  t.is(result.included[0].type, 'comments');
});

test('renders document meta', async (t) => {
  class TestSerializer extends JSONAPISerializer {
    attributes: string[] = [];
    relationships = {};
  }
  let serializer = new TestSerializer();
  let model = await Post.create({});

  let result = await serializer.serialize(model, <any>{}, { meta: { foo: true }});
  t.true(result.meta.foo);
});

test('renders document links', async (t) => {
  class TestSerializer extends JSONAPISerializer {
    attributes: string[] = [];
    relationships = {};
  }
  let serializer = new TestSerializer();
  let model = await Post.create({});

  let result = await serializer.serialize(model, <any>{}, { links: { foo: true }});
  t.true(result.links.foo);
});

test('renders jsonapi version', async (t) => {
  class TestSerializer extends JSONAPISerializer {
    attributes: string[] = [];
    relationships = {};
  }
  let serializer = new TestSerializer();
  let model = await Post.create({});

  let result = await serializer.serialize(model, <any>{}, {});
  t.is(result.jsonapi.version, '1.0');
});

test('renders an array of models as an array under `data`', async (t) => {
  class TestSerializer extends JSONAPISerializer {
    attributes = [ 'title' ];
    relationships = {};
  }
  let serializer = new TestSerializer();
  let postOne = await Post.create({ title: 'foo' });
  let postTwo = await Post.create({ title: 'bar' });

  let result = await serializer.serialize([ postOne, postTwo ], <any>{}, {});
  let data = <ResourceObject[]>result.data;
  t.true(isArray(data));
  t.is(data[0].id, postOne.id);
  t.is(data[1].id, postTwo.id);
});

test('only renders whitelisted attributes', async (t) => {
  class PostSerializer extends JSONAPISerializer {
    attributes = [ 'title' ];
    relationships = {};
  }
  let serializer = new PostSerializer();
  let post = await Post.create({ title: 'foo', content: 'bar' });

  let result = await serializer.serialize(post, <any>{}, {});
  let data = <ResourceObject>result.data;
  t.is(data.attributes.title, 'foo');
  t.falsy(data.attributes.content);
});

test('allows render options to override class-level attributes whitelist', async (t) => {
  class PostSerializer extends JSONAPISerializer {
    attributes = [ 'title' ];
    relationships = {};
  }
  let serializer = new PostSerializer();
  let post = await Post.create({ title: 'foo', content: 'bar' });

  let result = await serializer.serialize(post, <any>{}, { attributes: [ 'content' ] });
  let data = <ResourceObject>result.data;
  t.is(data.attributes.content, 'bar');
  t.falsy(data.attributes.title);
});

test('only renders whitelisted relationships', async (t) => {
  let { inject } = t.context;
  class PostSerializer extends JSONAPISerializer {
    attributes = [ 'title' ];
    relationships = {
      comments: {
        strategy: 'id'
      }
    };
  }
  inject('serializer:comment', class CommentSerializer extends JSONAPISerializer {
    attributes = [ 'text' ];
    relationships = {};
  });
  let serializer = new PostSerializer();
  let post = await Post.create({ title: 'foo' });

  let result = await serializer.serialize(post, <any>{}, {});
  let data = <ResourceObject>result.data;
  t.falsy(data.relationships.author);
  let commentsRelationship = <RelationshipsWithData>data.relationships.comments;
  t.true(isArray(commentsRelationship.data));
});

test('allows render options to override class-level relationships whitelist', async (t) => {
  let { inject } = t.context;
  class PostSerializer extends JSONAPISerializer {
    attributes = [ 'title' ];
    relationships = {
      author: {
        strategy: 'id'
      }
    };
  }
  inject('serializer:comments', class CommentSerializer extends JSONAPISerializer {
    attributes = [ 'title' ];
    relationships = {};
  });
  let serializer = new PostSerializer();
  let post = await Post.create({ title: 'foo' });

  let result = await serializer.serialize(post, <any>{}, {
    relationships: {
      comments: {
        strategy: 'id'
      }
    }
  });
  let data = <ResourceObject>result.data;
  t.falsy(data.relationships.author);
  let commentsRelationship = <RelationshipsWithData>data.relationships.comments;
  t.true(isArray(commentsRelationship.data));
});

test('uses related serializers to render related records', async (t) => {
  let { inject } = t.context;
  class PostSerializer extends JSONAPISerializer {
    attributes = [ 'title' ];
    relationships = {
      comments: {
        strategy: 'embed'
      }
    };
  }
  inject('serializer:comment', class CommentSerializer extends JSONAPISerializer {
    attributes = [ 'text' ];
    relationships = {};
  });
  inject('model:comment', class Comment extends Model {
    static text = attr('string');
    static publishedAt = attr('string');
  });
  let serializer = new PostSerializer();
  let post = await Post.create({ title: 'foo' });
  await post.addComment(await Comment.create({ text: 'bar', publishedAt: 'fizz' }));

  let result = await serializer.serialize(post, <any>{}, {});
  t.true(isArray(result.included));
  t.is(result.included[0].attributes.text, 'bar');
  t.falsy(result.included[0].attributes.publishedAt);
});

test.todo('renders resource object meta');

test.todo('renders resource object links');

test('dasherizes field names', async (t) => {
  class TestSerializer extends JSONAPISerializer {
    attributes = [ 'publishedAt' ];
    relationships = {};
  }
  let serializer = new TestSerializer();
  debugger;
  let post = await Post.create({ publishedAt: 'foo' });

  let result = await serializer.serialize(post, <any>{}, {});
  let data = <ResourceObject>result.data;
  t.is(data.attributes['published-at'], 'foo');
});

test.todo('renders relationship meta');

test.todo('renders relationship links');
