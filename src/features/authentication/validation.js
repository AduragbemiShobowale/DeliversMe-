import { z } from 'zod';
import { phoneRegex } from '../deliveries/validation';

export const PASSWORD_RULES = [
  { key: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { key: 'number', label: 'Include a number', test: (v) => /\d/.test(v) },
  { key: 'letter', label: 'Include a letter', test: (v) => /[A-Za-z]/.test(v) },
  { key: 'special', label: 'Include a special character (e.g. !@#)', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export const passwordSchema = z.string().refine(
  (v) => PASSWORD_RULES.every((r) => r.test(v)),
  'Password must have 8+ characters with a letter, a number and a special character',
);

export const ACCOUNT_TYPES = [
  { value: 'sme_owner', label: 'SME / Business Owner', hint: 'Ship goods, manage deliveries' },
  { value: 'rider', label: 'Rider / Transporter', hint: 'Receive and fulfil delivery requests' },
  { value: 'customer', label: 'Client / Customer', hint: 'Send or track your deliveries' },
];

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

export const registerSchema = z
  .object({
    account_type: z.enum(['sme_owner', 'rider', 'customer'], { errorMap: () => ({ message: 'Choose an account type' }) }),
    full_name: z.string().trim().min(2, 'Enter your full name').max(120),
    email: z.string().trim().email('Enter a valid email address'),
    phone: z.string().trim().regex(phoneRegex, 'Enter a valid phone number, e.g. 0802 123 4567'),
    password: passwordSchema,
    business_name: z.string().trim().max(120).optional(),
    business_category: z.string().optional(),
    vehicle_type: z.string().optional(),
    terms: z.literal(true, { errorMap: () => ({ message: 'Accept the Terms of Service to continue' }) }),
  })
  .superRefine((v, ctx) => {
    if (v.account_type === 'sme_owner' && (!v.business_name || v.business_name.trim().length < 2)) {
      ctx.addIssue({ code: 'custom', path: ['business_name'], message: 'Enter your business name' });
    }
  });

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export const emailOnlySchema = z.object({ email: z.string().trim().email('Enter a valid email address') });

// Normalise Nigerian local numbers to +234 format for storage.
export function normalizePhone(raw = '') {
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('234')) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 11) return `+234${digits.slice(1)}`;
  return digits;
}
