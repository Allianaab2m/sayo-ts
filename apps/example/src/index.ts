import { SayoApp } from "@sayo-ts/core"
import { AppApi } from "./api/api.js"
import { UsersLive } from "./api/users.routes.js"

SayoApp.make(AppApi)
  .addHandlers(UsersLive)
  .listen()
