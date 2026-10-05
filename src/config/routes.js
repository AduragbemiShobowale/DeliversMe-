/** Where each role opens a delivery. */
export const DELIVERY_PATH = {
  customer: (id) => `/customer/deliveries/${id}`,
  sme_owner: (id) => `/business/deliveries/${id}`,
  rider: (id) => `/rider/jobs/${id}`,
  admin: (id) => `/admin/deliveries/${id}`,
};
export const BASE_PATH = { customer: '/customer', sme_owner: '/business', rider: '/rider', admin: '/admin' };
