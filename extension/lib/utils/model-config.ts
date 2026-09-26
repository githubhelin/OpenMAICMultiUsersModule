import { useSettingsStore } from '@/lib/store/settings';
import { isLLMProviderConfigured } from '@/lib/store/settings-validation';
import {
  getThinkingConfigKey,
  normalizeThinkingConfig,
  supportsConfigurableThinking,
} from '@/lib/ai/thinking-config';
import { findModelById, modelIdsMatch } from '@/lib/ai/model-aliases';
import { getCatalogThinkingCapability } from '@/lib/ai/model-metadata';

/**
 * Get current model configuration from settings store
 */
export function getCurrentModelConfig() {
  const { providerId, modelId, providersConfig, thinkingConfigs } = useSettingsStore.getState();
  const providerConfig = providersConfig[providerId];
  const availableModels = providerConfig?.models ?? [];
  const effectiveModelId =
    availableModels.length > 0 &&
    !availableModels.some((m) => m.id === modelId || modelIdsMatch(providerId, m.id, modelId))
      ? availableModels[0]?.id || modelId
      : modelId;
  const modelString = `${providerId}:${effectiveModelId}`;

  // Get current provider's config
  const modelInfo = findModelById(providerId, providerConfig?.models, effectiveModelId);
  const thinking =
    modelInfo?.capabilities?.thinking ?? getCatalogThinkingCapability(providerId, effectiveModelId);
  const thinkingConfig = supportsConfigurableThinking(thinking)
    ? normalizeThinkingConfig(
        thinking,
        thinkingConfigs[getThinkingConfigKey(providerId, effectiveModelId)],
      )
    : undefined;

  return {
    providerId,
    modelId: effectiveModelId,
    modelString,
    apiKey: providerConfig?.apiKey || '',
    baseUrl: providerConfig?.baseUrl || '',
    providerType: providerConfig?.type,
    requiresApiKey: providerConfig?.requiresApiKey,
    isServerConfigured: providerConfig?.isServerConfigured,
    thinkingConfig,
  };
}

/**
 * Serialize the user's per-stage LLM routes (settings store `llmStageRoutes`)
 * for the `x-model-routes` header, or `undefined` when no stage is routed.
 *
 * Each entry carries the routed provider's own connection params so the server
 * can build the model even when it differs from the main model's provider;
 * server-managed providers ignore the client credentials regardless.
 * Precedence server-side: operator MODEL_ROUTES > these routes > x-model.
 */
export function getStageRoutesHeaderValue(): string | undefined {
  const { llmStageRoutes, providersConfig } = useSettingsStore.getState();
  const entries = Object.entries(llmStageRoutes);
  if (entries.length === 0) return undefined;
  const routes: Record<string, unknown> = {};
  for (const [stage, selection] of entries) {
    const config = providersConfig[selection.providerId];
    // Belt for routes persisted before write-time pruning existed, and for
    // providers disabled/de-credentiailed through paths that bypass the store:
    // a route onto an unusable provider would make the server fail that stage
    // instead of falling back to the main model, so it is dropped here.
    if (!config || config.enabled === false || !isLLMProviderConfigured(config)) continue;

    // Check if the selected model still exists in available models for this provider
    const availableModels = config.models ?? [];
    if (availableModels.length > 0) {
      const isModelValid = availableModels.some(
        (m) =>
          m.id === selection.modelId ||
          modelIdsMatch(selection.providerId, m.id, selection.modelId),
      );
      if (!isModelValid) continue; // Model is obsolete or no longer exists; skip sending stale route!
    }

    routes[stage] = {
      model: `${selection.providerId}:${selection.modelId}`,
      apiKey: config?.apiKey || undefined,
      baseUrl: config?.baseUrl || undefined,
      providerType: config?.type,
      thinking: selection.thinking ?? undefined,
    };
  }
  if (Object.keys(routes).length === 0) return undefined;
  return JSON.stringify(routes);
}
