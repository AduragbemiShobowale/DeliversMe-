const env = import.meta.env;

export const site = {
  name: 'DeliverSME',
  tagline: 'Delivering Possibilities',
  // PLACEHOLDER contact details shown until the real ones are set via env. Replace before launch.
  supportPhone: env.VITE_SUPPORT_PHONE || '+234 800 000 0000',
  supportEmail: env.VITE_SUPPORT_EMAIL || 'support@deliversme.ng',
  hours: 'Mon – Fri, 9:00 AM – 5:00 PM (WAT)',
  address: env.VITE_SUPPORT_ADDRESS || '15 Herbert Macaulay Way, Yaba',
  location: 'Lagos, Nigeria',
  social: [
    { key: 'linkedin', label: 'LinkedIn', href: env.VITE_SOCIAL_LINKEDIN },
    { key: 'x', label: 'X', href: env.VITE_SOCIAL_X },
    { key: 'instagram', label: 'Instagram', href: env.VITE_SOCIAL_INSTAGRAM },
    { key: 'facebook', label: 'Facebook', href: env.VITE_SOCIAL_FACEBOOK },
  ].filter((s) => Boolean(s.href)),
};

export function siteUrl() {
  return env.VITE_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
}

export const LAGOS_CENTER = [6.5244, 3.3792];

export const ROLE_HOME = {
  customer: '/customer',
  sme_owner: '/business',
  rider: '/rider',
  admin: '/admin',
};

export const ROLE_LABEL = {
  customer: 'Customer',
  sme_owner: 'SME Owner',
  rider: 'Rider',
  admin: 'Administrator',
};

export const BUSINESS_CATEGORIES = [
  { value: 'retail', label: 'Retail' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'food', label: 'Food' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'other', label: 'Other' },
];

export const VEHICLE_TYPES = [
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'bicycle', label: 'Bicycle' },
  { value: 'tricycle', label: 'Tricycle (Keke)' },
  { value: 'car', label: 'Car' },
  { value: 'van', label: 'Van' },
];

export const PAGE_SIZE = 10;
