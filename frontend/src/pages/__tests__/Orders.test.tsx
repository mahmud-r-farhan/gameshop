import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Orders } from '@/pages/Orders';
import { orderAPI } from '@/services/api';

vi.mock('@/services/api', () => ({
  orderAPI: { getMyOrders: vi.fn() },
}));

function renderWithClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Orders />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Orders', () => {
  // Regression: failures were only written to the console, leaving a blank page.
  it('shows a retryable error instead of an empty list when the request fails', async () => {
    vi.mocked(orderAPI.getMyOrders).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({
      data: { data: { orders: [] } },
    } as never);
    const user = userEvent.setup();

    renderWithClient();

    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load your orders.");
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(await screen.findByText('No orders yet')).toBeInTheDocument();
    expect(orderAPI.getMyOrders).toHaveBeenCalledTimes(2);
  });

  it('renders orders returned by the API', async () => {
    vi.mocked(orderAPI.getMyOrders).mockResolvedValue({
      data: {
        data: {
          orders: [
            {
              id: 'order-1',
              orderNumber: 'ORD-2026-000001',
              createdAt: '2026-11-24T10:00:00.000Z',
              totalAmount: '360.00',
              orderStatus: 'DELIVERED',
              paymentStatus: 'VERIFIED',
              items: [{ id: 'item-1' }],
            },
          ],
        },
      },
    } as never);

    renderWithClient();

    expect(await screen.findByText(/ORD-2026-000001/)).toBeInTheDocument();
    expect(screen.getByText(/BDT 360/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view order ORD-2026-000001/i })).toBeInTheDocument();
  });

  it('shows an empty state when there are no orders', async () => {
    vi.mocked(orderAPI.getMyOrders).mockResolvedValue({ data: { data: { orders: [] } } } as never);

    renderWithClient();

    expect(await screen.findByText('No orders yet')).toBeInTheDocument();
  });
});
