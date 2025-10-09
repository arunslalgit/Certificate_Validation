import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import AppLayout from '@/components/AppLayout';
import SimpleLogin from '@/components/SimpleLogin';
import { AuthWrapper } from '@/components/AuthWrapper';
import { ThemeProvider } from '@/contexts/ThemeContext';
import Dashboard from '@/pages/Dashboard';
import RunNow from '@/pages/RunNow';
import Results from '@/pages/Results';
import CertificateManagement from '@/pages/CertificateManagement';
import UserManagement from '@/pages/UserManagement';
import SystemSettings from '@/pages/SystemSettings';

export default function App() {
  return (
    <ThemeProvider>
      <MantineProvider withNormalizeCSS withGlobalStyles>
        <Notifications />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<SimpleLogin />} />
            <Route
              path="/*"
              element={
                <AuthWrapper>
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/run-now" element={<RunNow />} />
                      <Route path="/results" element={<Results />} />
                      <Route path="/certificates" element={<CertificateManagement />} />
                      <Route path="/users" element={<UserManagement />} />
                      <Route path="/settings" element={<SystemSettings />} />
                    </Routes>
                  </AppLayout>
                </AuthWrapper>
              }
            />
          </Routes>
        </BrowserRouter>
      </MantineProvider>
    </ThemeProvider>
  );
}
