import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { Check } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useAsync } from '@/hooks/useAsync';
import { useDebounce } from '@/hooks/useDebounce';
import { createBusinessDelivery } from '@/services/deliveries';
import { createCustomer, getCustomer, listCustomers } from '@/services/customers';
import { deliveryDetailsSchema, businessCustomerSchema } from '@/features/deliveries/validation';
import { PACKAGE_SIZES } from '@/features/deliveries/status';
import { Card, PageHeader, DetailRow } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/forms/Fields';
import { SearchInput } from '@/components/common/Controls';
import { DeliveryFields, deliveryDefaults } from '@/components/deliveries/DeliveryFields';
import { errorMessage } from '@/lib/errors';
import { NoBusiness } from './BusinessDashboard';

const STEPS = ['Details', 'Recipient', 'Review'];

function Stepper({ step }) {
  return (
    <ol className="mb-6 flex items-center" aria-label="Progress">
      {STEPS.map((label, i) => (
        <li key={label} className="flex flex-1 items-center last:flex-none" aria-current={i === step ? 'step' : undefined}>
          <div className="flex flex-col items-center gap-1">
            <span className={`grid h-8 w-8 place-items-center rounded-full text-sm font-semibold ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className="text-xs font-medium text-slate-600">{label}</span>
          </div>
          {i < STEPS.length - 1 && <span className={`mx-2 mb-5 h-0.5 flex-1 ${i < step ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
        </li>
      ))}
    </ol>
  );
}

function pickDetails(d) {
  if (!d) return deliveryDefaults;
  return {
    ...deliveryDefaults,
    pickup_address: d.pickup_address || '', pickup_lat: d.pickup_lat ?? null, pickup_lng: d.pickup_lng ?? null,
    dropoff_address: d.dropoff_address || '', dropoff_lat: d.dropoff_lat ?? null, dropoff_lng: d.dropoff_lng ?? null,
    item_description: d.item_description || '', package_size: d.package_size || 'small', priority: d.priority || 'standard',
    special_instructions: d.special_instructions || '',
  };
}

function RecipientStep({ businessId, selected, onSelect, draft, setDraft, draftErrors }) {
  const [search, setSearch] = useState('');
  const q = useDebounce(search, 250);
  const { data, loading } = useAsync(() => listCustomers(businessId, { search: q, pageSize: 8 }), [businessId, q]);
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-sm font-semibold text-navy-900">Select existing customer</p>
        <SearchInput value={search} onChange={setSearch} placeholder="Search customers by name or phone…" label="Search customers" />
        <ul className="mt-2 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200" role="listbox" aria-label="Customers">
          {loading && <li className="p-3 text-sm text-slate-500">Loading…</li>}
          {!loading && !data?.rows?.length && <li className="p-3 text-sm text-slate-500">{q ? 'No customers match.' : 'No saved customers yet. Create one below.'}</li>}
          {data?.rows?.map((c) => (
            <li key={c.id} role="option" aria-selected={selected?.id === c.id}>
              <button type="button" onClick={() => onSelect(c)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-slate-50 focus-visible:bg-brand-50 focus-visible:outline-none ${selected?.id === c.id ? 'bg-brand-50' : ''}`}>
                <span><span className="block font-medium text-navy-900">{c.full_name}</span><span className="text-xs text-slate-500">{c.phone}{c.address ? ` · ${c.address}` : ''}</span></span>
                {selected?.id === c.id && <Check className="h-4 w-4 text-brand-600" aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center gap-3 text-xs font-medium uppercase text-slate-400"><span className="h-px flex-1 bg-slate-200" />or<span className="h-px flex-1 bg-slate-200" /></div>
      <fieldset className="space-y-4" onFocus={() => selected && onSelect(null)}>
        <legend className="mb-2 text-sm font-semibold text-navy-900">Create new customer</legend>
        <Input label="Full name" value={draft.full_name} error={draftErrors.full_name} onChange={(e) => setDraft({ ...draft, full_name: e.target.value })} placeholder="Enter customer name" />
        <Input label="Phone number" type="tel" value={draft.phone} error={draftErrors.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} placeholder="+234 802 123 4567" />
        <Input label="Address (optional)" value={draft.address} error={draftErrors.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} placeholder="Enter customer address" />
      </fieldset>
    </div>
  );
}

export default function CreateDeliveryPage() {
  const { business } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const reorder = state?.reorder;
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState({ full_name: '', phone: '', email: '', address: '' });
  const [draftErrors, setDraftErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const form = useForm({ resolver: zodResolver(deliveryDetailsSchema), defaultValues: pickDetails(reorder) });
  const { register, setValue, watch, trigger, getValues, formState: { errors } } = form;

  // Preselect a customer when reordering or arriving from the Customers page
  const presetId = reorder?.business_customer_id || state?.customerId;
  useEffect(() => {
    if (presetId) getCustomer(presetId).then((c) => c && setSelected(c)).catch(() => {});
  }, [presetId]);

  if (!business) return <NoBusiness />;

  const next = async () => {
    if (step === 0) { if (await trigger()) setStep(1); return; }
    if (step === 1) {
      if (selected) { setStep(2); return; }
      const parsed = businessCustomerSchema.safeParse(draft);
      if (!parsed.success) {
        setDraftErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
        if (!draft.full_name && !draft.phone) toast.error('Select a customer or create a new one');
        return;
      }
      setDraftErrors({});
      setStep(2);
    }
  };

  const recipient = selected || draft;
  const submit = async () => {
    setSaving(true);
    try {
      let customer = selected;
      if (!customer) {
        customer = await createCustomer(business.id, businessCustomerSchema.parse(draft));
        setSelected(customer);
      }
      const d = await createBusinessDelivery(customer.id, getValues());
      navigate(`/business/deliveries/created/${d.id}`, { replace: true, state: { code: d.code } });
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  const v = getValues();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={reorder ? `Reorder #${reorder.code}` : 'Create Delivery'} description="Add a delivery to your dispatch queue." />
      <Card className="p-5 sm:p-6">
        <Stepper step={step} />
        {step === 0 && <DeliveryFields register={register} errors={errors} setValue={setValue} watch={watch} />}
        {step === 1 && <RecipientStep businessId={business.id} selected={selected} onSelect={setSelected} draft={draft} setDraft={setDraft} draftErrors={draftErrors} />}
        {step === 2 && (
          <dl className="divide-y divide-slate-100">
            <DetailRow label="Pickup location">{v.pickup_address}</DetailRow>
            <DetailRow label="Delivery location">{v.dropoff_address}</DetailRow>
            <DetailRow label="Customer">{recipient.full_name}<br /><span className="text-slate-500">{recipient.phone}</span>{!selected && <span className="ml-1 text-xs text-brand-600">(new — will be saved)</span>}</DetailRow>
            <DetailRow label="Item description">{v.item_description}</DetailRow>
            <DetailRow label="Package">{PACKAGE_SIZES.find((p) => p.value === v.package_size)?.label} · {v.priority === 'express' ? 'Express' : 'Standard'}</DetailRow>
            <DetailRow label="Special instructions">{v.special_instructions}</DetailRow>
          </dl>
        )}
        <div className="mt-6 flex justify-between gap-2">
          {step > 0 ? <Button variant="outline" onClick={() => setStep(step - 1)} disabled={saving}>Back</Button> : <Button variant="outline" to="/business/deliveries">Cancel</Button>}
          {step < 2 ? <Button onClick={next}>Next</Button> : <Button onClick={submit} loading={saving}>Confirm &amp; Create</Button>}
        </div>
      </Card>
    </div>
  );
}
