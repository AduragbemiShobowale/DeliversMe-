import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Smoke tests: each role's pages mount, load (mocked) data and show real content or an empty state.
// Services are mocked; RLS/RPC behaviour is covered by the SQL tests.
const now = new Date().toISOString();
const delivery = {
  id: 'd1', code: 'DLV000123', status: 'pending', priority: 'standard', package_size: 'small', business_id: 'b1', rider_id: null,
  pickup_address: '12 Allen Avenue, Ikeja', dropoff_address: '3 Admiralty Way, Lekki', item_description: 'Documents',
  recipient_name: 'John Doe', recipient_phone: '+2348123456789', created_at: now, updated_at: now, history: [],
  business: { id: 'b1', name: 'Demo Foods', phone: '+2348000000000' }, rider: null, customer: null,
};
let auth;
vi.mock('@/app/providers/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/hooks/useRealtime', () => ({ useRealtime: () => {} }));
vi.mock('@/components/deliveries/DeliveryMap', () => ({ DeliveryMap: () => <div data-testid="map" /> }));
vi.mock('@/services/notifications', () => ({
  listNotifications: vi.fn(async () => ({ rows: [{ id: 'n1', title: 'Rider assigned', body: 'Emeka accepted #DLV000123', created_at: now, read_at: null, type: 'rider_assigned', delivery_id: 'd1' }], count: 1 })),
  markRead: vi.fn(), markAllRead: vi.fn(), deleteNotification: vi.fn(), unreadCount: vi.fn(async () => 1),
}));
vi.mock('@/services/deliveries', () => ({
  listDeliveries: vi.fn(async () => ({ rows: [delivery], count: 1 })),
  countDeliveries: vi.fn(async () => 3),
  deliveriesForAnalytics: vi.fn(async () => [{ status: 'delivered', created_at: now, accepted_at: now, delivered_at: now }]),
  getDelivery: vi.fn(async () => delivery),
  getRating: vi.fn(async () => null),
}));
vi.mock('@/services/riders', () => ({
  listRiders: vi.fn(async () => [{ id: 'r1', full_name: 'Emeka Daniels', phone: '+2348000000001', availability: 'available', is_verified: true, active_jobs: 0 }]),
  riderStatus: (r) => (r.availability === 'available' ? 'available' : 'offline'),
  getRiderLocation: vi.fn(async () => null),
}));
vi.mock('@/services/businesses', () => ({
  listBusinesses: vi.fn(async () => [{ id: 'b1', name: 'Demo Foods', category: 'food', completed_deliveries: 4, avg_rating: 4.5, rating_count: 2 }]),
  getBusiness: vi.fn(async () => ({ id: 'b1', name: 'Demo Foods', category: 'food' })),
  customerBusinesses: vi.fn(async () => []),
}));
vi.mock('@/services/customers', () => ({ listCustomers: vi.fn(async () => ({ rows: [], count: 0 })), getCustomer: vi.fn(async () => null) }));
vi.mock('@/services/admin', () => ({
  platformStats: vi.fn(async () => ({ customers: 1, smes: 1, riders: 1, unverifiedRiders: 1, businesses: 1, deliveries: 1, active: 0, delivered: 0, newMessages: 0 })),
  listUsers: vi.fn(async () => ({ rows: [], count: 0 })),
  listAllBusinesses: vi.fn(async () => ({ rows: [], count: 0 })),
  listMessages: vi.fn(async () => ({ rows: [], count: 0 })),
}));

const modules = import.meta.glob('../src/pages/*/*.jsx');
const load = async (p) => (await modules[`../src/pages/${p}.jsx`]()).default;
const base = { user: { id: 'u1' }, loading: false };
const as = {
  customer: { ...base, role: 'customer', profile: { id: 'u1', full_name: 'David Okafor', role: 'customer' } },
  sme_owner: { ...base, role: 'sme_owner', profile: { id: 'u1', full_name: 'Tunde Adebayo', role: 'sme_owner' }, business: { id: 'b1', name: 'Demo Foods' } },
  rider: { ...base, role: 'rider', profile: { id: 'u1', full_name: 'Chinedu Okafor', role: 'rider' }, rider: { id: 'u1', availability: 'offline', is_verified: false } },
  admin: { ...base, role: 'admin', profile: { id: 'u1', full_name: 'Admin', role: 'admin' } },
};

