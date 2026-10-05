import { ArrowRight, Bell, Building2, MapPin, PlayCircle, ShieldCheck, Bike, Users, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/common/Button';
import { useAuth } from '@/app/providers/AuthProvider';
import { ROLE_HOME } from '@/config/site';

const HIGHLIGHTS = [
  { icon: ShieldCheck, title: 'Secure & Reliable', text: 'Your deliveries are safe with us.' },
  { icon: MapPin, title: 'Real-time Tracking', text: 'Track every delivery in real-time.' },
  { icon: Users, title: 'Built for SMEs', text: 'Manage your business deliveries with ease.' },
  { icon: Bell, title: 'Instant Notifications', text: 'Stay updated at every step of the way.' },
];

export const ROLE_CARDS = [
  { slug: 'businesses', icon: Building2, title: 'For Businesses', text: 'Manage deliveries, riders, customers and performance from one dashboard.', tone: 'bg-brand-50 text-brand-600', card: 'bg-brand-50/60' },
  { slug: 'riders', icon: Bike, title: 'For Riders', text: 'Receive jobs, navigate routes, and complete deliveries efficiently.', tone: 'bg-emerald-50 text-emerald-600', card: 'bg-emerald-50/60' },
  { slug: 'customers', icon: Users, title: 'For Customers', text: 'Place orders, track in real-time, and confirm delivery securely.', tone: 'bg-amber-50 text-amber-600', card: 'bg-amber-50/60' },
  { slug: 'administrators', icon: ShieldCheck, title: 'For Administrators', text: 'Oversee the platform, manage users, and ensure quality and compliance.', tone: 'bg-violet-50 text-violet-600', card: 'bg-violet-50/60' },
];

function PhonePreview() {
  return (
    <div className="absolute bottom-6 right-4 hidden w-60 rounded-[2rem] border-[6px] border-navy-900 bg-white p-3 shadow-2xl md:block lg:right-10" aria-hidden="true">
      <div className="flex items-center justify-between"><p className="text-sm font-semibold text-navy-900">Live Tracking</p><span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">In Transit</span></div>
      <svg viewBox="0 0 200 80" className="mt-2 h-20 w-full rounded-lg bg-slate-100">
        <path d="M20 45 C60 20, 90 60, 120 35 S170 40, 180 55" fill="none" stroke="#0A5CF5" strokeWidth="3" />
        <circle cx="20" cy="45" r="8" fill="#0A5CF5" /><circle cx="180" cy="55" r="8" fill="#16A34A" />
      </svg>
      <p className="mt-2 text-xs font-medium text-slate-600">Your package is on the way</p>
      <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-2 py-2 text-xs">
        <span className="font-medium text-navy-900">Rider en route</span><Phone className="h-4 w-4 text-brand-600" />
      </div>
      <p className="mt-2 text-center text-[10px] uppercase tracking-wide text-slate-400">Illustrative preview</p>
    </div>
  );
}

export default function HomePage() {
  const { user, profile } = useAuth();
  const startTo = user && profile ? ROLE_HOME[profile.role] : '/register';
  return (
    <>
      <section className="overflow-hidden bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:px-8 lg:py-16">
          <div>
            <span className="inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">Smart Delivery Management Platform</span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight text-navy-900 sm:text-5xl lg:text-6xl">
              Deliver Smarter.<br /><span className="text-brand-600">Connect Better.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-600">
              DeliverSME connects businesses, riders, and customers on one secure platform to manage deliveries in real-time, from pickup to successful drop-off.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" to={startTo}>Get Started Now <ArrowRight className="h-4 w-4" /></Button>
              <Button size="lg" variant="outline" to="/how-it-works">See How It Works <PlayCircle className="h-5 w-5" /></Button>
            </div>
            <ul className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
              {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
                <li key={title}>
                  <Icon className="h-6 w-6 text-brand-600" aria-hidden="true" />
                  <p className="mt-2 text-sm font-semibold text-navy-900">{title}</p>
                  <p className="mt-1 text-xs text-slate-500">{text}</p>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative h-[420px] overflow-hidden rounded-3xl bg-slate-200 sm:h-[500px]">
            <img src="/images/hero-rider.jpg" alt="A DeliverSME rider with a branded delivery box" className="h-full w-full object-cover" />
            <PhonePreview />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-bold text-navy-900">One Platform. Four Powerful Roles.</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ROLE_CARDS.map(({ slug, icon: Icon, title, text, tone, card }) => (
            <Link key={slug} to={`/for/${slug}`} className={`group rounded-xl border border-slate-200 p-6 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${card}`}>
              <span className={`grid h-11 w-11 place-items-center rounded-lg ${tone}`}><Icon className="h-6 w-6" aria-hidden="true" /></span>
              <h3 className="mt-4 text-lg font-semibold text-navy-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-600">Learn More <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
