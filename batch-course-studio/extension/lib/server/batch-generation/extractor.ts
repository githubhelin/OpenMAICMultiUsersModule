import { promises as fs } from 'fs';
import { parsePptxIsolated } from '@/lib/server/agent-runtime/import-pptx';
import { extractDocument, documentArtifactToParsedPdfContent } from '@/lib/document';
import { normalizeDocumentMimeType } from '@/lib/document/mime';
import { createLogger } from '@/lib/logger';
import type { Slide } from '@openmaic/dsl';

const log = createLogger('BatchExtractor');

export interface ExtractedContent {
  text: string;
  images: string[];
  title?: string;
  slideCount?: number;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function extractFromPptxSlides(slides: Slide[]): ExtractedContent {
  const textParts: string[] = [];
  const images: string[] = [];
  let firstTitle = '';

  slides.forEach((slide, index) => {
    const slideNumber = index + 1;
    let slideTitle = `第 ${slideNumber} 页`;
    const bodyTexts: string[] = [];

    for (const elem of slide.elements ?? []) {
      const rec = elem as {
        type?: string;
        content?: string;
        text?: { content?: string };
        src?: string;
      };

      if (rec.type === 'text' && rec.content) {
        const clean = stripHtml(rec.content);
        if (clean) {
          if (!firstTitle) firstTitle = clean;
          bodyTexts.push(clean);
        }
      } else if (rec.type === 'shape' && rec.text?.content) {
        const clean = stripHtml(rec.text.content);
        if (clean) bodyTexts.push(clean);
      } else if (rec.type === 'image' && rec.src && typeof rec.src === 'string') {
        if (rec.src.startsWith('data:image/') || rec.src.startsWith('http')) {
          images.push(rec.src);
        }
      }
    }

    if (bodyTexts.length > 0) {
      slideTitle = bodyTexts[0].slice(0, 50);
    }

    let slideBlock = `### 幻灯片 ${slideNumber}: ${slideTitle}\n${bodyTexts.join('\n')}`;
    if (slide.script) {
      slideBlock += `\n**讲师旁白与讲解脚本**：\n${slide.script.trim()}`;
    }
    textParts.push(slideBlock);
  });

  return {
    text: textParts.join('\n\n---\n\n'),
    images: images.slice(0, 15),
    title: firstTitle || undefined,
    slideCount: slides.length,
  };
}

export async function extractFileContent(
  filePath: string,
  fileName: string,
  declaredMime?: string,
): Promise<ExtractedContent> {
  const buffer = await fs.readFile(filePath);
  const ext = fileName.toLowerCase().split('.').pop() || '';
  const mimeType = normalizeDocumentMimeType({ fileName, mimeType: declaredMime });

  log.info(`Extracting content for ${fileName} [ext=${ext}, mime=${mimeType}, size=${buffer.length} bytes]`);

  // 1. PPTX 文件处理（原汁原味抽取每一页与批注讲解）
  if (ext === 'pptx' || mimeType.includes('presentationml')) {
    try {
      const slides = await parsePptxIsolated(buffer.buffer);
      if (slides && slides.length > 0) {
        log.info(`Parsed ${slides.length} slides from PPTX: ${fileName}`);
        return extractFromPptxSlides(slides);
      }
    } catch (err) {
      log.warn(`Isolated PPTX parse failed for ${fileName}, attempting fallback document extractor:`, err);
    }
  }

  // 2. 纯文本 / Markdown
  if (ext === 'txt' || ext === 'md' || mimeType.startsWith('text/')) {
    const text = buffer.toString('utf-8');
    return {
      text,
      images: [],
      title: fileName.replace(/\.[^/.]+$/, ''),
    };
  }

  // 3. PDF / DOCX 等利用 OpenMAIC 的底层提取器（自动使用 MinerU / AliDocMind）
  try {
    const artifact = await extractDocument({
      buffer,
      fileName,
      mimeType,
      config: {
        providerId: '',
        allowEnvFallback: true,
      },
    });

    const parsed = documentArtifactToParsedPdfContent(artifact);
    const text = parsed.text || '';
    const images = (parsed.images || []).slice(0, 15);

    log.info(`Document extracted successfully: ${fileName} (${text.length} chars, ${images.length} images)`);

    return {
      text,
      images,
      title: fileName.replace(/\.[^/.]+$/, ''),
    };
  } catch (err) {
    log.error(`Document extraction failed for ${fileName}:`, err);
    // 即使高级解析失败，若含有可读文本，做兜底容灾
    const rawText = buffer.toString('utf-8').replace(/[^\x20-\x7E\u4e00-\u9fa5\n\r\t]/g, '');
    if (rawText.length > 100) {
      return {
        text: rawText.slice(0, 20000),
        images: [],
        title: fileName.replace(/\.[^/.]+$/, ''),
      };
    }
    throw new Error(`无法解析课件文件 "${fileName}": ${err instanceof Error ? err.message : String(err)}`);
  }
}
