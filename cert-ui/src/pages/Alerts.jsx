import { useState, useEffect } from 'react';
import { Container, Title, Card, Text, Badge, Table, Group, Grid, Select, LoadingOverlay } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconMail, IconBrandTeams, IconCheck, IconX, IconBell } from '@tabler/icons-react';
import { getAlertLogs, getAlertStats } from '../api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({
    email: { sent: 0, failed: 0 },
    teams: { sent: 0, failed: 0 },
    total: { sent: 0, failed: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    loadData();
  }, [statusFilter, typeFilter]);

  const loadData = async () => {
    try {
      const filters = {};
      if (statusFilter) filters.status = statusFilter;
      if (typeFilter) filters.alert_type = typeFilter;

      const [alertsRes, statsRes] = await Promise.all([
        getAlertLogs(filters),
        getAlertStats()
      ]);

      setAlerts(alertsRes.data.alerts);
      setStats(statsRes.data);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to load alert logs',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const getAlertTypeIcon = (type) => {
    return type === 'email' ? <IconMail size={16} /> : <IconBrandTeams size={16} />;
  };

  const getStatusIcon = (status) => {
    return status === 'sent' ? <IconCheck size={16} /> : <IconX size={16} />;
  };

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="xl">
        <Group>
          <IconBell size={32} />
          <Title>Alert Logs (Audit Trail)</Title>
        </Group>
      </Group>

      {/* Statistics Cards */}
      <Grid mb="xl">
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card withBorder>
            <Text size="sm" c="dimmed">Total Sent (7 days)</Text>
            <Text size="xl" fw={700} c="green">{stats.total.sent}</Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card withBorder>
            <Text size="sm" c="dimmed">Total Failed (7 days)</Text>
            <Text size="xl" fw={700} c="red">{stats.total.failed}</Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card withBorder>
            <Group gap="xs">
              <IconMail size={20} />
              <div>
                <Text size="sm" c="dimmed">Email Alerts</Text>
                <Group gap="xs">
                  <Text size="lg" fw={700} c="green">{stats.email.sent}</Text>
                  <Text size="sm" c="dimmed">/</Text>
                  <Text size="lg" fw={700} c="red">{stats.email.failed}</Text>
                </Group>
              </div>
            </Group>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card withBorder>
            <Group gap="xs">
              <IconBrandTeams size={20} />
              <div>
                <Text size="sm" c="dimmed">Teams Alerts</Text>
                <Group gap="xs">
                  <Text size="lg" fw={700} c="green">{stats.teams.sent}</Text>
                  <Text size="sm" c="dimmed">/</Text>
                  <Text size="lg" fw={700} c="red">{stats.teams.failed}</Text>
                </Group>
              </div>
            </Group>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Filters */}
      <Card withBorder p="md" mb="md">
        <Group>
          <Select
            placeholder="All Types"
            clearable
            data={[
              { value: 'email', label: 'Email' },
              { value: 'teams', label: 'Teams' },
            ]}
            value={typeFilter}
            onChange={setTypeFilter}
            w={150}
          />
          <Select
            placeholder="All Statuses"
            clearable
            data={[
              { value: 'sent', label: 'Sent' },
              { value: 'failed', label: 'Failed' },
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
            w={150}
          />
          <Text size="xs" c="dimmed">
            Showing {alerts.length} alerts
          </Text>
        </Group>
      </Card>

      {/* Alerts Table */}
      <Card withBorder>
        <LoadingOverlay visible={loading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Certificate</Table.Th>
              <Table.Th>Alert Type</Table.Th>
              <Table.Th>Recipient / Webhook</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Sent At</Table.Th>
              <Table.Th>Error</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {alerts.map((alert) => (
              <Table.Tr key={alert.id}>
                <Table.Td>
                  <div>
                    <Text fw={500} size="sm">{alert.eai_name}</Text>
                    <Text size="xs" c="dimmed">{alert.eai_number}</Text>
                  </div>
                </Table.Td>
                <Table.Td>
                  <Badge
                    leftSection={getAlertTypeIcon(alert.alert_type)}
                    color={alert.alert_type === 'email' ? 'blue' : 'violet'}
                  >
                    {alert.alert_type.toUpperCase()}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {alert.recipients || alert.webhook_url || 'N/A'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    leftSection={getStatusIcon(alert.status)}
                    color={alert.status === 'sent' ? 'green' : 'red'}
                  >
                    {alert.status.toUpperCase()}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{dayjs(alert.sent_at).format('MMM D, YYYY h:mm A')}</Text>
                  <Text size="xs" c="dimmed">{dayjs(alert.sent_at).fromNow()}</Text>
                </Table.Td>
                <Table.Td>
                  {alert.error_message ? (
                    <Text size="xs" c="red" style={{ maxWidth: 200 }}>
                      {alert.error_message}
                    </Text>
                  ) : (
                    <Text size="xs" c="dimmed">-</Text>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        {alerts.length === 0 && !loading && (
          <Text ta="center" py="xl" c="dimmed">
            No alert logs found. Alerts will appear here when notifications are sent.
          </Text>
        )}
      </Card>

      <Card withBorder mt="md" p="md" bg="blue.0">
        <Text size="sm" fw={600} mb="xs">About Alert Logs</Text>
        <Text size="xs" c="dimmed">
          This page shows an audit trail of all email and Teams notifications sent by the system.
          Every alert attempt is logged with recipient information, status, and timestamp.
          This ensures full accountability - no one can claim they didn't receive an alert!
        </Text>
      </Card>
    </Container>
  );
}
