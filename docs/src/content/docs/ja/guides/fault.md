---
title: Fault
description: 誰かが対処できる失敗．
sidebar:
  order: 1
---

```ts
class TodoNotFound extends Fault.NotFound("TodoNotFound", { id: TodoId }) {}
// Fault.Invalid / Unauthorized / Forbidden / NotFound / Conflict / Unavailable
```

`Fault` が持つのは種類（kind）で，HTTP ステータスは持たない．種類を各アダプタが自分の語彙に対応づける．HTTP アダプタなら `NotFound` は 404，`Conflict` は 409 になる．ドメインに通信の概念が入り込まない．

どの層でも手の打ちようがない失敗（壊れた不変条件，形の崩れたレコード，設定の欠落）は `Fault` にしない．タグ付きの値で `Effect.die` する．プラットフォームがそれを 500 にして，`Cause` を丸ごとログに出す．
