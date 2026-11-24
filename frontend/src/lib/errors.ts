/**
 * The API's error envelope is `{ success: false, error }` (see docs/API.md).
 * Axios wraps it in `response.data`; narrowing here keeps `any` out of UI code
 * and makes sure a failure always produces a message the user can read.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null || !('response' in error)) return fallback;

  const response = (error as { response?: unknown }).response;
  if (typeof response !== 'object' || response === null || !('data' in response)) return fallback;

  const data = (response as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null || !('error' in data)) return fallback;

  const message = (data as { error?: unknown }).error;
  return typeof message === 'string' && message.trim() !== '' ? message : fallback;
}
