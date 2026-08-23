import { isAxiosError } from 'axios';
import type { ApiErrorBody } from './client';

/** Extracts a user-displayable message from the backend's centralized error shape. */
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (isAxiosError<ApiErrorBody>(error) && error.response?.data) {
    const { message } = error.response.data;
    return Array.isArray(message) ? message.join(', ') : message;
  }
  return fallback;
}
