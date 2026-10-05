// Single source of truth for the delivery state machine in the browser.
// MUST match app.valid_transition() in supabase/migrations/*_functions_triggers.sql
// (tests/status.test.js parses the SQL file and fails on drift). The database is authoritative.

export const STATUSES = [
  'requested', 'pending', 'assigned', 'accepted', 'picked_up', 'in_transit', 'arrived', 'delivered', 'cancelled', 'rejected',
];

export const TRANSITIONS = {
  requested: ['pending', 'rejected', 'cancelled'],
  pending: ['assigned', 'cancelled'],
  assigned: ['accepted', 'pending', 'cancelled'],
  accepted: ['picked_up', 'cancelled'],
  picked_up: ['in_transit', 'cancelled'],
  in_transit: ['arrived', 'cancelled'],
  arrived: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
  rejected: [],
};

export const TERMINAL = ['delivered', 'cancelled', 'rejected'];
export const ACTIVE_RIDER = ['accepted', 'picked_up', 'in_transit', 'arrived'];
export const IN_PROGRESS = ['assigned', 'accepted', 'picked_up', 'in_transit', 'arrived'];

export function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

export const STATUS_META = {
  requested: { label: 'Requested', tone: 'amber' },
  pending: { label: 'Pending', tone: 'amber' },
  assigned: { label: 'Awaiting rider', tone: 'violet' },
  accepted: { label: 'Rider assigned', tone: 'blue' },
  picked_up: { label: 'Picked up', tone: 'blue' },
  in_transit: { label: 'In Transit', tone: 'blue' },
  arrived: { label: 'Arrived', tone: 'blue' },
  delivered: { label: 'Completed', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'red' },
  rejected: { label: 'Declined', tone: 'red' },
};

export function statusLabel(status) {
  return STATUS_META[status]?.label || status;
}

// Tracking timeline shown to customers and SMEs (matches the screenshots)
export const TIMELINE_STEPS = [
  { key: 'accepted', label: 'Rider assigned' },
  { key: 'picked_up', label: 'Picked up' },
  { key: 'in_transit', label: 'In transit' },
  { key: 'arrived', label: 'Arrived at destination' },
  { key: 'delivered', label: 'Completed' },
];

const ORDER = ['requested', 'pending', 'assigned', 'accepted', 'picked_up', 'in_transit', 'arrived', 'delivered'];

export function stepState(currentStatus, stepKey) {
  if (currentStatus === 'cancelled' || currentStatus === 'rejected') return 'inactive';
  const cur = ORDER.indexOf(currentStatus);
  const step = ORDER.indexOf(stepKey);
  if (currentStatus === 'delivered' || cur > step) return 'done';
  if (cur === step) return 'current';
  return 'upcoming';
}

// The rider's next action on an active job.
export function nextRiderAction(status) {
  switch (status) {
    case 'accepted': return { to: 'picked_up', label: 'Confirm pickup' };
    case 'picked_up': return { to: 'in_transit', label: 'Start trip' };
    case 'in_transit': return { to: 'arrived', label: 'Mark as arrived' };
    case 'arrived': return { to: 'delivered', label: 'Complete delivery' };
    default: return null;
  }
}

// Mirrors the cancel_delivery RPC so buttons are only shown when they can work.
export function canCancel(role, status) {
  if (role === 'admin') return !TERMINAL.includes(status);
  if (role === 'customer') return ['requested', 'pending', 'assigned'].includes(status);
  if (role === 'sme_owner') return ['requested', 'pending', 'assigned', 'accepted'].includes(status);
  return false;
}

// Tab groups used by delivery lists
export const STATUS_GROUPS = {
  all: null,
  requests: ['requested'],
  pending: ['pending'],
  active: IN_PROGRESS,
  completed: ['delivered'],
  cancelled: ['cancelled', 'rejected'],
};

export const PACKAGE_SIZES = [
  { value: 'small', label: 'Small (under 1kg, envelope)' },
  { value: 'medium', label: 'Medium (1–5kg, box)' },
  { value: 'large', label: 'Large (over 5kg)' },
];

export const PRIORITIES = [
  { value: 'standard', label: 'Standard' },
  { value: 'express', label: 'Express' },
];
