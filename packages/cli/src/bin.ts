#!/usr/bin/env node
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Effect } from "effect"
import { app } from "./app.ts"

const version = "0.1.0"

app.cli("node", { name: "sayo", version })(process.argv.slice(2)).pipe(
  Effect.flatMap((code) => Effect.sync(() => void (process.exitCode = code))),
  Effect.provide(NodeServices.layer),
  NodeRuntime.runMain
)
