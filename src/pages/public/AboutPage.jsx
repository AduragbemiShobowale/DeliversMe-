import { ArrowRight, BarChart3, Building, Heart, Leaf, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/common/Button';

const VALUES = [
  { icon: ShieldCheck, title: 'Reliability', text: 'We are committed to safe and dependable deliveries.', tone: 'bg-brand-50 text-brand-600' },
  { icon: Users, title: 'People First', text: 'We prioritize the needs of SMEs, riders, and customers.', tone: 'bg-emerald-50 text-emerald-600' },
  { icon: BarChart3, title: 'Growth', text: 'We enable businesses to scale through efficient delivery operations.', tone: 'bg-amber-50 text-amber-600' },
  { icon: Heart, title: 'Integrity', text: 'We operate with transparency, accountability, and trust.', tone: 'bg-red-50 text-red-500' },
];

export default function AboutPage() {
  return (
    <>
      <section className="bg-slate-50">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">About us</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight text-navy-900 sm:text-5xl">More Than Deliveries.<br /><span className="text-brand-600">We Power Possibilities.</span></h1>
            <p className="mt-5 text-slate-600">DeliverSME is an integrated delivery management platform built to support small and medium-sized businesses (SMEs) by making delivery operations simple, transparent, and reliable.</p>
            <p className="mt-4 text-slate-600">We connect businesses, riders, and customers on one platform to ensure goods move efficiently from pickup to drop-off — helping SMEs grow and serve their customers better.</p>
            <Button className="mt-7" href="#story">Our Story <ArrowRight className="h-4 w-4" /></Button>
            <ul className="mt-8 flex flex-wrap gap-6 text-sm text-slate-700">
              <li className="flex items-center gap-2"><span className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-600"><Users className="h-5 w-5" /></span>People Centered</li>
              <li className="flex items-center gap-2"><span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-50 text-emerald-600"><Leaf className="h-5 w-5" /></span>Sustainable Growth</li>
              <li className="flex items-center gap-2"><span className="grid h-10 w-10 place-items-center rounded-full bg-amber-50 text-amber-600"><ShieldCheck className="h-5 w-5" /></span>Trusted Delivery</li>
            </ul>
          </div>
          <div className="relative overflow-hidden rounded-3xl">
            <img src="/images/about-hero.jpg" alt="An SME owner using a tablet among packed orders" className="h-[420px] w-full object-cover" />
            <blockquote className="absolute bottom-5 right-5 max-w-[220px] rounded-xl bg-white/95 p-5 shadow-lg">
              <p className="font-semibold text-navy-900">“We believe that when SMEs move forward, communities grow.”</p>
              <footer className="mt-3 text-sm text-slate-500">Delivering Possibilities</footer>
            </blockquote>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Our values</p>
        <h2 className="mt-2 text-3xl font-bold text-navy-900">What Drives Us</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map(({ icon: Icon, title, text, tone }) => (
            <div key={title} className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-card">
              <span className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${tone}`}><Icon className="h-7 w-7" aria-hidden="true" /></span>
              <h3 className="mt-4 font-semibold text-navy-900">{title}</h3>
              <p className="mt-2 text-sm text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="story" className="mx-auto grid max-w-7xl scroll-mt-20 items-center gap-10 px-4 pb-14 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Our story</p>
          <h2 className="mt-2 text-3xl font-bold text-navy-900">Built for SMEs,<br />Inspired by <span className="text-brand-600">Real Challenges.</span></h2>
          <p className="mt-4 text-slate-600">DeliverSME was created from a simple observation — SMEs face real challenges in managing deliveries. From finding reliable riders to keeping customers informed, delivery logistics can be stressful and time-consuming.</p>
          <p className="mt-4 text-slate-600">We built DeliverSME to solve these challenges with technology, providing a single, easy-to-use platform that brings everyone together — businesses, riders, and customers.</p>
          <Button className="mt-6" to="/register">Join Us <ArrowRight className="h-4 w-4" /></Button>
        </div>
        <div className="relative overflow-hidden rounded-2xl">
          <img src="/images/about-bridge.jpg" alt="Lagos skyline and bridge at dusk" className="h-80 w-full object-cover" />
          <div className="absolute bottom-5 right-5 max-w-[190px] rounded-xl bg-white/95 p-4 shadow-lg">
            <Building className="h-6 w-6 text-brand-600" aria-hidden="true" />
            <p className="mt-2 text-sm font-semibold text-navy-900">Supporting SMEs for a stronger, more connected tomorrow.</p>
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-r from-brand-700 to-brand-600 px-4 py-14 text-center text-white">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-100">Our commitment</p>
        <h2 className="mt-2 text-3xl font-bold">A More Connected Tomorrow</h2>
        <p className="mx-auto mt-3 max-w-2xl text-brand-100">We are committed to building a logistics ecosystem that empowers SMEs, creates opportunities for riders, and delivers better experiences for customers.</p>
        <Button variant="white" size="lg" className="mt-6" to="/register">Get Started Today <ArrowRight className="h-4 w-4" /></Button>
      </section>
    </>
  );
}
