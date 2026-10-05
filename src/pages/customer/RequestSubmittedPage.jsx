import { useLocation, useParams } from 'react-router-dom';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';

export default function RequestSubmittedPage() {
  const { id } = useParams();
  const { state } = useLocation();
  return (
    <Card className="mx-auto mt-6 max-w-md p-8 text-center">
      <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-50 text-emerald-600">
        <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <h1 className="mt-5 text-xl font-bold text-navy-900">Delivery Request Submitted Successfully!</h1>
      <p className="mt-2 text-sm text-slate-600">
        Your delivery request has been sent to {state?.businessName || 'the business'}. You will be notified once it&apos;s accepted.
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <Button to={`/customer/deliveries/${id}`}>View Delivery Details</Button>
        <Button variant="outline-brand" to="/customer/request">Request Another Delivery</Button>
      </div>
    </Card>
  );
}
