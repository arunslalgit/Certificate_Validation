import { useState, useEffect } from 'react';
import { Container, Title, Button, Table, Badge, Group, Modal, TextInput, Select, PasswordInput, ActionIcon } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrash, IconKey } from '@tabler/icons-react';
import { getUsers, createUser, deleteUser } from '../api';
import { useAuth } from '../AuthContext';
import dayjs from 'dayjs';

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    role: 'user',
    email: '',
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await getUsers();
      setUsers(response.data.users);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to load users',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.username || !formData.password) {
      notifications.show({
        title: 'Validation Error',
        message: 'Username and password are required',
        color: 'red',
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      notifications.show({
        title: 'Validation Error',
        message: 'Passwords do not match',
        color: 'red',
      });
      return;
    }

    if (formData.password.length < 6) {
      notifications.show({
        title: 'Validation Error',
        message: 'Password must be at least 6 characters',
        color: 'red',
      });
      return;
    }

    try {
      await createUser({
        username: formData.username,
        password: formData.password,
        role: formData.role,
        email: formData.email,
      });
      notifications.show({
        title: 'Success',
        message: 'User created successfully',
        color: 'green',
      });
      setModalOpen(false);
      resetForm();
      loadUsers();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.error || 'Failed to create user',
        color: 'red',
      });
    }
  };

  const handleDelete = async (id, username) => {
    if (id === currentUser?.id) {
      notifications.show({
        title: 'Error',
        message: 'You cannot delete your own account',
        color: 'red',
      });
      return;
    }

    if (!confirm(`Are you sure you want to delete user "${username}"?`)) return;

    try {
      await deleteUser(id);
      notifications.show({
        title: 'Success',
        message: 'User deleted successfully',
        color: 'green',
      });
      loadUsers();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to delete user',
        color: 'red',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      confirmPassword: '',
      role: 'user',
      email: '',
    });
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'admin': return 'red';
      case 'user': return 'blue';
      case 'viewer': return 'gray';
      default: return 'gray';
    }
  };

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="xl">
        <Title>User Management</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => {
            resetForm();
            setModalOpen(true);
          }}
        >
          Add User
        </Button>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Username</Table.Th>
            <Table.Th>Email</Table.Th>
            <Table.Th>Role</Table.Th>
            <Table.Th>Created</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {users.map((user) => (
            <Table.Tr key={user.id}>
              <Table.Td>
                <div style={{ fontWeight: 500 }}>
                  {user.username}
                  {user.id === currentUser?.id && (
                    <Badge size="sm" variant="light" ml="xs">You</Badge>
                  )}
                </div>
              </Table.Td>
              <Table.Td>{user.email || '-'}</Table.Td>
              <Table.Td>
                <Badge color={getRoleBadgeColor(user.role)}>
                  {user.role.toUpperCase()}
                </Badge>
              </Table.Td>
              <Table.Td>
                {dayjs(user.created_at).format('MMM D, YYYY')}
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <ActionIcon
                    color="red"
                    variant="light"
                    onClick={() => handleDelete(user.id, user.username)}
                    disabled={user.id === currentUser?.id}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {users.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'gray' }}>
          No users found
        </div>
      )}

      <Modal
        opened={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title="Add User"
        size="md"
      >
        <TextInput
          label="Username"
          placeholder="johndoe"
          required
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          mb="sm"
        />

        <TextInput
          label="Email"
          placeholder="john@example.com"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          mb="sm"
        />

        <Select
          label="Role"
          required
          value={formData.role}
          onChange={(value) => setFormData({ ...formData, role: value })}
          data={[
            { value: 'admin', label: 'Admin - Full access' },
            { value: 'user', label: 'User - Manage certificates' },
            { value: 'viewer', label: 'Viewer - Read only' },
          ]}
          mb="sm"
        />

        <PasswordInput
          label="Password"
          placeholder="Minimum 6 characters"
          required
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          mb="sm"
        />

        <PasswordInput
          label="Confirm Password"
          placeholder="Re-enter password"
          required
          value={formData.confirmPassword}
          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          mb="md"
        />

        <Group justify="flex-end" mt="md">
          <Button variant="light" onClick={() => {
            setModalOpen(false);
            resetForm();
          }}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Create User
          </Button>
        </Group>
      </Modal>
    </Container>
  );
}
