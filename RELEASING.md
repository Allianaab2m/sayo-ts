# Releasing

sayo-ts uses **[Changesets](https://github.com/changesets/changesets)** for versioning and changelog generation, and **GitHub Actions + npm Trusted Publishers (OIDC)** for publishing. No long-lived `NPM_TOKEN` is required.

## Release flow (the happy path)

```
┌────────────────┐   feature PR    ┌────────────────┐    merge    ┌────────────────┐
│ feature branch │ ───(changeset)──▶│     main       │──────────▶│  Version PR    │
└────────────────┘                 └────────────────┘             │ (auto-opened)  │
                                                                  └────────┬───────┘
                                                                           │ merge
                                                                           ▼
                                                              ┌─────────────────────┐
                                                              │ npm publish (OIDC)  │
                                                              │ + provenance        │
                                                              │ + git tags pushed   │
                                                              └─────────────────────┘
```

### Step-by-step (as a contributor)

1. **Branch off `main`** for your change.
2. **Make the code change.**
3. **Add a changeset:**
   ```bash
   pnpm changeset
   ```
   Interactively select which packages changed and their semver bump. Write a one-line summary. This produces a markdown file under `.changeset/`.
4. **Commit the changeset** alongside your code change.
5. **Open a PR.** Merge it into `main` once reviewed.

### What happens after merge to `main`

The [`release.yml`](./.github/workflows/release.yml) workflow runs on every push to `main`:

- **If there are pending `.changeset/*.md` files** → it opens (or updates) a PR titled **"chore: version packages"**. That PR removes the changesets, bumps the versions in each affected `package.json`, and updates `CHANGELOG.md` for each package.
- **If the "Version Packages" PR is merged** → the workflow detects the bumped versions, runs `pnpm release` (which builds every package and calls `changeset publish`), and publishes to npm via **OIDC**. It also pushes the release tags back to the repo.

## One-time setup

### 1. Create the `@sayo-ts` org on npm

Go to <https://www.npmjs.com/org/create> and create the **`sayo-ts`** org (free plan is fine). Invite any co-maintainers.

### 2. Configure npm Trusted Publishers for each package

For each of the following packages, open its page on npmjs.com and go to **Settings → Publishing access → Add trusted publisher → GitHub Actions**:

| Package | Page (after first publish) / pre-registration |
| --- | --- |
| `@sayo-ts/eslint-plugin` | https://www.npmjs.com/package/@sayo-ts/eslint-plugin |
| `@sayo-ts/cli` | https://www.npmjs.com/package/@sayo-ts/cli |
| `create-sayo-app` | https://www.npmjs.com/package/create-sayo-app |

Enter:

- **Organization or user:** `Allianaab2m`
- **Repository:** `sayo-ts`
- **Workflow filename:** `release.yml`
- **Environment name:** (leave blank)

npm allows configuring trusted publishers **before** the first publish — the package name is reserved and the very first release is emitted via OIDC.

### 3. No repository secrets are needed

The workflow requires no `NPM_TOKEN`. It uses `GITHUB_TOKEN` (auto-provided) for opening the version PR and OIDC for npm authentication.

## Versioning policy

- **Semver**, pre-1.0: breaking changes can ship as a `minor` bump during `0.x`
- **Every user-visible change requires a changeset.** CI enforcement is not yet wired up; reviewers should flag PRs missing a changeset.
- **Internal refactors / chores**: a changeset is optional. If you want the change to appear in the changelog, include one.

## Emergency / manual publish

If CI is broken and you must publish from your laptop:

```bash
unset NPM_CONFIG_PROVENANCE   # provenance requires OIDC, disable for local publish
npm login
pnpm install
pnpm -r --filter="./packages/*" run build
pnpm changeset version        # if there are pending changesets
git add . && git commit -m "chore: version packages"
pnpm changeset publish
git push --follow-tags
```

Manual publishes do **not** get provenance attestation. Re-enable CI-based releases as soon as possible.

## Unpublishing / yanking

Use `npm deprecate <pkg>@<version> "<message>"` to discourage installs without breaking existing consumers. Do **not** `npm unpublish` published versions — it breaks downstream installs and only works within 72 hours of publish.

## Troubleshooting

### "Version Packages" PR isn't being opened

- Ensure at least one file exists under `.changeset/` (excluding `README.md` and `config.json`).
- Check the Actions tab for the `Release` workflow run.

### `npm publish` fails with "403 Forbidden"

- Trusted publisher not configured on npm for that package.
- Or the workflow path in npm's config doesn't match `release.yml`.
- Or the repo / org names don't match.

### First publish fails with "package not found"

- The package name is reserved (someone else has it) or not yet claimed. For scoped packages, ensure the org exists.

### Publish succeeded but no provenance badge

- `NPM_CONFIG_PROVENANCE: "true"` must be set in the workflow env (it is).
- `permissions.id-token: write` must be set on the job (it is).
- npm CLI version must be `>= 11.5.1` (Node 24 ships a compatible version).
