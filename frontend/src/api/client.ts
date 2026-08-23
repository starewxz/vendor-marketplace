import axios from 'axios';
import { env } from '../config/env';
import { getAccessToken } from '../features/auth/token-storage';

/**
 * Single Axios instance for the whole app. Every request gets a fresh
 * correlation ID so it can be traced through backend logs (see backend's
 * CorrelationIdMiddleware), and the auth token — once Stage 2 issues one —
 * is attached automatically here rather than at each call site.
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
