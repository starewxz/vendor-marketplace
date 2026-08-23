export const PRODUCTS_INDEX = 'products';

export const PRODUCTS_INDEX_SETTINGS = {
  searchableAttributes: ['name', 'description', 'sellerName', 'categoryName'],
  filterableAttributes: [
    'categoryId',
    'sellerId',
    'price',
    'rating',
    'available',
    'productType',
  ],
  sortableAttributes: ['price', 'createdAt', 'rating'],
};
