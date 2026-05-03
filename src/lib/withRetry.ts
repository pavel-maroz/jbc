export interface WithRetryOptions {
  signal: AbortSignal;
  maxAttempts: number;
  onAttempt?: (attempt: number) => void;
  onError?: (attempt: number, error: Error) => void;
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/**
 * Run an async operation with retries.
 *
 * - Retries up to `maxAttempts` times. The first attempt counts.
 * - Aborts via `signal` are propagated immediately and never retried.
 * - `onAttempt` fires before each attempt, `onError` fires after each
 *   failed attempt (including the last one). Both are optional and used
 *   by the caller to log into operation history.
 * - Re-throws the last error after all attempts are exhausted.
 */
export async function withRetry<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  opts: WithRetryOptions,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    if (opts.signal.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    opts.onAttempt?.(attempt);

    try {
      return await fn(opts.signal);
    } catch (err) {
      if (isAbortError(err)) throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
      opts.onError?.(attempt, lastError);
    }
  }

  throw lastError ?? new Error("withRetry: exhausted without error");
}
