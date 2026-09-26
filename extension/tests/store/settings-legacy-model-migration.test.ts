import { describe, expect, it } from 'vitest';
import { migrateLegacyModelIds, type SettingsState } from '@/lib/store/settings';

describe('migrateLegacyModelIds', () => {
  it('migrates main modelId from gemini-3.7-flash-high to gemini-3.8-flash-high', () => {
    const state: Partial<SettingsState> = {
      modelId: 'gemini-3.7-flash-high',
    };
    migrateLegacyModelIds(state);
    expect(state.modelId).toBe('gemini-3.8-flash-high');
  });

  it('migrates stage routes from gemini-3.7-flash-high to gemini-3.8-flash-high', () => {
    const state: Partial<SettingsState> = {
      llmStageRoutes: {
        'scene-content': { providerId: 'openai', modelId: 'gemini-3.7-flash-high' },
        'scene-actions': { providerId: 'openai', modelId: 'gemini-3.7-flash-high' },
        'quiz-grade': { providerId: 'openai', modelId: 'gpt-4o' },
      },
    };
    migrateLegacyModelIds(state);
    expect(state.llmStageRoutes?.['scene-content']?.modelId).toBe('gemini-3.8-flash-high');
    expect(state.llmStageRoutes?.['scene-actions']?.modelId).toBe('gemini-3.8-flash-high');
    expect(state.llmStageRoutes?.['quiz-grade']?.modelId).toBe('gpt-4o');
  });

  it('migrates provider models', () => {
    const state = {
      providersConfig: {
        openai: {
          apiKey: 'key',
          baseUrl: 'url',
          name: 'OpenAI',
          type: 'openai',
          requiresApiKey: true,
          isBuiltIn: true,
          models: [
            { id: 'gemini-3.7-flash-high', name: 'gemini-3.7-flash-high' },
            { id: 'other-model', name: 'Other Model' },
          ],
        },
      },
    } as unknown as Partial<SettingsState>;
    migrateLegacyModelIds(state);
    expect(state.providersConfig?.openai.models).toEqual([
      { id: 'gemini-3.8-flash-high', name: 'gemini-3.8-flash-high' },
      { id: 'other-model', name: 'Other Model' },
    ]);
  });

  it('migrates thinkingConfigs keys', () => {
    const state: Partial<SettingsState> = {
      thinkingConfigs: {
        'openai:gemini-3.7-flash-high': { enabled: true, level: 'high' },
        'openai:gpt-5': { enabled: false },
      },
    };
    migrateLegacyModelIds(state);
    expect(state.thinkingConfigs?.['openai:gemini-3.8-flash-high']).toEqual({
      enabled: true,
      level: 'high',
    });
    expect(state.thinkingConfigs?.['openai:gemini-3.7-flash-high']).toBeUndefined();
    expect(state.thinkingConfigs?.['openai:gpt-5']).toEqual({ enabled: false });
  });
});

describe('pruneInvalidStageRoutes', () => {
  it('dynamically prunes stage routes whose model is no longer available in the provider', async () => {
    const { pruneInvalidStageRoutes } = await import('@/lib/store/settings');
    const providersConfig = {
      openai: {
        models: [
          { id: 'gemini-4.0-flash', name: 'Gemini 4.0' },
          { id: 'claude-sonnet-4', name: 'Claude Sonnet 4' },
        ],
        enabled: true,
      },
    } as never;

    const routes = {
      'scene-content': { providerId: 'openai' as never, modelId: 'gemini-3.8-flash-high' }, // obsolete model
      'scene-actions': { providerId: 'openai' as never, modelId: 'gemini-4.0-flash' }, // valid model
      'maic-agent-driver': { providerId: 'openai' as never, modelId: 'gemini-4.0-flash' }, // operator only
    };

    const pruned = pruneInvalidStageRoutes(routes, providersConfig);
    expect(pruned).toEqual({
      'scene-actions': { providerId: 'openai', modelId: 'gemini-4.0-flash' },
    });
  });

  it('keeps valid routes and returns null when nothing changed', async () => {
    const { pruneInvalidStageRoutes } = await import('@/lib/store/settings');
    const providersConfig = {
      openai: {
        models: [{ id: 'gemini-4.0-flash', name: 'Gemini 4.0' }],
        enabled: true,
      },
    } as never;

    const routes = {
      'scene-actions': { providerId: 'openai' as never, modelId: 'gemini-4.0-flash' },
    };

    const pruned = pruneInvalidStageRoutes(routes, providersConfig);
    expect(pruned).toBeNull();
  });
});
