import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  BarChart3, Bell, Briefcase, Building2, ChevronDown, ClipboardList, Home, Inbox, LogOut, Menu, PackagePlus,
  Search, Settings, ShieldCheck, Truck, User, Users, X,
} from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { Avatar } from '@/components/common/Avatar';
import { useAuth } from '@/app/providers/AuthProvider';
import { ROLE_LABEL } from '@/config/site';
import { unreadCount } from '@/services/notifications';
import { setAvailability } from '@/services/riders';
import { useRealtime } from '@/hooks/useRealtime';
import { useRiderLocation } from '@/hooks/useRiderLocation';
import { errorMessage } from '@/lib/errors';

export const NAV_BY_ROLE = {
  customer: [
    { to: '/customer', label: 'Dashboard', icon: Home, end: true },
    { to: '/customer/request', label: 'Request Delivery', icon: PackagePlus },
    { to: '/customer/deliveries', label: 'My Deliveries', icon: ClipboardList },
    { to: '/customer/my-businesses', label: 'My Businesses', icon: Building2 },
    { to: '/customer/notifications', label: 'Notifications', icon: Bell, badge: true },
    { to: '/customer/settings/profile', label: 'Profile', icon: User },
    { to: '/customer/settings/security', label: 'Settings', icon: Settings },
  ],
  sme_owner: [
    { to: '/business', label: 'Dashboard', icon: Home, end: true },
    { to: '/business/deliveries/new', label: 'Create Delivery', icon: PackagePlus },
    { to: '/business/deliveries', label: 'My Deliveries', icon: ClipboardList, end: true },
    { to: '/business/customers', label: 'Customers', icon: Users },
    { to: '/business/riders', label: 'Riders', icon: Truck },
    { to: '/business/notifications', label: 'Notifications', icon: Bell, badge: true },
    { to: '/business/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/business/settings/profile', label: 'Settings', icon: Settings },
  ],
  rider: [
    { to: '/rider', label: 'Dashboard', icon: Home, end: true },
    { to: '/rider/jobs', label: 'Available Jobs', icon: Briefcase, end: true },
    { to: '/rider/deliveries', label: 'My Deliveries', icon: ClipboardList },
    { to: '/rider/notifications', label: 'Notifications', icon: Bell, badge: true },
    { to: '/rider/settings/profile', label: 'Profile', icon: User },
    { to: '/rider/settings/security', label: 'Settings', icon: Settings },
  ],
  admin: [
    { to: '/admin', label: 'Dashboard', icon: Home, end: true },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/businesses', label: 'Businesses', icon: Building2 },
    { to: '/admin/riders', label: 'Riders', icon: Truck },
    { to: '/admin/deliveries', label: 'Deliveries', icon: ClipboardList },
    { to: '/admin/messages', label: 'Messages', icon: Inbox },
    { to: '/admin/notifications', label: 'Notifications', icon: Bell, badge: true },
    { to: '/admin/settings/profile', label: 'Settings', icon: Settings },
  ],
};

const BASE = { customer: '/customer', sme_owner: '/business', rider: '/rider', admin: '/admin' };

function useUnread(userId) {
  const [count, setCount] = useState(0);
  const load = useCallback(() => { if (userId) unreadCount(userId).then(setCount).catch(() => {}); }, [userId]);
  useEffect(load, [load]);
  useRealtime({
    table: 'notifications',
    filter: userId ? `user_id=eq.${userId}` : undefined,
    enabled: Boolean(userId),
    channelKey: `unread:${userId}`,
    onChange: (payload) => {
      if (payload.eventType === 'INSERT') toast(payload.new.title, { icon: '🔔' });
      load();
    },
  });
  return [count, load];
}

