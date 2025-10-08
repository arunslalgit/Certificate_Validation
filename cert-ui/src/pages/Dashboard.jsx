import { useState, useEffect } from 'react';
import { Container, Title, Grid, Card, Text, Badge, Button, Table, Group, ActionIcon, LoadingOverlay } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconRefresh, IconCheck, IconAlertTriangle, IconX, IconClock } from '@tabler/icons-react';
import { getLatestResults, getDashboardStats } from '../api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export default function Dashboard() {
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState({ total: 0, valid: 0, expiring_soon: 0, expired: 0, error: 0 });
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [resultsRes, statsRes] = await Promise.all([
        getLatestResults(),
        getDashboardStats()
      ]);
      setResults(resultsRes.data.results);
      setStats(statsRes.data);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to load dashboard data',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const checkAllCertificates = () => {
    setChecking(true);
    const eventSource = new EventSource('/api/stream/certificates/check-all');

    let count = 0;

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      count++;
      notifications.show({
        title: data.eai_name,
        message: `${data.status} - ${data.days_until_expiry || 0} days until expiry`,
        color: data.status === 'expired' ? 'red' : data.status === 'expiring_soon' ? 'orange' : 'green',
        autoClose: 3000,
      });
    };

    eventSource.addEventListener('done', () => {
      eventSource.close();
      setChecking(false);
      loadData();
      notifications.show({
        title: 'Complete',
        message: `Checked ${count} certificates`,
        color: 'blue',
      });
    });

    eventSource.onerror = () => {
      eventSource.close();
      setChecking(false);
      notifications.show({
        title: 'Error',
        message: 'Failed to check certificates',
        color: 'red',
      });
    };
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'valid': return 'green';
      case 'expiring_soon': return 'orange';
      case 'expired': return 'red';
      case 'error': return 'gray';
      default: return 'blue';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'valid': return <IconCheck size={16} />;
      case 'expiring_soon': return <IconAlertTriangle size={16} />;
      case 'expired': return <IconX size={16} />;
      case 'error': return <IconAlertTriangle size={16} />;
      default: return <IconClock size={16} />;
    }
  };

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="xl">
        <Title>Certificate Dashboard</Title>
        <Button
          leftSection={<IconRefresh size={16} />}
          onClick={checkAllCertificates}
          loading={checking}
        >
          Check All Certificates
        </Button>
      </Group>

      <Grid mb="xl">
        <Grid.Col span={{ base: 12, xs: 6, md: 2.4 }}>
          <Card withBorder>
            <Text size="sm" c="dimmed">Total</Text>
            <Text size="xl" fw={700}>{stats.total}</Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, xs: 6, md: 2.4 }}>
          <Card withBorder>
            <Text size="sm" c="dimmed">Valid</Text>
            <Text size="xl" fw={700} c="green">{stats.valid || 0}</Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, xs: 6, md: 2.4 }}>
          <Card withBorder>
            <Text size="sm" c="dimmed">Expiring Soon</Text>
            <Text size="xl" fw={700} c="orange">{stats.expiring_soon || 0}</Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, xs: 6, md: 2.4 }}>
          <Card withBorder>
            <Text size="sm" c="dimmed">Expired</Text>
            <Text size="xl" fw={700} c="red">{stats.expired || 0}</Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, xs: 6, md: 2.4 }}>
          <Card withBorder>
            <Text size="sm" c="dimmed">Errors</Text>
            <Text size="xl" fw={700} c="gray">{stats.error || 0}</Text>
          </Card>
        </Grid.Col>
      </Grid>

      <Card withBorder>
        <LoadingOverlay visible={loading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>EAI Name</Table.Th>
              <Table.Th>Environment</Table.Th>
              <Table.Th>URL</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Days Until Expiry</Table.Th>
              <Table.Th>Checked</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {results.map((result) => (
              <Table.Tr key={result.id}>
                <Table.Td>
                  <Text fw={500}>{result.eai_name}</Text>
                  <Text size="xs" c="dimmed">{result.eai_number}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge size="sm" variant="light">
                    {result.environment.toUpperCase()}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {result.url}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={getStatusColor(result.status)}
                    leftSection={getStatusIcon(result.status)}
                  >
                    {result.status.replace('_', ' ')}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text
                    fw={result.days_until_expiry <= 7 ? 700 : 400}
                    c={result.days_until_expiry <= 7 ? 'red' : result.days_until_expiry <= 30 ? 'orange' : undefined}
                  >
                    {result.days_until_expiry !== null ? `${result.days_until_expiry} days` : 'N/A'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {dayjs(result.checked_at).fromNow()}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        {results.length === 0 && !loading && (
          <Text ta="center" py="xl" c="dimmed">
            No certificates configured yet
          </Text>
        )}
      </Card>
    </Container>
  );
}
