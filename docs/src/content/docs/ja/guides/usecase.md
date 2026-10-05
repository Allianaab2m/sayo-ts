---
title: UseCase
description: ビジネスロジックの単位．
sidebar:
  order: 2
---

```ts
const InviteMember = UseCase.make({
  input: { projectId: ProjectId, email: Email },
  success: Invitation,
  errors: [ProjectNotFound, NotProjectOwner, AlreadyMember],
})(function* ({ projectId, email }) {
  const { user } = yield* CurrentUser // 認証済みユーザーが要ることは依存（requirements）に現れる
  const now = yield* DateTime.now
  // ...
})
```

本体はただの `Effect.fn`．

## errors と success は検査される

`errors` と `success` は本体と双方向に突き合わせられる．

```ts
const CompleteTodo = UseCase.make({
  input: { id: TodoId },
  success: Todo,
  errors: [TodoNotFound],
})(function* ({ id }) {
//~~~~~~~~~~~~~~~~~~~
// Property '"Fault AlreadyDone is not declared in errors"' is missing ...
  // ...
  if (todo.done) return yield* new AlreadyDone()
})
```

逆向きも検査する．宣言したのに本体が決して起こさないエラーは `Fault X is declared in errors but never raised` として報告される．起こりえない 404 が OpenAPI に載ることはない．Fault でないエラー（`Error X is not a Fault. Map it to a Fault, or die`）や，`success` に合わない戻り値も同じように弾かれる．実際には，コンパイラが出したリストをそのまま写せばいい．

## 名前

UseCase に名前は要らない．登録した場所（`todos.complete`）から名前が付く．リファクタリングをまたいで名前を固定したいとき（RPC で公開する場合など）だけ `name` を渡す．

```ts
UseCase.make({ name: "CompleteTodo", input, success, errors })
```

## 契約と実装

契約と実装は分けられる．フロントエンドは契約だけを import し，サーバーのコードをバンドルに引き込まない．

```ts
// contract.ts: フロントエンドと共有する
export const InviteMember = UseCase.contract({ input, success, errors })

// server.ts
export const InviteMemberLive = InviteMember.implement(function* (input) { /* ... */ })
```
