import { useState } from 'react';
import { Button, Card, Container, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function SimpleLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await axios.post(
        '/api/auth/login',
        { username, password },
        { withCredentials: true }
      );
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size={420} my={120}>
      <Title ta="center" mb="md">
        Certificate Monitor Login
      </Title>
      <Card withBorder shadow="sm" p="xl">
        <form onSubmit={handleSubmit}>
          <Stack>
            <TextInput
              label="Username"
              required
              value={username}
              onChange={(event) => setUsername(event.currentTarget.value)}
            />
            <PasswordInput
              label="Password"
              required
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />
            {error && (
              <Text c="red" size="sm">
                {error}
              </Text>
            )}
            <Button type="submit" loading={loading}>
              Sign In
            </Button>
          </Stack>
        </form>
      </Card>
    </Container>
  );
}
