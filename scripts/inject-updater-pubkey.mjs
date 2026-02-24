#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const pubkey = process.env.TAURI_UPDATER_PUBKEY?.trim()

if (!pubkey) {
  throw new Error('缺少 TAURI_UPDATER_PUBKEY 环境变量')
}

const confPath = path.join(process.cwd(), 'src-tauri', 'tauri.conf.json')
const conf = JSON.parse(fs.readFileSync(confPath, 'utf8'))

if (!conf.plugins || !conf.plugins.updater) {
  throw new Error('tauri.conf.json 未配置 plugins.updater')
}

conf.plugins.updater.active = true
conf.plugins.updater.pubkey = pubkey
fs.writeFileSync(confPath, `${JSON.stringify(conf, null, 2)}\n`, 'utf8')

console.log('updater 公钥注入完成')
