# 9. CLI とスキャフォールディング

この章で学ぶこと:

- `create-sayo-app` が内部で何をしているか
- `sayo generate <name>` で生成される 6 ファイル
- 生成後に必要な手動の配線 (`api.ts` / `main.ts` への組み込み)
- Rails / NestJS のジェネレータとの対応

前提章: [01. はじめに](./01-getting-started.md)

---

## `create-sayo-app` — プロジェクト生成

```bash
npx create-sayo-app my-project
```

内部動作:

1. `my-project/` ディレクトリを作成
2. 同梱テンプレ (`templates/default/`) を `node_modules`, `dist`, `.turbo` を除外してコピー
3. コピー先の `package.json` を書き換え
   - `name` を `my-project` に置換
   - `workspace:*` として指定されている `@sayo-ts/eslint-plugin` を実際のリリース版 (例 `^0.0.1`) に置換
4. `pnpm install` を実行
5. 完了メッセージ (`cd my-project`, `pnpm dev` など) を出力

出来上がるプロジェクトは [01. はじめに](./01-getting-started.md) の「ディレクトリ構成」の通りです。

## `sayo generate <name>` — リソーススキャフォールディング

```bash
npx sayo generate post
# もしくは
npx sayo g post
```

1 コマンドで `src/post/` 以下に 6 ファイルを生成します。

| 生成ファイル | 役割 |
| --- | --- |
| `src/post/errors.ts` | `PostNotFound extends Schema.TaggedErrorClass` |
| `src/post/schemas.ts` | `PostResponse` (`Schema.Class`) と `CreatePostRequest` (`Schema.Struct`) |
| `src/post/service.ts` | `PostService extends Context.Service` (`findById` メソッド) |
| `src/post/service.live.ts` | `PostServiceLive: Layer.Layer<PostService>` (TODO 実装) |
| `src/post/api.ts` | `PostsGroup` (`GET /posts/:id` エンドポイント) |
| `src/post/handlers.ts` | `PostsHandlers` (`PostService` を使うハンドラ) |

命名規則:

- 入力 (`post`) は **そのままディレクトリ名・変数名・パスに**
- PascalCase 変換 (`Post`) は **クラス名・Schema 名・TaggedError 名に**

生成される `api.ts` は概ね次のような中身です。

```ts
// src/post/api.ts (生成例)
import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi"
import { PostResponse } from "./schemas.js"
import { PostNotFound } from "./errors.js"

const getPost = HttpApiEndpoint.get("getPost", "/posts/:id", {
  params: { id: Schema.String },
  success: PostResponse,
  error: PostNotFound.pipe(HttpApiSchema.status(404)),
})

export const PostsGroup = HttpApiGroup.make("Posts").add(getPost)
```

## 生成後に必要な手作業 (2 ステップ)

CLI は生成だけで、**DI グラフへの組み込みは自動で行いません**。生成コマンドは完了時に下記のヒントを出力します。

### 1) `src/api.ts` に追加

```ts
import { HttpApi } from "effect/unstable/httpapi"
import { UsersGroup } from "./users/api.js"
import { PostsGroup } from "./post/api.js"   // ← 追加

export const AppApi = HttpApi
  .make("AppApi")
  .add(UsersGroup)
  .add(PostsGroup)                            // ← 追加
```

### 2) `src/main.ts` に Handlers と Service Live を追加

```ts
import { UsersHandlers } from "./users/handlers.js"
import { UserServiceLive } from "./users/service.live.js"
import { PostsHandlers } from "./post/handlers.js"       // ← 追加
import { PostServiceLive } from "./post/service.live.js" // ← 追加

const ApiLive = HttpApiBuilder.layer(AppApi).pipe(
  Layer.provide(Layer.mergeAll(UsersHandlers, PostsHandlers)),  // ← mergeAll に
)

const ServerLive = Served.pipe(
  Layer.provide(Layer.mergeAll(UserServiceLive, PostServiceLive)),  // ← mergeAll に
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
)
```

### 3) `service.live.ts` のビジネスロジックを書く

生成された `PostServiceLive` は「常に `PostNotFound` を返す」だけの雛形です。実装を書き込んでください。

```ts
export const PostServiceLive = Layer.effect(
  PostService,
  Effect.gen(function* () {
    const db = yield* Database   // ← 例えば DB を注入
    return PostService.of({
      findById: (id) => db.queryPost(id),
    })
  }),
)
```

## 生成後すぐにテストを書く

CLI は `test/` 側のファイルを生成しないので、手動で作成するのが推奨です。`users/` のテストをひな形に、リソース名を変えるだけで済みます。

## Rails / NestJS との対応

| やりたいこと | Rails | NestJS | sayo-ts |
| --- | --- | --- | --- |
| プロジェクト生成 | `rails new app` | `nest new app` | `npx create-sayo-app app` |
| リソース一式生成 | `rails g resource post title:string` | `nest g resource posts` | `npx sayo generate post` |
| コントローラだけ | `rails g controller posts` | `nest g controller posts` | (手書き。後日 `sayo generate` 拡張予定) |
| マイグレーション | `rails g migration ...` | (TypeORM 任せ) | (範囲外。任意の ORM を選ぶ) |

sayo-ts は意図的に **HTTP 層 + Effect 規約** に絞ってジェネレータを提供し、DB/ORM にはノータッチです。

## この章のまとめ

- `create-sayo-app` はテンプレコピー + `package.json` 調整 + `pnpm install` までを自動化
- `sayo generate <name>` は 6 ファイル生成 (errors/schemas/service/service.live/api/handlers)
- 生成後は **`api.ts` と `main.ts` への追記が手動** で必要
- テストファイルは手動作成 (既存 `test/users/` をひな形に)

### 人と AI の視点から

`sayo generate` が **毎回同じ構成** を出力するのは、人間の記憶依存を減らすだけでなく、AI コーディング補助が "それっぽい" 架空のディレクトリ構成や命名を発明することを抑える効果もあります。先に `sayo generate` を実行してから AI に渡す、という単純な手順が、プロンプトでは伝えきれない配置規約を物理的に固定する近道です。詳細は [人と AI のためのフレームワーク](./for-humans-and-ai.md) を参照。

次は [10. 規約と Lint ルール](./10-conventions.md) で、`@sayo-ts/eslint-plugin` のルールを一覧します。
