import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Container,
  Group,
  NumberInput,
  Stack,
  Switch,
  Text,
  TextInput
} from '@mantine/core';
import { notifications } from '@mantine/notifications';

interface SettingItem {
  key: string;
  value: string;
  description?: string;
}

export default function SystemSettings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const loadSettings = async () => {
    setLoading(true);
    const response = await fetch('/api/settings', { credentials: 'include' });
    const data = await response.json();
    const map: Record<string, string> = {};
    (data.settings || []).forEach((item: SettingItem) => {
      map[item.key] = item.value;
    });
    setSettings(map);
    setLoading(false);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const updateSetting = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(settings)
    });

    if (response.ok) {
      notifications.show({ title: 'Settings updated', message: 'Changes saved', color: 'green' });
    } else {
      notifications.show({ title: 'Update failed', message: 'Unable to save settings', color: 'red' });
    }
  };

  return (
    <Container size="xl">
      <Text fw={700} size="xl" mb="lg">
        System settings
      </Text>

      <Card withBorder>
        <Stack>
          <Text fw={600}>Email (SMTP)</Text>
          <Switch
            label="Enable SMTP"
            checked={settings['smtp.enabled'] === 'true'}
            onChange={(event) => updateSetting('smtp.enabled', event.currentTarget.checked ? 'true' : 'false')}
          />
          <Group grow>
            <TextInput
              label="SMTP host"
              value={settings['smtp.host'] || ''}
              onChange={(event) => updateSetting('smtp.host', event.currentTarget.value)}
            />
            <NumberInput
              label="SMTP port"
              value={Number(settings['smtp.port'] || 587)}
              onChange={(value) => updateSetting('smtp.port', String(value || 0))}
            />
          </Group>
          <TextInput
            label="From address"
            value={settings['smtp.from'] || ''}
            onChange={(event) => updateSetting('smtp.from', event.currentTarget.value)}
          />
        </Stack>
      </Card>

      <Card withBorder mt="lg">
        <Stack>
          <Text fw={600}>Alerts</Text>
          <NumberInput
            label="Default alert threshold (days)"
            value={Number(settings['alert.default_threshold_days'] || 50)}
            onChange={(value) => updateSetting('alert.default_threshold_days', String(value || 0))}
          />
          <Group>
            <Switch
              label="Send Monday alerts"
              checked={settings['alert.monday_enabled'] !== 'false'}
              onChange={(event) => updateSetting('alert.monday_enabled', event.currentTarget.checked ? 'true' : 'false')}
            />
            <Switch
              label="Send Friday alerts"
              checked={settings['alert.friday_enabled'] !== 'false'}
              onChange={(event) => updateSetting('alert.friday_enabled', event.currentTarget.checked ? 'true' : 'false')}
            />
          </Group>
        </Stack>
      </Card>

      <Card withBorder mt="lg">
        <Stack>
          <Text fw={600}>Retention</Text>
          <Switch
            label="Enable retention cleanup"
            checked={settings['retention.enabled'] !== 'false'}
            onChange={(event) => updateSetting('retention.enabled', event.currentTarget.checked ? 'true' : 'false')}
          />
          <NumberInput
            label="Retention days"
            value={Number(settings['retention.results_days'] || 30)}
            onChange={(value) => updateSetting('retention.results_days', String(value || 0))}
          />
        </Stack>
      </Card>

      <Group justify="flex-end" mt="lg">
        <Button loading={loading} onClick={handleSave}>
          Save changes
        </Button>
      </Group>
    </Container>
  );
}
