---
title: Module
description: 物の置き場所．
sidebar:
  order: 7
---

```ts
export const todos = Module.make("todos", {
  http: TodoHttp,
  jobs: [Job.cron("0 9 * * *", SendDueReminders)],
  events: [Event.on(TodoAssigned, NotifyAssignee)],
})
```

ファイルシステムは走査しない．Module は登録する値だ．同じ UseCase を HTTP にも，スケジュール実行にも，イベントハンドラにも出せる．
