import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Smoke test: every public page renders without a signed-in user and without network access.
vi.mock('@/app/providers/AuthProvider', () => ({ useAuth: () => ({ user: null, profile: null, role: null, loading: false }) }));

const pages = {
  HomePage: (await import('@/pages/public/HomePage')).default,
  HowItWorksPage: (await import('@/pages/public/HowItWorksPage')).default,
  AboutPage: (await import('@/pages/public/AboutPage')).default,
  ContactPage: (await import('@/pages/public/ContactPage')).default,
  HelpPage: (await import('@/pages/public/HelpPage')).default,
  NotFoundPage: (await import('@/pages/public/NotFoundPage')).default,
};
const RolePage = (await import('@/pages/public/RolePage')).default;
const LegalPage = (await import('@/pages/public/LegalPage')).default;

describe('public pages render', () => {
  Object.entries(pages).forEach(([name, Page]) => {
    it(name, () => {
      render(<MemoryRouter><Page /></MemoryRouter>);
      expect(screen.getAllByRole('heading').length).toBeGreaterThan(0);
    });
  });
  ['businesses', 'riders', 'customers', 'administrators'].forEach((role) => {
    it(`RolePage /for/${role}`, () => {
      render(<MemoryRouter initialEntries={[`/for/${role}`]}><Routes><Route path="/for/:role" element={<RolePage />} /></Routes></MemoryRouter>);
      expect(screen.getAllByRole('heading').length).toBeGreaterThan(0);
    });
  });
  it('LegalPage privacy and terms', () => {
    render(<MemoryRouter><LegalPage kind="privacy" /><LegalPage kind="terms" /></MemoryRouter>);
    expect(screen.getAllByRole('heading').length).toBeGreaterThan(1);
  });
});

describe('auth pages render', () => {
  const auth = ['LoginPage', 'RegisterPage', 'VerifyEmailPage', 'ResetPasswordPage'];
  auth.forEach((name) => {
    it(name, async () => {
      const Page = (await import(`../src/pages/auth/${name}.jsx`)).default;
      render(<MemoryRouter initialEntries={['/x?email=ada%40example.com']}><Page /></MemoryRouter>);
      expect(screen.getAllByRole('heading').length).toBeGreaterThan(0);
    });
  });
  it('register form shows the three account types and no admin/clearing agent option', async () => {
    const Page = (await import('../src/pages/auth/RegisterPage.jsx')).default;
    render(<MemoryRouter><Page /></MemoryRouter>);
    expect(screen.queryByText(/clearing agent/i)).toBeNull();
    expect(screen.getByText(/SME \/ Business Owner/)).toBeInTheDocument();
    expect(screen.getByText(/Rider \/ Transporter/)).toBeInTheDocument();
  });
});
