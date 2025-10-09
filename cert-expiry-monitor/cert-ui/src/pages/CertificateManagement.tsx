import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Container,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { DataTable } from 'mantine-datatable';
import {
  IconBrandTeams,
  IconDownload,
  IconEdit,
  IconMail,
  IconPlus,
  IconRefresh,
  IconTestPipe,
  IconTrash
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import * as XLSX from 'xlsx';

interface CertificateConfig {
  id: number;
  eai_number: string;
  eai_name: string;
  url: string;
  environment: 'dev' | 'qa' | 'uat' | 'prod';
  email_recipients: string | null;
  teams_webhook_url: string | null;
  alert_threshold_days: number;
  check_frequency_hours: number;
  enabled: number;
  last_checked: string | null;
}

const frequencyOptions = [
  { value: '1', label: 'Every 1 hour' },
  { value: '2', label: 'Every 2 hours' },
  { value: '4', label: 'Every 4 hours' },
  { value: '6', label: 'Every 6 hours' },
  { value: '12', label: 'Every 12 hours' },
  { value: '24', label: 'Every 24 hours' }
];

const environmentOptions = [
  { value: 'dev', label: 'Development' },
  { value: 'qa', label: 'QA' },
  { value: 'uat', label: 'UAT' },
  { value: 'prod', label: 'Production' }
];

function downloadTemplate() {
  const configSheet = [
    [
      'eai_number',
      'eai_name',
      'url',
      'environment',
      'email_recipients',
      'teams_webhook_url',
      'alert_threshold_days',
      'check_frequency_hours',
      'enabled'
    ],
    [
      'EAI-001',
      'Production API',
      'https://api.example.com',
      'prod',
      'team1@example.com,admin@example.com',
      'https://outlook.office.com/webhook/...',
      '50',
      '4',
      'TRUE'
    ],
    [
      'EAI-002',
      'UAT Service',
      'https://uat.example.com',
      'uat',
      'team2@example.com',
      '',
      '30',
      '6',
      'TRUE'
    ],
    [
      'EAI-003',
      'Dev API',
      'https://dev.example.com',
      'dev',
      '',
      'https://outlook.office.com/webhook/...',
      '60',
      '12',
      'FALSE'
    ]
  ];

  const descSheet = [
    ['Field', 'Required', 'Description', 'Example'],
    ['eai_number', 'YES', 'Unique identifier', 'EAI-001'],
    ['eai_name', 'YES', 'Application/service name', 'Production API'],
    ['url', 'YES', 'HTTPS endpoint', 'https://api.example.com'],
    ['environment', 'YES', 'dev, qa, uat, prod', 'prod'],
    ['email_recipients', 'Optional', 'Comma-separated emails', 'ops@example.com,team@example.com'],
    ['teams_webhook_url', 'Optional', 'Teams webhook URL', 'https://outlook.office.com/webhook/...'],
    ['alert_threshold_days', 'Optional', 'Days before expiry to alert', '50'],
    ['check_frequency_hours', 'Optional', 'Check interval in hours', '4'],
    ['enabled', 'Optional', 'TRUE or FALSE', 'TRUE']
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(configSheet), 'Certificates');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(descSheet), 'Field_Descriptions');
  XLSX.writeFile(wb, 'certificate-import-template.xlsx');
}

