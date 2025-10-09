import { useEffect, useState } from 'react';
import {
  Badge,
  Card,
  Container,
  Group,
  SimpleGrid,
  Text
} from '@mantine/core';
import { IconAlertCircle, IconAlertTriangle, IconCertificate, IconListDetails } from '@tabler/icons-react';
import { DataTable } from 'mantine-datatable';

interface DashboardStats {
  total: number;
  valid: number;
  expiring_soon: number;
  expired: number;
  error: number;
}

interface LatestResult {
  id: number;
  eai_name: string;
  eai_number: string;
  url: string;
  environment: string;
  days_until_expiry: number;
  expiry_date: string;
  status: 'valid' | 'expiring_soon' | 'expired' | 'error';
  issuer: string;
}

function StatsCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <Card withBorder>
      <Group justify="space-between">
        <div>
          <Text size="sm" c="dimmed">
            {title}
          </Text>
          <Text fw={700} size="xl">
            {value}
          </Text>
        </div>
        {icon}
      </Group>
    </Card>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({ total: 0, valid: 0, expiring_soon: 0, expired: 0, error: 0 });
  const [latest, setLatest] = useState<LatestResult[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const statsResponse = await fetch('/api/dashboard-stats', { credentials: 'include' });
    const statsData = await statsResponse.json();
    setStats(statsData);

    const resultsResponse = await fetch('/api/results/latest?limit=20', { credentials: 'include' });
    const resultsData = await resultsResponse.json();
    setLatest(resultsData.results || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <Container size="xl">
      <Text fw={700} size="xl" mb="lg">
        Dashboard
      </Text>

      <SimpleGrid cols={{ base: 1, md: 4 }} spacing="lg" mb="lg">
        <StatsCard title="Total certificates" value={stats.total} icon={<IconCertificate size={32} />} />
        <StatsCard title="Expiring soon" value={stats.expiring_soon || 0} icon={<IconAlertTriangle size={32} color="orange" />} />
        <StatsCard title="Expired" value={stats.expired || 0} icon={<IconAlertCircle size={32} color="red" />} />
        <StatsCard title="Errors" value={stats.error || 0} icon={<IconListDetails size={32} color="gray" />} />
      </SimpleGrid>

      <Card withBorder>
        <Text fw={600} mb="sm">
          Latest results
        </Text>
        <DataTable
          minHeight={220}
          fetching={loading}
          records={latest}
          columns={[
            {
              accessor: 'eai_name',
              title: 'EAI',
              render: (record) => (
                <div>
                  <Text fw={600}>{record.eai_name}</Text>
                  <Text size="xs" c="dimmed">
                    {record.eai_number}
                  </Text>
                </div>
              )
            },
            {
              accessor: 'url',
              title: 'URL',
              render: (record) => <Text size="sm">{record.url}</Text>
            },
            {
              accessor: 'environment',
              title: 'Environment',
              render: (record) => (
                <Badge
                  color={
                    record.environment === 'prod'
                      ? 'red'
                      : record.environment === 'uat'
                      ? 'orange'
                      : 'blue'
                  }
                >
                  {record.environment.toUpperCase()}
                </Badge>
              )
            },
            {
              accessor: 'days_until_expiry',
              title: 'Days until expiry',
              render: (record) => (
                <Text
                  fw={600}
                  c={
                    record.days_until_expiry < 0
                      ? 'red'
                      : record.days_until_expiry <= 7
                      ? 'red'
                      : record.days_until_expiry <= 30
                      ? 'orange'
                      : 'green'
                  }
                >
                  {record.days_until_expiry}
                </Text>
              )
            },
            {
              accessor: 'expiry_date',
              title: 'Expiry date',
              render: (record) => (
                <Text size="sm">{new Date(record.expiry_date).toLocaleDateString()}</Text>
              )
            },
            {
              accessor: 'issuer',
              title: 'Issuer',
              render: (record) => (
                <Text size="sm" c="dimmed">
                  {record.issuer}
                </Text>
              )
            },
            {
              accessor: 'status',
              title: 'Status',
              render: (record) => (
                <Badge
                  color={
                    record.status === 'valid'
                      ? 'green'
                      : record.status === 'expiring_soon'
                      ? 'orange'
                      : record.status === 'expired'
                      ? 'red'
                      : 'gray'
                  }
                >
                  {record.status.replace('_', ' ').toUpperCase()}
                </Badge>
              )
            }
          ]}
          rowStyle={(record) => {
            if (record.days_until_expiry < 0) return { backgroundColor: '#ffcccc' };
            if (record.days_until_expiry <= 7) return { backgroundColor: '#ffe0e0' };
            if (record.days_until_expiry <= 30) return { backgroundColor: '#fff3e0' };
            return {};
          }}
        />
      </Card>
    </Container>
  );
}
