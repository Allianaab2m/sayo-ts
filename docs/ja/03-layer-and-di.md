# 3. Layer システムと DI

この章で学ぶこと:

- `Context.Service` でインターフェースを宣言する方法
- `Layer.succeed` / `Layer.effect` で実装を提供する方法
- `Layer.provide` / `Layer.mergeAll` / `Layer.provideMerge` の違い
- なぜ `service.ts` と `service.live.ts` を分けるのか
- `main.ts` で Layer 合成がどう組み上がるのか
- テスト時に `UserServiceLive` を `UserServiceMock` に差し替えられる理由

前提章: [02. Effect の基礎](./02-effect-essentials.md)

---

## Rails / NestJS 経験者向けの 1 行サマリ

| | Rails | NestJS | sayo-ts |
| --- | --- | --- | --- |
| インターフェース | (明示的概念なし) | `interface UserRepository` | `class UserService extends Context.Service<...>()("UserService") {}` |
| 実装 | `UsersRepository < ApplicationRecord` | `@Injectable() class UserRepositoryImpl` | `const UserServiceLive = Layer.succeed(UserService, impl)` |
| 注入 | 暗黙 (定数 lookup) | `constructor(private repo: UserRepository)` | `const svc = yield* UserService` |
| モジュール組立 | (Rails は自動ロード) | `@Module({ providers: [...] })` | `Layer.provide` / `Layer.mergeAll` |

Effect の強みは、**DI コンテナが型そのもの** である点です。ランタイム (`Layer`) も型システム (`Requirements`) も同じ依存グラフを見ていて、接続漏れはビルド時に検出されます。

## ポートとアダプタ: `service.ts` / `service.live.ts`

テンプレの `templates/default/src/users/service.ts` は次のようになっています。

```ts
import { Context, Effect } from "effect"
import type { UserResponse, CreateUserRequest } from "./schemas.js"
import type { UserNotFound, EmailAlreadyTaken } from "./errors.js"

export class UserService extends Context.Service<
  UserService,
  {
    readonly findById: (id: string) => Effect.Effect<UserResponse, UserNotFound>
    readonly register: (input: CreateUserRequest) => Effect.Effect<UserResponse, EmailAlreadyTaken>
  }
>()("UserService") {}
```

ポイント:

- `Context.Service<Self, Shape>()("TagName")` で「**このタグで DI コンテナから取り出せるサービス**」を定義
- `Shape` は **メソッドのインターフェース** だけを書く (実装は書かない)
- ここには DB や HTTP クライアントなどの副作用の詳細は一切出てこない (= ポート)

実装は別ファイルに書きます (`service.live.ts`)。

```ts
import { Effect, Layer } from "effect"
import { UserService } from "./service.js"
import { UserNotFound, EmailAlreadyTaken } from "./errors.js"
import { UserResponse } from "./schemas.js"

export const UserServiceLive: Layer.Layer<UserService> = Layer.succeed(
  UserService,
  UserService.of({
    findById: (id) =>
      Effect.gen(function* () {
        if (id === "1") {
          return new UserResponse({ id: "1", name: "Alice", email: "alice@example.com" })
        }
        return yield* new UserNotFound({ userId: id })
      }),

    register: (input) =>
      Effect.gen(function* () {
        if (input.email === "taken@example.com") {
          return yield* new EmailAlreadyTaken({ email: input.email })
        }
        return new UserResponse({ id: crypto.randomUUID(), name: input.name, email: input.email })
      }),
  }),
)
```

- `Layer.succeed(Tag, impl)` は「**この Tag に対してこの実装を提供する Layer**」を作る
- `UserService.of({...})` はインターフェースを満たすオブジェクトを作るヘルパ (型検査が効く)
- 返り値の型 `Layer.Layer<UserService>` は「`UserService` を **提供する** Layer (他に必要な依存はない)」を意味する

この **`service.ts` (ポート) と `service.live.ts` (アダプタ) を別ファイルにする** 慣習は `sayo/service-interface-separation` ルールで強制されます。テスト時にモックと入れ替えやすくするための分離です。

