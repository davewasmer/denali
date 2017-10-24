---
title: Serializers
---

Since Denali is API focused, it doesn't ship with any kind of view layer for
rendering HTML. However, one way to think of Serializers is like the view layer
for a JSON only API.

When your app needs to send some data in a response, there are three problems to
face:

  1. **What data to send**: you'll often want to send only a subset of your
  record back (i.e. omitting a hashed password).

  2. **Transforming the data**: you may want to transform the content to make it
  easier to consume or to match consumer expectations (i.e. change underscore_
  keys to camelCaseKeys).

  3. **Structuring the data**: what is the structure of the response? Is there a root JSON wrapper? Does it conform to a spec, i.e. JSON-API 1.0?

Serializers address all of these problems. They select what data to send, apply
transformations to that data (i.e. renaming keys, serializing values), and
structure the result according to a particular output format.

Typically, your API will have a standard output format (i.e. JSON-API 1.0) for all response.
A good approach is to pick (or create) a base ApplicationSerializer class that renders that
structure, much like we used a base ApplicationAction class.

With a base ApplicationSerializer class in place, you'll then create a subclass
for each model you have (PostSerializer, UserSerializer, etc). These subclasses
tell Denali what attributes and relationships should be sent in a response that
contains that particular model.

## Rendering data in a response

Serializers render data based on _whitelists_. That means that if you want any
part of your Model to render into JSON in the response body, you must specify
it explicitly in that Model's Serializer. This ensures you won't
accidentally return sensitive data in a response because you forgot to strip it
out.

Selecting which attributes to render is as simple as adding them to the
attributes array on your serializer:

```js
export default class UserSerializer extends ApplicationSerializer {

  attributes = [ 'firstName', 'lastName' ];

}
```

Relationships are slightly more complex.

TODO documentation for relationship serializers

# Built-in Serializers

Denali ships with two base serializers out of the box:

  * **FlatSerializer**, which renders models as simple JSON objects or arrays of objects. Related records are directly embedded under their relationship name.

  * **JSONAPISerializer**, a [JSON-API 1.0] compliant serializer with support
  for meta, links, errors, and more.

