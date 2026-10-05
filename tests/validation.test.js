import { describe, expect, it } from 'vitest';
import { registerSchema, resetPasswordSchema, normalizePhone, ACCOUNT_TYPES } from '@/features/authentication/validation';
import { customerRequestSchema, businessCustomerSchema, toDeliveryRpcArgs } from '@/features/deliveries/validation';

const base = { account_type: 'customer', full_name: 'Ada Obi', email: 'ada@example.com', phone: '0802 123 4567', password: 'Passw0rd!', terms: true };

describe('registration validation', () => {
  it('accepts a valid customer', () => expect(registerSchema.safeParse(base).success).toBe(true));
  it('never offers an admin or clearing-agent account type', () => {
    const values = ACCOUNT_TYPES.map((a) => a.value);
    expect(values).not.toContain('admin');
    expect(values).not.toContain('clearing_agent');
    expect(registerSchema.safeParse({ ...base, account_type: 'admin' }).success).toBe(false);
  });
  it('requires a business name for SME owners', () => {
    const r = registerSchema.safeParse({ ...base, account_type: 'sme_owner' });
    expect(r.success).toBe(false);
    expect(r.error.issues[0].path).toEqual(['business_name']);
    expect(registerSchema.safeParse({ ...base, account_type: 'sme_owner', business_name: 'Mama Put Ltd' }).success).toBe(true);
  });
  it('enforces password strength and terms', () => {
    expect(registerSchema.safeParse({ ...base, password: 'password' }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, terms: false }).success).toBe(false);
  });
  it('checks password confirmation', () => {
    expect(resetPasswordSchema.safeParse({ password: 'Passw0rd!', confirm: 'Passw0rd?' }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ password: 'Passw0rd!', confirm: 'Passw0rd!' }).success).toBe(true);
  });
  it('normalises Nigerian phone numbers', () => {
    expect(normalizePhone('0802 123 4567')).toBe('+2348021234567');
    expect(normalizePhone('2348021234567')).toBe('+2348021234567');
    expect(normalizePhone('+234 802 123 4567')).toBe('+2348021234567');
  });
});

describe('delivery validation', () => {
  const d = { pickup_address: '12 Allen Avenue, Ikeja', dropoff_address: '3 Admiralty Way, Lekki', item_description: 'Documents', package_size: 'small', priority: 'standard', special_instructions: '' };
  it('accepts a complete request and rejects short addresses', () => {
    expect(customerRequestSchema.safeParse({ ...d, recipient_name: '', recipient_phone: '' }).success).toBe(true);
    expect(customerRequestSchema.safeParse({ ...d, pickup_address: 'Ikj' }).success).toBe(false);
    expect(customerRequestSchema.safeParse({ ...d, package_size: 'huge' }).success).toBe(false);
  });
  it('validates business customers', () => {
    expect(businessCustomerSchema.safeParse({ full_name: 'John Doe', phone: 'abc' }).success).toBe(false);
    expect(businessCustomerSchema.safeParse({ full_name: 'John Doe', phone: '+234 812 345 6789', email: '', address: '' }).success).toBe(true);
  });
  it('maps form values to RPC args with empty strings as null', () => {
    const args = toDeliveryRpcArgs({ ...d, recipient_name: '', pickup_lat: 6.5, pickup_lng: 3.3 });
    expect(args.p_recipient_name).toBeNull();
    expect(args.p_special_instructions).toBeNull();
    expect(args.p_pickup_lat).toBe(6.5);
    expect(args.p_dropoff_lat).toBeNull();
    expect(Object.keys(args).every((k) => k.startsWith('p_'))).toBe(true);
  });
});
