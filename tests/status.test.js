import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  STATUSES, TRANSITIONS, TERMINAL, canTransition, canCancel, nextRiderAction, stepState, STATUS_META,
} from '@/features/deliveries/status';

// Parse app.valid_transition() out of the migration so the browser copy can never drift from the DB.
function sqlTransitions() {
  const dir = join(__dirname, '..', 'supabase', 'migrations');
  const file = readdirSync(dir).find((f) => f.endsWith('_functions_triggers.sql'));
  const sql = readFileSync(join(dir, file), 'utf8');
  const body = sql.slice(sql.indexOf('function app.valid_transition'), sql.indexOf('$$;', sql.indexOf('function app.valid_transition')));
  const pairs = [...body.matchAll(/\('(\w+)'(?:::public\.delivery_status)?,\s*'(\w+)'(?:::public\.delivery_status)?\)/g)].map((m) => `${m[1]}>${m[2]}`);
  return new Set(pairs);
}

describe('delivery state machine', () => {
  it('matches app.valid_transition() in the SQL migration exactly', () => {
    const sql = sqlTransitions();
    const js = new Set(Object.entries(TRANSITIONS).flatMap(([from, tos]) => tos.map((to) => `${from}>${to}`)));
    expect(sql.size).toBeGreaterThan(10);
    expect([...js].sort()).toEqual([...sql].sort());
  });

  it('has metadata for every status and no exits from terminal states', () => {
    STATUSES.forEach((s) => expect(STATUS_META[s]).toBeDefined());
    TERMINAL.forEach((s) => expect(TRANSITIONS[s]).toEqual([]));
  });

  it('rejects skipping steps', () => {
    expect(canTransition('pending', 'delivered')).toBe(false);
    expect(canTransition('accepted', 'arrived')).toBe(false);
    expect(canTransition('arrived', 'delivered')).toBe(true);
  });

  it('gives the rider one next action per active status', () => {
    expect(nextRiderAction('accepted').to).toBe('picked_up');
    expect(nextRiderAction('picked_up').to).toBe('in_transit');
    expect(nextRiderAction('in_transit').to).toBe('arrived');
    expect(nextRiderAction('arrived').to).toBe('delivered');
    expect(nextRiderAction('delivered')).toBeNull();
    ['accepted', 'picked_up', 'in_transit', 'arrived'].forEach((s) => expect(canTransition(s, nextRiderAction(s).to)).toBe(true));
  });

  it('mirrors cancel_delivery role rules', () => {
    expect(canCancel('customer', 'requested')).toBe(true);
    expect(canCancel('customer', 'accepted')).toBe(false);
    expect(canCancel('sme_owner', 'accepted')).toBe(true);
    expect(canCancel('sme_owner', 'picked_up')).toBe(false);
    expect(canCancel('admin', 'in_transit')).toBe(true);
    expect(canCancel('admin', 'delivered')).toBe(false);
    expect(canCancel('rider', 'accepted')).toBe(false);
  });

  it('computes timeline step states', () => {
    expect(stepState('in_transit', 'picked_up')).toBe('done');
    expect(stepState('in_transit', 'in_transit')).toBe('current');
    expect(stepState('in_transit', 'arrived')).toBe('upcoming');
    expect(stepState('delivered', 'delivered')).toBe('done');
    expect(stepState('cancelled', 'accepted')).toBe('inactive');
  });
});
