import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { SearchInput } from '@/components/common/Controls';
import { Button } from '@/components/common/Button';
import { EmptyState } from '@/components/common/States';

export const FAQS = [
  { cat: 'Getting started', q: 'Which account type should I choose?', a: 'Choose SME / Business Owner if you send goods to customers, Rider / Transporter if you deliver packages, and Client / Customer if you want to request and track deliveries from businesses. The account type cannot be changed by yourself later; contact support if you picked the wrong one.' },
  { cat: 'Getting started', q: 'I did not receive my verification code.', a: 'Check your spam folder, then use “Resend” on the verification screen. Codes expire, so always use the latest one.' },
  { cat: 'Customers', q: 'How do I request a delivery?', a: 'Go to Request Delivery, choose a business, fill in pickup, drop-off and item details and submit. The business will accept or decline your request, and you are notified either way.' },
  { cat: 'Customers', q: 'Can I cancel a delivery?', a: 'Yes, until a rider has accepted the job. After that, contact the business directly — its phone number is shown on the delivery details page.' },
  { cat: 'Businesses', q: 'How do I assign a rider?', a: 'Open My Deliveries, select a pending delivery and click Assign Rider. Only verified riders who are online appear as available. The rider must accept the job before it starts.' },
  { cat: 'Businesses', q: 'Where do I find proof of delivery?', a: 'Open the completed delivery and select the “Proof of Delivery” tab. Photos are stored privately and are only visible to the business, customer, rider and administrators involved.' },
  { cat: 'Riders', q: 'Why am I not receiving jobs?', a: 'New rider accounts must be verified by an administrator, and you must be Online. Businesses offer jobs directly to riders, so keep your profile and vehicle details up to date.' },
  { cat: 'Riders', q: 'Is my location shared all the time?', a: 'No. Your location is only shared while you are Online and the app is open, and it is only visible to businesses and customers on deliveries you are handling.' },
  { cat: 'Account & security', q: 'How do I reset my password?', a: 'On the login page, click “Forgot password?”, enter your email and follow the link we send you.' },
];

export default function HelpPage() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? FAQS.filter((f) => `${f.q} ${f.a} ${f.cat}`.toLowerCase().includes(s)) : FAQS;
  }, [q]);
  return (
    <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-extrabold text-navy-900 sm:text-4xl">Help Center</h1>
      <p className="mt-2 text-slate-600">Answers to common questions about using DeliverSME.</p>
      <SearchInput className="mt-6" value={q} onChange={setQ} placeholder="Search help articles…" label="Search help" />
      {list.length === 0 ? (
        <EmptyState title="No matching answers" message="Try different words, or send us a message." action={<Button to="/contact">Contact support</Button>} />
      ) : (
        <ul className="mt-6 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {list.map((f) => {
            const isOpen = open === f.q;
            return (
              <li key={f.q}>
                <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : f.q)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500">
                  <span><span className="block text-xs font-medium text-brand-600">{f.cat}</span><span className="font-medium text-navy-900">{f.q}</span></span>
                  <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && <p className="px-5 pb-4 text-sm leading-relaxed text-slate-600">{f.a}</p>}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-8 text-sm text-slate-600">Still stuck? <Link to="/contact" className="font-medium text-brand-600 hover:underline">Contact support</Link>.</p>
    </section>
  );
}
