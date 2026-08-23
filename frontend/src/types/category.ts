export interface Category {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface CategoryFormInput {
  name: string;
  iconUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
}
