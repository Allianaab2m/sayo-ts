import { createServer } from "node:http";
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { Layer } from "effect";
import { HttpRouter } from "effect/http";
import { app } from "./app.ts";

const port = Number(process.env["PORT"] ?? 3000);
// `sayo dev --profile <name>` sets SAYO_PROFILE
const profile = app.profile(process.env["SAYO_PROFILE"] ?? "local");

HttpRouter.serve(app.http(profile)).pipe(
  Layer.provide(NodeHttpServer.layer(createServer, { port })),
  Layer.launch,
  NodeRuntime.runMain,
);
