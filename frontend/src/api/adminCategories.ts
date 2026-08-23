import { apiClient } from './client';
import type { Category, CategoryFormInput } from '../types/category';

export async function createCategory(input: CategoryFormInput): Promise<Category> {
  const { data } = await apiClient.post<Category>('/admin/categories', input);
  return data;
}

export async function updateCategory(id: string, input: Partial<CategoryFormInput>): Promise<Category> {
  const { data } = await apiClient.patch<Category>(`/admin/categories/${id}`, input);
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  await apiClient.delete(`/admin/categories/${id}`);
}
