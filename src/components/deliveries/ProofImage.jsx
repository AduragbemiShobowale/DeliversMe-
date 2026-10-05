import { Download } from 'lucide-react';
import { useAsync } from '@/hooks/useAsync';
import { getProofUrl } from '@/services/deliveries';
import { Spinner } from '@/components/common/Spinner';
import { Button } from '@/components/common/Button';

export function ProofImage({ path }) {
  const { data: url, loading, error } = useAsync(() => getProofUrl(path), [path], { enabled: Boolean(path) });
  if (!path) return <p className="text-sm text-slate-500">The rider did not attach a photo.</p>;
  if (loading) return <Spinner />;
  if (error || !url) return <p className="text-sm text-red-600">Could not load the proof photo.</p>;
  return (
    <div className="flex flex-wrap items-end gap-4">
      <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt="Proof of delivery" className="h-32 w-44 rounded-lg border border-slate-200 object-cover" /></a>
      <Button variant="outline" size="sm" href={url} target="_blank" rel="noopener noreferrer" download><Download className="h-4 w-4" />Download proof</Button>
    </div>
  );
}
