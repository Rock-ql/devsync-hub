#!/usr/bin/env node
/**
 * PostgreSQL → JSON 数据导出脚本
 * 将 DevSync Hub Web 版的 PostgreSQL 数据导出为 JSON 文件，供桌面客户端导入。
 *
 * 用法:
 *   npm install pg
 *   node scripts/export-pg-data.js --host=localhost --port=5432 --db=devsync --user=postgres --password=xxx
 *
 * 或使用环境变量:
 *   PG_HOST=localhost PG_PORT=5432 PG_DB=devsync PG_USER=postgres PG_PASSWORD=xxx node scripts/export-pg-data.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const TABLES = [
  'project',
  'iteration',
  'iteration_project',
  'pending_sql',
  'sql_env_config',
  'sql_execution_log',
  'report',
  'report_template',
  'api_key',
  'system_setting',
  'git_commit',
  'requirement',
  'requirement_project',
  'work_item_link',
];

// PG → SQLite 字段名映射 (camelCase → snake_case 已在表中一致，仅处理特殊差异)
const FIELD_TRANSFORMS = {
  // PG 的 timestamp 字段需要转为 SQLite 的 TEXT 格式
  created_at: (v) => v ? new Date(v).toISOString().replace('T', ' ').slice(0, 19) : null,
  updated_at: (v) => v ? new Date(v).toISOString().replace('T', ' ').slice(0, 19) : null,
  deleted_at: (v) => v ? new Date(v).toISOString().replace('T', ' ').slice(0, 19) : null,
  executed_at: (v) => v ? new Date(v).toISOString().replace('T', ' ').slice(0, 19) : null,
  committed_at: (v) => v ? new Date(v).toISOString().replace('T', ' ').slice(0, 19) : null,
  last_used_at: (v) => v ? new Date(v).toISOString().replace('T', ' ').slice(0, 19) : null,
};

// 需要排除的 PG 特有字段 (SQLite schema 中不存在的)
const EXCLUDE_FIELDS = ['tenant', 'organization_id'];

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach((arg) => {
    const [key, val] = arg.replace(/^--/, '').split('=');
    args[key] = val;
  });
  return {
    host: args.host || process.env.PG_HOST || 'localhost',
    port: parseInt(args.port || process.env.PG_PORT || '5432'),
    database: args.db || args.database || process.env.PG_DB || 'devsync',
    user: args.user || process.env.PG_USER || 'postgres',
    password: args.password || process.env.PG_PASSWORD || '',
    output: args.output || args.o || `devsync-export-${new Date().toISOString().slice(0, 10)}.json`,
  };
}

function transformRow(row) {
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    if (EXCLUDE_FIELDS.includes(key)) continue;
    const transform = FIELD_TRANSFORMS[key];
    result[key] = transform ? transform(value) : value;
  }
  return result;
}

async function main() {
  const config = parseArgs();
  console.log(`连接 PostgreSQL: ${config.user}@${config.host}:${config.port}/${config.database}`);

  const client = new Client({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
  });

  try {
    await client.connect();
    console.log('连接成功\n');

    const data = {};
    let totalRows = 0;

    for (const table of TABLES) {
      try {
        const res = await client.query(`SELECT * FROM "${table}" ORDER BY id ASC`);
        const rows = res.rows.map(transformRow);
        data[table] = rows;
        totalRows += rows.length;
        console.log(`  ✓ ${table}: ${rows.length} 条记录`);
      } catch (err) {
        if (err.message.includes('does not exist')) {
          console.log(`  - ${table}: 表不存在，跳过`);
          data[table] = [];
        } else {
          throw err;
        }
      }
    }

    const outputPath = path.resolve(config.output);
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');

    console.log(`\n导出完成！共 ${totalRows} 条记录`);
    console.log(`输出文件: ${outputPath}`);
    console.log('\n在 DevSync Hub 桌面客户端中：设置 → 数据管理 → 导入数据，选择此文件即可。');
  } catch (err) {
    console.error('导出失败:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
