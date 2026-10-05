import { useLocation, useParams } from 'react-router-dom';
import { Card } from '@/components/common/Card';
import { Button } from '@/components/common/Button';

export default function DeliveryCreatedPage() {
  const { id } = useParams();
  const { state } = useLocation();
  return (
    <Card className="mx-auto mt-6 max-w-md p-8 text-center">
      <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-50 text-emerald-600">
        <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <h1 className="mt-5 text-xl font-bold text-navy-900">Delivery Created Successfully!</h1>
      <p className="mt-2 text-sm text-slate-600">
        {state?.code ? `Delivery #${state.code}` : 'Your delivery'} has been added to the dispatch queue. Assign a rider to get it moving.
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <Button to={`/business/deliveries/${id}/assign`}>Assign a Rider Now</Button>
        <Button variant="outline-brand" to="/business/deliveries">View in My Deliveries</Button>
        <Button variant="ghost" to="/business/deliveries/new">Create Another Delivery</Button>
      </div>
    </Card>
  );
}
