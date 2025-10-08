import { useState, useEffect } from 'react';
import { Container, Title, Card, TextInput, NumberInput, Switch, Button, Group, Text, Divider, Stack, Textarea, PasswordInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy } from '@tabler/icons-react';
import { getSettings, updateSetting } from '../api';

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await getSettings();
      const settingsMap = {};
      response.data.settings.forEach(setting => {
        settingsMap[setting.key] = setting.value;
      });
      setSettings(settingsMap);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to load settings',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save all settings
      const promises = Object.entries(settings).map(([key, value]) =>
        updateSetting(key, value)
      );
      await Promise.all(promises);

      notifications.show({
        title: 'Success',
        message: 'Settings saved successfully',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to save settings',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return <Container size="md" py="md"><Text>Loading settings...</Text></Container>;
  }

  return (
    <Container size="md" py="md">
      <Group justify="space-between" mb="xl">
        <Title>System Settings</Title>
        <Button
          leftSection={<IconDeviceFloppy size={16} />}
          onClick={handleSave}
          loading={saving}
        >
          Save Settings
        </Button>
      </Group>

      <Stack gap="lg">
        {/* SMTP Configuration */}
        <Card withBorder p="lg">
          <Title order={3} mb="md">SMTP Configuration</Title>
          <Text size="sm" c="dimmed" mb="md">
            Configure email notification settings
          </Text>

          <Switch
            label="Enable Email Notifications"
            description="Turn on/off email alerts"
            checked={settings['smtp.enabled'] === 'true'}
            onChange={(e) => updateSetting('smtp.enabled', e.currentTarget.checked ? 'true' : 'false')}
            mb="md"
          />

          <TextInput
            label="SMTP Host"
            placeholder="smtp.example.com"
            value={settings['smtp.host'] || ''}
            onChange={(e) => updateSetting('smtp.host', e.target.value)}
            mb="sm"
          />

          <NumberInput
            label="SMTP Port"
            placeholder="587"
            value={parseInt(settings['smtp.port']) || 587}
            onChange={(value) => updateSetting('smtp.port', value.toString())}
            mb="sm"
          />

          <TextInput
            label="From Email Address"
            placeholder="certs@example.com"
            type="email"
            value={settings['smtp.from'] || ''}
            onChange={(e) => updateSetting('smtp.from', e.target.value)}
            mb="sm"
          />

          <Text size="xs" c="dimmed" mt="xs">
            Note: SMTP username and password are configured via environment variables (SMTP_USER, SMTP_PASS)
          </Text>
        </Card>

        {/* Alert Configuration */}
        <Card withBorder p="lg">
          <Title order={3} mb="md">Alert Configuration</Title>
          <Text size="sm" c="dimmed" mb="md">
            Control when alerts are sent
          </Text>

          <Switch
            label="Send Alerts on Monday"
            description="Enable alert notifications on Mondays"
            checked={settings['alert.monday_enabled'] === 'true'}
            onChange={(e) => updateSetting('alert.monday_enabled', e.currentTarget.checked ? 'true' : 'false')}
            mb="md"
          />

          <Switch
            label="Send Alerts on Friday"
            description="Enable alert notifications on Fridays"
            checked={settings['alert.friday_enabled'] === 'true'}
            onChange={(e) => updateSetting('alert.friday_enabled', e.currentTarget.checked ? 'true' : 'false')}
            mb="sm"
          />

          <Text size="xs" c="dimmed" mt="xs">
            Alerts are only sent once per day per certificate, on the configured days
          </Text>
        </Card>

        {/* Proxy Configuration */}
        <Card withBorder p="lg">
          <Title order={3} mb="md">Proxy Configuration</Title>
          <Text size="sm" c="dimmed" mb="md">
            Configure HTTP/HTTPS proxy for webhook and email connections
          </Text>

          <Switch
            label="Enable Proxy"
            description="Route webhook and email traffic through proxy"
            checked={settings['proxy.enabled'] === 'true'}
            onChange={(e) => updateSetting('proxy.enabled', e.currentTarget.checked ? 'true' : 'false')}
            mb="md"
          />

          <TextInput
            label="Proxy Host"
            placeholder="proxy.example.com"
            value={settings['proxy.host'] || ''}
            onChange={(e) => updateSetting('proxy.host', e.target.value)}
            mb="sm"
            disabled={settings['proxy.enabled'] !== 'true'}
          />

          <NumberInput
            label="Proxy Port"
            placeholder="8080"
            value={parseInt(settings['proxy.port']) || 8080}
            onChange={(value) => updateSetting('proxy.port', value.toString())}
            mb="sm"
            disabled={settings['proxy.enabled'] !== 'true'}
          />

          <TextInput
            label="Proxy Username (Optional)"
            placeholder="username"
            value={settings['proxy.username'] || ''}
            onChange={(e) => updateSetting('proxy.username', e.target.value)}
            mb="sm"
            disabled={settings['proxy.enabled'] !== 'true'}
          />

          <PasswordInput
            label="Proxy Password (Optional)"
            placeholder="password"
            value={settings['proxy.password'] || ''}
            onChange={(e) => updateSetting('proxy.password', e.target.value)}
            mb="sm"
            disabled={settings['proxy.enabled'] !== 'true'}
          />
        </Card>

        {/* TLS Configuration */}
        <Card withBorder p="lg">
          <Title order={3} mb="md">TLS Check Configuration</Title>
          <Text size="sm" c="dimmed" mb="md">
            Configure timeout and concurrency for certificate checks
          </Text>

          <NumberInput
            label="Connection Timeout (ms)"
            description="Timeout for TLS connection attempts"
            min={1000}
            max={60000}
            step={1000}
            value={parseInt(settings['tls.timeout']) || 10000}
            onChange={(value) => updateSetting('tls.timeout', value.toString())}
            mb="sm"
          />

          <NumberInput
            label="Maximum Concurrent Checks"
            description="Maximum number of certificates to check simultaneously"
            min={1}
            max={20}
            value={parseInt(settings['tls.concurrency']) || 5}
            onChange={(value) => updateSetting('tls.concurrency', value.toString())}
            mb="sm"
          />

          <Text size="xs" c="dimmed" mt="xs">
            Lower concurrency reduces server load but increases total check time
          </Text>
        </Card>

        {/* Environment Configuration */}
        <Card withBorder p="lg">
          <Title order={3} mb="md">Environment Configuration</Title>
          <Text size="sm" c="dimmed" mb="md">
            Define available environment options for certificates
          </Text>

          <Textarea
            label="Environment List"
            description="Comma-separated list of environment names (e.g., prod,non-prod,qa,dev)"
            placeholder="prod,non-prod"
            value={settings['environments.list'] || 'prod,non-prod'}
            onChange={(e) => updateSetting('environments.list', e.target.value)}
            minRows={2}
            mb="sm"
          />

          <Text size="xs" c="dimmed" mt="xs">
            These options will appear in the environment dropdown when creating/editing certificates
          </Text>
        </Card>

        {/* Data Retention */}
        <Card withBorder p="lg">
          <Title order={3} mb="md">Data Retention</Title>
          <Text size="sm" c="dimmed" mb="md">
            Automatic cleanup of old certificate check results
          </Text>

          <Switch
            label="Enable Data Retention"
            description="Automatically delete old check results"
            checked={settings['retention.enabled'] === 'true'}
            onChange={(e) => updateSetting('retention.enabled', e.currentTarget.checked ? 'true' : 'false')}
            mb="md"
          />

          <NumberInput
            label="Retention Period (Days)"
            description="Delete results older than this many days"
            min={1}
            max={365}
            value={parseInt(settings['retention.results_days']) || 30}
            onChange={(value) => updateSetting('retention.results_days', value.toString())}
            mb="sm"
          />

          <NumberInput
            label="Batch Size"
            description="Number of records to delete per batch operation"
            min={100}
            max={10000}
            step={100}
            value={parseInt(settings['retention.batch_size']) || 1000}
            onChange={(value) => updateSetting('retention.batch_size', value.toString())}
            mb="sm"
          />

          <Text size="xs" c="dimmed" mt="xs">
            Data retention cleanup runs daily at 2:00 AM
          </Text>
        </Card>

        {/* Save Button */}
        <Group justify="flex-end">
          <Button
            size="lg"
            leftSection={<IconDeviceFloppy size={20} />}
            onClick={handleSave}
            loading={saving}
          >
            Save All Settings
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
