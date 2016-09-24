---
title: Introduction
---

# Core Principles

Denali is built on a few core concepts:

  * **API-first.** Most server-side frameworks focus on server-rendered HTML
  applications, with APIs an afterthought at best. Denali flips this around - its
  entire focus is data-only JSON APIs. You won't find any HTML templating
  engines or asset compilers here.

  * **Developer happiness.** Denali aims to go beyond nice syntax and helpful
  boilerplate to help solve those common workflows and pain points when
  developing APIs.

  * **Data access / ORM agnostic**. ORMs and data layers are _hard_. Some of the
  hardest problems around. Denali doesn't pretend to solve that. Instead, it is
  completely agnostic about how you manage your data. Mongoose, Sequelize,
  Thinky, or even plain old JS objects - Denali doesn't care.[1]

## Why not [insert other framework]?

There are a few other framework options besides Denali. Here's a quick run down
of the major differences with Denali:

1. **Rails** is a great default choice for many, with a large ecosystem and a
   mature codebase. However, Rails is designed for a much wider range of uses
   cases, including primarily HTML rendering. That brings along a lot of
   cognitive overhead to manage. Also, for web apps, Ruby means learning an
   additional language.

2. **Express.js** is the foundation of much of the Node server-side world. It's
   lightweight, fast, and simple. But for complex applications, Express only
   provides the basics (routing and middleware). It lacks the higher level
   abstractions to make rapid development easier.

3. **Sails.js** is an effort to be the Node equivalent of Rails. However, many
   of the framework's patterns run counter to the Node ethos. It also comes
   tightly bound to Waterline, making it difficult to integrate with databases
   that Waterline doesn't support.

--------------
[1] If you choose an ORM that doesn't have out of the box support, you will need
to write an adapter for it. But fear not, adapters are simple. To get started,
check out the [adapter docs](latest/guides/data/orm-adapters) for details.
