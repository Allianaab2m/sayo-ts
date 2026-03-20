import {
  HttpApi,
  HttpApiBuilder,
  HttpApiClient,
  HttpApiGroup,
  HttpApiSwagger,
  HttpMiddleware,
} from "@effect/platform"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Config, Effect, Layer } from "effect"
import { createServer } from "node:http"
import { LoggerLayer, SayoConfig } from "./config.js"

export interface SayoListenOptions {
  /**
   * デフォルト: Config.number("PORT").pipe(Config.withDefault(3000))
   */
  port?: Config.Config<number>
  /**
   * デフォルト: Config.string("HOST").pipe(Config.withDefault("0.0.0.0"))
   */
  host?: Config.Config<string>
  /**
   * Swagger UI を提供するか。デフォルト: NODE_ENV !== "production"
   */
  swagger?: boolean
}

/**
 * sayo-ts のアプリケーションビルダー。
 * HttpApi を直接受け取り、ボイラープレート（サーバー起動・テスト・Layer 結合）のみを担当する。
 *
 * @example
 * ```typescript
 * SayoApp.make(AppApi)
 *   .addHandlers(UsersLive)
 *   .withLayer(DatabaseLayer)
 *   .listen()
 * ```
 */
export class SayoApp<
  Id extends string,
  Groups extends HttpApiGroup.HttpApiGroup.Any,
  ApiError,
  ApiErrorR,
> {
  private readonly handlerLayers: Layer.Layer<any, any, any>[] = []
  private readonly extraLayers: Layer.Layer<any, any, any>[] = []

  private constructor(
    readonly api: HttpApi.HttpApi<Id, Groups, ApiError, ApiErrorR>,
  ) {}

  static make<
    Id extends string,
    Groups extends HttpApiGroup.HttpApiGroup.Any,
    E,
    R,
  >(api: HttpApi.HttpApi<Id, Groups, E, R>): SayoApp<Id, Groups, E, R> {
    return new SayoApp(api)
  }

  /**
   * HttpApiBuilder.group() の戻り値（Layer）を追加する。
   * 複数回呼び出せる。
   */
  addHandlers(layer: Layer.Layer<any, any, any>): this {
    this.handlerLayers.push(layer)
    return this
  }

  /**
   * 任意の Effect Layer を追加する。
   * DB 接続・認証・外部クライアント等に使う。
   */
  withLayer(layer: Layer.Layer<any, any, any>): this {
    this.extraLayers.push(layer)
    return this
  }

  /**
   * 型付きの HttpApi を返す。
   */
  toHttpApi(): HttpApi.HttpApi<Id, Groups, ApiError, ApiErrorR> {
    return this.api
  }

  /**
   * HttpApi + ハンドラ Layer + 追加 Layer をまとめた Layer を返す。
   */
  toLive(): Layer.Layer<any, any, any> {
    const apiLayer = HttpApiBuilder.api(this.api)

    const allHandlerLayers =
      this.handlerLayers.length > 0
        ? Layer.mergeAll(...(this.handlerLayers as [Layer.Layer<any>]))
        : Layer.empty

    const allExtraLayers =
      this.extraLayers.length > 0
        ? Layer.mergeAll(...(this.extraLayers as [Layer.Layer<any>]))
        : Layer.empty

    return apiLayer.pipe(
      Layer.provide(allHandlerLayers),
      Layer.provide(allExtraLayers),
    )
  }

  /**
   * テスト用の Layer を構築する。
   * NodeHttpServer.layerTest でランダムポートにサーバーを立てる。
   */
  testLayer(): Layer.Layer<any, never, never> {
    return Layer.mergeAll(
      HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
        Layer.provide(this.toLive()),
        Layer.provide(NodeHttpServer.layerTest),
      ),
      NodeHttpServer.layerTest,
    ) as Layer.Layer<any, never, never>
  }

  /**
   * 型付きの HttpApiClient を返す Effect。
   */
  makeClient() {
    return HttpApiClient.make(this.api)
  }

  /**
   * サーバーを起動する。
   * Layer.launch → NodeRuntime.runMain を内部で呼ぶ。
   */
  listen(options: SayoListenOptions = {}): void {
    const port = options.port ?? SayoConfig.port
    const host = options.host ?? SayoConfig.host

    const serverLayer = Effect.gen(function* () {
      const resolvedPort = yield* port
      const resolvedHost = yield* host

      return NodeHttpServer.layer(createServer, {
        port: resolvedPort,
        host: resolvedHost,
      })
    }).pipe(Layer.unwrapEffect)

    // Swagger は NODE_ENV が production でなければ自動で提供する
    const maybeSwagger =
      options.swagger !== false
        ? HttpApiSwagger.layer()
        : Layer.empty

    const appLayer = HttpApiBuilder.serve(HttpMiddleware.logger).pipe(
      Layer.provide(maybeSwagger),
      Layer.provide(this.toLive()),
      Layer.provide(serverLayer),
      Layer.provide(LoggerLayer),
    )

    Layer.launch(appLayer as Layer.Layer<never, any, never>).pipe(
      NodeRuntime.runMain,
    )
  }
}
