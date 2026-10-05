import { useParams } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/common/Button';
import NotFoundPage from './NotFoundPage';
import { ROLE_CARDS } from './HomePage';

const CONTENT = {
  businesses: {
    heading: 'Run every delivery from one dashboard',
    intro: 'Create deliveries for your customers, accept delivery requests placed with your business, dispatch them to verified riders and track them live.',
    points: [
      'Create deliveries in three steps: details, recipient, review',
      'Keep a customer list so repeat deliveries take seconds',
      'Accept or decline requests customers send to your business',
      'Assign verified riders who are online and see who is busy',
      'Live map tracking, status history and photo proof of delivery',
      'Analytics: total deliveries, success rate, average delivery time and daily trend',
    ],
    cta: { label: 'Register your business', to: '/register?type=sme_owner' },
    hero: { title: 'Deliveries That Keep Up', accent: 'With Your Business.', image: '/images/about-hero.jpg', alt: 'An SME owner using a tablet among packed orders' },
  },
  riders: {
    heading: 'Get delivery jobs and complete them with confidence',
    intro: 'Go online, receive job offers from Lagos SMEs, and move each delivery from pickup to drop-off with clear next steps.',
    points: [
      'Go online or offline with one switch',
      'See pickup, drop-off, distance and estimated time before accepting',
      'Accept or decline job offers',
      'Step-by-step active delivery screen with Open in Maps and one-tap calls',
      'Capture a photo as proof of delivery',
      'Full delivery history. Accounts are verified by an administrator before receiving jobs',
    ],
    cta: { label: 'Sign up as a rider', to: '/register?type=rider' },
    hero: { title: 'Ride With DeliverSME.', accent: 'Earn on Your Schedule.', image: '/images/hero-rider.jpg', alt: 'A DeliverSME rider with a branded delivery box' },
  },
  customers: {
    heading: 'Request and track deliveries from many businesses',
    intro: 'One account lets you request deliveries from any registered SME on DeliverSME and follow them in real time.',
    points: [
      'Browse and search registered businesses by category',
      'Request a delivery with pickup, drop-off and item details',
      'Track your rider on a live map with a status timeline',
      'Get notified as your delivery moves forward',
      'Cancel before a rider accepts, and rate completed deliveries',
    ],
    cta: { label: 'Create a customer account', to: '/register?type=customer' },
    hero: { title: 'Every Delivery,', accent: 'Right in Your Pocket.' },
  },
  administrators: {
    heading: 'Oversee the platform, users and quality',
    intro: 'Administrators keep the platform trustworthy. Admin access is never self-service: it is granted by an existing administrator or during secure setup.',
    points: [
      'Platform overview computed from live records',
      'Verify riders before they can receive jobs',
      'Verify, suspend or reactivate businesses',
      'Change user roles and suspend accounts',
      'See every delivery and cancel problem deliveries',
      'Handle messages sent through the Contact page',
    ],
    cta: { label: 'Contact us about administration', to: '/contact' },
    hero: { title: 'Keep the Platform', accent: 'Safe and Trusted.' },
  },
};

export default function RolePage() {
  const { role } = useParams();
  const c = CONTENT[role];
  const card = ROLE_CARDS.find((r) => r.slug === role);
  if (!c || !card) return <NotFoundPage />;
  const Icon = card.icon;
  return (
    <>
      <section className="bg-slate-50">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <span className={`grid h-12 w-12 place-items-center rounded-xl ${card.tone}`}><Icon className="h-6 w-6" aria-hidden="true" /></span>
            <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-brand-600">{card.title}</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight text-navy-900 sm:text-5xl">{c.hero.title}<br /><span className="text-brand-600">{c.hero.accent}</span></h1>
            <p className="mt-5 max-w-lg text-lg text-slate-600">{c.intro}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" to={c.cta.to}>{c.cta.label} <ArrowRight className="h-4 w-4" /></Button>
              <Button size="lg" variant="outline" to="/how-it-works">How it works</Button>
            </div>
          </div>
          {c.hero.image ? (
            <img src={c.hero.image} alt={c.hero.alt} className="h-[360px] w-full rounded-3xl object-cover sm:h-[420px]" />
          ) : (
            <div className={`hidden h-[360px] place-items-center rounded-3xl lg:grid ${card.card}`} aria-hidden="true">
              <span className={`grid h-40 w-40 place-items-center rounded-full ${card.tone}`}><Icon className="h-20 w-20" /></span>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-navy-900">{c.heading}</h2>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {c.points.map((pt) => (
            <li key={pt} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-card">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />{pt}
            </li>
          ))}
        </ul>
        <div className="mt-10">
          <Button size="lg" to={c.cta.to}>{c.cta.label} <ArrowRight className="h-4 w-4" /></Button>
        </div>
      </section>
    </>
  );
}
