---
title: Service
description: 外の世界との境界．
sidebar:
  order: 3
---

```ts
class Mailer extends Service("Mailer")<{
  send: (mail: Mail) => Effect.Effect<void, Fault.Unavailable>
}>() {}

const MailerResend = Mailer.layer(Effect.gen(function* () { /* ... */ }))
const MailerConsole = Mailer.layer(/* コンソールに出力する */)
```

副作用（データベース，メール，決済，デバイス）はすべて `Service` の裏に置く．どの実装が動くかは [profile](../app-and-profiles/) ごとに選ぶ．

永続化はあえて範囲外にしている．sayo は ORM を同梱しない．ストレージは好きなデータベースライブラリで `Service` として実装する．
