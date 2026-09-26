import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/server/api-response';
import {
  listInteractiveLibrary,
  backfillInteractiveLibrary,
} from '@/lib/server/interactive-library';
import { createLogger } from '@/lib/logger';

const log = createLogger('InteractiveLibraryAPI');

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const force = searchParams.get('force') === '1';
    if (searchParams.get('backfill') === '1' || searchParams.get('refresh') === '1' || force) {
      const count = await backfillInteractiveLibrary({ force });
      log.info(`Manual sync/backfill executed, processed ${count} items`);
    }

    const overview = await listInteractiveLibrary();
    return apiSuccess({
      courses: overview.courses,
      totalItems: overview.totalItems,
      typeCounts: overview.typeCounts,
      data: {
        courses: overview.courses,
        totalItems: overview.totalItems,
        typeCounts: overview.typeCounts,
      },
    });
  } catch (error) {
    log.error('Failed to get interactive library:', error);
    return apiError('INTERNAL_ERROR', 500, 'Failed to fetch interactive library');
  }
}

export async function POST(req: NextRequest) {
  try {
    let force = false;
    try {
      const body = await req.json();
      force = Boolean(body?.force);
    } catch {
      // Body may be empty
    }

    log.info(`Interactive library sync requested (force=${force})`);
    const count = await backfillInteractiveLibrary({ force });
    const overview = await listInteractiveLibrary();
    return apiSuccess({
      processed: count,
      courses: overview.courses,
      totalItems: overview.totalItems,
      typeCounts: overview.typeCounts,
      data: {
        courses: overview.courses,
        totalItems: overview.totalItems,
        typeCounts: overview.typeCounts,
      },
    });
  } catch (error) {
    log.error('Failed to sync interactive library:', error);
    return apiError('INTERNAL_ERROR', 500, 'Failed to sync interactive library');
  }
}
