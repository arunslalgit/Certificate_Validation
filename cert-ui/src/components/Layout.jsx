import { useState } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { AppShell, Burger, Group, NavLink as MantineNavLink, Text, Button, Divider } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconDashboard, IconCertificate, IconLogout, IconLock, IconUsers, IconSettings, IconBell } from '@tabler/icons-react';
import { useAuth } from '../AuthContext';
import { logout } from '../api';

export default function Layout() {
  const [opened, { toggle }] = useDisclosure();
  const navigate = useNavigate();
  const { user, setUser, isAdmin } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      navigate('/login');
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Group gap="xs">
              <IconLock size={24} />
              <Text size="lg" fw={700}>Certificate Monitor</Text>
            </Group>
          </Group>
          <Group>
            <Text size="sm">
              {user?.username} ({user?.role})
            </Text>
            <Button
              variant="light"
              size="sm"
              leftSection={<IconLogout size={16} />}
              onClick={handleLogout}
            >
              Logout
            </Button>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <MantineNavLink
          component={NavLink}
          to="/"
          label="Dashboard"
          leftSection={<IconDashboard size={20} />}
          style={({ isActive }) => ({
            backgroundColor: isActive ? 'var(--mantine-color-blue-light)' : undefined,
          })}
        />
        <MantineNavLink
          component={NavLink}
          to="/certificates"
          label="Certificates"
          leftSection={<IconCertificate size={20} />}
          style={({ isActive }) => ({
            backgroundColor: isActive ? 'var(--mantine-color-blue-light)' : undefined,
          })}
        />
        <MantineNavLink
          component={NavLink}
          to="/alerts"
          label="Alert Logs"
          leftSection={<IconBell size={20} />}
          style={({ isActive }) => ({
            backgroundColor: isActive ? 'var(--mantine-color-blue-light)' : undefined,
          })}
        />

        {isAdmin && (
          <>
            <Divider my="sm" label="Admin" labelPosition="center" />
            <MantineNavLink
              component={NavLink}
              to="/users"
              label="Users"
              leftSection={<IconUsers size={20} />}
              style={({ isActive }) => ({
                backgroundColor: isActive ? 'var(--mantine-color-blue-light)' : undefined,
              })}
            />
            <MantineNavLink
              component={NavLink}
              to="/settings"
              label="Settings"
              leftSection={<IconSettings size={20} />}
              style={({ isActive }) => ({
                backgroundColor: isActive ? 'var(--mantine-color-blue-light)' : undefined,
              })}
            />
          </>
        )}
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
