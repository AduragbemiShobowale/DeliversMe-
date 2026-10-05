import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { RoleRedirect } from "./RoleRedirect";

import { LoginPage } from "../features/auth/components/LoginPage";
import { SignupPage } from "../features/auth/components/SignupPage";
import { InviteAcceptPage } from "../features/auth/components/InviteAcceptPage";
import { CustomerSignupPage } from "../features/auth/components/CustomerSignupPage";

/**
 * Route tree per Stage 6 Information Architecture.
 *
 * Each shell is lazy-loaded via React.lazy, which is what makes the
 * Owner/Rider bundle split (Stage 6, reaffirmed Stage 14) a build-time
 * fact rather than an aspiration: a rider's browser never downloads
 * OwnerLayout or its dashboard/chart-heavy pages, and vice versa.
 * Verified against a real `vite build` output during Phase 1 — the
 * initial eager-import version produced one 528KB bundle, which
 * silently broke this promise, so it was corrected here rather than
 * deferred to a later phase to notice.
 *
 * ProtectedRoute is navigation convenience only — see its own doc
 * comment. RLS (Stage 16) is what actually secures the data these
 * routes will eventually render.
 */
const OwnerLayout = lazy(() =>
  import("../shells/owner/OwnerLayout").then((m) => ({ default: m.OwnerLayout }))
);
const DashboardPage = lazy(() =>
  import("../shells/owner/pages/DashboardPage").then((m) => ({ default: m.DashboardPage }))
);
const DeliveriesPage = lazy(() =>
  import("../shells/owner/pages/DeliveriesPage").then((m) => ({ default: m.DeliveriesPage }))
);
const DeliveryDetailPage = lazy(() =>
  import("../shells/owner/pages/DeliveryDetailPage").then((m) => ({ default: m.DeliveryDetailPage }))
);
const CustomersPage = lazy(() =>
  import("../shells/owner/pages/CustomersPage").then((m) => ({ default: m.CustomersPage }))
);
const OwnerRidersPage = lazy(() =>
  import("../shells/owner/pages/RidersPage").then((m) => ({ default: m.RidersPage }))
);
const SettingsPage = lazy(() =>
  import("../shells/owner/pages/SettingsPage").then((m) => ({ default: m.SettingsPage }))
);

const RiderLayout = lazy(() =>
  import("../shells/rider/RiderLayout").then((m) => ({ default: m.RiderLayout }))
);
const JobsPage = lazy(() =>
  import("../shells/rider/pages/JobsPage").then((m) => ({ default: m.JobsPage }))
);
const HistoryPage = lazy(() =>
  import("../shells/rider/pages/HistoryPage").then((m) => ({ default: m.HistoryPage }))
);

const AdminLayout = lazy(() =>
  import("../shells/admin/AdminLayout").then((m) => ({ default: m.AdminLayout }))
);
const BusinessesPage = lazy(() =>
  import("../shells/admin/pages/BusinessesPage").then((m) => ({ default: m.BusinessesPage }))
);
const AdminRidersPage = lazy(() =>
  import("../shells/admin/pages/RidersPage").then((m) => ({ default: m.RidersPage }))
);

const CustomerLayout = lazy(() =>
  import("../shells/customer/CustomerLayout").then((m) => ({ default: m.CustomerLayout }))
);
const MyDeliveriesPage = lazy(() =>
  import("../shells/customer/pages/MyDeliveriesPage").then((m) => ({ default: m.MyDeliveriesPage }))
);

function RouteFallback() {
  return (
    <div className="flex h-screen items-center justify-center text-sm text-[var(--color-text-secondary)]">
      Loading…
    </div>
  );
}

function withSuspense(element: React.ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>;
}

export const router = createBrowserRouter([
  { path: "/", element: <RoleRedirect /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <SignupPage /> },
  { path: "/signup/customer", element: <CustomerSignupPage /> },
  { path: "/invite", element: <InviteAcceptPage /> },

  {
    element: <ProtectedRoute allowedRoles={["owner"]} />,
    children: [
      {
        path: "/owner",
        element: withSuspense(<OwnerLayout />),
        children: [
          { path: "dashboard", element: withSuspense(<DashboardPage />) },
          { path: "deliveries", element: withSuspense(<DeliveriesPage />) },
          { path: "deliveries/:id", element: withSuspense(<DeliveryDetailPage />) },
          { path: "customers", element: withSuspense(<CustomersPage />) },
          { path: "riders", element: withSuspense(<OwnerRidersPage />) },
          { path: "settings", element: withSuspense(<SettingsPage />) },
        ],
      },
    ],
  },

  {
    element: <ProtectedRoute allowedRoles={["rider"]} />,
    children: [
      {
        path: "/rider",
        element: withSuspense(<RiderLayout />),
        children: [
          { path: "jobs", element: withSuspense(<JobsPage />) },
          { path: "history", element: withSuspense(<HistoryPage />) },
        ],
      },
    ],
  },

  {
    element: <ProtectedRoute allowedRoles={["customer"]} />,
    children: [
      {
        path: "/customer",
        element: withSuspense(<CustomerLayout />),
        children: [{ path: "deliveries", element: withSuspense(<MyDeliveriesPage />) }],
      },
    ],
  },

  {
    element: <ProtectedRoute allowedRoles={["admin"]} />,
    children: [
      {
        path: "/admin",
        element: withSuspense(<AdminLayout />),
        children: [
          { path: "businesses", element: withSuspense(<BusinessesPage />) },
          { path: "riders", element: withSuspense(<AdminRidersPage />) },
        ],
      },
    ],
  },
]);
