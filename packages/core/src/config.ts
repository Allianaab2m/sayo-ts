import { Config, Effect, Layer, Logger, LogLevel } from "effect"

/**
 * sayo-ts のデフォルト Config。
 * ConfigProvider.fromEnv() から以下の環境変数を読む:
 *   PORT        デフォルト: 3000
 *   HOST        デフォルト: "0.0.0.0"
 *   NODE_ENV    デフォルト: "development"
 *   LOG_LEVEL   デフォルト: "info"
 */
export const SayoConfig = {
  port: Config.number("PORT").pipe(Config.withDefault(3000)),
  host: Config.string("HOST").pipe(Config.withDefault("0.0.0.0")),
  nodeEnv: Config.string("NODE_ENV").pipe(Config.withDefault("development")),
  logLevel: Config.logLevel("LOG_LEVEL").pipe(Config.withDefault(LogLevel.Info)),
}

/**
 * LOG_LEVEL 環境変数に基づいてロガーを設定する Layer。
 * NODE_ENV=production の場合は JSON structured logging、
 * それ以外は pretty logging を使用する。
 */
export const LoggerLayer = Layer.unwrapEffect(
  Effect.gen(function* () {
    const nodeEnv = yield* SayoConfig.nodeEnv
    const logLevel = yield* SayoConfig.logLevel

    const baseLoggerLayer =
      nodeEnv === "production" ? Logger.json : Logger.pretty

    return Layer.merge(baseLoggerLayer, Logger.minimumLogLevel(logLevel))
  }),
)
