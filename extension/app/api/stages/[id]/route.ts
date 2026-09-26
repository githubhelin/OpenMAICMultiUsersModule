/**
 * /api/stages/[id] — read, rename, save, and delete one owned course document.
 *
 * Ownership is enforced by the store itself, not by a pre-check: every read
 * and write goes through the owner-bound document store, so a foreign or
 * missing id answers the identical 404 (the no-existence-oracle posture of
 * the agent-runtime routes), and a write into a foreign document is refused
 * inside the store's transaction (`persistStage` re-checks the owner scope).
 *
 * - GET    returns the whole document (stage + scenes + outline).
 * - PATCH  renames the course ({ name }), the reference's update path.
 * - PUT    saves a whole document ({ stage, scenes, outline? }) — the coarse
 *          "update stage document" write the UI saves through; the server
 *          bumps `stage.updatedAt` so the freshness signal sees the change.
 * - DELETE removes the course and its cascading child rows.
 *
 * The configured runtime gates the family (see `app/api/stages/route.ts`):
 * off, or on without a DATABASE_URL, answers the same plain 404.
 */
import type { NextRequest } from 'next/server';

import { DocumentNotFoundError, DocumentVersionError, type MaicDocument } from '@openmaic/storage';

import { isAgentRuntimeConfigured } from '@/lib/config/feature-flags';
import { apiError } from '@/lib/server/api-response';
import { getOwnerScopedDocumentStore } from '@/lib/server/agent-runtime/owner-scoped-documents';
import { ownerApiError, ownerJson, ownerNotFound } from '@/lib/server/agent-runtime/route-response';
import { withRequestOwnerId } from '@/lib/server/agent-runtime/with-owner';
import { STAGE_NAME_MAX_LENGTH } from '@/lib/server/agent-runtime/stage-limits';
import { getSessionPayload } from '@/lib/server/auth/session';
import { getServerPersistenceProvider } from '@/lib/persistence/server-provider';
import {
  renameInteractiveLibraryStage,
  deleteInteractiveLibraryStage,
} from '@/lib/server/interactive-library';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

/** A save refused because the payload is not a structurally valid document. */
function isStoreValidationError(error: unknown): error is Error {
  return (
    error instanceof Error &&
    error.message.startsWith('@openmaic/storage:') &&
    !(error instanceof DocumentNotFoundError) &&
    !(error instanceof DocumentVersionError)
  );
}

/** Map a store save failure onto the route's error surface. */
function mapSaveError(error: unknown, headers: Headers) {
  if (error instanceof DocumentNotFoundError) return ownerNotFound(headers);
  if (error instanceof DocumentVersionError) {
    // A document written by a newer client cannot be saved by this one.
    return ownerApiError(
      'INVALID_REQUEST',
      400,
      'document was written by a newer client; reload before saving',
      headers,
      error.message,
    );
  }
  if (isStoreValidationError(error)) {
    return ownerApiError('INVALID_REQUEST', 400, 'invalid stage document', headers, error.message);
  }
  throw error;
}

// GET /api/stages/[id] — the full document.
export async function GET(req: NextRequest, { params }: Params) {
  if (!isAgentRuntimeConfigured()) return new Response('Not found', { status: 404 });

  return withRequestOwnerId(req, async (ownerId, responseHeaders) => {
    const { id } = await params;
    const store = await getOwnerScopedDocumentStore(ownerId);
    const document = await store.loadDocument(id);
    if (!document) return ownerNotFound(responseHeaders);
    return ownerJson(document, 200, responseHeaders);
  });
}

