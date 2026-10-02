import { App, Http } from "@sayo-ts/core"
import { AddTodo, CompleteTodo, ListTodos } from "./todo.ts"
import { TodosInMemory } from "./todos.memory.ts"

export const app = App.make({
  http: {
    todos: Http.group("/todos", {
      list: Http.get("/", ListTodos),
      add: Http.post("/", AddTodo),
      complete: Http.post("/:id/complete", CompleteTodo)
    })
  },
  profiles: {
    local: [TodosInMemory]
  }
})
