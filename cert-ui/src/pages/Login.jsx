import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Paper, TextInput, PasswordInput, Button, Title, Text, Alert } from '@mantine/core';
import { IconAlertCircle, IconLock } from '@tabler/icons-react';
import { login } from '../api';
import { useAuth } from '../AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await login(username, password);
      setUser(response.data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size={420} my={40}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <IconLock size={48} style={{ marginBottom: 10 }} />
        <Title order={1}>Certificate Monitor</Title>
        <Text c="dimmed" size="sm" mt={5}>
          Sign in to monitor SSL certificates
        </Text>
      </div>

      <Paper withBorder shadow="md" p={30} radius="md">
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextInput
            label="Username"
            placeholder="admin"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            mb="md"
          />

          <PasswordInput
            label="Password"
            placeholder="Your password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            mb="md"
          />

          <Button fullWidth type="submit" loading={loading}>
            Sign in
          </Button>
        </form>

        <Text c="dimmed" size="xs" mt="md" ta="center">
          Default: admin / admin123
        </Text>
      </Paper>
    </Container>
  );
}