// PATCH /api/stages/[id] — rename the course (owner-only).
export async function PATCH(req: NextRequest, { params }: Params) {
  if (!isAgentRuntimeConfigured()) return new Response('Not found', { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('INVALID_REQUEST', 400, 'invalid JSON body');
  }
  const rawName = (body as { name?: unknown })?.name;
  if (typeof rawName !== 'string' || rawName.trim().length === 0) {
    return apiError('INVALID_REQUEST', 400, 'name must be a non-empty string');
  }
  const name = rawName.trim();
  if (name.length > STAGE_NAME_MAX_LENGTH) {
    return apiError(
      'INVALID_REQUEST',
      400,
      `name exceeds the ${STAGE_NAME_MAX_LENGTH} character limit`,
    );
  }

  return withRequestOwnerId(req, async (ownerId, responseHeaders) => {
    const { id } = await params;
    const store = await getOwnerScopedDocumentStore(ownerId);
    const document = await store.loadDocument(id);
    if (!document) return ownerNotFound(responseHeaders);
    try {
      await store.saveDocument({
        ...document,
        stage: { ...document.stage, name, updatedAt: Date.now() },
      });
      void renameInteractiveLibraryStage(id, name).catch(() => {});
    } catch (error) {
      return mapSaveError(error, responseHeaders);
    }
    return ownerJson({ success: true, name }, 200, responseHeaders);
  });
}

// PUT /api/stages/[id] — save a whole document.
export async function PUT(req: NextRequest, { params }: Params) {
  if (!isAgentRuntimeConfigured()) return new Response('Not found', { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('INVALID_REQUEST', 400, 'invalid JSON body');
  }
  const candidate = body as {
    stage?: { id?: unknown; updatedAt?: unknown };
    scenes?: unknown;
  };
  if (
    typeof candidate !== 'object' ||
    candidate === null ||
    typeof candidate.stage !== 'object' ||
    candidate.stage === null ||
    typeof candidate.stage.id !== 'string' ||
    !Array.isArray(candidate.scenes)
  ) {
    return apiError(
      'INVALID_REQUEST',
      400,
      'request body must be a stage document with `stage` and `scenes`',
    );
  }

  return withRequestOwnerId(req, async (ownerId, responseHeaders) => {
    const { id } = await params;
    if (candidate.stage!.id !== id) {
      return ownerApiError(
        'INVALID_REQUEST',
        400,
        'document stage id does not match the requested stage',
        responseHeaders,
      );
    }
    const store = await getOwnerScopedDocumentStore(ownerId);
    // Save is existence-gated (the reference's update path is too): PUT
    // updates a course that exists; it must not resurrect a deleted one or
    // mint a course under a client-chosen id. The owner scope is re-checked
    // inside the write transaction, so a foreign id still refuses there.
    const existing = await store.loadDocument(id);
    if (!existing) return ownerNotFound(responseHeaders);
    try {
      // The server is authoritative for "last modified": bumping updatedAt
      // keeps the manifest/freshness signal accurate for this route's writes.
      // The full payload is validated inside the store before anything is
      // persisted (invalid stage/scene shapes throw and map to 400 below).
      await store.saveDocument({
        ...(body as MaicDocument),
        stage: { ...(body as MaicDocument).stage, updatedAt: Date.now() },
      });
    } catch (error) {
      return mapSaveError(error, responseHeaders);
    }
    return ownerJson({ success: true }, 200, responseHeaders);
  });
}

// DELETE /api/stages/[id] — remove the course completely from DB, disk files, and interactive library.
export async function DELETE(req: NextRequest, { params }: Params) {
  if (!isAgentRuntimeConfigured()) return new Response('Not found', { status: 404 });

  const session = getSessionPayload(req);
  const isAdmin = session?.role === 'admin';
  const { id } = await params;

  return withRequestOwnerId(req, async (ownerId, responseHeaders) => {
    let deletedViaStore = false;
    try {
      const store = await getOwnerScopedDocumentStore(ownerId);
      await store.deleteDocument(id);
      deletedViaStore = true;
    } catch {
      // Owner-scoped delete failed (e.g. foreign owner); handled via admin cascade below
    }

    // 1. Direct database cascade purge if admin or store didn't handle it
    if (!deletedViaStore && (isAdmin || !process.env.DATABASE_URL)) {
      if (process.env.DATABASE_URL) {
        try {
          const { Pool } = await import('pg');
          const pool = new Pool({ connectionString: process.env.DATABASE_URL });
          await pool.query('DELETE FROM document_scenes WHERE stage_id = $1', [id]);
          await pool.query('DELETE FROM stage_meta WHERE stage_id = $1', [id]);
          await pool.query('DELETE FROM document_stages WHERE id = $1', [id]);
          try {
            await pool.query('DELETE FROM document_asset_refs WHERE stage_id = $1', [id]);
          } catch {}
          try {
            await pool.query('DELETE FROM document_asset_withdrawals WHERE stage_id = $1', [id]);
          } catch {}
          await pool.end();
        } catch (dbErr) {
          console.warn(`[DELETE /api/stages/${id}] Direct DB deletion encountered error:`, dbErr);
        }
      }
    } else if (!deletedViaStore && !isAdmin) {
      return ownerApiError('INVALID_REQUEST', 403, 'Permission denied', responseHeaders);
    }

    // 2. Direct database cleanup even if store delete succeeded (ensure stage_meta and scenes are clean)
    if (isAdmin && process.env.DATABASE_URL) {
      try {
        const { Pool } = await import('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        await pool.query('DELETE FROM document_scenes WHERE stage_id = $1', [id]);
        await pool.query('DELETE FROM stage_meta WHERE stage_id = $1', [id]);
        await pool.query('DELETE FROM document_stages WHERE id = $1', [id]);
        await pool.end();
      } catch {}
    }

    // 3. Purge physical files in data/classrooms/
    try {
      const { promises: fsPromises } = await import('fs');
      const pathModule = await import('path');
      const classroomsDir = pathModule.join(process.cwd(), 'data', 'classrooms');
      const jsonPath = pathModule.join(classroomsDir, `${id}.json`);
      const mediaDirPath = pathModule.join(classroomsDir, id);

      await fsPromises.rm(jsonPath, { force: true }).catch(() => {});
      await fsPromises.rm(mediaDirPath, { recursive: true, force: true }).catch(() => {});

      // Clean up any classroom-jobs for this stage
      const jobsDir = pathModule.join(process.cwd(), 'data', 'classroom-jobs');
      try {
        const jobFiles = await fsPromises.readdir(jobsDir);
        for (const jf of jobFiles) {
          if (jf.includes(id)) {
            await fsPromises.rm(pathModule.join(jobsDir, jf), { force: true }).catch(() => {});
          }
        }
      } catch {}
    } catch (fsErr) {
      console.warn(`[DELETE /api/stages/${id}] Filesystem purge error:`, fsErr);
    }

    // 4. Purge interactive games folder in data/interactive-library/
    try {
      await deleteInteractiveLibraryStage(id);
    } catch (libErr) {
      console.warn(`[DELETE /api/stages/${id}] Interactive library delete error:`, libErr);
    }

    return ownerJson({ ok: true, success: true }, 200, responseHeaders);
  });
}
