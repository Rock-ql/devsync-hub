#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const packagePath = path.join(root, 'package.json')
const lockPath = path.join(root, 'package-lock.json')
const tauriConfPath = path.join(root, 'src-tauri', 'tauri.conf.json')
const cargoTomlPath = path.join(root, 'src-tauri', 'Cargo.toml')

const semverPattern = /^(\d+)\.(\d+)\.(\d+)$/

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'))
const writeJson = (filePath, data) => {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

const bumpPatch = (version) => {
  const match = semverPattern.exec(version)
  if (!match) {
    throw new Error(`不支持的版本号格式: ${version}`)
  }

  const major = Number(match[1])
  const minor = Number(match[2])
  const patch = Number(match[3]) + 1
  return `${major}.${minor}.${patch}`
}

const updateCargoPackageVersion = (filePath, nextVersion) => {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n')
  let inPackage = false
  let replaced = false

  const updated = lines.map((line) => {
    const trimmed = line.trim()

    if (trimmed === '[package]') {
      inPackage = true
      return line
    }

    if (trimmed.startsWith('[') && trimmed.endsWith(']') && trimmed !== '[package]') {
      inPackage = false
      return line
    }

    if (inPackage && /^version\s*=/.test(trimmed) && !replaced) {
      replaced = true
      return `version = "${nextVersion}"`
    }

    return line
  })

  if (!replaced) {
    throw new Error('未在 Cargo.toml 的 [package] 节找到 version 字段')
  }

  fs.writeFileSync(filePath, `${updated.join('\n')}\n`, 'utf8')
}

const pkg = readJson(packagePath)
const nextVersion = bumpPatch(pkg.version)
pkg.version = nextVersion
writeJson(packagePath, pkg)

const lock = readJson(lockPath)
lock.version = nextVersion
if (lock.packages && lock.packages['']) {
  lock.packages[''].version = nextVersion
}
writeJson(lockPath, lock)

const tauriConf = readJson(tauriConfPath)
tauriConf.version = nextVersion
writeJson(tauriConfPath, tauriConf)

updateCargoPackageVersion(cargoTomlPath, nextVersion)

if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `new_version=${nextVersion}\n`, 'utf8')
}

console.log(nextVersion)

