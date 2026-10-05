import { z } from 'zod';

export const phoneRegex = /^\+?[0-9 ()-]{7,20}$/;
const optionalPhone = z.string().trim().refine((v) => v === '' || phoneRegex.test(v), 'Enter a valid phone number, e.g. +234 802 123 4567');
const coord = z.number().nullable().optional();

export const deliveryDetailsSchema = z.object({
  pickup_address: z.string().trim().min(5, 'Enter the full pickup address').max(300),
  pickup_lat: coord,
  pickup_lng: coord,
  dropoff_address: z.string().trim().min(5, 'Enter the full drop-off address').max(300),
  dropoff_lat: coord,
  dropoff_lng: coord,
  item_description: z.string().trim().min(2, 'Describe the item').max(300),
  package_size: z.enum(['small', 'medium', 'large']),
  priority: z.enum(['standard', 'express']),
  special_instructions: z.string().trim().max(500, 'Keep notes under 500 characters').optional().or(z.literal('')),
});

export const customerRequestSchema = deliveryDetailsSchema.extend({
  recipient_name: z.string().trim().max(120).optional().or(z.literal('')),
  recipient_phone: optionalPhone.optional(),
});

export const businessCustomerSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter the customer name').max(120),
  phone: z.string().trim().regex(phoneRegex, 'Enter a valid phone number'),
  email: z.string().trim().email('Enter a valid email').max(254).optional().or(z.literal('')),
  address: z.string().trim().max(300).optional().or(z.literal('')),
});

export const cancelSchema = z.object({ reason: z.string().trim().max(300).optional() });

// Build the RPC argument object from validated form values (empty strings → null)
export function toDeliveryRpcArgs(values) {
  const n = (v) => (v === '' || v === undefined ? null : v);
  return {
    p_pickup_address: values.pickup_address,
    p_dropoff_address: values.dropoff_address,
    p_item_description: values.item_description,
    p_recipient_name: n(values.recipient_name),
    p_recipient_phone: n(values.recipient_phone),
    p_package_size: values.package_size,
    p_priority: values.priority,
    p_special_instructions: n(values.special_instructions),
    p_pickup_lat: n(values.pickup_lat),
    p_pickup_lng: n(values.pickup_lng),
    p_dropoff_lat: n(values.dropoff_lat),
    p_dropoff_lng: n(values.dropoff_lng),
  };
}
