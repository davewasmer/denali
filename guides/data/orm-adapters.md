---
title: ORM Adapters
---

# ORM Adapters

Denali takes a somewhat unique approach to handling the data layer. Unlike most
frameworks, it doesn't come bundled with a pre-chosen ORM, or attempt to build
it's own. Instead, Denali's Model class works with your ORM of choice by
communicating with it through an ORM Adapter.

This lets you bring your own ORM to your apps, while still enabling Denali to
understand your data model. This is good news for your app, since it lets you
pick the right ORM for the job and leverage the strengths of the specific data
store backing your app, rather than relying on a lowest-common-denominator data
layer.

## Available ORM Adapters

Several popular ORMs have Denali adapters ready to go. Just add them to your
project via `$ denali install <adapter package name>`, and set the `ormAdapter`
property in your `config/environment.js` file to the ORM's name.

* [`node-orm2`](https://github.com/denali-js/denali-node-orm2) (beta)
* ~~`Sequelize`~~ (coming soon)
* ~~`Bookshelf`~~ (coming soon)

## Creating an ORM Adapter

Want to use an ORM that doesn't have an adapter yet? It's fairly easy to write
your own! Just extend from the base `ORMAdapter` class, and implement each of
the hooks:

```js
export default class MyCoolORMAdapter extends ORMAdapter {

  static find(type, query, options) {

  }

  static createRecord(type, data, options) {

  }

  static idFor(model) {

  }

  static getAttribute(model, property) {

  }

  static setAttribute(model, property) {

  }

  static deleteAttribute(model, property) {

  }

  static getRelated(model, relationship) {

  }

  static setRelated(model, relationship) {

  }

  static removeRelated(model, relationship) {

  }

  static saveRecord(model, options) {

  }

  static deleteRecord(model, options) {

  }

  static define(Model) {

  }

}
```
