export interface Category {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}
