import { useAuthStore } from '../store/auth';
import { ApiError, type ApiErrorBody } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean; // defaults to true
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = useAuthStore.getState().token;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json() : undefined;

  if (!res.ok) {
    if (res.status === 401 && auth) {
      // Expired/invalid token — force back to login.
      useAuthStore.getState().clearAuth();
    }
    const errorBody: ApiErrorBody = payload ?? {
      error: 'UNKNOWN_ERROR',
      message: `Request failed with status ${res.status}`,
    };
    throw new ApiError(res.status, errorBody);
  }

  return payload as T;
}
