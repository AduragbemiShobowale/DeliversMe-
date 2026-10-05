import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { useAuth } from '@/app/providers/AuthProvider';
import { useAsync } from '@/hooks/useAsync';
import { deliveriesForAnalytics } from '@/services/deliveries';
import { Card, CardHeader, PageHeader, StatCard } from '@/components/common/Card';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/common/States';
import { Input } from '@/components/forms/Fields';
import { toISODate } from '@/utils/format';
import { computeAnalytics } from '@/features/deliveries/analytics';
import { NoBusiness } from './BusinessDashboard';

export default function AnalyticsPage() {
  const { business } = useAuth();
  const today = new Date();
  const [range, setRange] = useState({ from: toISODate(new Date(today.getTime() - 29 * 86400000)), to: toISODate(today) });
  const bid = business?.id;
  const invalid = range.from > range.to;
  const { data, loading, error, reload } = useAsync(
    () => deliveriesForAnalytics({ business_id: bid }, new Date(`${range.from}T00:00:00`).toISOString(), new Date(`${range.to}T23:59:59.999`).toISOString()),
    [bid, range.from, range.to], { enabled: Boolean(bid) && !invalid },
  );
  const stats = useMemo(() => computeAnalytics(data || []), [data]);
  if (!bid) return <NoBusiness />;

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics & Reports" description="Delivery performance for the selected period."
        action={
          <div className="flex items-end gap-2">
            <Input type="date" label="From" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} />
            <Input type="date" label="To" value={range.to} min={range.from} max={toISODate(today)} onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} />
          </div>
        } />
      {invalid ? <Card><ErrorState title="Check the dates" message="The start date must be before the end date." /></Card>
        : error ? <Card><ErrorState error={error} onRetry={reload} /></Card> : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Total Deliveries" value={stats.total} loading={loading} tone="blue" />
            <StatCard label="Success Rate (of finished)" value={stats.successRate == null ? '—' : `${stats.successRate}%`} loading={loading} tone="green" />
            <StatCard label="Avg. Delivery Time (hours, accept → drop-off)" value={stats.avgHours == null ? '—' : stats.avgHours} loading={loading} tone="violet" />
          </div>
          <Card>
            <CardHeader title="Deliveries Trend" description="Deliveries created per weekday in this period" />
            {loading ? <SkeletonRows /> : !stats.total ? (
              <EmptyState icon={BarChart3} title="No deliveries in this period" message="Pick a wider date range." />
            ) : (
              <div className="h-72 p-4" role="img" aria-label={`Bar chart: ${stats.byWeekday.map((d) => `${d.day} ${d.count}`).join(', ')}`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.byWeekday}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={32} />
                    <Tooltip cursor={{ fill: '#eff6ff' }} />
                    <Bar dataKey="count" name="Deliveries" fill="#0A5CF5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
          <p className="text-xs text-slate-500">Success rate = completed ÷ (completed + cancelled + declined) in the period. Deliveries still in progress are excluded. Limited to the first 5,000 deliveries in the range.</p>
        </>
      )}
    </div>
  );
}