const cases = [
  ['customer', 'customer/CustomerDashboard', 'Your Recent Deliveries'],
  ['customer', 'customer/FindBusinessPage', 'Demo Foods'],
  ['customer', 'customer/CustomerDeliveriesPage', '#DLV000123'],
  ['customer', 'customer/MyBusinessesPage', 'No businesses yet'],
  ['sme_owner', 'business/BusinessDashboard', 'Total Deliveries'],
  ['sme_owner', 'business/BusinessDeliveriesPage', '#DLV000123'],
  ['sme_owner', 'business/CreateDeliveryPage', 'Pickup address'],
  ['sme_owner', 'business/CustomersPage', 'No customers yet'],
  ['sme_owner', 'business/RidersPage', 'Emeka Daniels'],
  ['sme_owner', 'business/AnalyticsPage', 'Success Rate (of finished)'],
  ['rider', 'rider/RiderDashboard', 'awaiting verification'],
  ['rider', 'rider/AvailableJobsPage', '#DLV000123'],
  ['rider', 'rider/RiderDeliveriesPage', '#DLV000123'],
  ['admin', 'admin/AdminDashboard', 'rider awaiting verification'],
  ['admin', 'admin/AdminUsersPage', 'No users found'],
  ['admin', 'admin/AdminBusinessesPage', 'No businesses found'],
  ['admin', 'admin/AdminRidersPage', 'No riders waiting'],
  ['admin', 'admin/AdminMessagesPage', 'Inbox zero'],
];

describe('dashboard pages render with data', () => {
  cases.forEach(([role, page, text]) => {
    it(`${role}: ${page}`, async () => {
      auth = as[role];
      const Page = await load(page);
      render(<MemoryRouter><Page /></MemoryRouter>);
      await waitFor(() => expect(screen.getAllByText(new RegExp(text.replace(/[()#]/g, '\\$&'), 'i')).length).toBeGreaterThan(0));
    });
  });

  it('SME assign-rider page lists riders for a pending delivery', async () => {
    auth = as.sme_owner;
    const Page = await load('business/AssignRiderPage');
    render(<MemoryRouter initialEntries={['/business/deliveries/d1/assign']}><Routes><Route path="/business/deliveries/:id/assign" element={<Page />} /></Routes></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Emeka Daniels')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Select' })).toBeEnabled();
  });

  it('customer request form loads the business', async () => {
    auth = as.customer;
    const Page = await load('customer/RequestDeliveryPage');
    render(<MemoryRouter initialEntries={['/customer/request/b1']}><Routes><Route path="/customer/request/:businessId" element={<Page />} /></Routes></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Demo Foods')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Submit Request' })).toBeInTheDocument();
  });

  const at = (Page, path, route) => render(<MemoryRouter initialEntries={[path]}><Routes><Route path={route} element={<Page />} /></Routes></MemoryRouter>);

  it('rider job page offers accept/decline on an offered job', async () => {
    auth = as.rider;
    Object.assign(delivery, { status: 'assigned', rider_id: 'u1' });
    at(await load('rider/JobPage'), '/rider/jobs/d1', '/rider/jobs/:id');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Accept Job' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Decline' })).toBeInTheDocument();
  });

  it('rider job page shows the complete form once arrived', async () => {
    auth = as.rider;
    Object.assign(delivery, { status: 'arrived', rider_id: 'u1' });
    at(await load('rider/JobPage'), '/rider/jobs/d1', '/rider/jobs/:id');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Complete Delivery' })).toBeInTheDocument());
    expect(screen.getByText('Take a Photo')).toBeInTheDocument();
  });

  it('SME delivery details offers accept/decline for a customer request', async () => {
    auth = as.sme_owner;
    Object.assign(delivery, { status: 'requested', rider_id: null });
    at(await load('shared/DeliveryDetailsPage'), '/business/deliveries/d1', '/business/deliveries/:id');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Accept request' })).toBeInTheDocument());
  });

  it('customer delivery details allows cancelling before a rider accepts', async () => {
    auth = as.customer;
    Object.assign(delivery, { status: 'pending', rider_id: null });
    at(await load('shared/DeliveryDetailsPage'), '/customer/deliveries/d1', '/customer/deliveries/:id');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel delivery' })).toBeInTheDocument());
  });

  it('notifications page lists notifications', async () => {
    auth = as.customer;
    at(await load('shared/NotificationsPage'), '/customer/notifications', '/customer/notifications');
    await waitFor(() => expect(screen.getByText('Rider assigned')).toBeInTheDocument());
  });

  it('settings page renders each rider tab', async () => {
    auth = { ...as.rider, refresh: vi.fn(), setRider: vi.fn() };
    const Page = await load('shared/SettingsPage');
    for (const tab of ['profile', 'vehicle', 'security', 'notifications']) {
      const { unmount } = at(Page, `/rider/settings/${tab}`, '/rider/settings/:tab');
      await waitFor(() => expect(screen.getAllByRole('heading').length).toBeGreaterThan(0));
      unmount();
    }
  });
});
