import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import toast from 'react-hot-toast';
import { ArrowLeft, Store } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useAsync } from '@/hooks/useAsync';
import { getBusiness } from '@/services/businesses';
import { createDeliveryRequest } from '@/services/deliveries';
import { customerRequestSchema } from '@/features/deliveries/validation';
import { Card, PageHeader } from '@/components/common/Card';
import { Button } from '@/components/common/Button';
import { Avatar } from '@/components/common/Avatar';
import { EmptyState, ErrorState } from '@/components/common/States';
import { FullPageSpinner } from '@/components/common/Spinner';
import { Input } from '@/components/forms/Fields';
import { DeliveryFields, deliveryDefaults } from '@/components/deliveries/DeliveryFields';
import { errorMessage } from '@/lib/errors';

export default function RequestDeliveryPage() {
  const { businessId } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const biz = useAsync(() => getBusiness(businessId), [businessId]);
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(customerRequestSchema),
    defaultValues: { ...deliveryDefaults, recipient_name: profile?.full_name || '', recipient_phone: profile?.phone || '' },
  });

  if (biz.loading) return <FullPageSpinner />;
  if (biz.error) return <ErrorState error={biz.error} onRetry={biz.reload} />;
  if (!biz.data) {
    return <EmptyState icon={Store} title="Business not found" message="It may have been removed or is not accepting requests."
      action={<Button to="/customer/request">Browse businesses</Button>} />;
  }
  const b = biz.data;

  const onSubmit = async (values) => {
    try {
      const d = await createDeliveryRequest(b.id, values);
      navigate(`/customer/request/submitted/${d.id}`, { replace: true, state: { businessName: b.name } });
    } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Request a Delivery"
        back={<Link to="/customer/request" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy-900"><ArrowLeft className="h-4 w-4" />Back to businesses</Link>} />
      <Card className="p-5 sm:p-6">
        <div className="mb-6 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <Avatar name={b.name} src={b.logo_url} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-navy-900">{b.name}</p>
            <p className="truncate text-xs text-slate-500">{b.tagline || b.address || b.category}</p>
          </div>
          <Link to="/customer/request" className="text-sm font-semibold text-brand-600 hover:underline">Change</Link>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <DeliveryFields register={register} errors={errors} setValue={setValue} watch={watch} />
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold text-navy-900">Recipient (defaults to you)</legend>
            <Input label="Recipient name" error={errors.recipient_name?.message} {...register('recipient_name')} />
            <Input label="Recipient phone" type="tel" placeholder="+234 802 123 4567" error={errors.recipient_phone?.message} {...register('recipient_phone')} />
          </fieldset>
          <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>Submit Request</Button>
        </form>
      </Card>
    </div>
  );
}
