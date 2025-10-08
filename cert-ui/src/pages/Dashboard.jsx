import { useState, useEffect } from 'react';
import { Container, Title, Grid, Card, Text, Badge, Button, Table, Group, LoadingOverlay, TextInput, Select, Modal, ActionIcon, Stack, Divider, List } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconRefresh, IconCheck, IconAlertTriangle, IconX, IconClock, IconFilter, IconFilterOff, IconSearch, IconEye, IconCertificate, IconFlask } from '@tabler/icons-react';
import { getLatestResults, getDashboardStats } from '../api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export default function Dashboard() {
  const [results, setResults] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [stats, setStats] = useState({ total: 0, valid: 0, expiring_soon: 0, expired: 0, error: 0 });
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [environmentFilter, setEnvironmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Details modal
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedCert, setSelectedCert] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, environmentFilter, statusFilter, results]);

  const loadData = async () => {
    try {
      const [resultsRes, statsRes] = await Promise.all([
        getLatestResults(),
        getDashboardStats()
      ]);
      setResults(resultsRes.data.results);
      setFilteredResults(resultsRes.data.results);
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

  const applyFilters = () => {
    let filtered = [...results];

    if (searchTerm) {
      filtered = filtered.filter(r =>
        r.eai_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.eai_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.url?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (environmentFilter) {
      filtered = filtered.filter(r => r.environment === environmentFilter);
    }

    if (statusFilter) {
      filtered = filtered.filter(r => r.status === statusFilter);
    }

    setFilteredResults(filtered);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setEnvironmentFilter('');
    setStatusFilter('');
  };

  const viewDetails = (result) => {
    setSelectedCert(result);
    setDetailsModalOpen(true);
  };

  const checkSingleCertificate = (configId) => {
    const eventSource = new EventSource(`/api/stream/certificates/check/${configId}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      const daysUntilExpiry = data.daysUntilExpiry ?? data.days_until_expiry ?? 'N/A';
      const statusText = data.status?.replace('_', ' ') || 'Unknown';

      notifications.show({
        title: `${data.eai_name} Checked`,
        message: `${statusText} - ${daysUntilExpiry === 'N/A' ? daysUntilExpiry : daysUntilExpiry + ' days until expiry'}`,
        color: data.status === 'valid' ? 'green' : data.status === 'expiring_soon' ? 'yellow' : 'red',
      });
    };

    eventSource.addEventListener('done', () => {
      eventSource.close();
      loadData();
    });

    eventSource.onerror = () => {
      eventSource.close();
      notifications.show({
        title: 'Error',
        message: 'Failed to check certificate',
        color: 'red',
      });
    };
  };

  const checkAllCertificates = () => {
    setChecking(true);
    const eventSource = new EventSource('/api/stream/certificates/check-all');

    let count = 0;

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      count++;

      // Get days until expiry from either field name
      const daysUntilExpiry = data.daysUntilExpiry ?? data.days_until_expiry ?? 'N/A';
      const statusText = data.status?.replace('_', ' ') || 'Unknown';

      notifications.show({
        title: data.eai_name || 'Certificate',
        message: `${statusText} - ${daysUntilExpiry === 'N/A' ? daysUntilExpiry : daysUntilExpiry + ' days until expiry'}`,
        color: data.status === 'expired' ? 'red' : data.status === 'expiring_soon' ? 'orange' : data.status === 'error' ? 'gray' : 'green',
        autoClose: 4000,
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

      <Card withBorder p="md" mb="md">
        <Group mb="xs">
          <IconFilter size={20} />
          <Text fw={500}>Filters</Text>
        </Group>
        <Grid>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <TextInput
              placeholder="Search EAI Name, Number, or URL"
              leftSection={<IconSearch size={16} />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 3 }}>
            <Select
              placeholder="All Environments"
              clearable
              data={[
                { value: 'dev', label: 'Development' },
                { value: 'qa', label: 'QA' },
                { value: 'uat', label: 'UAT' },
                { value: 'prod', label: 'Production' },
              ]}
              value={environmentFilter}
              onChange={setEnvironmentFilter}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 3 }}>
            <Select
              placeholder="All Statuses"
              clearable
              data={[
                { value: 'valid', label: 'Valid' },
                { value: 'expiring_soon', label: 'Expiring Soon' },
                { value: 'expired', label: 'Expired' },
                { value: 'error', label: 'Error' },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 2 }}>
            <Button
              variant="light"
              fullWidth
              leftSection={<IconFilterOff size={16} />}
              onClick={clearFilters}
            >
              Clear
            </Button>
          </Grid.Col>
        </Grid>
        <Text size="xs" c="dimmed" mt="xs">
          Showing {filteredResults.length} of {results.length} certificates
        </Text>
      </Card>

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
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredResults.map((result) => (
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
                  <Group gap="xs">
                    <Text size="sm" style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {result.url}
                    </Text>
                    {result.subject_alternate_names && (
                      <Badge size="xs" variant="dot" color="gray" title="Subject Alternate Names count">
                        {typeof result.subject_alternate_names === 'string' ?
                          JSON.parse(result.subject_alternate_names).length :
                          result.subject_alternate_names.length
                        } SANs
                      </Badge>
                    )}
                  </Group>
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
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      variant="light"
                      color="green"
                      onClick={() => checkSingleCertificate(result.config_id)}
                      title="Test Check Certificate"
                    >
                      <IconFlask size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="light"
                      color="blue"
                      onClick={() => viewDetails(result)}
                      title="View Details & SANs"
                    >
                      <IconEye size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        {filteredResults.length === 0 && !loading && (
          <Text ta="center" py="xl" c="dimmed">
            {results.length === 0 ? 'No certificates configured yet' : 'No certificates match the filters'}
          </Text>
        )}
      </Card>

      {/* Certificate Details Modal */}
      <Modal
        opened={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title={
          <Group>
            <IconCertificate size={24} />
            <Text fw={600}>Certificate Details</Text>
          </Group>
        }
        size="lg"
      >
        {selectedCert && (
          <Stack gap="md">
            {/* Certificate Info */}
            <Card withBorder p="md">
              <Text fw={600} mb="sm">Certificate Information</Text>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">EAI Number:</Text>
                  <Text size="sm" fw={500}>{selectedCert.eai_number}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">EAI Name:</Text>
                  <Text size="sm" fw={500}>{selectedCert.eai_name}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Environment:</Text>
                  <Badge size="sm" variant="light">{selectedCert.environment.toUpperCase()}</Badge>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">URL:</Text>
                  <Text size="sm" fw={500}>{selectedCert.url}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Hostname:</Text>
                  <Text size="sm">{selectedCert.hostname}</Text>
                </Group>
              </Stack>
            </Card>

            {/* Status & Expiry */}
            <Card withBorder p="md">
              <Text fw={600} mb="sm">Status & Expiry</Text>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Status:</Text>
                  <Badge
                    color={getStatusColor(selectedCert.status)}
                    leftSection={getStatusIcon(selectedCert.status)}
                  >
                    {selectedCert.status.replace('_', ' ')}
                  </Badge>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Days Until Expiry:</Text>
                  <Text
                    size="sm"
                    fw={700}
                    c={selectedCert.days_until_expiry <= 7 ? 'red' : selectedCert.days_until_expiry <= 30 ? 'orange' : 'green'}
                  >
                    {selectedCert.days_until_expiry !== null ? `${selectedCert.days_until_expiry} days` : 'N/A'}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Expiry Date:</Text>
                  <Text size="sm" fw={500}>
                    {selectedCert.expiry_date ? dayjs(selectedCert.expiry_date).format('MMM D, YYYY h:mm A') : 'N/A'}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Issuer:</Text>
                  <Text size="sm">{selectedCert.issuer || 'Unknown'}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Last Checked:</Text>
                  <Text size="sm" c="dimmed">{dayjs(selectedCert.checked_at).fromNow()}</Text>
                </Group>
              </Stack>
            </Card>

            {/* Subject Alternate Names (SANs) */}
            <Card withBorder p="md">
              <Group mb="sm">
                <Text fw={600}>Subject Alternate Names (SANs)</Text>
                <Badge size="sm" variant="light">
                  {selectedCert.subject_alternate_names ?
                    (typeof selectedCert.subject_alternate_names === 'string' ?
                      JSON.parse(selectedCert.subject_alternate_names).length :
                      selectedCert.subject_alternate_names.length) : 0
                  } domains
                </Badge>
              </Group>
              {selectedCert.subject_alternate_names ? (
                <List size="sm" spacing="xs" withPadding>
                  {(typeof selectedCert.subject_alternate_names === 'string' ?
                    JSON.parse(selectedCert.subject_alternate_names) :
                    selectedCert.subject_alternate_names
                  ).map((san, index) => (
                    <List.Item key={index}>
                      <Text size="sm" ff="monospace">{san}</Text>
                    </List.Item>
                  ))}
                </List>
              ) : (
                <Text size="sm" c="dimmed">No alternate names found</Text>
              )}
            </Card>

            {/* Error Message (if any) */}
            {selectedCert.error_message && (
              <Card withBorder p="md" bg="red.0">
                <Text fw={600} c="red" mb="sm">Error</Text>
                <Text size="sm" c="red">{selectedCert.error_message}</Text>
              </Card>
            )}
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