## `Layer.Layer<Provides, E, Requires>`

`Layer` の型パラメータは次の通り:

```ts
Layer.Layer<Provides, E, Requires>
//           │       │   └─ この Layer を構築するために必要な他のサービス
//           │       └───── 構築中に起こり得るエラー
//           └───────────── この Layer が提供するサービス
```

`Requires` が空 (`never`) の Layer は「そのまま持ち運べる単位」、`Requires` が埋まっている Layer は「他の Layer で埋めてもらう必要がある Layer」です。

例:

```ts
// UserService を提供し、他には何も要らない (= self-contained)
const UserServiceLive: Layer.Layer<UserService>

// UserService を提供するが、構築には Database Layer が必要
const UserServiceWithDbLive: Layer.Layer<UserService, never, Database>
```

## 実装が他サービスを必要とする場合: `Layer.effect`

DB 接続プールなど、構築時に別の Layer が必要な場合は `Layer.effect` を使います。

```ts
import { Effect, Layer } from "effect"
import { UserService } from "./service.js"
import { Database } from "../infra/database.js"

export const UserServiceLive = Layer.effect(
  UserService,
  Effect.gen(function* () {
    const db = yield* Database  // ← ここで別の Layer の依存を取り込む
    return UserService.of({
      findById: (id) => db.queryUser(id),
      register: (input) => db.insertUser(input),
    })
  }),
)
// 型: Layer.Layer<UserService, never, Database>
```

## Layer の合成: `provide` / `mergeAll` / `provideMerge`

sayo-ts のテンプレ `src/main.ts` を丸ごと読み解きます。

```ts
import { Layer } from "effect"
import { HttpApiBuilder, HttpApiScalar } from "effect/unstable/httpapi"
import { HttpRouter } from "effect/unstable/http"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { createServer } from "node:http"
import { AppApi } from "./api.js"
import { UsersHandlers } from "./users/handlers.js"
import { UserServiceLive } from "./users/service.live.js"

const ApiLive = HttpApiBuilder.layer(AppApi).pipe(
  Layer.provide(UsersHandlers),
)

const Served = HttpRouter.serve(
  Layer.mergeAll(
    ApiLive,
    HttpApiScalar.layer(AppApi, { path: "/docs" }),
  ),
)

const ServerLive = Served.pipe(
  Layer.provide(UserServiceLive),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
)

Layer.launch(ServerLive).pipe(NodeRuntime.runMain)
```

段階ごとに見ていきます。

### 1) `Layer.provide(child)` — 子 Layer で依存を埋める

```ts
const ApiLive = HttpApiBuilder.layer(AppApi).pipe(
  Layer.provide(UsersHandlers),
)
```

`HttpApiBuilder.layer(AppApi)` は「API 定義から HTTP 層を組み立てる Layer」ですが、**各エンドポイントのハンドラを要求** します。ここに `UsersHandlers` を `Layer.provide` することでその依存を消しています。

比喩: `parent.provide(child)` = 「parent が欲しがっていた依存を child が差し出す」。

### 2) `Layer.mergeAll([a, b, ...])` — 並列合成

```ts
const Served = HttpRouter.serve(
  Layer.mergeAll(
    ApiLive,
    HttpApiScalar.layer(AppApi, { path: "/docs" }),
  ),
)
```

`mergeAll` は独立した Layer を合併します。依存関係は変えません。ここでは「実 API」と「`/docs` に生えるドキュメント UI」を同じルータに束ねています。

### 3) 依存を順に `.pipe(Layer.provide(...))` でつぶす

```ts
const ServerLive = Served.pipe(
  Layer.provide(UserServiceLive),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
)
```

- `Served` は `UsersHandlers` の実行に `UserService` を要求 → `UserServiceLive` で満たす
- 最後に `NodeHttpServer.layer` で実サーバを差し込む

