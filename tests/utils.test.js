import { describe, expect, it } from 'vitest';
import { distanceKm, formatKm, estimateMinutes, sanitizeSearch, telHref, initials, firstName, timeAgo, greeting, mapsDirectionsUrl } from '@/utils/format';
import { errorMessage, unwrap } from '@/lib/errors';
import { computeAnalytics } from '@/features/deliveries/analytics';

describe('format utils', () => {
  it('computes great-circle distance (Ikeja → Victoria Island ≈ 19 km)', () => {
    const km = distanceKm({ lat: 6.6018, lng: 3.3515 }, { lat: 6.4281, lng: 3.4219 });
    expect(km).toBeGreaterThan(18);
    expect(km).toBeLessThan(22);
    expect(distanceKm(null, { lat: 1, lng: 1 })).toBeNull();
  });
  it('formats distance and ETA', () => {
    expect(formatKm(0.45)).toBe('450 m');
    expect(formatKm(3.21)).toBe('3.2 km');
    expect(formatKm(null)).toBe('—');
    expect(estimateMinutes(9)).toEqual([35, 56]);
  });
  it('strips PostgREST filter syntax from search input', () => {
    expect(sanitizeSearch('a,b.or(id.eq.1)%_*')).toBe('a b.or id.eq.1');
    expect(sanitizeSearch('x'.repeat(100))).toHaveLength(60);
  });
  it('builds tel and map links', () => {
    expect(telHref('+234 802 123-4567')).toBe('tel:+2348021234567');
    expect(telHref('')).toBeUndefined();
    expect(mapsDirectionsUrl('Lekki', 6.4, 3.5)).toContain('destination=6.4,3.5');
    expect(mapsDirectionsUrl('Allen Avenue, Ikeja')).toContain(encodeURIComponent('Allen Avenue, Ikeja'));
  });
  it('handles names and relative time', () => {
    expect(initials('David Okafor')).toBe('DO');
    expect(initials('')).toBe('?');
    expect(firstName('  Tunde Adebayo ')).toBe('Tunde');
    const now = Date.parse('2026-01-01T12:00:00Z');
    expect(timeAgo('2026-01-01T11:55:00Z', now)).toBe('5m ago');
    expect(timeAgo('2026-01-01T11:59:50Z', now)).toBe('just now');
    expect(greeting(new Date('2026-01-01T08:00:00'))).toBe('Good morning');
    expect(greeting(new Date('2026-01-01T19:00:00'))).toBe('Good evening');
  });
});

describe('errors', () => {
  it('maps known auth errors and RPC messages', () => {
    expect(errorMessage({ message: 'Invalid login credentials' })).toBe('Email or password is incorrect.');
    expect(errorMessage({ code: 'P0001', message: 'This job is no longer open' })).toBe('This job is no longer open');
    expect(errorMessage({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe('That record already exists.');
  });
  it('hides internal database details', () => {
    expect(errorMessage({ code: 'XX000', message: 'relation "public.secret" does not exist' })).toBe('Something went wrong. Try again.');
    expect(errorMessage({ message: 'Failed to fetch' })).toMatch(/connection/);
  });
  it('unwrap throws on error', () => {
    expect(unwrap({ data: 1, error: null })).toBe(1);
    expect(() => unwrap({ data: null, error: new Error('x') })).toThrow('x');
  });
});

describe('analytics', () => {
  it('computes totals, success rate and average hours', () => {
    const rows = [
      { status: 'delivered', created_at: '2026-06-01T09:00:00', accepted_at: '2026-06-01T09:00:00Z', delivered_at: '2026-06-01T11:00:00Z' },
      { status: 'delivered', created_at: '2026-06-02T09:00:00', accepted_at: '2026-06-02T09:00:00Z', delivered_at: '2026-06-02T10:00:00Z' },
      { status: 'cancelled', created_at: '2026-06-02T09:00:00' },
      { status: 'in_transit', created_at: '2026-06-03T09:00:00' },
    ];
    const s = computeAnalytics(rows);
    expect(s.total).toBe(4);
    expect(s.successRate).toBe(67);
    expect(s.avgHours).toBe(1.5);
    expect(s.byWeekday.reduce((a, b) => a + b.count, 0)).toBe(4);
    expect(s.byWeekday[0].day).toBe('Mon');
  });
  it('returns nulls with no data', () => {
    const s = computeAnalytics([]);
    expect(s.successRate).toBeNull();
    expect(s.avgHours).toBeNull();
  });
});
