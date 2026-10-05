---
title: App and profiles
description: No hand-written wiring.
sidebar:
  order: 6
---

```ts
App.make({
  modules: [todos, projects, users],
  profiles: {
    local: [PGlite, TodosSql, MailerConsole, StorageLocal],
    test: [PGlite, TodosSql, MailerInMemory],
    prod: [Postgres, TodosSql, MailerResend, StorageS3],
  },
  guard: { local: () => process.env.NODE_ENV !== "production" },
})
```

A profile lists layers in dependency order: each layer may use whatever the layers before it provide (`TodosSql` uses the database from `PGlite` or `Postgres`). At runtime that is all the wiring there is, a left fold. You never write `Layer.provide`.

## Checked by the compiler

The type checker verifies every profile and reports the problem where it is:

```ts
prod: [
  TodosSql, // Property '"SqlClient must be provided by a layer listed before this one"' is missing ...
  Postgres,
]
local: [TodosSql], // Property '"Mailer is required by a UseCase but not provided by this profile"' is missing ...
```

## Why an order

A `Layer` does not reveal at runtime what it provides or requires, so resolving an unordered set would need either extra declarations on every layer or building layers by trial and error. An order costs you nothing the compiler cannot point out.

## Guards

A `guard` refuses to boot a profile in the wrong environment, so fakes never reach production.