**各 `Layer.provide` の型が合わないとコンパイルエラーになる** のが重要なポイントです。`UserServiceLive` を消せばビルドが通りません。

### 4) `Layer.provideMerge` — テストの決まり文句

テスト (`test/users/handlers.test.ts`) では `Layer.provideMerge` が登場します。

```ts
const TestLive = HttpRouter.serve(ApiLive).pipe(
  Layer.provide(UserServiceMock),
  Layer.provideMerge(NodeHttpServer.layerTest),
)
```

| API | 意味 |
| --- | --- |
| `Layer.provide(child)` | child は親に吸収され、外からは見えなくなる |
| `Layer.provideMerge(child)` | child も親に吸収されるが、**同時に親の提供サービスに合流して外からも見える** |

`NodeHttpServer.layerTest` は `HttpClient` を提供する Layer で、テスト本体の `Effect.gen` から `yield* HttpApiClient.make(AppApi)` するために外から見える必要があります。よって `provideMerge` を使います。

## `Layer.launch` — DI グラフの起動

`Layer.launch(ServerLive)` は:

1. `ServerLive` が `Layer.Layer<never>` (= 外部依存がない) であることを型で要求
2. 内部の全 Layer を適切な順序で起動
3. 依存関係に沿って Scope (リソース生存期間) を管理
4. 停止時に逆順で解放

`NodeRuntime.runMain` と組み合わせて、SIGINT などのシグナルでも安全に停止します。

## ハンドラ側から見た DI

Layer で組んでおけば、ハンドラ側は単に `yield*` するだけです。

```ts
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { UserService } from "./service.js"

export const UsersHandlers = HttpApiBuilder.group(AppApi, "Users", (h) =>
  h.handle("getUser", (req) =>
    Effect.gen(function* () {
      const service = yield* UserService            // ← DI
      return yield* service.findById(req.params.id)
    }),
  ),
)
```

`yield* UserService` の型は「`Effect.Effect<UserService["Shape"], never, UserService>`」。つまり **要求が型として浮かび上がる** ため、どこかで `UserServiceLive` を `Layer.provide` し忘れているとビルドが通りません。

## 複数サービスと依存関係の整理

リソースが増えると Layer が増えます。慣習:

- リソースごとに `service.ts` / `service.live.ts`
- 共通インフラ (DB, Logger, Config など) は `src/infra/` にまとめる
- `main.ts` の最上段で「全リソースの Live」と「インフラ Live」を `Layer.mergeAll` → `Layer.provide` で接続

```ts
const AppLive = Layer.mergeAll(
  UsersHandlers,
  PostsHandlers,
)

const ApiLive = HttpApiBuilder.layer(AppApi).pipe(Layer.provide(AppLive))

const InfraLive = Layer.mergeAll(
  UserServiceLive,
  PostServiceLive,
  DatabaseLive,
)

const ServerLive = HttpRouter.serve(ApiLive).pipe(
  Layer.provide(InfraLive),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
)
```

## この章のまとめ

- `Context.Service` = DI タグ (ポート)
- `Layer.succeed(Tag, impl)` / `Layer.effect(Tag, buildEffect)` = 実装 (アダプタ)
- `Layer.provide(child)` = 子で親の依存を埋める
- `Layer.mergeAll([...])` = 独立 Layer の並列合併
- `Layer.provideMerge(child)` = provide + 外部公開 (テストで頻出)
- `Layer.launch(ServerLive)` = 最終実行
- `service.ts` と `service.live.ts` を分離するのは、テストで Layer を差し替えられるようにするため

### 関連 ESLint ルール

- `sayo/service-interface-separation` (warn): 同じファイルに `Context.Service` と `Layer` 実装を書くと警告

### Rails / NestJS ではどう呼ぶか

- NestJS: `@Injectable()` + `@Module({ providers: [...] })`
- Rails: (明示的 DI はなく、定数参照と autoload が大半)

次は [04. エンドポイントとハンドラ](./04-endpoints.md) へ進みます。
