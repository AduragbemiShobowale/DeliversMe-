import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Globe, Headphones, HelpCircle, Menu, ShieldCheck, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Logo } from '@/components/common/Logo';
import { Button } from '@/components/common/Button';
import { useAuth } from '@/app/providers/AuthProvider';
import { ROLE_HOME, site } from '@/config/site';
import { subscribeNewsletter } from '@/services/public';
import { errorMessage } from '@/lib/errors';
import { SocialLinks } from './SocialLinks';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/for/businesses', label: 'For Businesses' },
  { to: '/for/riders', label: 'For Riders' },
  { to: '/about', label: 'About Us' },
  { to: '/contact', label: 'Contact' },
];

function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, profile } = useAuth();
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  const link = ({ isActive }) =>
    `relative py-2 text-[15px] font-medium transition-colors ${isActive ? 'text-brand-600 after:absolute after:-bottom-[22px] after:left-0 after:h-0.5 after:w-full after:bg-brand-600' : 'text-navy-900 hover:text-brand-600'}`;
  const dash = profile ? (profile.onboarded ? ROLE_HOME[profile.role] : '/onboarding') : '/login';

  return (
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-7 lg:flex">
          {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={link}>{n.label}</NavLink>)}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          {user ? (
            <Button to={dash}>Go to dashboard</Button>
          ) : (
            <>
              <Button variant="outline" to="/login" className="px-6">Login</Button>
              <Button to="/register" className="px-6">Get Started</Button>
            </>
          )}
        </div>
        <button type="button" className="rounded-md p-2 text-navy-900 hover:bg-slate-100 lg:hidden" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open && (
        <nav aria-label="Mobile" className="border-t border-slate-100 bg-white px-4 pb-5 pt-2 lg:hidden">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `block rounded-lg px-3 py-2.5 font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-navy-900'}`}>{n.label}</NavLink>
          ))}
          <div className="mt-3 grid grid-cols-2 gap-2">
            {user ? <Button to={dash} className="col-span-2">Go to dashboard</Button> : (
              <><Button variant="outline" to="/login">Login</Button><Button to="/register">Get Started</Button></>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

function TopStrip() {
  return (
    <div className="hidden bg-slate-50 md:block">
      <div className="mx-auto flex h-9 max-w-7xl items-center justify-between px-4 text-xs sm:px-6 lg:px-8">
        <span />
        <p className="flex items-center gap-2 font-medium text-navy-900"><ShieldCheck className="h-4 w-4" aria-hidden="true" /> Trusted by SMEs. Built for secure, reliable, and efficient deliveries.</p>
        <div className="flex items-center gap-5 text-slate-600">
          <Link to="/contact" className="flex items-center gap-1.5 hover:text-brand-600"><Headphones className="h-3.5 w-3.5" aria-hidden="true" />Support</Link>
          <Link to="/help" className="flex items-center gap-1.5 hover:text-brand-600"><HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />Help Center</Link>
        </div>
      </div>
    </div>
  );
}

function Newsletter() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast.error('Enter a valid email address'); return; }
    setBusy(true);
    try { await subscribeNewsletter(email); toast.success('Subscribed. Watch your inbox for updates.'); setEmail(''); }
    catch (err) { toast.error(errorMessage(err)); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="mt-4 flex max-w-sm overflow-hidden rounded-lg border border-slate-600 focus-within:ring-2 focus-within:ring-brand-500">
      <label htmlFor="newsletter-email" className="sr-only">Email address</label>
      <input id="newsletter-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email"
        className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-white placeholder:text-slate-400 focus:outline-none" />
      <button type="submit" disabled={busy} className="bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-60">{busy ? 'Saving…' : 'Subscribe'}</button>
    </form>
  );
}

export function Footer() {
  const col = (title, links) => (
    <div>
      <h3 className="font-semibold text-white">{title}</h3>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map(([to, label]) => <li key={to}><Link to={to} className="text-slate-300 hover:text-white">{label}</Link></li>)}
      </ul>
    </div>
  );
  return (
    <footer className="bg-navy-900 text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.6fr] lg:px-8">
        <div>
          <Logo dark />
          <p className="mt-4 max-w-xs text-sm leading-relaxed">Empowering SMEs with smart delivery management. Connecting businesses, riders, and customers for seamless deliveries.</p>
          <SocialLinks className="mt-5" />
        </div>
        {col('Platform', [['/how-it-works', 'How It Works'], ['/for/businesses', 'For Businesses'], ['/for/riders', 'For Riders'], ['/for/customers', 'For Customers'], ['/for/administrators', 'For Administrators']])}
        {col('Company', [['/about', 'About Us'], ['/contact', 'Contact'], ['/terms', 'Terms of Service']])}
        {col('Support', [['/help', 'Help Center'], ['/privacy', 'Privacy Policy']])}
        <div>
          <h3 className="font-semibold text-white">Newsletter</h3>
          <p className="mt-4 text-sm">Subscribe to get the latest updates and news from DeliverSME.</p>
          <Newsletter />
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-sm sm:flex-row sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} {site.name}. All rights reserved.</p>
          <p>Made with <span className="text-red-500" aria-label="love">♥</span> for SMEs</p>
          <p className="flex items-center gap-1.5"><Globe className="h-4 w-4" aria-hidden="true" /> English</p>
        </div>
      </div>
    </footer>
  );
}

export function PublicLayout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      {pathname === '/' && <TopStrip />}
      <Navbar />
      <main className="flex-1"><Outlet /></main>
      <Footer />
    </div>
  );
}