function RiderOnlineToggle() {
  const { rider, setRider } = useAuth();
  const [busy, setBusy] = useState(false);
  const status = useRiderLocation(rider?.id, rider?.availability === 'available');
  if (!rider) return null;
  const online = rider.availability === 'available';
  const toggle = async () => {
    if (!rider.is_verified && !online) {
      toast.error('Your profile is awaiting admin verification. You can go online once verified.');
      return;
    }
    setBusy(true);
    try { setRider(await setAvailability(rider.id, online ? 'offline' : 'available')); }
    catch (e) { toast.error(errorMessage(e)); }
    finally { setBusy(false); }
  };
  return (
    <button type="button" onClick={toggle} disabled={busy} aria-pressed={online}
      title={online ? (status === 'denied' ? 'Location permission denied — customers cannot see your position' : 'You are online') : 'Go online to receive jobs'}
      className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${online ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-white text-slate-600'}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-slate-400'}`} aria-hidden="true" />
      {online ? 'Online' : 'Offline'}
    </button>
  );
}

function UserMenu() {
  const { profile, role, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const logout = async () => { await signOut(); toast.success('Logged out'); navigate('/login'); };
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu"
        className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
        <Avatar name={profile?.full_name} src={profile?.avatar_url} size="sm" />
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-sm font-semibold text-navy-900">{profile?.full_name}</span>
          <span className="block text-xs text-slate-500">{ROLE_LABEL[role]}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          <Link role="menuitem" to={`${BASE[role]}/settings/profile`} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"><User className="h-4 w-4" />Profile</Link>
          <Link role="menuitem" to={`${BASE[role]}/settings/security`} onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"><ShieldCheck className="h-4 w-4" />Security</Link>
          <button role="menuitem" type="button" onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"><LogOut className="h-4 w-4" />Log out</button>
        </div>
      )}
    </div>
  );
}

function Sidebar({ role, unread, onNavigate }) {
  const items = NAV_BY_ROLE[role] || [];
  return (
    <nav aria-label="Dashboard" className="flex flex-1 flex-col gap-1 px-3">
      {items.map(({ to, label, icon: Icon, end, badge }) => (
        <NavLink key={to} to={to} end={end} onClick={onNavigate}
          className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${isActive ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          <span className="flex-1">{label}</span>
          {badge && unread > 0 && <span className="rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">{unread > 99 ? '99+' : unread}</span>}
        </NavLink>
      ))}
    </nav>
  );
}

export function DashboardLayout() {
  const { role, user, profile, signOut } = useAuth();
  const [drawer, setDrawer] = useState(false);
  const [unread] = useUnread(user?.id);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => setDrawer(false), [pathname]);

  const logout = async () => { await signOut(); navigate('/login'); };
  const sideInner = (
    <div className="flex h-full flex-col bg-navy-900 py-5">
      <div className="mb-6 px-5"><Logo dark compact to={BASE[role]} /></div>
      <Sidebar role={role} unread={unread} onNavigate={() => setDrawer(false)} />
      <div className="mt-4 px-3">
        <button type="button" onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white">
          <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 lg:block">{sideInner}</aside>
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-navy-950/60" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%]">
            <button type="button" onClick={() => setDrawer(false)} aria-label="Close navigation" className="absolute right-3 top-4 z-10 rounded-md p-1 text-slate-300 hover:text-white"><X className="h-5 w-5" /></button>
            {sideInner}
          </div>
        </div>
      )}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button type="button" className="rounded-md p-2 text-navy-900 hover:bg-slate-100 lg:hidden" aria-label="Open navigation" onClick={() => setDrawer(true)}>
            <Menu className="h-5 w-5" />
          </button>
          {role === 'customer' && (
            <Link to="/customer/request" className="hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:border-brand-300 md:flex">
              <Search className="h-4 w-4" aria-hidden="true" />Find a business to deliver from
            </Link>
          )}
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {role === 'rider' && <RiderOnlineToggle />}
            <Link to={`${BASE[role]}/notifications`} aria-label={`Notifications, ${unread} unread`} className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
              <Bell className="h-5 w-5" />
              {unread > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />}
            </Link>
            <UserMenu />
          </div>
        </header>
        {profile && !profile.is_active && <div className="bg-red-600 px-4 py-2 text-sm text-white">This account is suspended.</div>}
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}
