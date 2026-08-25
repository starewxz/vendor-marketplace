import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  args: { children: 'AUCTION' },
};
export default meta;

type Story = StoryObj<typeof Badge>;

export const Yellow: Story = { args: { tone: 'yellow' } };
export const Blue: Story = { args: { tone: 'blue' } };
export const Coral: Story = { args: { tone: 'coral', children: 'CANCELLED' } };
export const Mint: Story = { args: { tone: 'mint', children: 'DELIVERED' } };
export const Neutral: Story = { args: { tone: 'neutral', children: 'DRAFT' } };
