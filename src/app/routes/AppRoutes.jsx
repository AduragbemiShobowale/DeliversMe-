import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { GuestOnly, RequireRole, RequireSession } from '@/app/guards/guards';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { FullPageSpinner } from '@/components/common/Spinner';

const p = (loader) => lazy(loader);

// Public
const HomePage = p(() => import('@/pages/public/HomePage'));
const HowItWorksPage = p(() => import('@/pages/public/HowItWorksPage'));
const RolePage = p(() => import('@/pages/public/RolePage'));
const AboutPage = p(() => import('@/pages/public/AboutPage'));
const ContactPage = p(() => import('@/pages/public/ContactPage'));
const HelpPage = p(() => import('@/pages/public/HelpPage'));
const LegalPage = p(() => import('@/pages/public/LegalPage'));
const NotFoundPage = p(() => import('@/pages/public/NotFoundPage'));
// Auth
const LoginPage = p(() => import('@/pages/auth/LoginPage'));
const RegisterPage = p(() => import('@/pages/auth/RegisterPage'));
const VerifyEmailPage = p(() => import('@/pages/auth/VerifyEmailPage'));
const ResetPasswordPage = p(() => import('@/pages/auth/ResetPasswordPage'));
const OnboardingPage = p(() => import('@/pages/auth/OnboardingPage'));
// Shared (role-aware)
const DeliveryDetailsPage = p(() => import('@/pages/shared/DeliveryDetailsPage'));
const NotificationsPage = p(() => import('@/pages/shared/NotificationsPage'));
const SettingsPage = p(() => import('@/pages/shared/SettingsPage'));
// Customer
const CustomerDashboard = p(() => import('@/pages/customer/CustomerDashboard'));
const FindBusinessPage = p(() => import('@/pages/customer/FindBusinessPage'));
const RequestDeliveryPage = p(() => import('@/pages/customer/RequestDeliveryPage'));
const RequestSubmittedPage = p(() => import('@/pages/customer/RequestSubmittedPage'));
const CustomerDeliveriesPage = p(() => import('@/pages/customer/CustomerDeliveriesPage'));
const MyBusinessesPage = p(() => import('@/pages/customer/MyBusinessesPage'));
// Business
const BusinessDashboard = p(() => import('@/pages/business/BusinessDashboard'));
const CreateDeliveryPage = p(() => import('@/pages/business/CreateDeliveryPage'));
const DeliveryCreatedPage = p(() => import('@/pages/business/DeliveryCreatedPage'));
const BusinessDeliveriesPage = p(() => import('@/pages/business/BusinessDeliveriesPage'));
const AssignRiderPage = p(() => import('@/pages/business/AssignRiderPage'));
const CustomersPage = p(() => import('@/pages/business/CustomersPage'));
const RidersPage = p(() => import('@/pages/business/RidersPage'));
const AnalyticsPage = p(() => import('@/pages/business/AnalyticsPage'));
// Rider
const RiderDashboard = p(() => import('@/pages/rider/RiderDashboard'));
const AvailableJobsPage = p(() => import('@/pages/rider/AvailableJobsPage'));
const JobPage = p(() => import('@/pages/rider/JobPage'));
const RiderDeliveriesPage = p(() => import('@/pages/rider/RiderDeliveriesPage'));
// Admin
const AdminDashboard = p(() => import('@/pages/admin/AdminDashboard'));
const AdminUsersPage = p(() => import('@/pages/admin/AdminUsersPage'));
const AdminBusinessesPage = p(() => import('@/pages/admin/AdminBusinessesPage'));
const AdminRidersPage = p(() => import('@/pages/admin/AdminRidersPage'));
const AdminDeliveriesPage = p(() => import('@/pages/admin/AdminDeliveriesPage'));
const AdminMessagesPage = p(() => import('@/pages/admin/AdminMessagesPage'));

export function AppRoutes() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="how-it-works" element={<HowItWorksPage />} />
          <Route path="for/:role" element={<RolePage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="help" element={<HelpPage />} />
          <Route path="privacy" element={<LegalPage kind="privacy" />} />
          <Route path="terms" element={<LegalPage kind="terms" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route element={<GuestOnly />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
        </Route>
        {/* Outside GuestOnly so the success modal can show after the code signs the user in */}
        <Route path="verify-email" element={<VerifyEmailPage />} />
        {/* Reachable from the recovery email link (which signs the user in temporarily) */}
        <Route path="reset-password" element={<ResetPasswordPage />} />
        <Route element={<RequireSession />}>
          <Route path="onboarding" element={<OnboardingPage />} />
        </Route>

        <Route element={<RequireRole roles={['customer']} />}>
          <Route path="customer" element={<DashboardLayout />}>
            <Route index element={<CustomerDashboard />} />
            <Route path="request" element={<FindBusinessPage />} />
            <Route path="request/:businessId" element={<RequestDeliveryPage />} />
            <Route path="request/submitted/:id" element={<RequestSubmittedPage />} />
            <Route path="deliveries" element={<CustomerDeliveriesPage />} />
            <Route path="deliveries/:id" element={<DeliveryDetailsPage />} />
            <Route path="my-businesses" element={<MyBusinessesPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<Navigate to="profile" replace />} />
            <Route path="settings/:tab" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route element={<RequireRole roles={['sme_owner']} />}>
          <Route path="business" element={<DashboardLayout />}>
            <Route index element={<BusinessDashboard />} />
            <Route path="deliveries" element={<BusinessDeliveriesPage />} />
            <Route path="deliveries/new" element={<CreateDeliveryPage />} />
            <Route path="deliveries/created/:id" element={<DeliveryCreatedPage />} />
            <Route path="deliveries/:id" element={<DeliveryDetailsPage />} />
            <Route path="deliveries/:id/assign" element={<AssignRiderPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="riders" element={<RidersPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<Navigate to="profile" replace />} />
            <Route path="settings/:tab" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route element={<RequireRole roles={['rider']} />}>
          <Route path="rider" element={<DashboardLayout />}>
            <Route index element={<RiderDashboard />} />
            <Route path="jobs" element={<AvailableJobsPage />} />
            <Route path="jobs/:id" element={<JobPage />} />
            <Route path="deliveries" element={<RiderDeliveriesPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<Navigate to="profile" replace />} />
            <Route path="settings/:tab" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route element={<RequireRole roles={['admin']} />}>
          <Route path="admin" element={<DashboardLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="businesses" element={<AdminBusinessesPage />} />
            <Route path="riders" element={<AdminRidersPage />} />
            <Route path="deliveries" element={<AdminDeliveriesPage />} />
            <Route path="deliveries/:id" element={<DeliveryDetailsPage />} />
            <Route path="messages" element={<AdminMessagesPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings" element={<Navigate to="profile" replace />} />
            <Route path="settings/:tab" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
