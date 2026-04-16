import { HttpApi } from "effect/unstable/httpapi"
import { UsersGroup } from "./users/api.js"

export const AppApi = HttpApi.make("AppApi").add(UsersGroup)
