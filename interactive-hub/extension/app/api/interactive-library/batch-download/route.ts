import { NextRequest, NextResponse } from 'next/server';
import {
  createInteractiveZipArchive,
  listInteractiveLibrary,
  type BatchDownloadItem,
} from '@/lib/server/interactive-library';
import { createLogger } from '@/lib/logger';

const log = createLogger('InteractiveBatchDownloadAPI');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let items: BatchDownloadItem[] = Array.isArray(body?.items) ? body.items : [];
    const stageId = typeof body?.stageId === 'string' ? body.stageId.trim() : undefined;
    const archiveName = typeof body?.archiveName === 'string' ? body.archiveName.trim() : undefined;

    // If stageId is provided but items is empty, fetch all items for this stage
    if (items.length === 0 && stageId) {
      const overview = await listInteractiveLibrary();
      const course = overview.courses.find((c) => c.stageId === stageId);
      if (course && course.items.length > 0) {
        items = course.items.map((it) => ({
          stageId: course.stageId,
          fileName: it.fileName,
          courseName: course.courseName,
          title: it.title,
        }));
      }
    }

    if (items.length === 0) {
      return NextResponse.json(
        { success: false, error: '未提供待下载的互动项目或指定课程暂无互动内容' },
        { status: 400 },
      );
    }

    log.info(`Batch download requested for ${items.length} items`);
    const zipResult = await createInteractiveZipArchive(items, archiveName);

    if (!zipResult || zipResult.count === 0) {
      return NextResponse.json(
        { success: false, error: '未能找到待下载的有效互动应用文件' },
        { status: 404 },
      );
    }

    const { buffer, filename, count } = zipResult;
    log.info(`Successfully packed ${count} items into ${filename} (${buffer.length} bytes)`);

    const encodedFilename = encodeURIComponent(filename);
    const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_');

    const headers = new Headers();
    headers.set('Content-Type', 'application/zip');
    headers.set(
      'Content-Disposition',
      `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedFilename}`,
    );
    headers.set('Content-Length', String(buffer.length));
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers,
    });
  } catch (error) {
    log.error('Batch download failed:', error);
    return NextResponse.json(
      { success: false, error: '打包批量下载失败，请稍后重试' },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const stageId = searchParams.get('stageId');
    const archiveName = searchParams.get('name') || undefined;

    if (!stageId) {
      return NextResponse.json(
        { success: false, error: '缺少 stageId 课程参数' },
        { status: 400 },
      );
    }

    const overview = await listInteractiveLibrary();
    const course = overview.courses.find((c) => c.stageId === stageId);
    if (!course || course.items.length === 0) {
      return NextResponse.json(
        { success: false, error: '指定课程暂无互动组件' },
        { status: 404 },
      );
    }

    const items: BatchDownloadItem[] = course.items.map((it) => ({
      stageId: course.stageId,
      fileName: it.fileName,
      courseName: course.courseName,
      title: it.title,
    }));

    const zipResult = await createInteractiveZipArchive(
      items,
      archiveName || course.courseName,
    );

    if (!zipResult) {
      return NextResponse.json(
        { success: false, error: '未能找到有效互动应用文件' },
        { status: 404 },
      );
    }

    const { buffer, filename } = zipResult;
    const encodedFilename = encodeURIComponent(filename);
    const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_');

    const headers = new Headers();
    headers.set('Content-Type', 'application/zip');
    headers.set(
      'Content-Disposition',
      `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedFilename}`,
    );
    headers.set('Content-Length', String(buffer.length));

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers,
    });
  } catch (error) {
    log.error('GET Batch download failed:', error);
    return NextResponse.json(
      { success: false, error: '打包下载失败' },
      { status: 500 },
    );
  }
}
