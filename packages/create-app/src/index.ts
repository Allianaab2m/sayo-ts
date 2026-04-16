#!/usr/bin/env node

import { cp, readFile, writeFile } from "node:fs/promises"
import { execSync } from "node:child_process"
import { resolve, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))

const main = async () => {
  const projectName = process.argv[2]

  if (!projectName) {
    console.error("Usage: create-sayo-app <project-name>")
    process.exit(1)
  }

  const targetDir = resolve(process.cwd(), projectName)
  const templateDir = resolve(__dirname, "../../templates/default")

  console.log(`Creating sayo app in ${targetDir}...`)

  // Copy template
  await cp(templateDir, targetDir, {
    recursive: true,
    filter: (src) => {
      const name = src.split("/").pop() ?? ""
      return name !== "node_modules" && name !== "dist" && name !== ".turbo"
    },
  })

  // Update package.json name
  const pkgPath = join(targetDir, "package.json")
  const pkgJson = JSON.parse(await readFile(pkgPath, "utf-8"))
  pkgJson.name = projectName

  // Replace workspace: references with real versions
  if (pkgJson.devDependencies?.["@sayo/eslint-plugin"] === "workspace:*") {
    pkgJson.devDependencies["@sayo/eslint-plugin"] = "^0.0.1"
  }

  await writeFile(pkgPath, JSON.stringify(pkgJson, null, 2) + "\n")

  // Install dependencies
  console.log("Installing dependencies...")
  execSync("pnpm install", { cwd: targetDir, stdio: "inherit" })

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
