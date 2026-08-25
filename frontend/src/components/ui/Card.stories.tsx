import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from './Card';

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    className: 'p-6 w-80',
    children: <p className="text-sm text-navy/70">Plain content panel — forms, tables, dashboard tiles.</p>,
  },
};

export const WithNotch: Story = {
  args: {
    notch: true,
    className: 'p-6 w-80',
    children: <p className="text-sm text-navy/70">Die-cut corner accent used on product cards and promo tiles.</p>,
  },
};
