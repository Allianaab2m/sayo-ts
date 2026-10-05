---
title: テスト
description: UseCase 単体と API 全体のテスト．
sidebar:
  order: 8
---

## UseCase 単体

```ts
UseCase.test(InviteMember)
  .given(ProjectsInMemory([fixture(Project)]))
  .as(fixture(User))
  .at("2026-10-02T09:00:00+09:00") // TestClock を進める
  .run({ projectId, email })
// → Exit<Invitation, ProjectNotFound | NotProjectOwner | AlreadyMember>
```

- `fixture(Schema, overrides?)` は Schema の arbitrary から値を作る．テスト用ユーザーを手で組み立てなくていい．
- スタブが欠けていればコンパイルエラーになる．

## API 全体

HTTP のためにコントローラのテストを別に書く必要はない．テスト用 profile のアプリをインメモリのプラットフォームで起動し，生成された型付きクライアント越しに呼ぶ．

```ts
const TestServer = HttpRouter.serve(app.http("test")).pipe(Layer.provideMerge(NodeHttpServer.layerTest))

it.effect("completes a todo", () =>
  Effect.gen(function* () {
    const client = yield* HttpApiClient.make(app.api)
    const done = yield* client.todos.complete({ params: { id } }) // UseCase から型が付く
    expect(done.done).toBe(true)
  }).pipe(Effect.provide(TestServer)))
```
