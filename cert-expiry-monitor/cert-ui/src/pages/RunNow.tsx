import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Progress,
  Stack,
  Table,
  Text,
  Checkbox
} from '@mantine/core';
import { IconAlertTriangle, IconCheck, IconRefresh, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface Certificate {
  id: number;
  eai_name: string;
  eai_number: string;
  url: string;
  environment: string;
  enabled: number;
}

interface CheckResult {
  config_id: number;
  eai_name: string;
  eai_number: string;
  url: string;
  environment: string;
  hostname: string;
  valid: boolean;
  expiry_date?: string;
  days_until_expiry?: number;
  status: 'valid' | 'expiring_soon' | 'expired' | 'error';
  issuer?: string;
  sans?: string[];
  error?: string;
}

export default function RunNow() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<CheckResult[]>([]);

  useEffect(() => {
    const fetchCertificates = async () => {
      const response = await fetch('/api/certificates', { credentials: 'include' });
      const data = await response.json();
      setCertificates(data.certificates || []);
      setSelected(
        (data.certificates || [])
          .filter((cert: Certificate) => cert.enabled)
          .map((cert: Certificate) => cert.id)
      );
    };
    fetchCertificates();
  }, []);

  const totalToCheck = useMemo(() => selected.length, [selected]);

  const updateProgress = () => {
    setProgress((prev) => {
      const completed = (prev / 100) * totalToCheck + 1;
      if (!totalToCheck) return 0;
      return Math.min((completed / totalToCheck) * 100, 100);
    });
  };

  const handleSelect = (id: number) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelected(certificates.map((cert) => cert.id));
  const deselectAll = () => setSelected([]);

  const getRowColor = (result: CheckResult) => {
    if (result.status === 'error') return undefined;
    const days = result.days_until_expiry ?? 999;
    if (days < 0) return '#ffcccc';
    if (days <= 7) return '#ffe0e0';
    if (days <= 30) return '#fff3e0';
    return undefined;
  };

  const getStatusBadge = (result: CheckResult) => {
    const color =
      result.status === 'valid'
        ? 'green'
        : result.status === 'expiring_soon'
        ? 'orange'
        : result.status === 'expired'
        ? 'red'
        : 'gray';
    return <Badge color={color}>{result.status.replace('_', ' ').toUpperCase()}</Badge>;
  };

  const handleCheckNow = () => {
    if (!selected.length) {
      notifications.show({
        title: 'No certificates selected',
        message: 'Select at least one certificate to run checks',
        color: 'orange'
      });
      return;
    }

    setChecking(true);
    setProgress(0);
    setResults([]);

    const ids = selected.join(',');
    const eventSource = new EventSource(`/api/stream/certificates/check-all?configIds=${ids}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data) as CheckResult;
      setResults((prev) => [...prev, data]);
      updateProgress();
    };

    eventSource.addEventListener('done', () => {
      eventSource.close();
      setProgress(100);
      setChecking(false);

      const critical = results.filter((item) => (item.days_until_expiry ?? 999) <= 7).length;
      const warning = results.filter((item) => (item.days_until_expiry ?? 999) <= 30).length;

      notifications.show({
        title: 'Check complete',
        message: `${results.length} certificates checked. ${warning} expiring within 30 days, ${critical} critical.`,
        color: critical ? 'red' : warning ? 'orange' : 'green',
        icon: critical ? <IconAlertTriangle /> : <IconCheck />
      });
    });

    eventSource.onerror = (error) => {
      console.error('SSE error', error);
      eventSource.close();
      setChecking(false);
      notifications.show({
        title: 'Streaming error',
        message: 'Failed to stream certificate check results',
        color: 'red',
        icon: <IconX />
      });
    };
  };

  return (
    <Container size="xl">
      <Group justify="space-between" mb="lg">
        <div>
          <Text fw={700} size="xl">
            Run Certificate Checks Now
          </Text>
          <Text size="sm" c="dimmed">
            Trigger immediate checks with real-time streaming feedback
          </Text>
        </div>
      </Group>

      <Card withBorder mb="lg">
        <Stack>
          <Group justify="space-between">
            <Text fw={600}>Select certificates to check</Text>
            <Group gap="xs">
              <Button size="xs" variant="light" onClick={selectAll}>
                Select all
              </Button>
              <Button size="xs" variant="light" onClick={deselectAll}>
                Deselect all
              </Button>
            </Group>
          </Group>

          <Stack gap="xs">
            {certificates.map((cert) => (
              <Checkbox
                key={cert.id}
                label={
                  <Group gap="xs">
                    <Text>{cert.eai_name}</Text>
                    <Text size="sm" c="dimmed">
                      ({cert.url})
                    </Text>
                    <Badge
                      size="sm"
                      color={
                        cert.environment === 'prod'
                          ? 'red'
                          : cert.environment === 'uat'
                          ? 'orange'
                          : 'blue'
                      }
                    >
                      {cert.environment.toUpperCase()}
                    </Badge>
                  </Group>
                }
                checked={selected.includes(cert.id)}
                onChange={() => handleSelect(cert.id)}
              />
            ))}
          </Stack>

          <Button
            leftSection={<IconRefresh size={18} />}
            onClick={handleCheckNow}
            loading={checking}
            disabled={!selected.length}
          >
            {checking ? 'Checking...' : `Check now (${selected.length})`}
          </Button>

          {checking && (
            <div>
              <Progress value={progress} animated striped />
              <Text size="sm" c="dimmed" mt="xs">
                {results.length} / {totalToCheck} completed
              </Text>
            </div>
          )}
        </Stack>
      </Card>

      {results.length > 0 && (
        <Card withBorder>
          <Text fw={600} mb="md">
            Results
          </Text>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>EAI Name</Table.Th>
                <Table.Th>URL</Table.Th>
                <Table.Th>Environment</Table.Th>
                <Table.Th>Expires in</Table.Th>
                <Table.Th>Expiry date</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Issuer / Error</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {results.map((result, index) => (
                <Table.Tr key={index} style={{ backgroundColor: getRowColor(result) }}>
                  <Table.Td>
                    <Text fw={500}>{result.eai_name}</Text>
                    <Text size="xs" c="dimmed">
                      {result.eai_number}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {result.url}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={
                        result.environment === 'prod'
                          ? 'red'
                          : result.environment === 'uat'
                          ? 'orange'
                          : 'blue'
                      }
                    >
                      {result.environment.toUpperCase()}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {result.status === 'error' ? (
                      <Text size="sm" c="red">
                        Error
                      </Text>
                    ) : (
                      <Group gap="xs">
                        {(result.days_until_expiry ?? 999) <= 30 && (
                          <IconAlertTriangle
                            size={16}
                            color={(result.days_until_expiry ?? 999) <= 7 ? 'red' : 'orange'}
                          />
                        )}
                        <Text
                          fw={600}
                          c={
                            (result.days_until_expiry ?? 999) < 0
                              ? 'red'
                              : (result.days_until_expiry ?? 999) <= 7
                              ? 'red'
                              : (result.days_until_expiry ?? 999) <= 30
                              ? 'orange'
                              : 'green'
                          }
                        >
                          {result.days_until_expiry ?? '—'} days
                        </Text>
                      </Group>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {result.status === 'error' ? (
                      <Text size="sm" c="dimmed">
                        —
                      </Text>
                    ) : (
                      <Text size="sm">
                        {result.expiry_date ? new Date(result.expiry_date).toLocaleDateString() : '—'}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>{getStatusBadge(result)}</Table.Td>
                  <Table.Td>
                    <Text size="sm" c={result.status === 'error' ? 'red' : 'dimmed'}>
                      {result.status === 'error' ? result.error : result.issuer}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          <Alert
            icon={<IconAlertTriangle size={16} />}
            color={
              results.some((r) => (r.days_until_expiry ?? 999) <= 7)
                ? 'red'
                : results.some((r) => (r.days_until_expiry ?? 999) <= 30)
                ? 'orange'
                : 'green'
            }
            mt="md"
          >
            <Text fw={600}>
              {results.filter((r) => (r.days_until_expiry ?? 999) <= 30).length} expiring within 30 days
            </Text>
            <Text size="sm">
              {results.filter((r) => (r.days_until_expiry ?? 999) <= 7).length} critical (≤7 days remaining)
            </Text>
          </Alert>
        </Card>
      )}
    </Container>
  );
}
