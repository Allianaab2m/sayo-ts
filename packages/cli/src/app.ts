import { App, Cli } from "@sayo-ts/core"
import { Dev, GenerateUseCase } from "./project.ts"
import { RunnerNode } from "./runner.node.ts"
import { RunnerRecording } from "./runner.recording.ts"

export const app = App.make({
  cli: {
    dev: Cli.command(Dev, { description: "Serve a profile and restart on changes" }),
    generate: {
      usecase: Cli.command(GenerateUseCase, { args: ["name"], description: "Write a UseCase skeleton" })
    }
  },
  profiles: {
    node: [RunnerNode],
    test: [RunnerRecording]
  }
})
