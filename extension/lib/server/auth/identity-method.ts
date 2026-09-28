import type {
  OwnerAuthMethod,
  OwnerAuthMethodResult,
  OwnerAuthRequest,
  StoredOwnerDescription,
} from '@/lib/server/identity/types';
import type { LibraryProvider, LibraryListContext } from '@/lib/server/persistence-hooks/types';
import { getSessionPayload } from './session';

/**
 * Multi-user session auth method plugged into OpenMAIC's Owner Identity Seam.
 * Authenticates requests carrying an `openmaic_session` cookie into `user:<userId>`.
 */
export const userSessionAuthMethod: OwnerAuthMethod = {
  name: 'user-session',
  async authenticate(req: OwnerAuthRequest): Promise<OwnerAuthMethodResult> {
    try {
      const payload = getSessionPayload({ headers: req.headers });
      if (!payload || !payload.userId) {
        return { status: 'not-applicable' };
      }
      return {
        status: 'authenticated',
        principal: {
          ownerId: `user:${payload.userId}`,
          kind: 'user',
          roles: new Set(payload.role ? [payload.role] : ['user']),
          assurance: 'verified',
        },
      };
    } catch {
      return { status: 'not-applicable' };
    }
  },
  describeStoredOwner(ownerId: string): StoredOwnerDescription | undefined {
    if (ownerId.startsWith('user:')) {
      return { kind: 'user' };
    }
    return undefined;
  },
};

/**
 * Multi-user library provider plugged into OpenMAIC's PersistenceHooks.
 * Admin principals can view all non-deleted courses in the system library;
 * standard users view their own courses.
 */
export const multiUserLibraryProvider: LibraryProvider = {
  name: 'multi-user-library-provider',
  async list({ principal, queryable, ownedStageIds }: LibraryListContext): Promise<readonly string[]> {
    if (principal.roles.has('admin')) {
      try {
        const res = await queryable.query<{ id: string }>(
          `SELECT stages.id FROM document_stages AS stages
           JOIN stage_meta AS meta ON meta.stage_id = stages.id
           WHERE meta.deleted_at IS NULL
           ORDER BY stages.updated_at DESC`,
        );
        return res.rows.map((row) => row.id);
      } catch {
        return ownedStageIds();
      }
    }
    return ownedStageIds();
  },
};
