---
title: Cli
description: UseCase をコマンドラインにバインドする．
sidebar:
  order: 5
---

同じ UseCase をターミナルで動かす．`@sayo-ts/cli` 自体もこの方法で書かれている．

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

- input のフィールドはフラグになり（`dryRun` → `--dry-run`），その Schema でデコードされる．`args` に挙げたフィールドは位置引数になる．省略可能なフィールドは省略可能なフラグに，Boolean はスイッチになる．
- ネストしたレコードはサブコマンドになる（`sayo generate usecase <name>`）．
- Fault は種類ごとの終了コードでプロセスを終える．sysexits に従い，`NotFound` は 66，`Conflict` は 73，`Invalid` は 65 などになる．デコードできないコマンドラインは 64 で終わる．
- ファイルシステム，パス，ターミナル，子プロセスは CLI プラットフォームが用意するので，profile で配線することはない．
