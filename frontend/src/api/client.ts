import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { env } from '../config/env';
import { getAccessToken, setAccessToken } from '../features/auth/token-storage';
import type { AuthResponse } from '../types/user';

/**
 * Single Axios instance for the whole app. Every request gets a fresh
 * correlation ID so it can be traced through backend logs, and the
 * in-memory access token is attached automatically here rather than at
 * each call site. `withCredentials` is required so the httpOnly refresh
 * cookie rides along on every request.
 */
export const apiClient = axios.create({
  baseURL: env.apiUrl,
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  config.headers['x-correlation-id'] = crypto.randomUUID();

  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  correlationId: string;
}

type RetriableRequestConfig = InternalAxiosRequestConfig & { _retried?: boolean };

const REFRESH_URL = '/auth/refresh';

// A single in-flight refresh is shared by every request that hits a 401 at
// the same time, so a burst of concurrent requests doesn't fire a burst of
// concurrent refresh calls (each of which would rotate the token and race
// the others out).
let refreshPromise: Promise<string> | null = null;

function refreshAccessToken(): Promise<string> {
  refreshPromise ??= apiClient
    .post<AuthResponse>(REFRESH_URL)
    .then((res) => {
      setAccessToken(res.data.accessToken);
      return res.data.accessToken;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;

    const isUnauthorized = error.response?.status === 401;
    const isRefreshCall = originalRequest?.url === REFRESH_URL;

    // Never retry the refresh endpoint itself — that's the infinite-loop
    // trap. A failed refresh means the session is genuinely over.
    if (!isUnauthorized || isRefreshCall || !originalRequest || originalRequest._retried) {
      if (isUnauthorized) {
        setAccessToken(null);
      }
      return Promise.reject(error);
    }

    originalRequest._retried = true;
    try {
      const newToken = await refreshAccessToken();
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      setAccessToken(null);
      return Promise.reject(refreshError);
    }
  },
);
