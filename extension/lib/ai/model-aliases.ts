const MODEL_ID_ALIASES: ReadonlyMap<string, string> = new Map([
  ['openai:gpt-5.6-sol', 'gpt-5.6'],
  ['openai:gemini-3.7-flash-high', 'gemini-3.8-flash-high'],
  ['google:gemini-3.7-flash-high', 'gemini-3.8-flash-high'],
  ['unknown:gemini-3.7-flash-high', 'gemini-3.8-flash-high'],
]);

/** Resolve aliases used for local catalog, settings, capability, and usage lookups. */
export function getCanonicalModelId(providerId: string, modelId: string): string {
  if (modelId === 'gemini-3.7-flash-high') {
    return 'gemini-3.8-flash-high';
  }
  return MODEL_ID_ALIASES.get(`${providerId}:${modelId}`) ?? modelId;
}

export function modelIdsMatch(providerId: string, left: string, right: string): boolean {
  return getCanonicalModelId(providerId, left) === getCanonicalModelId(providerId, right);
}

/** Find a model using canonical IDs without changing the model ID sent on the wire. */
export function findModelById<T extends { id: string }>(
  providerId: string,
  models: readonly T[] | undefined,
  modelId: string,
): T | undefined {
  const canonicalModelId = getCanonicalModelId(providerId, modelId);
  return (
    models?.find((model) => model.id === canonicalModelId) ??
    models?.find((model) => modelIdsMatch(providerId, model.id, modelId))
  );
}
