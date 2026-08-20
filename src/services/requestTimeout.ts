const DEFAULT_REQUEST_TIMEOUT_MS = 45_000;

export type RequestScope = {
  signal: AbortSignal;
  didTimeout: () => boolean;
  dispose: () => void;
};

export function createRequestScope(
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  externalSignal?: AbortSignal
): RequestScope {
  const controller = new AbortController();
  let timedOut = false;
  const onExternalAbort = () => controller.abort();
  if (externalSignal?.aborted) controller.abort();
  else externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    dispose: () => {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    },
  };
}

export function normalizeRequestError(error: unknown, scope: RequestScope): Error {
  if (scope.didTimeout()) return new Error('请求超时，请检查网络后重试。');
  if (error instanceof Error && error.name === 'AbortError') return new Error('请求已取消。');
  return error instanceof Error ? error : new Error('网络请求失败');
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
): Promise<Response> {
  const scope = createRequestScope(timeoutMs, init.signal ?? undefined);
  try {
    return await fetch(input, { ...init, signal: scope.signal });
  } catch (error) {
    throw normalizeRequestError(error, scope);
  } finally {
    scope.dispose();
  }
}
