#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises"
import { execSync } from "node:child_process"
import { resolve, join } from "node:path"
import { downloadTemplate } from "giget"

// Template source. Eventually this should point at a dedicated
// `sayo-ts-template` repository; for now we pull from the monorepo's
// `templates/default/` subdirectory on the matching release tag.
const TEMPLATE_SOURCE =
  process.env.SAYO_TEMPLATE_SOURCE ??
  "github:Allianaab2m/sayo-ts/templates/default"

const printUsage = (): void => {
  console.error("Usage: create-sayo-app <project-name> [options]")
  console.error("")
  console.error("Options:")
  console.error("  --no-install          Skip `pnpm install`")
  console.error("  --ref <branch|tag>    Pull the template from a specific ref (default: main)")
  console.error("")
  console.error("Environment:")
  console.error("  SAYO_TEMPLATE_SOURCE  Override the template source (default:")
  console.error(`                        ${TEMPLATE_SOURCE})`)
}

const parseArgs = (argv: ReadonlyArray<string>) => {
  const args = argv.slice(2)
  let projectName: string | undefined
  let install = true
  let ref: string | undefined

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === "--no-install") {
      install = false
    } else if (a === "--ref") {
      ref = args[++i]
    } else if (a && !a.startsWith("-") && !projectName) {
      projectName = a
    } else {
      console.error(`Unknown argument: ${a}`)
      printUsage()
      process.exit(1)
    }
  }

  return { projectName, install, ref }
}

const main = async () => {
  const { projectName, install, ref } = parseArgs(process.argv)

  if (!projectName) {
    printUsage()
    process.exit(1)
  }

  const targetDir = resolve(process.cwd(), projectName)
  const source = ref ? `${TEMPLATE_SOURCE}#${ref}` : TEMPLATE_SOURCE

  console.log(`Creating sayo app in ${targetDir}`)
  console.log(`Template: ${source}`)

  await downloadTemplate(source, {
    dir: targetDir,
    force: false,
  })

  // Update package.json name and replace workspace: references with real versions
  const pkgPath = join(targetDir, "package.json")
  const pkgJson = JSON.parse(await readFile(pkgPath, "utf-8"))
  pkgJson.name = projectName

  if (pkgJson.devDependencies?.["@sayo-ts/eslint-plugin"] === "workspace:*") {
    pkgJson.devDependencies["@sayo-ts/eslint-plugin"] = "^0.0.1"
  }

  await writeFile(pkgPath, JSON.stringify(pkgJson, null, 2) + "\n")

  if (install) {
    console.log("Installing dependencies...")
    try {
      execSync("pnpm install", { cwd: targetDir, stdio: "inherit" })
    } catch {
      console.warn("\n`pnpm install` failed — run it manually inside the project directory.")
    }
  }

  console.log(`
Done! Your sayo app is ready.

  cd ${projectName}
  pnpm dev       # Start development server
  pnpm test      # Run tests
  pnpm build     # Build for production
`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
