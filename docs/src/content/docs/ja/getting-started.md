---
title: はじめる
description: テンプレートからアプリを作り，UseCase を足して HTTP に出し，テストする．
---

## アプリを作る

Node.js 22.18 以上（または 24.11 以上），pnpm，[Vite+](https://viteplus.dev)（`vp`）が要る．

```sh
vp create @sayo-ts      # `api` テンプレートを選ぶ
cd my-api
pnpm install
pnpm dev                # sayo dev: http://localhost:3000/todos，API リファレンスは /docs
```

`pnpm dev` は `local` profile を起動し，保存のたびに再起動する．別の profile を使うときは `--profile <name>` を渡す．

テンプレートは小さな todo API になっている．

| ファイル | 中身 |
| --- | --- |
| `src/todo.ts` | Schema，Fault，`Todos` サービス，UseCase．HTTP のことは何も知らない． |
| `src/todos.memory.ts` | `local` profile 用のインメモリ `Todos` |
| `src/app.ts` | どの UseCase をどこに出すか，各 profile がどの layer を使うか |
| `src/app.test.ts` | 生成されたクライアント越しの，API 全体のテスト |
| `src/main.ts` | Node でサーバーを起動する |

## UseCase を足す

雛形を生成する．

```sh
pnpm sayo generate usecase rename-todo   # src/rename-todo.ts を書き出す
```

input，成功時の値，本体を埋める．`errors` は最初は空でいい．どの Fault を並べるべきかはコンパイラが教えてくれる．

```ts
// src/rename-todo.ts
import { Schema } from "effect";
import { UseCase } from "@sayo-ts/core";
import { Todo, TodoId, TodoNotFound, Todos } from "./todo.ts";

export const RenameTodo = UseCase.make({
  input: { id: TodoId, title: Schema.NonEmptyString },
  success: Todo,
  errors: [TodoNotFound], // `todos.find` がこれで失敗しうる
})(function* ({ id, title }) {
  const todos = yield* Todos;
  const todo = yield* todos.find(id);
  const renamed = new Todo({ id: todo.id, title, done: todo.done });
  yield* todos.save(renamed);
  return renamed;
});
```

## HTTP に出す

`src/app.ts` に登録する．`id` はパスから，`title` はボディから取られる．

```ts
todos: Http.group("/todos", {
  list: Http.get("/", ListTodos),
  add: Http.post("/", AddTodo),
  complete: Http.post("/:id/complete", CompleteTodo),
  rename: Http.patch("/:id", RenameTodo),
}),
```

これで `PATCH /todos/:id` が `/docs` に載り，`TodoNotFound` は 404 で返る．

## テストする

`src/app.test.ts` にケースを足す．クライアントのメソッド名は登録したときのキーになる．

```ts
it("renames a todo", () =>
  run(
    Effect.gen(function* () {
      const client = yield* HttpApiClient.make(app.api);
      const todo = yield* client.todos.add({ payload: { title: "try sayo" } });
      const renamed = yield* client.todos.rename({
        params: { id: todo.id },
        payload: { title: "try sayo today" },
      });
      expect(renamed.title).toBe("try sayo today");
    }),
  ));
```

```sh
vp test     # API 全体を，インメモリで，型付きクライアント越しに
vp check    # フォーマット，lint，型チェック
```

## 次にやること

- 新しい副作用（データベース，メール，決済）はそれぞれ `Service` の裏に置き，すべての profile に実装を用意する．[Service](../guides/service/) と [App と profile](../guides/app-and-profiles/) を参照．
- 本物の実装を並べた `prod` profile を足す．実装が欠けているサービスはコンパイラが指摘する．
