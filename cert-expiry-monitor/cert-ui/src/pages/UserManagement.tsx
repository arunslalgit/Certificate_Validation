import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Button,
  Card,
  Container,
  Group,
  Modal,
  PasswordInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface User {
  id: number;
  username: string;
  role: 'admin' | 'user' | 'viewer';
  email?: string;
  created_at: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    const response = await fetch('/api/users', { credentials: 'include' });
    const data = await response.json();
    setUsers(data.users || []);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleDelete = async (user: User) => {
    if (!window.confirm(`Delete ${user.username}?`)) return;
    const response = await fetch(`/api/users/${user.id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (response.ok) {
      notifications.show({ title: 'User deleted', message: user.username, color: 'green' });
      loadUsers();
    } else {
      notifications.show({ title: 'Delete failed', message: 'Unable to delete user', color: 'red' });
    }
  };

  return (
    <Container size="xl">
      <Group justify="space-between" mb="lg">
        <Text fw={700} size="xl">
          User management
        </Text>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setModalOpen(true)}>
          Add user
        </Button>
      </Group>

      <Card withBorder>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Username</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Created</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {users.map((user) => (
              <Table.Tr key={user.id}>
                <Table.Td>{user.username}</Table.Td>
                <Table.Td>{user.email}</Table.Td>
                <Table.Td>{user.role.toUpperCase()}</Table.Td>
                <Table.Td>{new Date(user.created_at).toLocaleDateString()}</Table.Td>
                <Table.Td>
                  <ActionIcon color="red" variant="subtle" onClick={() => handleDelete(user)}>
                    <IconTrash size={16} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {loading && <Text size="sm">Loading...</Text>}
      </Card>

      <UserModal opened={modalOpen} onClose={() => { setModalOpen(false); loadUsers(); }} />
    </Container>
  );
}

function UserModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'user' | 'viewer'>('user');
  const [email, setEmail] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password, role, email })
    });

    if (response.ok) {
      notifications.show({ title: 'User created', message: username, color: 'green' });
      onClose();
      setUsername('');
      setPassword('');
      setEmail('');
      setRole('user');
    } else {
      const data = await response.json();
      notifications.show({
        title: 'Create failed',
        message: data.error || 'Unable to create user',
        color: 'red'
      });
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Add user">
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput label="Username" required value={username} onChange={(event) => setUsername(event.currentTarget.value)} />
          <PasswordInput label="Password" required value={password} onChange={(event) => setPassword(event.currentTarget.value)} />
          <TextInput label="Email" value={email} onChange={(event) => setEmail(event.currentTarget.value)} />
          <Select
            label="Role"
            data={[
              { value: 'admin', label: 'Admin' },
              { value: 'user', label: 'User' },
              { value: 'viewer', label: 'Viewer' }
            ]}
            value={role}
            onChange={(value) => setRole((value as any) || 'user')}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
