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
    HttpApiScalar.layer(AppApi, { path: "/docs" })
  )
)

const ServerLive = Served.pipe(
  Layer.provide(UserServiceLive),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
)

Layer.launch(ServerLive).pipe(NodeRuntime.runMain)
