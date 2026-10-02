// The whole HTTP API on the local profile, over an in-memory server,
// called through the client generated from the UseCases.
import { NodeHttpServer } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/http";
import { HttpApiClient } from "effect/http-api";
import { describe, expect, it } from "vite-plus/test";
import { app } from "./app.ts";
import { AlreadyDone } from "./todo.ts";

const TestServer = HttpRouter.serve(app.http("local")).pipe(
  Layer.provideMerge(NodeHttpServer.layerTest),
);

/** Runs a test on a fresh in-memory server. */
const run = <A, E>(test: Effect.Effect<A, E, Layer.Success<typeof TestServer>>) =>
  Effect.runPromise(test.pipe(Effect.provide(TestServer)));

describe("todos", () => {
  it("adds and completes a todo", () =>
    run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(app.api);
        const todo = yield* client.todos.add({ payload: { title: "try sayo" } });
        const done = yield* client.todos.complete({ params: { id: todo.id } });
        expect(done.done).toBe(true);
        expect(yield* client.todos.list()).toEqual([done]);
      }),
    ));

  it("answers 409 when a todo is completed twice", () =>
    run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(app.api);
        const todo = yield* client.todos.add({ payload: { title: "only once" } });
        yield* client.todos.complete({ params: { id: todo.id } });
        const error = yield* Effect.flip(client.todos.complete({ params: { id: todo.id } }));
        expect(error).toBeInstanceOf(AlreadyDone);
      }),
    ));
});
