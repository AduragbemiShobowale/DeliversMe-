import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { ArrowRight, Mail, MapPin, Phone, Send } from 'lucide-react';
import { MapContainer, Marker, TileLayer, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/common/Button';
import { Input, Select, Textarea } from '@/components/forms/Fields';
import { SocialLinks } from '@/components/layout/SocialLinks';
import { LAGOS_CENTER, site } from '@/config/site';
import { sendContactMessage } from '@/services/public';
import { errorMessage } from '@/lib/errors';
import { telHref } from '@/utils/format';

export const SUBJECTS = [
  { value: 'general', label: 'General enquiry' },
  { value: 'support', label: 'Account or delivery support' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'rider', label: 'Becoming a rider' },
  { value: 'billing', label: 'Billing' },
  { value: 'other', label: 'Other' },
];

export const contactSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your name').max(120),
  email: z.string().trim().email('Enter a valid email address').max(254),
  subject: z.enum(SUBJECTS.map((s) => s.value), { errorMap: () => ({ message: 'Select a topic' }) }),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(2000, 'Keep it under 2000 characters'),
});

const pin = L.divIcon({ className: '', html: '<span style="display:block;width:22px;height:22px;border-radius:9999px;background:#DC2626;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></span>', iconSize: [22, 22], iconAnchor: [11, 11] });

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(contactSchema), defaultValues: { full_name: '', email: '', subject: '', message: '' },
  });
  const onSubmit = async (values) => {
    try {
      await sendContactMessage(values);
      reset(); setSent(true);
      toast.success('Message sent. We will get back to you shortly.');
    } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <>
      <section className="relative overflow-hidden bg-slate-50">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Contact us</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight text-navy-900 sm:text-5xl">Let’s Build<br /><span className="text-brand-600">A More Connected Lagos.</span></h1>
            <p className="mt-5 max-w-lg text-slate-600">Have questions, need support, or want to partner with us? We’re here to help. Reach out and our team will get back to you as soon as possible.</p>
          </div>
          <img src="/images/contact-hero.jpg" alt="A DeliverSME support agent wearing a headset" className="h-72 w-full rounded-2xl object-cover lg:h-80" />
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1.3fr_1fr] lg:px-8">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
          <h2 className="text-2xl font-bold text-navy-900">Send Us a Message</h2>
          <p className="mt-1 text-sm text-slate-500">Fill out the form below and we’ll get back to you shortly.</p>
          {sent && <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Thanks — your message has been received.</p>}
          <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Full Name" placeholder="Enter your name" autoComplete="name" error={errors.full_name?.message} {...register('full_name')} />
              <Input label="Email Address" type="email" placeholder="Enter your email" autoComplete="email" error={errors.email?.message} {...register('email')} />
            </div>
            <Select label="Subject" placeholder="Select a topic" options={SUBJECTS} error={errors.subject?.message} {...register('subject')} />
            <Textarea label="Your Message" rows={4} placeholder="Type your message here…" error={errors.message?.message} {...register('message')} />
            <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Send Message <Send className="h-4 w-4" /></Button>
          </form>
        </div>

        <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-navy-900">Get in Touch</h2>
          <p className="mt-1 text-sm text-slate-500">You can also reach us through the following channels.</p>
          <ul className="mt-6 space-y-6">
            {site.supportPhone && (
              <li className="flex gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-brand-600"><Phone className="h-5 w-5" /></span>
                <div><p className="font-semibold text-navy-900">Phone</p><a href={telHref(site.supportPhone)} className="text-sm text-slate-600 hover:text-brand-600">{site.supportPhone}</a><p className="text-sm text-slate-600">{site.hours}</p></div></li>
            )}
            {site.supportEmail && (
              <li className="flex gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-brand-600"><Mail className="h-5 w-5" /></span>
                <div><p className="font-semibold text-navy-900">Email</p><a href={`mailto:${site.supportEmail}`} className="text-sm text-slate-600 hover:text-brand-600">{site.supportEmail}</a></div></li>
            )}
            <li className="flex gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-brand-600"><MapPin className="h-5 w-5" /></span>
              <div><p className="font-semibold text-navy-900">Our Location</p><p className="text-sm text-slate-600">{site.location}</p><p className="text-sm text-slate-600">Serving businesses across Lagos</p></div></li>
            {site.social.length > 0 && (
              <li className="flex gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-brand-600"><Send className="h-5 w-5" /></span>
                <div><p className="font-semibold text-navy-900">Follow Us</p><SocialLinks className="mt-2" /></div></li>
            )}
          </ul>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl items-center gap-8 px-4 pb-14 sm:px-6 lg:grid-cols-[1fr_1.6fr] lg:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Our location</p>
          <h2 className="mt-2 text-3xl font-bold text-navy-900">Find Us Here</h2>
          <p className="mt-3 text-slate-600">We are based in Lagos, Nigeria, and proudly support SMEs across the state.</p>
          <Button variant="outline-brand" className="mt-5" href={`https://www.openstreetmap.org/?mlat=${LAGOS_CENTER[0]}&mlon=${LAGOS_CENTER[1]}#map=12/${LAGOS_CENTER[0]}/${LAGOS_CENTER[1]}`} target="_blank" rel="noopener noreferrer">Get Directions <ArrowRight className="h-4 w-4" /></Button>
        </div>
        <MapContainer center={LAGOS_CENTER} zoom={11} scrollWheelZoom={false} className="h-72 w-full">
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={LAGOS_CENTER} icon={pin}><Tooltip permanent direction="right" offset={[12, 0]}><strong>DeliverSME</strong><br />Lagos, Nigeria</Tooltip></Marker>
        </MapContainer>
      </section>
    </>
  );
}
