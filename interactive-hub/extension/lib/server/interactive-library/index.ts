import fs from 'fs/promises';
import path from 'path';
import { createLogger } from '@/lib/logger';
import { inlineHtmlAssets } from '@/lib/export/inline-assets';
import type { Scene } from '@/lib/types/stage';

const log = createLogger('InteractiveLibrary');

const INTERACTIVE_LIBRARY_DIR = path.join(process.cwd(), 'data', 'interactive-library');
const CLASSROOMS_DIR = path.join(process.cwd(), 'data', 'classrooms');

export interface InteractiveItemMeta {
  sceneId: string;
  order: number;
  title: string;
  widgetType: 'simulation' | 'game' | 'diagram' | 'code' | string;
  fileName: string;
  concept?: string;
  description?: string;
  size: number;
  createdAt: number;
}

export interface InteractiveStageMeta {
  stageId: string;
  courseName: string;
  folderName: string;
  updatedAt: number;
  items: InteractiveItemMeta[];
}

export interface InteractiveLibraryOverview {
  courses: InteractiveStageMeta[];
  totalItems: number;
  typeCounts: {
    game: number;
    simulation: number;
    diagram: number;
    code: number;
    other: number;
  };
}

/** Sanitize file and directory name for safe filesystem storage */
export function sanitizeFsName(name: string): string {
  return (name || '未命名')
    .replace(/[\\/:*?"<>|\r\n\t]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/** Ensure base directory exists */
async function ensureBaseDir(): Promise<void> {
  await fs.mkdir(INTERACTIVE_LIBRARY_DIR, { recursive: true });
}

/**
 * Find existing directory on disk for a given stageId (matches *_${stageId} or ${stageId})
 */
async function findStageDir(stageId: string): Promise<string | null> {
  await ensureBaseDir();
  try {
    const entries = await fs.readdir(INTERACTIVE_LIBRARY_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name.endsWith(`_${stageId}`) || entry.name === stageId) {
          return path.join(INTERACTIVE_LIBRARY_DIR, entry.name);
        }
      }
    }
  } catch (err) {
    log.error('Failed to find stage dir:', err);
  }
  return null;
}

/**
 * Sync and export all interactive scenes for a given stage into standalone HTML files.
 */
export async function syncInteractiveLibraryForStage(
  stage: { id: string; name?: string; title?: string },
  scenes: Scene[],
  options?: { force?: boolean },
): Promise<InteractiveStageMeta | null> {
  const stageId = stage.id;
  const courseName = stage.name || stage.title || stageId;
  const safeCourseName = sanitizeFsName(courseName);

  // Filter interactive scenes that have HTML content
  const interactiveScenes: Scene[] = [];
  scenes.forEach((s) => {
    const rawContent = s.content as { type?: string; widgetType?: string; html?: string } | undefined;
    const isInteractive =
      s.type === 'interactive' ||
      rawContent?.type === 'interactive' ||
      Boolean(rawContent?.widgetType) ||
      Boolean(rawContent?.html);

    const html = rawContent?.html;
    if (isInteractive && html && typeof html === 'string' && html.trim().length > 0) {
      interactiveScenes.push(s);
    }
  });

  const existingDir = await findStageDir(stageId);

  // If there are no interactive scenes in this stage, clean up any existing folder
  if (interactiveScenes.length === 0) {
    if (existingDir) {
      try {
        await fs.rm(existingDir, { recursive: true, force: true });
        log.info(`Removed empty interactive directory for stage ${stageId}`);
      } catch (err) {
        log.warn(`Failed to remove empty directory ${existingDir}:`, err);
      }
    }
    return null;
  }

  await ensureBaseDir();

  const targetFolderName = `${safeCourseName}_${stageId}`;
  const targetDir = path.join(INTERACTIVE_LIBRARY_DIR, targetFolderName);

  // If directory exists under an old name, rename it
  if (existingDir && existingDir !== targetDir) {
    try {
      await fs.rename(existingDir, targetDir);
      log.info(`Renamed stage directory from ${existingDir} to ${targetDir}`);
    } catch {
      await fs.mkdir(targetDir, { recursive: true });
    }
  } else {
    await fs.mkdir(targetDir, { recursive: true });
  }

  const items: InteractiveItemMeta[] = [];
  const now = Date.now();

  for (let idx = 0; idx < interactiveScenes.length; idx++) {
    const scene = interactiveScenes[idx];
    const order = typeof scene.order === 'number' ? scene.order : idx + 1;
    const sceneTitle = scene.title || `第${order}页互动`;
    const safeTitle = sanitizeFsName(sceneTitle);
    const fileName = `${String(order).padStart(2, '0')}_${safeTitle}.html`;
    const filePath = path.join(targetDir, fileName);

    const rawContent = scene.content as Record<string, unknown>;
    const rawHtml = String(rawContent.html || '');
    const widgetType =
      String(rawContent.widgetType || '') ||
      String((rawContent.widgetConfig as { type?: string })?.type || '') ||
      'simulation';

    const widgetConfig = (rawContent.widgetConfig as Record<string, unknown>) || {};
    const concept = String(widgetConfig.concept || '');
    const description = String(widgetConfig.description || '');

    // Check if valid inlined file already exists to avoid redundant heavy packaging
    let fileSize = 0;
    let fileWritten = false;
    if (!options?.force) {
      try {
        const stat = await fs.stat(filePath);
        if (stat.size > 200) {
          fileSize = stat.size;
          fileWritten = true;
        }
      } catch {
        fileWritten = false;
      }
    }

    if (!fileWritten) {
      // Perform deep asset inlining
      let inlinedHtml = rawHtml;
      try {
        const { html } = await inlineHtmlAssets(rawHtml);
        inlinedHtml = html;
      } catch (err) {
        log.warn(`Inlining assets for ${sceneTitle} failed; writing raw HTML`, err);
        inlinedHtml = rawHtml;
      }

      await fs.writeFile(filePath, inlinedHtml, 'utf-8');
      fileSize = Buffer.byteLength(inlinedHtml, 'utf-8');
    }

    items.push({
      sceneId: scene.id,
      order,
      title: sceneTitle,
      widgetType,
      fileName,
      concept: concept || undefined,
      description: description || undefined,
      size: fileSize,
      createdAt: now,
    });
  }

  const meta: InteractiveStageMeta = {
    stageId,
    courseName,
    folderName: targetFolderName,
    updatedAt: now,
    items,
  };

  await fs.writeFile(
    path.join(targetDir, 'meta.json'),
    JSON.stringify(meta, null, 2),
    'utf-8',
  );

  log.info(`Successfully synced ${items.length} interactive games to ${targetFolderName}`);
  return meta;
}

/**
 * Rename course folder and update meta.json when a course is renamed.
 */
export async function renameInteractiveLibraryStage(
  stageId: string,
  newCourseName: string,
): Promise<boolean> {
  const existingDir = await findStageDir(stageId);
  if (!existingDir) return false;

  const safeName = sanitizeFsName(newCourseName);
  const targetDir = path.join(INTERACTIVE_LIBRARY_DIR, `${safeName}_${stageId}`);

  try {
    if (existingDir !== targetDir) {
      await fs.rename(existingDir, targetDir);
    }

    const metaPath = path.join(targetDir, 'meta.json');
    try {
      const metaRaw = await fs.readFile(metaPath, 'utf-8');
      const meta = JSON.parse(metaRaw) as InteractiveStageMeta;
      meta.courseName = newCourseName;
      meta.folderName = `${safeName}_${stageId}`;
      meta.updatedAt = Date.now();
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
    } catch {
      // meta.json missing, will be recreated on next sync
    }
    log.info(`Renamed interactive library stage ${stageId} to ${newCourseName}`);
    return true;
  } catch (err) {
    log.error(`Failed to rename interactive stage ${stageId}:`, err);
    return false;
  }
}

/**
 * Delete course folder when a course is deleted.
 */
export async function deleteInteractiveLibraryStage(stageId: string): Promise<boolean> {
  const existingDir = await findStageDir(stageId);
  if (!existingDir) return false;

  try {
    await fs.rm(existingDir, { recursive: true, force: true });
    log.info(`Deleted interactive library folder for stage ${stageId}: ${existingDir}`);
    return true;
  } catch (err) {
    log.error(`Failed to delete interactive stage ${stageId}:`, err);
    return false;
  }
}

/**
 * Read all interactive items from disk.
 */
export async function listInteractiveLibrary(): Promise<InteractiveLibraryOverview> {
  await ensureBaseDir();

  const courses: InteractiveStageMeta[] = [];
  const typeCounts = {
    game: 0,
    simulation: 0,
    diagram: 0,
    code: 0,
    other: 0,
  };

  try {
    const entries = await fs.readdir(INTERACTIVE_LIBRARY_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const metaPath = path.join(INTERACTIVE_LIBRARY_DIR, entry.name, 'meta.json');
      try {
        const metaRaw = await fs.readFile(metaPath, 'utf-8');
        const meta = JSON.parse(metaRaw) as InteractiveStageMeta;
        courses.push(meta);

        for (const item of meta.items) {
          const t = item.widgetType.toLowerCase();
          if (t === 'game') typeCounts.game++;
          else if (t === 'simulation') typeCounts.simulation++;
          else if (t === 'diagram') typeCounts.diagram++;
          else if (t === 'code') typeCounts.code++;
          else typeCounts.other++;
        }
      } catch {
        // meta.json may not exist yet or was corrupted
      }
    }
  } catch (err) {
    log.error('Failed to list interactive library:', err);
  }

  // Sort courses by updatedAt descending
  courses.sort((a, b) => b.updatedAt - a.updatedAt);

  const totalItems =
    typeCounts.game + typeCounts.simulation + typeCounts.diagram + typeCounts.code + typeCounts.other;

  return {
    courses,
    totalItems,
    typeCounts,
  };
}

/**
 * Safely get an HTML file's content for rendering or downloading.
 */
export async function getInteractiveHtmlFile(
  stageId: string,
  fileName: string,
): Promise<{ html: string; title: string } | null> {
  const stageDir = await findStageDir(stageId);
  if (!stageDir) return null;

  // Prevent path traversal
  const safeFileName = path.basename(fileName);
  const filePath = path.join(stageDir, safeFileName);

  try {
    const html = await fs.readFile(filePath, 'utf-8');
    return { html, title: safeFileName.replace(/\.html$/i, '') };
  } catch {
    return null;
  }
}

/**
 * Backfill & Rescan: Scan all existing courses in data/classrooms/*.json and PostgreSQL database.
 */
export async function backfillInteractiveLibrary(options?: { force?: boolean }): Promise<number> {
  let processed = 0;
  const processedStageIds = new Set<string>();

  // 1. Scan filesystem data/classrooms/*.json
  try {
    const files = await fs.readdir(CLASSROOMS_DIR);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const fpath = path.join(CLASSROOMS_DIR, file);
      try {
        const raw = await fs.readFile(fpath, 'utf-8');
        const data = JSON.parse(raw);
        const stage = data.stage || { id: data.id || file.slice(0, -5), name: data.name };
        const scenes = data.scenes || [];
        if (Array.isArray(scenes) && scenes.length > 0) {
          const res = await syncInteractiveLibraryForStage(stage, scenes, options);
          if (res && res.items.length > 0) {
            processed += res.items.length;
            processedStageIds.add(stage.id);
          }
        }
      } catch (err) {
        log.warn(`Failed to backfill from ${file}:`, err);
      }
    }
  } catch (err) {
    log.error('Failed to read classrooms dir during backfill:', err);
  }

  // 2. Scan PostgreSQL database if configured
  if (process.env.DATABASE_URL) {
    try {
      const { Pool } = await import('pg');
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const stagesRes = await pool.query('SELECT id, name FROM document_stages');
      for (const row of stagesRes.rows) {
        if (processedStageIds.has(row.id)) continue;
        try {
          const scenesRes = await pool.query(
            'SELECT scene_order, data FROM document_scenes WHERE stage_id = $1 ORDER BY scene_order ASC',
            [row.id],
          );
          if (scenesRes.rows.length > 0) {
            const scenes = scenesRes.rows.map((r: { data: any }) => r.data).filter(Boolean);
            const stage = { id: row.id, name: row.name };
            const res = await syncInteractiveLibraryForStage(stage, scenes, options);
            if (res && res.items.length > 0) {
              processed += res.items.length;
              processedStageIds.add(row.id);
            }
          }
        } catch (err) {
          log.warn(`Failed to backfill database stage ${row.id}:`, err);
        }
      }
      await pool.end();
    } catch (dbErr) {
      log.warn('Failed to query database for interactive backfill:', dbErr);
    }
  }

  // 3. Clean up orphaned interactive folders for courses that no longer exist
  try {
    const existingDirs = await fs.readdir(INTERACTIVE_LIBRARY_DIR, { withFileTypes: true });
    for (const d of existingDirs) {
      if (!d.isDirectory()) continue;
      let stageId: string | null = null;
      try {
        const metaRaw = await fs.readFile(path.join(INTERACTIVE_LIBRARY_DIR, d.name, 'meta.json'), 'utf-8');
        const meta = JSON.parse(metaRaw);
        if (meta?.stageId) {
          stageId = meta.stageId;
        }
      } catch {
        // Fallback
      }

      const isLive = stageId
        ? processedStageIds.has(stageId)
        : Array.from(processedStageIds).some((id) => d.name.endsWith(`_${id}`) || d.name === id);

      if (!isLive) {
        log.info(`Purging orphaned interactive folder for deleted stage: ${d.name}`);
        await fs.rm(path.join(INTERACTIVE_LIBRARY_DIR, d.name), { recursive: true, force: true });
      }
    }
  } catch (err) {
    log.warn('Failed to clean up orphaned interactive folders:', err);
  }

  return processed;
}
