import { ArrowDown, BellRing, CheckCircle2, Headphones, MapPin, Navigation, PackagePlus, ShieldCheck, Bike, Bell, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/common/Button';

export const STEPS = [
  { icon: PackagePlus, title: 'Create Order', text: 'The customer places a delivery request with details of pickup and drop-off.' },
  { icon: ClipboardCheck, title: 'Business Receives', text: 'The business receives the order and reviews the delivery details.' },
  { icon: Navigation, title: 'Assign to Rider', text: 'The business assigns the delivery to an available, verified rider.' },
  { icon: Bike, title: 'Rider Picks Up', text: 'The rider accepts the job and picks up the package from the business location.' },
  { icon: MapPin, title: 'In Transit', text: 'The rider is on the way. Both business and customer can track in real-time.' },
  { icon: CheckCircle2, title: 'Delivery Completed', text: 'The package is delivered, proof is captured and the order is marked as completed.' },
];

const PILLARS = [
  { icon: ShieldCheck, title: 'Secure & Reliable', text: 'Role-based access means each party sees only the deliveries they are part of.' },
  { icon: MapPin, title: 'Real-time Tracking', text: 'Track every step of your delivery from pickup to drop-off.' },
  { icon: Bell, title: 'Instant Notifications', text: 'Stay updated with alerts at every step of the delivery process.' },
  { icon: Headphones, title: 'Dedicated Support', text: 'Our support team is ready to help you with any questions.' },
];

export default function HowItWorksPage() {
  return (
    <div className="bg-slate-50">
      <section className="bg-gradient-to-br from-navy-900 via-brand-700 to-brand-600 text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:px-8 lg:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-100">How it works</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">From Order to Doorstep,<br /><span className="text-brand-100">In Six Simple Steps.</span></h1>
            <p className="mt-5 max-w-lg text-brand-100">A simple and secure delivery process that connects businesses, riders, and customers, with every step tracked in real time.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" variant="white" to="/register">Get Started <BellRing className="h-4 w-4" /></Button>
              <a href="#steps" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/40 px-6 text-base font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">See the steps <ArrowDown className="h-4 w-4" /></a>
            </div>
          </div>
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Delivery steps at a glance">
            {STEPS.map(({ icon: Icon, title }, i) => (
              <li key={title} className="rounded-xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur">
                <Icon className="h-6 w-6 text-brand-100" aria-hidden="true" />
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-brand-100">Step {i + 1}</p>
                <p className="mt-1 text-sm font-semibold">{title}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="steps" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-14 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-navy-900">How <span className="text-brand-600">DeliverSME</span> Works</h2>
        <div className="mx-auto mt-5 h-1 w-16 rounded bg-brand-600" />
        <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-6">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="relative flex flex-col items-center">
              <span className="z-10 grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</span>
              {i < STEPS.length - 1 && <span className="absolute left-1/2 top-4 hidden h-px w-full border-t-2 border-dashed border-brand-200 lg:block" aria-hidden="true" />}
              <div className="mt-4 flex h-full w-full flex-col items-center rounded-xl border border-slate-200 bg-white p-5 shadow-card">
                <span className="grid h-20 w-20 place-items-center rounded-full bg-brand-50 text-brand-600"><Icon className="h-9 w-9" aria-hidden="true" /></span>
                <h3 className="mt-4 font-semibold text-navy-900">{title}</h3>
                <p className="mt-2 text-sm text-slate-600">{text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-12 grid gap-6 rounded-xl border border-brand-100 bg-brand-50/50 p-6 text-left sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white text-brand-600 shadow-card"><Icon className="h-7 w-7" aria-hidden="true" /></span>
              <div><h3 className="font-semibold text-navy-900">{title}</h3><p className="mt-1 text-sm text-slate-600">{text}</p></div>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button size="lg" to="/register">Get Started <BellRing className="h-4 w-4" /></Button>
          <Button size="lg" variant="outline" to="/contact">Talk to us</Button>
        </div>
      </section>
    </div>
  );
}
