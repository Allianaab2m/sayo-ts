---
title: Cli
description: Binding UseCases to a command line.
sidebar:
  order: 5
---

The same UseCases, on a terminal. `@sayo-ts/cli` itself is written this way.

```ts
App.make({
  cli: {
    dev: Cli.command(Dev, { description: "Serve a profile and restart on changes" }),
    generate: {
      usecase: Cli.command(GenerateUseCase, { args: ["name"] }),
    },
  },
  profiles: { node: [RunnerNode], test: [RunnerRecording] },
})

app.cli("node", { name: "sayo", version })(process.argv.slice(2)) // Effect<exit code>
```

- Input fields become flags (`dryRun` → `--dry-run`), decoded with their Schema. Fields named in `args` are positional. Optional fields are optional flags; Booleans are switches.
- Nested records are subcommands: `sayo generate usecase <name>`.
- Each Fault ends the process with the exit code of its kind, following sysexits: `NotFound` 66, `Conflict` 73, `Invalid` 65, and so on. A command line that does not decode exits with 64.
- File system, path, terminal and child processes come from the CLI platform, so profiles never wire them.
