---
title: Service
description: Boundaries to the outside world.
sidebar:
  order: 3
---

```ts
class Mailer extends Service("Mailer")<{
  send: (mail: Mail) => Effect.Effect<void, Fault.Unavailable>
}>() {}

const MailerResend = Mailer.layer(Effect.gen(function* () { /* ... */ }))
const MailerConsole = Mailer.layer(/* prints to the console */)
```

Every side effect (database, mail, payments, devices) goes behind a `Service`. Which implementation runs is chosen per [profile](../app-and-profiles/).

Persistence is deliberately out of scope. sayo does not ship an ORM; you implement storage as a `Service` with the database library of your choice.
