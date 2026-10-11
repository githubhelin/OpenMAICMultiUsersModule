import { NextRequest } from 'next/server';
import { promises as fs } from 'node:fs';
import {
  getClassroomMaterial,
  archiveClassroomMaterial,
} from '@/lib/persistence/classroom-materials';
import { buildCourseScaleInstruction, CourseScale } from '@/lib/types/course-scale';
import { buildThemeStyleInstruction, InteractiveThemeStyle, SlideThemeStyle } from '@/lib/types/theme-style';
import { withRequestOwner } from '@/lib/server/identity/with-owner';
import { createOwnerMaterialFromFile } from '@/lib/server/materials/create-owner-material';
import { executeAndAwaitGenerationRun } from '@/lib/server/generation/run/await-run';
import { getOwnerScopedDocumentStore } from '@/lib/server/agent-runtime/owner-scoped-documents';
import { syncInteractiveLibraryForStage } from '@/lib/server/interactive-library';
import { repairInteractiveHtml } from '@/lib/interactive/repair-interactive-html';
import { createLogger } from '@/lib/logger';

const log = createLogger('DeriveCourse API');

export const runtime = 'nodejs';
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id: classroomId } = await params;

  return withRequestOwner(req, async (principal) => {
    let body: {
      materialId?: string;
      requirement?: string;
      courseTitle?: string;
      courseScale?: CourseScale;
      interactiveMode?: boolean;
      interactiveTheme?: InteractiveThemeStyle;
      slideTheme?: SlideThemeStyle;
      enableTTS?: boolean;
    };

    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { materialId, requirement } = body;
    if (!materialId || !requirement) {
      return new Response(
        JSON.stringify({ success: false, error: 'materialId and requirement are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const material = await getClassroomMaterial(materialId);
    if (!material) {
      return new Response(
        JSON.stringify({ success: false, error: 'Specified material was not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    try {
      await fs.access(material.filePath);
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Material file is not present on disk' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const ownerId = principal.ownerId || 'anon:derive';
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: Record<string, unknown>) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {
            /* ignore if connection was closed */
          }
        };

        try {
          // 1. 将课件文件挂载为所有者材料
          sendEvent({
            type: 'progress',
            step: 'initializing',
            progress: 10,
            message: `正在准备素材并解析 (${material.name})...`,
          });

          const ownerMaterialId = await createOwnerMaterialFromFile({
            ownerId,
            filePath: material.filePath,
            fileName: material.name,
            mimeType: material.mimeType,
            extract: true,
          });

          // 2. 组装提示词与规格指令
          const cleanFileName = material.name.replace(/\.[^/.]+$/, '');
          const finalTitle = body.courseTitle?.trim() || `${cleanFileName} (专题定制)`;
          const scaleInstruction = buildCourseScaleInstruction(
            body.courseScale || 'standard',
            !!body.interactiveMode,
          );
          const themeInstruction = buildThemeStyleInstruction(
            body.interactiveTheme || 'dark',
            body.slideTheme || 'light',
          );

          let fullRequirement = body.interactiveMode
            ? `【课程教学主题】：${finalTitle}\n【教学定制重点与要求】：\n${requirement}\n【教学交互规范】：必须启用深度互动模式（Interactive-First），全课必须生成不少于2~3个生动的高品质可交互场景（涵盖物理/科学过程仿真、动态沙盒、算法可视化或趣味闯关游戏，提供完备的 widgetType 与 widgetOutline），与理论精讲及阶段小测深度交替融合。`
            : `【课程教学主题】：${finalTitle}\n【教学定制重点与要求】：\n${requirement}`;

          if (scaleInstruction && !fullRequirement.includes('【课程篇幅与教学结构规范')) {
            fullRequirement += scaleInstruction;
          }
          if (themeInstruction && !fullRequirement.includes('【界面视觉风格强制规约')) {
            fullRequirement += themeInstruction;
          }

          // 3. 启动并等待服务端生成运行管线
          const { stageId } = await executeAndAwaitGenerationRun({
            ownerId,
            input: {
              requirement: fullRequirement,
              materialIds: [ownerMaterialId],
              interactive: !!body.interactiveMode,
              taskEngine: false,
              agents: { mode: 'auto' },
              outlineReview: 'auto',
            },
            onProgress: async (p) => {
              sendEvent({
                type: 'progress',
                step: p.step,
                progress: p.progress,
                message: p.message,
              });
            },
          });

          // 4. 若用户指定了自定义标题，则更新课程名称
          if (body.courseTitle?.trim()) {
            try {
              const store = await getOwnerScopedDocumentStore(ownerId);
              const doc = await store.loadDocument(stageId);
              if (doc) {
                doc.stage.name = body.courseTitle.trim();
                await store.saveDocument(doc);
              }
            } catch (renameErr) {
              log.warn(`Failed to update title for derived course ${stageId}:`, renameErr);
            }
          }

          // 5. 自动将原参考文件挂载并归档到新课程中
          sendEvent({
            type: 'progress',
            step: 'persisting',
            progress: 96,
            message: '正在关联原始参考素材到新课程...',
          });

          try {
            await archiveClassroomMaterial({
              classroomId: stageId,
              sourceFilePath: material.filePath,
              fileName: material.name,
              size: material.size,
              mimeType: material.mimeType,
              promptText: requirement,
              source: `derived_from:${classroomId}`,
            });
          } catch (archiveErr) {
            log.warn(`Failed to inherit material to derived course ${stageId}:`, archiveErr);
          }

          // 6. 清洗互动场景并同步组件库
          try {
            const store = await getOwnerScopedDocumentStore(ownerId);
            const doc = await store.loadDocument(stageId);
            if (doc) {
              let hasModifiedHtml = false;
              for (const scene of doc.scenes) {
                if (scene.type === 'interactive' && scene.content && typeof (scene.content as any).html === 'string') {
                  const { html: cleanHtml, appliedRepairs } = repairInteractiveHtml((scene.content as any).html);
                  if (appliedRepairs.length > 0) {
                    (scene.content as any).html = cleanHtml;
                    hasModifiedHtml = true;
                  }
                }
              }
              if (hasModifiedHtml) {
                try {
                  await store.saveDocument(doc);
                } catch (saveErr) {
                  log.warn(`Failed to save repaired document ${stageId}:`, saveErr);
                }
              }
              void syncInteractiveLibraryForStage(doc.stage, doc.scenes).catch((err) => {
                log.warn(`Failed to sync interactive library for derived course ${stageId}:`, err);
              });
            }
          } catch {
            /* ignore */
          }

          // 7. 发送完成事件
          sendEvent({
            type: 'complete',
            progress: 100,
            message: '全新衍生微课生成成功！',
            classroomId: stageId,
            url: `/classroom/${stageId}`,
            title: finalTitle,
          });
        } catch (err) {
          log.error('Derive course generation failed:', err);
          sendEvent({
            type: 'error',
            error: err instanceof Error ? err.message : String(err),
          });
        } finally {
          try {
            controller.close();
          } catch {
            /* ignore */
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  });
}