export default function CertificateManagement() {
  const [certificates, setCertificates] = useState<CertificateConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<CertificateConfig | null>(null);

  const loadCertificates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/certificates', { credentials: 'include' });
      const data = await response.json();
      setCertificates(data.certificates || []);
    } catch (error) {
      console.error('Failed to load certificates', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCertificates();
  }, []);

  const handleManualCheck = async (record: CertificateConfig) => {
    notifications.show({
      id: `check-${record.id}`,
      title: 'Checking certificate',
      message: `Checking ${record.eai_name}...`,
      loading: true,
      autoClose: false
    });

    try {
      const response = await fetch(`/api/certificates/${record.id}/check`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Check failed');
      }

      notifications.update({
        id: `check-${record.id}`,
        title: 'Check complete',
        color: data.days_until_expiry <= 30 ? 'orange' : 'green',
        message: `${record.eai_name} expires in ${data.daysUntilExpiry ?? data.days_until_expiry} days`,
        autoClose: 3000,
        loading: false
      });
      loadCertificates();
    } catch (error: any) {
      notifications.update({
        id: `check-${record.id}`,
        title: 'Check failed',
        color: 'red',
        message: error.message,
        autoClose: 3000,
        loading: false
      });
    }
  };

  const handleDelete = async (record: CertificateConfig) => {
    if (!window.confirm(`Delete configuration for ${record.eai_name}?`)) {
      return;
    }

    try {
      await fetch(`/api/certificates/${record.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      notifications.show({
        title: 'Deleted',
        message: `${record.eai_name} removed`,
        color: 'green'
      });
      loadCertificates();
    } catch (error: any) {
      notifications.show({
        title: 'Delete failed',
        message: error.message,
        color: 'red'
      });
    }
  };

  const columns = [
    {
      accessor: 'eai_number',
      title: 'EAI Number',
      width: 140
    },
    {
      accessor: 'eai_name',
      title: 'EAI Name',
      width: 200
    },
    {
      accessor: 'url',
      title: 'URL',
      render: (record: CertificateConfig) => (
        <Text size="sm" maw={320} truncate>
          {record.url}
        </Text>
      )
    },
    {
      accessor: 'environment',
      title: 'Environment',
      render: (record: CertificateConfig) => (
        <Badge color={
          record.environment === 'prod'
            ? 'red'
            : record.environment === 'uat'
            ? 'orange'
            : 'blue'
        }>
          {record.environment.toUpperCase()}
        </Badge>
      )
    },
    {
      accessor: 'alerts',
      title: 'Alerts',
      render: (record: CertificateConfig) => (
        <Group gap="xs">
          {record.email_recipients ? (
            <IconMail size={16} color="blue" />
          ) : (
            <Text size="xs" c="dimmed">
              No email
            </Text>
          )}
          {record.teams_webhook_url ? (
            <IconBrandTeams size={16} color="purple" />
          ) : (
            <Text size="xs" c="dimmed">
              No Teams
            </Text>
          )}
        </Group>
      )
    },
    {
      accessor: 'check_frequency_hours',
      title: 'Frequency',
      render: (record: CertificateConfig) => (
        <Text size="sm">Every {record.check_frequency_hours}h</Text>
      )
    },
    {
      accessor: 'alert_threshold_days',
      title: 'Alert Threshold',
      render: (record: CertificateConfig) => (
        <Text size="sm">{record.alert_threshold_days} days</Text>
      )
    },
    {
      accessor: 'enabled',
      title: 'Status',
      render: (record: CertificateConfig) => (
        <Badge color={record.enabled ? 'green' : 'gray'}>
          {record.enabled ? 'Enabled' : 'Disabled'}
        </Badge>
      )
    },
    {
      accessor: 'last_checked',
      title: 'Last Checked',
      render: (record: CertificateConfig) => (
        <Text size="sm" c="dimmed">
          {record.last_checked ? new Date(record.last_checked).toLocaleString() : 'Never'}
        </Text>
      )
    },
    {
      accessor: 'actions',
      title: '',
      render: (record: CertificateConfig) => (
        <Group gap="xs">
          <ActionIcon variant="subtle" onClick={() => { setSelected(record); setModalOpen(true); }}>
            <IconEdit size={16} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="blue" onClick={() => handleManualCheck(record)}>
            <IconRefresh size={16} />
          </ActionIcon>
          <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(record)}>
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      )
    }
  ];

  return (
    <Container size="xl">
      <Group justify="space-between" mb="lg">
        <div>
          <Text fw={700} size="xl">
            Certificate Management
          </Text>
          <Text size="sm" c="dimmed">
            Configure monitoring, alert thresholds, and notification channels per certificate
          </Text>
        </div>
        <Group>
          <Button leftSection={<IconDownload size={16} />} variant="light" onClick={downloadTemplate}>
            Download Template
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={() => { setSelected(null); setModalOpen(true); }}>
            Add Certificate
          </Button>
        </Group>
      </Group>

      <DataTable
        minHeight={220}
        columns={columns}
        records={certificates}
        fetching={loading}
        striped
        highlightOnHover
        noRecordsText="No certificates configured"
      />

      <CertificateFormModal
        opened={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelected(null);
          loadCertificates();
        }}
        certificate={selected}
      />
    </Container>
  );
}

interface CertificateFormModalProps {
  opened: boolean;
  onClose: () => void;
  certificate: CertificateConfig | null;
}

function CertificateFormModal({ opened, onClose, certificate }: CertificateFormModalProps) {
  const form = useForm({
    initialValues: {
      eai_number: certificate?.eai_number || '',
      eai_name: certificate?.eai_name || '',
      url: certificate?.url || 'https://',
      environment: certificate?.environment || 'prod',
      email_recipients: certificate?.email_recipients || '',
      teams_webhook_url: certificate?.teams_webhook_url || '',
      alert_threshold_days: certificate?.alert_threshold_days || 50,
      check_frequency_hours: certificate?.check_frequency_hours?.toString() || '4',
      enabled: certificate?.enabled !== undefined ? Boolean(certificate.enabled) : true
    },
    validate: {
      url: (value) => (value.startsWith('https://') ? null : 'URL must start with https://')
    }
  });

  useEffect(() => {
    form.setValues({
      eai_number: certificate?.eai_number || '',
      eai_name: certificate?.eai_name || '',
      url: certificate?.url || 'https://',
      environment: certificate?.environment || 'prod',
      email_recipients: certificate?.email_recipients || '',
      teams_webhook_url: certificate?.teams_webhook_url || '',
      alert_threshold_days: certificate?.alert_threshold_days || 50,
      check_frequency_hours: certificate?.check_frequency_hours?.toString() || '4',
      enabled: certificate?.enabled !== undefined ? Boolean(certificate.enabled) : true
    });
  }, [certificate]);

  const handleSubmit = async (values: typeof form.values) => {
    const payload = {
      ...values,
      alert_threshold_days: Number(values.alert_threshold_days),
      check_frequency_hours: Number(values.check_frequency_hours),
      enabled: values.enabled
    };

    try {
      const url = certificate ? `/api/certificates/${certificate.id}` : '/api/certificates';
      const method = certificate ? 'PUT' : 'POST';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Save failed');
      }

      notifications.show({
        title: 'Saved',
        message: `Certificate ${values.eai_name} saved`,
        color: 'green'
      });
      onClose();
    } catch (error: any) {
      notifications.show({
        title: 'Save failed',
        message: error.message,
        color: 'red'
      });
    }
  };

  const handleTestWebhook = async () => {
    const url = form.values.teams_webhook_url;
    if (!url) {
      notifications.show({
        title: 'Webhook URL required',
        message: 'Enter a Teams webhook URL to test',
        color: 'orange'
      });
      return;
    }

    try {
      const response = await fetch('/api/certificates/test-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ webhookUrl: url })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Webhook test failed');
      }
      notifications.show({
        title: 'Webhook sent',
        message: 'Test message delivered to Teams',
        color: 'green'
      });
    } catch (error: any) {
      notifications.show({
        title: 'Webhook failed',
        message: error.message,
        color: 'red'
      });
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Certificate Configuration" size="lg">
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack>
          <Group grow>
            <TextInput label="EAI Number" required {...form.getInputProps('eai_number')} />
            <TextInput label="EAI Name" required {...form.getInputProps('eai_name')} />
          </Group>
          <TextInput label="URL" required {...form.getInputProps('url')} />
          <Group grow>
            <Select
              label="Environment"
              data={environmentOptions}
              {...form.getInputProps('environment')}
            />
            <Select
              label="Check Frequency"
              data={frequencyOptions}
              {...form.getInputProps('check_frequency_hours')}
            />
          </Group>
          <NumberInput
            label="Alert Threshold (days)"
            min={1}
            max={120}
            {...form.getInputProps('alert_threshold_days')}
          />
          <Textarea
            label="Email Recipients"
            description="Comma-separated list of addresses"
            autosize
            minRows={2}
            {...form.getInputProps('email_recipients')}
          />
          <Group align="end" gap="sm">
            <TextInput
              label="Teams Webhook URL"
              style={{ flex: 1 }}
              {...form.getInputProps('teams_webhook_url')}
            />
            <Button
              variant="light"
              leftSection={<IconTestPipe size={16} />}
              onClick={handleTestWebhook}
              type="button"
            >
              Test
            </Button>
          </Group>
          <Switch
            label="Enable monitoring"
            {...form.getInputProps('enabled', { type: 'checkbox' })}
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
