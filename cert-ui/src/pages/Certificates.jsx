import { useState, useEffect } from 'react';
import { Container, Title, Button, Table, Badge, Group, Modal, TextInput, Select, NumberInput, ActionIcon, LoadingOverlay, MultiSelect, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconEdit, IconTrash, IconBrandTeams, IconFlask } from '@tabler/icons-react';
import { getCertificates, createCertificate, updateCertificate, deleteCertificate, testWebhook, getEnvironments } from '../api';

export default function Certificates() {
  const [certificates, setCertificates] = useState([]);
  const [environments, setEnvironments] = useState(['prod', 'non-prod']);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    eai_number: '',
    eai_name: '',
    url: '',
    environment: 'prod',
    alert_threshold_days: 50,
    alert_days: null,
    email_recipients: '',
    teams_webhook_url: '',
    check_frequency_hours: 4,
    enabled: 1,
  });

  useEffect(() => {
    loadCertificates();
    loadEnvironments();
  }, []);

  const loadEnvironments = async () => {
    try {
      const response = await getEnvironments();
      setEnvironments(response.data.environments);
    } catch (error) {
      console.error('Failed to load environments', error);
    }
  };

  const loadCertificates = async () => {
    try {
      const response = await getCertificates();
      setCertificates(response.data.certificates);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to load certificates',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (editingId) {
        await updateCertificate(editingId, formData);
        notifications.show({
          title: 'Success',
          message: 'Certificate updated successfully',
          color: 'green',
        });
      } else {
        await createCertificate(formData);
        notifications.show({
          title: 'Success',
          message: 'Certificate created successfully',
          color: 'green',
        });
      }
      setModalOpen(false);
      resetForm();
      loadCertificates();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: error.response?.data?.error || 'Failed to save certificate',
        color: 'red',
      });
    }
  };

  const handleEdit = (cert) => {
    setEditingId(cert.id);
    setFormData({
      eai_number: cert.eai_number,
      eai_name: cert.eai_name,
      url: cert.url,
      environment: cert.environment,
      alert_threshold_days: cert.alert_threshold_days,
      alert_days: cert.alert_days || null,
      email_recipients: cert.email_recipients || '',
      teams_webhook_url: cert.teams_webhook_url || '',
      check_frequency_hours: cert.check_frequency_hours,
      enabled: cert.enabled,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this certificate?')) return;

    try {
      await deleteCertificate(id);
      notifications.show({
        title: 'Success',
        message: 'Certificate deleted successfully',
        color: 'green',
      });
      loadCertificates();
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to delete certificate',
        color: 'red',
      });
    }
  };

  const handleTestWebhook = async (url) => {
    try {
      await testWebhook(url);
      notifications.show({
        title: 'Success',
        message: 'Test notification sent to Teams',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to send test notification',
        color: 'red',
      });
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      eai_number: '',
      eai_name: '',
      url: '',
      environment: environments[0] || 'prod',
      alert_threshold_days: 50,
      alert_days: null,
      email_recipients: '',
      teams_webhook_url: '',
      check_frequency_hours: 4,
      enabled: 1,
    });
  };

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="xl">
        <Title>Certificate Management</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => {
            resetForm();
            setModalOpen(true);
          }}
        >
          Add Certificate
        </Button>
      </Group>

      <LoadingOverlay visible={loading} />

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>EAI Name</Table.Th>
            <Table.Th>URL</Table.Th>
            <Table.Th>Environment</Table.Th>
            <Table.Th>Check Freq</Table.Th>
            <Table.Th>Alert Days</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {certificates.map((cert) => (
            <Table.Tr key={cert.id}>
              <Table.Td>
                <div>
                  <div style={{ fontWeight: 500 }}>{cert.eai_name}</div>
                  <div style={{ fontSize: '0.875rem', color: 'gray' }}>{cert.eai_number}</div>
                </div>
              </Table.Td>
              <Table.Td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {cert.url}
              </Table.Td>
              <Table.Td>
                <Badge size="sm" variant="light">
                  {cert.environment.toUpperCase()}
                </Badge>
              </Table.Td>
              <Table.Td>{cert.check_frequency_hours}h</Table.Td>
              <Table.Td>{cert.alert_threshold_days} days</Table.Td>
              <Table.Td>
                <Badge color={cert.enabled ? 'green' : 'gray'}>
                  {cert.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  {cert.teams_webhook_url && (
                    <ActionIcon
                      color="blue"
                      variant="light"
                      onClick={() => handleTestWebhook(cert.teams_webhook_url)}
                      title="Test Teams Webhook"
                    >
                      <IconBrandTeams size={16} />
                    </ActionIcon>
                  )}
                  <ActionIcon
                    color="blue"
                    variant="light"
                    onClick={() => handleEdit(cert)}
                  >
                    <IconEdit size={16} />
                  </ActionIcon>
                  <ActionIcon
                    color="red"
                    variant="light"
                    onClick={() => handleDelete(cert.id)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {certificates.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'gray' }}>
          No certificates configured yet. Click "Add Certificate" to get started.
        </div>
      )}

      <Modal
        opened={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title={editingId ? 'Edit Certificate' : 'Add Certificate'}
        size="lg"
      >
        <TextInput
          label="EAI Number"
          placeholder="EAI-001"
          required
          value={formData.eai_number}
          onChange={(e) => setFormData({ ...formData, eai_number: e.target.value })}
          mb="sm"
        />

        <TextInput
          label="EAI Name"
          placeholder="Production API"
          required
          value={formData.eai_name}
          onChange={(e) => setFormData({ ...formData, eai_name: e.target.value })}
          mb="sm"
        />

        <TextInput
          label="URL"
          placeholder="https://example.com"
          required
          value={formData.url}
          onChange={(e) => setFormData({ ...formData, url: e.target.value })}
          mb="sm"
        />

        <Select
          label="Environment"
          required
          value={formData.environment}
          onChange={(value) => setFormData({ ...formData, environment: value })}
          data={environments.map(env => ({ value: env, label: env.toUpperCase() }))}
          mb="sm"
        />

        <NumberInput
          label="Check Frequency (hours)"
          min={1}
          max={24}
          value={formData.check_frequency_hours}
          onChange={(value) => setFormData({ ...formData, check_frequency_hours: value })}
          mb="sm"
        />

        <NumberInput
          label="Alert Threshold (days before expiry)"
          min={1}
          max={365}
          value={formData.alert_threshold_days}
          onChange={(value) => setFormData({ ...formData, alert_threshold_days: value })}
          mb="sm"
        />

        <MultiSelect
          label="Alert Days (Optional)"
          placeholder="Leave empty to use global Monday/Friday settings"
          description="Specify custom days for this certificate (overrides global settings)"
          value={formData.alert_days ? formData.alert_days.split(',') : []}
          onChange={(value) => setFormData({ ...formData, alert_days: value.length > 0 ? value.join(',') : null })}
          data={[
            { value: 'monday', label: 'Monday' },
            { value: 'tuesday', label: 'Tuesday' },
            { value: 'wednesday', label: 'Wednesday' },
            { value: 'thursday', label: 'Thursday' },
            { value: 'friday', label: 'Friday' },
            { value: 'saturday', label: 'Saturday' },
            { value: 'sunday', label: 'Sunday' },
          ]}
          mb="sm"
          clearable
        />

        <TextInput
          label="Email Recipients"
          placeholder="team@example.com, admin@example.com"
          description="Comma-separated email addresses"
          value={formData.email_recipients}
          onChange={(e) => setFormData({ ...formData, email_recipients: e.target.value })}
          mb="sm"
        />

        <TextInput
          label="Teams Webhook URL"
          placeholder="https://outlook.office.com/webhook/..."
          description="Microsoft Teams incoming webhook URL"
          value={formData.teams_webhook_url}
          onChange={(e) => setFormData({ ...formData, teams_webhook_url: e.target.value })}
          mb="sm"
        />

        <Select
          label="Status"
          value={formData.enabled.toString()}
          onChange={(value) => setFormData({ ...formData, enabled: parseInt(value) })}
          data={[
            { value: '1', label: 'Enabled' },
            { value: '0', label: 'Disabled' },
          ]}
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
            {editingId ? 'Update' : 'Create'}
          </Button>
        </Group>
      </Modal>
    </Container>
  );
}
