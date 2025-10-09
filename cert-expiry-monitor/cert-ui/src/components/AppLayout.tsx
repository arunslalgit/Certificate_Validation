import { ReactNode } from 'react';
import { AppShell, Group, NavLink, Text } from '@mantine/core';
import { IconCertificate, IconHome, IconList, IconRefresh, IconSettings, IconUsers } from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSimpleAuth, UserMenu } from '@/components/AuthWrapper';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useSimpleAuth();
  const user = auth.user;

  const menuItems = [
    { path: '/', label: 'Dashboard', icon: IconHome },
    { path: '/run-now', label: 'Run Now', icon: IconRefresh },
    { path: '/results', label: 'Results', icon: IconList },
    { path: '/certificates', label: 'Certificates', icon: IconCertificate }
  ];

  if (user?.role === 'admin') {
    menuItems.push({ path: '/users', label: 'Users', icon: IconUsers });
    menuItems.push({ path: '/settings', label: 'Settings', icon: IconSettings });
  }

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 240, breakpoint: 'sm' }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Text fw={700} size="lg">
            Cert Monitor
          </Text>
          <UserMenu />
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            label={item.label}
            leftSection={<item.icon size={18} />}
            active={location.pathname === item.path}
            onClick={() => navigate(item.path)}
          />
        ))}
      </AppShell.Navbar>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
