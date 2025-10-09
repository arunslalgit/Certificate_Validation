import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput
} from '@mantine/core';
import { DataTable, type DataTableColumn } from 'mantine-datatable';
import { IconDownload, IconEye, IconFilter, IconSearch } from '@tabler/icons-react';

interface CertResult {
  id: number;
  eai_number: string;
  eai_name: string;
  url: string;
  environment: string;
  days_until_expiry: number;
  expiry_date: string;
  status: 'valid' | 'expiring_soon' | 'expired' | 'error';
  issuer: string;
  subject_alternate_names: string;
  checked_at: string;
}

export default function Results() {
  const [results, setResults] = useState<CertResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [details, setDetails] = useState<CertResult | null>(null);
  const [filters, setFilters] = useState({
    eai_name: '',
    environment: '',
    status: '',
    days_min: 0,
    days_max: 365
  });

  const fetchResults = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== '' && value !== null) {
        params.append(key, String(value));
      }
    });

    const response = await fetch(`/api/results/latest?${params.toString()}`, {
      credentials: 'include'
    });
    const data = await response.json();
    setResults(data.results || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchResults();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = () => fetchResults();

  const clearFilters = () => {
    setFilters({ eai_name: '', environment: '', status: '', days_min: 0, days_max: 365 });
    setTimeout(() => fetchResults(), 0);
  };

  const columns: DataTableColumn<CertResult>[] = [
    {
      accessor: 'eai_name',
      title: 'EAI Name',
      render: (record) => (
        <Stack gap={0}>
          <Text fw={600}>{record.eai_name}</Text>
          <Text size="xs" c="dimmed">
            {record.eai_number}
          </Text>
        </Stack>
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
    },
    {
      accessor: 'checked_at',
      title: 'Checked at',
      render: (record) => (
        <Text size="sm" c="dimmed">
          {new Date(record.checked_at).toLocaleString()}
        </Text>
      )
    },
    {
      accessor: 'actions',
      title: '',
      render: (record) => (
        <ActionIcon onClick={() => setDetails(record)}>
          <IconEye size={16} />
        </ActionIcon>
      )
    }
  ];

  const getRowStyle = (record: CertResult) => {
    if (record.days_until_expiry < 0) return { backgroundColor: '#ffcccc' };
    if (record.days_until_expiry <= 7) return { backgroundColor: '#ffe0e0' };
    if (record.days_until_expiry <= 30) return { backgroundColor: '#fff3e0' };
    return {};
  };

  const exportToExcel = () => {
    import('xlsx').then((XLSX) => {
      const sheet = XLSX.utils.json_to_sheet(results);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, 'Results');
      XLSX.writeFile(wb, 'certificate-results.xlsx');
    });
  };

  return (
    <Container size="xl">
      <Text fw={700} size="xl" mb="md">
        Certificate Results
      </Text>

      <Card withBorder mb="lg">
        <Text fw={600} mb="sm">
          Filters
        </Text>
        <Group grow mb="md">
          <TextInput
            placeholder="Search EAI name"
            leftSection={<IconSearch size={16} />}
            value={filters.eai_name}
            onChange={(event) => setFilters((prev) => ({ ...prev, eai_name: event.currentTarget.value }))}
          />
          <Select
            placeholder="Environment"
            data={['dev', 'qa', 'uat', 'prod'].map((env) => ({ value: env, label: env.toUpperCase() }))}
            value={filters.environment}
            onChange={(value) => setFilters((prev) => ({ ...prev, environment: value || '' }))}
            clearable
          />
          <Select
            placeholder="Status"
            data={['valid', 'expiring_soon', 'expired', 'error'].map((status) => ({
              value: status,
              label: status.replace('_', ' ').toUpperCase()
            }))}
            value={filters.status}
            onChange={(value) => setFilters((prev) => ({ ...prev, status: value || '' }))}
            clearable
          />
        </Group>
        <Group grow mb="md">
          <NumberInput
            label="Min days until expiry"
            value={filters.days_min}
            onChange={(value) => setFilters((prev) => ({ ...prev, days_min: Number(value) || 0 }))}
            min={0}
          />
          <NumberInput
            label="Max days until expiry"
            value={filters.days_max}
            onChange={(value) => setFilters((prev) => ({ ...prev, days_max: Number(value) || 0 }))}
            min={0}
          />
        </Group>
        <Group>
          <Button leftSection={<IconFilter size={16} />} onClick={applyFilters}>
            Apply filters
          </Button>
          <Button variant="light" onClick={clearFilters}>
            Clear
          </Button>
          <Button variant="light" leftSection={<IconDownload size={16} />} ml="auto" onClick={exportToExcel}>
            Export
          </Button>
        </Group>
      </Card>

      <DataTable
        minHeight={220}
        columns={columns}
        records={results}
        fetching={loading}
        rowStyle={getRowStyle}
        striped
        highlightOnHover
        noRecordsText="No results"
      />

      <Modal opened={!!details} onClose={() => setDetails(null)} title="Certificate details" size="lg">
        {details && (
          <Stack>
            <div>
              <Text size="sm" c="dimmed">
                EAI
              </Text>
              <Text fw={600}>{details.eai_name}</Text>
              <Text size="sm">{details.eai_number}</Text>
            </div>
            <div>
              <Text size="sm" c="dimmed">
                URL
              </Text>
              <Text>{details.url}</Text>
            </div>
            <div>
              <Text size="sm" c="dimmed">
                Issuer
              </Text>
              <Text>{details.issuer}</Text>
            </div>
            <div>
              <Text size="sm" c="dimmed">
                Expiry
              </Text>
              <Text fw={600} c={details.days_until_expiry <= 7 ? 'red' : details.days_until_expiry <= 30 ? 'orange' : 'green'}>
                {new Date(details.expiry_date).toLocaleDateString()} ({details.days_until_expiry} days remaining)
              </Text>
            </div>
            <div>
              <Text size="sm" c="dimmed">
                Subject alternative names
              </Text>
              <Stack gap="xs">
                {JSON.parse(details.subject_alternate_names || '[]').map((san: string, index: number) => (
                  <Badge key={index} variant="light">
                    {san}
                  </Badge>
                ))}
              </Stack>
            </div>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
