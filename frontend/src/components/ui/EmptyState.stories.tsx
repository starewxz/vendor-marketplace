import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmptyState } from './EmptyState';
import { Button } from './Button';

const meta: Meta<typeof EmptyState> = {
  title: 'UI/EmptyState',
  component: EmptyState,
};
export default meta;

type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: { title: 'No orders yet', description: 'Items you buy will show up here.' },
};

export const WithAction: Story = {
  args: {
    title: 'Your cart is empty',
    description: 'Browse the catalog to find something you like.',
    action: <Button>Go to catalog</Button>,
  },
};
