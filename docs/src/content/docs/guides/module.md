---
title: Module
description: Where things live.
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

No file-system scanning. Modules are values you register. The same UseCase can be exposed over HTTP, on a schedule, or as an event handler.
