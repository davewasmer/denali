---
title: Models
---

Denali's Models are actually just thin wrappers over your own ORM's model
instances. They leverage
[Proxies](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)
to let your ORM's methods and properties to continue to work, while guaranteeing
a basic common interface across all ORMs.

## Understanding Denali's Data Layer

It's important to understand Denali's data layer to get the most out of the
framework. And the most important commonly misunderstood concept is that Denali
Models are there to allow you to swap out databases without refactoring your
app.

**This is incorrect.** In fact, Denali takes the stance that the _goal itself is
a red herring_.

If your app can swap databases with zero refactoring, that either means:

1. The underlying databases are identical in their querying and storage
semantics (rarely the case), or
2. You were using some lowest common denominator of querying and storage semantics for the two databases that is
equivalent across both (which means you weren't using the strengths of your original
database)

Denali is built around the assumption that different databases have different
tradeoffs, and that you should pick the data store best suited to your use case.
This means a good data layer should highlight the unique strengths of choice of
data store, rather than trying to hide any differences behind a universal
interface.

So then why have a data layer at all for Denali? It's primarily _for addons_.
Having some common data interface allows addons to persist and query data
without needing to write their own adapters for every possible data store.

So if you find yourself skipping past Denali's Model API (as we'll explore
below) in your application, and using lots of database specific features and
syntax - **that's a good thing**. Don't shy away from it!

## Defining a Model

Models are defined in the `app/models/` folder. Conventionally, models extend
from a common base, the ApplicationModel:

```js
// app/models/application.js
import { Model } from 'denali';

export default class ApplicationModel extends Model {
  // add any common, application-wide model functionality here
}
```

Let's create a basic model representing a blog post:

```js
// app/models/post.js
import { attr } from 'denali';
import ApplicationModel from './application';

export default class Post extends ApplicationModel {

  static title = attr('text');

}
```

Here we started out by adding a `title` attribute to our Post model. We use the
`attr()` method exported by Denali to define an attribute. The single argument
is the data type of that attribute. Note the `static` keyword - attributes and
relationships should be defined statically, while instance properties will
contain the actual values for a given record.

### Data Types

Denali provides a common base set of data types for most ORM adapters:

* `text`
* `number`
* `date`
* `boolean`
* `object`

In addition to the basic data types, your ORM adapter can support additional,
more specialized data types (i.e. `integer` rather than `number`).

Keep in mind that each ORM adapter decides for itself how best to implement
these common data types, and it may be more performant to go with an
ORM-specific type in some cases. For example, ORMs for SQL based data stores
should implement the `number` data type as a `float` or `double` rather than an
`integer`, since JavaScript numbers are floating point. But if you know the
field should only container integers, you should use `integer` (assuming your
ORM adapter supports it).

The value of the common base set of data types is that it allows addons that
manage data attributes to safely assume a certain subset of data types.

### Relationships

In addition to basic data attributes, you can also define relationships on your model classes (assuming your ORM supports relationships):

```js
// app/models/post.js
import { attr, hasMany, hasOne } from 'denali';
import ApplicationModel from './application';

export default class Post extends ApplicationModel {

  static title = attr('text');
  static comments = hasMany('comment');
  static author = hasOne('user');

}
```

## Querying Data

Models expose a few methods for querying data:

```js
// Find post with id 1
Post.find(1);

// Find posts that match the filter
Post.query({ title: 'My cool post' });

// Find posts using ORM specific querying
Post.query((/* Your ORM can pass in arguments, i.e. a query builder */) => {
  // You can use ORM-specific syntax here
});

// Find all posts
Post.all()

// Find the first post that matches the supplied query (an object or
// ORM-specific function)
Post.queryOne()
```

Once you have a record, you can read attributes directly:

```js
let post = Post.find(1);
console.log(post.title);
// > "Denali is a tall mountain"
```

To read related data, you should use the `get[Relationship]` getters:

```js
let post = Post.find(1);
post.getAuthor().then((author) => {
  console.log(author)
  // <Author:17 name="Dave">
});

// or with async/await syntax:

await post.getAuthor();
```

For one-to-one style relationships, you can use `set[Relationship]` to set the
related record. For one-to-many style relationships, you can use
`set[Relationship]` to replace the entire relationship at once, or
`add[Relationship]` and `remove[Relationship]` to operate on a single member
of the relationship at a time.

## Saving Data

Models expose a `.save()` instance method that returns a promise which resolves
or rejects when the save operation is complete.
