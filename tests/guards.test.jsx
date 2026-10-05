import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

let auth = {};
vi.mock('@/app/providers/AuthProvider', () => ({ useAuth: () => auth }));
const { RequireRole, GuestOnly } = await import('@/app/guards/guards');

// The guarded route is only the one under test, so a redirect can never loop back into the guard.
function renderAt(path, element) {
  const guarded = path === '/business' ? <p>business area</p> : <p>login form</p>;
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={element}><Route path={path} element={guarded} /></Route>
        {path !== '/login' && <Route path="/login" element={<p>login page</p>} />}
        <Route path="/customer" element={<p>customer home</p>} />
        {path !== '/business' && <Route path="/business" element={<p>business home</p>} />}
        <Route path="/onboarding" element={<p>onboarding</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const profile = (role, extra = {}) => ({ id: 'u1', role, onboarded: true, is_active: true, ...extra });

describe('RequireRole', () => {
  it('sends signed-out visitors to login', () => {
    auth = { user: null, profile: null, loading: false };
    renderAt('/business', <RequireRole roles={['sme_owner']} />);
    expect(screen.getByText('login page')).toBeInTheDocument();
  });
  it('redirects other roles to their own dashboard', () => {
    auth = { user: { id: 'u1' }, profile: profile('customer'), loading: false };
    renderAt('/business', <RequireRole roles={['sme_owner']} />);
    expect(screen.getByText('customer home')).toBeInTheDocument();
  });
  it('sends users who have not onboarded to onboarding', () => {
    auth = { user: { id: 'u1' }, profile: profile('sme_owner', { onboarded: false }), loading: false };
    renderAt('/business', <RequireRole roles={['sme_owner']} />);
    expect(screen.getByText('onboarding')).toBeInTheDocument();
  });
  it('renders the page for the right role', () => {
    auth = { user: { id: 'u1' }, profile: profile('sme_owner'), loading: false };
    renderAt('/business', <RequireRole roles={['sme_owner']} />);
    expect(screen.getByText('business area')).toBeInTheDocument();
  });
  it('shows a recoverable error when the profile is missing', () => {
    auth = { user: { id: 'u1' }, profile: null, loading: false, refresh: vi.fn(), signOut: vi.fn() };
    renderAt('/business', <RequireRole roles={['sme_owner']} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/profile could not be loaded/i);
  });
});

describe('GuestOnly', () => {
  it('sends signed-in users to their dashboard', () => {
    auth = { user: { id: 'u1' }, profile: profile('sme_owner'), loading: false };
    renderAt('/login', <GuestOnly />);
    expect(screen.getByText('business home')).toBeInTheDocument();
  });
  it('shows the login form to guests', () => {
    auth = { user: null, profile: null, loading: false };
    renderAt('/login', <GuestOnly />);
    expect(screen.getByText('login form')).toBeInTheDocument();
  });
});
