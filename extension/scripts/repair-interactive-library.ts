import fs from 'node:fs/promises';
import path from 'node:path';
import { repairInteractiveHtml } from '../lib/interactive/repair-interactive-html';

const INTERACTIVE_LIBRARY_DIR = path.join(process.cwd(), 'data', 'interactive-library');

async function getAllHtmlFiles(dir: string): Promise<string[]> {
  const htmlFiles: string[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        htmlFiles.push(...(await getAllHtmlFiles(fullPath)));
      } else if (entry.name.endsWith('.html')) {
        htmlFiles.push(fullPath);
      }
    }
  } catch {
    /* ignore unreadable dirs */
  }
  return htmlFiles;
}

async function main() {
  console.log('====================================================');
  console.log('   OpenMAIC 历史互动展厅课件全量防御性自愈修复');
  console.log(`   扫描目录: ${INTERACTIVE_LIBRARY_DIR}`);
  console.log('====================================================\n');

  const files = await getAllHtmlFiles(INTERACTIVE_LIBRARY_DIR);
  console.log(`发现 ${files.length} 个互动 HTML 课件文件，开始逐一巡检修复...\n`);

  let repairedCount = 0;
  const repairBreakdown = new Map<string, number>();

  for (const filePath of files) {
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const { html: cleanHtml, appliedRepairs } = repairInteractiveHtml(raw);

      if (appliedRepairs.length > 0 && cleanHtml !== raw) {
        await fs.writeFile(filePath, cleanHtml, 'utf-8');
        repairedCount++;
        for (const rep of appliedRepairs) {
          repairBreakdown.set(rep, (repairBreakdown.get(rep) || 0) + 1);
        }
        const rel = path.relative(INTERACTIVE_LIBRARY_DIR, filePath);
        console.log(`[已修复] ${rel} -> [${appliedRepairs.join(', ')}]`);
      }
    } catch (err) {
      console.warn(`[跳过] ${filePath} 处理异常:`, err);
    }
  }

  console.log('\n====================================================');
  console.log(`巡检修复完成！共扫描 ${files.length} 个课件，修复生效 ${repairedCount} 个课件。`);
  if (repairBreakdown.size > 0) {
    console.log('各修复项生效统计:');
    for (const [name, count] of repairBreakdown.entries()) {
      console.log(`  - ${name}: ${count} 次`);
    }
  }
  console.log('====================================================\n');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
