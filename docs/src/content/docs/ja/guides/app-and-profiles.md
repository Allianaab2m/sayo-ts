---
title: App と profile
description: 配線を手で書かない．
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

profile には layer を依存の順に並べる．各 layer は，それより前の layer が提供するものを使える（`TodosSql` は `PGlite` か `Postgres` のデータベースを使う）．実行時の配線はこれで全部で，ただの左畳み込みになる．`Layer.provide` を書くことはない．

## コンパイラが検査する

型チェッカーはすべての profile を検証し，問題のある場所で報告する．

```ts
prod: [
  TodosSql, // Property '"SqlClient must be provided by a layer listed before this one"' is missing ...
  Postgres,
]
local: [TodosSql], // Property '"Mailer is required by a UseCase but not provided by this profile"' is missing ...
```

## なぜ順序なのか

`Layer` は，何を提供し何を要求するかを実行時に明かさない．順序のない集合を解決しようとすると，すべての layer に追加の宣言を求めるか，試行錯誤で layer を組み立てるしかない．順序なら，間違えてもコンパイラが指摘できるので，書く側の負担は増えない．

## guard

`guard` は，間違った環境で profile が起動するのを拒む．フェイクが本番に紛れ込むことはない．
