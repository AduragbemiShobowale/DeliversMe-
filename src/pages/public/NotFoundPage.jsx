import { Button } from '@/components/common/Button';

export default function NotFoundPage() {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="text-6xl font-extrabold text-brand-600">404</p>
      <h1 className="mt-4 text-2xl font-bold text-navy-900">Page not found</h1>
      <p className="mt-2 text-slate-600">The page you are looking for does not exist or has moved.</p>
      <div className="mt-6 flex gap-3"><Button to="/">Go home</Button><Button variant="outline" to="/contact">Contact support</Button></div>
    </section>
  );
}
