---
title: Http
description: Binding UseCases to HTTP.
sidebar:
  order: 4
---

```ts
App.make({
  http: {
    projects: Http.group("/projects", {
      get: Http.get("/:projectId", GetProject).view(ProjectView),
      invite: Http.post("/:projectId/invitations", InviteMember).view(InvitationView),
    }).auth(BearerUser),
  },
  profiles: { /* ... */ },
})
```

## Names

Groups are named by their key in `http`, endpoints by their key in the group. Those names are what the generated client uses: `client.projects.invite(...)`.

## Input

Input is assembled by convention: path parameters match input fields by name; the rest comes from the query string for `GET` and from the body otherwise. Override with `.input(...)`.

What does not compile:

- A path parameter that is not an input field: `Path parameter todoId is not a field of the UseCase input`.
- On `GET` and `DELETE`, a field that would come from the query string and is not flat (scalars, or arrays of scalars): `Query field filter is not flat. Flatten it or take it from a POST body`.

## Auth

`.auth(...)` takes an `HttpApiMiddleware`. Whatever it provides (the current user) is subtracted from what the profile must wire; the middleware itself must be in every profile.

If a UseCase requires `CurrentUser` and the endpoint has no `.auth(...)`, it does not compile.

## Views

A `View` converts the UseCase's success value into the response DTO. It is a Schema, written once, and may be effectful:

```ts
const ProjectView = View.make(Project, ProjectDto, (project) =>
  Effect.map(CurrentUser, ({ user }) => ProjectDto.forViewer(project, user)))
```

## Plain HttpApi underneath

sayo does not replace `HttpApi`; it generates it. Hand-written `HttpApiEndpoint`s can be mixed into the same group.
