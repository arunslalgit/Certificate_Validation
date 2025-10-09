import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Avatar, Button, Group, Loader, Menu, Text } from '@mantine/core';

interface User {
  id: number;
  username: string;
  role: 'admin' | 'user' | 'viewer';
  email?: string;
}

interface AuthContextValue {
  user: User | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = (globalThis as any).AuthContext || null;

let authContextSingleton: AuthContextValue | null = null;

function createAuthContextValue(navigate: ReturnType<typeof useNavigate>) {
  const state: { user: User | null } = { user: null };

  const refresh = async () => {
    try {
      const { data } = await axios.get('/api/auth/me', { withCredentials: true });
      state.user = data.user;
    } catch {
      state.user = null;
    }
  };

  const logout = async () => {
    await axios.post('/api/auth/logout', {}, { withCredentials: true });
    state.user = null;
    navigate('/login');
  };

  return {
    get user() {
      return state.user;
    },
    refresh,
    logout
  } as AuthContextValue;
}

export function useSimpleAuth() {
  if (!authContextSingleton) {
    throw new Error('Auth context not initialized');
  }
  return authContextSingleton;
}

export function UserMenu() {
  const auth = useSimpleAuth();
  const user = auth.user;

  if (!user) {
    return null;
  }

  return (
    <Menu>
      <Menu.Target>
        <Group gap="xs">
          <Avatar radius="xl">{user.username.slice(0, 2).toUpperCase()}</Avatar>
          <div>
            <Text fw={600}>{user.username}</Text>
            <Text size="xs" c="dimmed">
              {user.role.toUpperCase()}
            </Text>
          </div>
        </Group>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={() => auth.logout()}>Sign out</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

export function AuthWrapper({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [initializing, setInitializing] = useState(true);
  const [, setTick] = useState(0);

  if (!authContextSingleton) {
    authContextSingleton = createAuthContextValue(navigate);
  }

  useEffect(() => {
    const init = async () => {
      await authContextSingleton!.refresh();
      if (!authContextSingleton!.user) {
        navigate('/login', { replace: true });
      } else {
        setTick((t) => t + 1);
      }
      setInitializing(false);
    };
    init();
  }, [navigate]);

  if (initializing) {
    return (
      <Group justify="center" mt="xl">
        <Loader />
      </Group>
    );
  }

  if (!authContextSingleton?.user) {
    return null;
  }

  return <>{children}</>;
}
