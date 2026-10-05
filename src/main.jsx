import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import '@/styles/index.css';
import { isSupabaseConfigured } from '@/lib/supabase';
import { AuthProvider } from '@/app/providers/AuthProvider';
import { AppRoutes } from '@/app/routes/AppRoutes';
import { SetupRequired } from '@/pages/public/SetupRequired';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isSupabaseConfigured ? (
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 4000, style: { fontSize: '14px' } }} />
      </BrowserRouter>
    ) : (
      <SetupRequired />
    )}
  </React.StrictMode>,
);
