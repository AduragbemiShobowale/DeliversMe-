import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canCancel } from '@/features/deliveries/status';

// The cancel_delivery RPC lists the statuses each role may cancel from; keep the UI in sync.
describe('cancel rules vs SQL', () => {
  const sql = readFileSync(join(__dirname, '..', 'supabase', 'migrations', '20260929000004_rpc.sql'), 'utf8');
  const fn = sql.slice(sql.indexOf('function public.cancel_delivery'), sql.indexOf('function public.rate_delivery'));
  it('customer statuses appear in the RPC', () => {
    ['requested', 'pending', 'assigned'].forEach((s) => {
      expect(canCancel('customer', s)).toBe(true);
      expect(fn).toContain(`'${s}'`);
    });
  });
  it('SME may additionally cancel accepted jobs', () => {
    expect(fn).toContain("'accepted'");
    expect(canCancel('sme_owner', 'accepted')).toBe(true);
  });
});
