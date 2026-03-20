import { HttpApi } from "@effect/platform"
import { UsersGroup } from "./users.js"

export class AppApi extends HttpApi.make("my-app").add(UsersGroup) {}
