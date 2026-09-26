import { NextRequest, NextResponse } from 'next/server';
import { getInteractiveHtmlFile } from '@/lib/server/interactive-library';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ stageId: string; filename: string }> },
) {
  const { stageId, filename } = await context.params;
  const decodedFilename = decodeURIComponent(filename);

  const result = await getInteractiveHtmlFile(stageId, decodedFilename);
  if (!result) {
    return new NextResponse('Interactive game file not found', { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const isDownload = searchParams.get('download') === '1';

  const headers = new Headers();
  headers.set('Content-Type', 'text/html; charset=utf-8');

  if (isDownload) {
    const downloadName = encodeURIComponent(`${result.title}.html`);
    headers.set('Content-Disposition', `attachment; filename*=UTF-8''${downloadName}`);
  } else {
    headers.set('Content-Disposition', 'inline');
    headers.set('X-Frame-Options', 'SAMEORIGIN');
  }

  return new NextResponse(result.html, {
    status: 200,
    headers,
  });
}
