import type { Meta, StoryObj } from '@storybook/react-vite';
import { ProductImage } from './ProductImage';

const meta: Meta<typeof ProductImage> = {
  title: 'UI/ProductImage',
  component: ProductImage,
  decorators: [(Story) => <div style={{ width: 220, height: 220 }}><Story /></div>],
};
export default meta;

type Story = StoryObj<typeof ProductImage>;

export const Uploaded: Story = {
  args: {
    product: {
      id: '1',
      name: 'Seller-uploaded product',
      imageUrls: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=480&q=65&auto=format&fit=crop'],
    },
  },
};

export const DemoMatchByName: Story = {
  args: { product: { id: '2', name: 'iPhone 15 Pro', imageUrls: [] } },
};

export const DemoMatchByCategory: Story = {
  args: { product: { id: '3', name: 'Mystery gadget', categoryName: 'Electronics', imageUrls: [] } },
};

export const BrandedFallback: Story = {
  args: { product: { id: '4', name: 'Unrecognized item', imageUrls: [] } },
};

export const Hero: Story = {
  args: { product: { id: '5', name: 'Running Sneakers', imageUrls: [] }, variant: 'hero' },
  decorators: [(Story) => <div style={{ width: 420, height: 420 }}><Story /></div>],
};
