---
title: Http
description: UseCase を HTTP にバインドする．
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

## 名前

グループの名前は `http` でのキー，エンドポイントの名前はグループ内でのキーになる．生成されるクライアントもこの名前を使う（`client.projects.invite(...)`）．

## input

input は規約で組み立てる．パスパラメータは名前で input のフィールドに対応づける．残りは `GET` ならクエリ文字列から，それ以外ならボディから取る．`.input(...)` で上書きできる．

次のものはコンパイルが通らない．

- input のフィールドにないパスパラメータ：`Path parameter todoId is not a field of the UseCase input`
- `GET` と `DELETE` で，クエリ文字列から取るフィールドがフラットでない（スカラーかスカラーの配列でない）もの：`Query field filter is not flat. Flatten it or take it from a POST body`

## 認証

`.auth(...)` は `HttpApiMiddleware` を受け取る．middleware が提供するもの（現在のユーザー）は，profile が配線すべきものから差し引かれる．middleware 自体はすべての profile に入れる．

UseCase が `CurrentUser` を要求しているのに，エンドポイントに `.auth(...)` がなければコンパイルが通らない．

## View

`View` は UseCase の成功値をレスポンス DTO に変換する．Schema として一度だけ書く．副作用を持ってもいい．

```ts
const ProjectView = View.make(Project, ProjectDto, (project) =>
  Effect.map(CurrentUser, ({ user }) => ProjectDto.forViewer(project, user)))
```

## 中身は素の HttpApi

sayo は `HttpApi` を置き換えず，生成する．手書きの `HttpApiEndpoint` を同じグループに混ぜられる．
