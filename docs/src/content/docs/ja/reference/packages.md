---
title: パッケージ
description: sayo が提供するパッケージと動作要件．
---

| パッケージ | 説明 |
| --- | --- |
| `@sayo-ts/core` | `UseCase`，`Fault`，`Http`，`App` |
| `@sayo-ts/create` | `vp create @sayo-ts` 用のテンプレート．`api` テンプレートはサンプルアプリを兼ねる． |
| `@sayo-ts/cli` | `sayo dev` は profile を起動して変更時に再起動する．`sayo generate usecase <name>` は雛形を書き出す．[`Cli`](../../guides/cli/) で作られている． |

プロジェクトの作成，テスト，フォーマット，lint は [Vite+](https://viteplus.dev) に任せている．sayo の CLI が扱うのは Vite+ にできないことだけ．

## 動作要件

- TypeScript 5.9 以上
- Node.js 22.18 以上（または 24.11 以上）
- effect 4.x
