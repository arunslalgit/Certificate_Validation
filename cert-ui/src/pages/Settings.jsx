import { useState, useEffect } from 'react';
import { Container, Title, Card, TextInput, NumberInput, Switch, Button, Group, Text, Divider, Stack, Textarea, PasswordInput, Tabs, Code, Table, ScrollArea, Accordion } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDeviceFloppy, IconDatabase, IconSettings, IconPlayerPlay } from '@tabler/icons-react';
import { getSettings, updateSetting, getDatabaseSchema, executeQuery } from '../api';

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Database Tools state
  const [schema, setSchema] = useState([]);
  const [queryText, setQueryText] = useState('SELECT * FROM certificate_configs LIMIT 10');
  const [queryResult, setQueryResult] = useState(null);
  const [queryExecuting, setQueryExecuting] = useState(false);

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

  const loadSchema = async () => {
    try {
      const response = await getDatabaseSchema();
      setSchema(response.data.schema);
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to load database schema',
        color: 'red',
      });
    }
  };

  const runQuery = async () => {
    if (!queryText.trim()) {
      notifications.show({
        title: 'Error',
        message: 'Please enter a query',
        color: 'red',
      });
      return;
    }

    setQueryExecuting(true);
    setQueryResult(null);

    try {
      const response = await executeQuery(queryText);
      setQueryResult(response.data);
      notifications.show({
        title: 'Query Executed',
        message: `${response.data.rowCount} row(s) returned`,
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Query Failed',
        message: error.response?.data?.error || 'Failed to execute query',
        color: 'red',
      });
      setQueryResult({ error: error.response?.data?.error || 'Query failed' });
    } finally {
      setQueryExecuting(false);
    }
  };

  if (loading) {
    return <Container size="md" py="md"><Text>Loading settings...</Text></Container>;
  }

  return (
    <Container size="xl" py="md">
      <Title mb="xl">System Settings</Title>

      <Tabs defaultValue="settings">
        <Tabs.List>
          <Tabs.Tab value="settings" leftSection={<IconSettings size={16} />}>
            Configuration
          </Tabs.Tab>
          <Tabs.Tab value="database" leftSection={<IconDatabase size={16} />}>
            Database Tools
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="settings" pt="md">
          <Group justify="flex-end" mb="md">
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
        </Tabs.Panel>

        <Tabs.Panel value="database" pt="md">
          <Stack gap="lg">
            {/* Database Schema Viewer */}
            <Card withBorder p="lg">
              <Group justify="space-between" mb="md">
                <Title order={3}>Database Schema</Title>
                <Button onClick={loadSchema} size="sm" variant="light">
                  {schema.length > 0 ? 'Refresh Schema' : 'Load Schema'}
                </Button>
              </Group>

              {schema.length > 0 ? (
                <Accordion variant="separated">
                  {schema.map((table) => (
                    <Accordion.Item key={table.name} value={table.name}>
                      <Accordion.Control>
                        <Group>
                          <Text fw={600}>{table.name}</Text>
                          <Text size="sm" c="dimmed">
                            ({table.columns?.length || 0} columns)
                          </Text>
                        </Group>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap="sm">
                          {table.columns && table.columns.length > 0 && (
                            <div>
                              <Text size="sm" fw={600} mb="xs">Columns:</Text>
                              <Table striped withTableBorder withColumnBorders>
                                <Table.Thead>
                                  <Table.Tr>
                                    <Table.Th>Name</Table.Th>
                                    <Table.Th>Type</Table.Th>
                                    <Table.Th>Not Null</Table.Th>
                                    <Table.Th>Default</Table.Th>
                                    <Table.Th>PK</Table.Th>
                                  </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                  {table.columns.map((col) => (
                                    <Table.Tr key={col.cid}>
                                      <Table.Td><Code>{col.name}</Code></Table.Td>
                                      <Table.Td>{col.type}</Table.Td>
                                      <Table.Td>{col.notnull ? 'Yes' : 'No'}</Table.Td>
                                      <Table.Td>{col.dflt_value || '-'}</Table.Td>
                                      <Table.Td>{col.pk ? 'Yes' : 'No'}</Table.Td>
                                    </Table.Tr>
                                  ))}
                                </Table.Tbody>
                              </Table>
                            </div>
                          )}

                          {table.indexes && table.indexes.length > 0 && (
                            <div>
                              <Text size="sm" fw={600} mb="xs">Indexes:</Text>
                              {table.indexes.map((idx) => (
                                <div key={idx.name}>• {idx.name}</div>
                              ))}
                            </div>
                          )}

                          <div>
                            <Text size="sm" fw={600} mb="xs">CREATE TABLE Statement:</Text>
                            <ScrollArea>
                              <Code block>{table.sql}</Code>
                            </ScrollArea>
                          </div>
                        </Stack>
                      </Accordion.Panel>
                    </Accordion.Item>
                  ))}
                </Accordion>
              ) : (
                <Text c="dimmed" ta="center" py="md">
                  Click "Load Schema" to view database structure
                </Text>
              )}
            </Card>

            {/* SQL Query Runner */}
            <Card withBorder p="lg">
              <Title order={3} mb="md">Query Runner</Title>
              <Text size="sm" c="dimmed" mb="md">
                Execute SELECT queries to view data. Only read-only queries are allowed (automatically limited to 1000 rows).
              </Text>

              <Textarea
                label="SQL Query"
                placeholder="SELECT * FROM certificate_configs LIMIT 10"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                minRows={4}
                mb="md"
                styles={{ input: { fontFamily: 'monospace' } }}
              />

              <Group mb="md">
                <Button
                  leftSection={<IconPlayerPlay size={16} />}
                  onClick={runQuery}
                  loading={queryExecuting}
                  disabled={!queryText.trim()}
                >
                  Execute Query
                </Button>
                <Button
                  variant="light"
                  onClick={() => setQueryText('SELECT * FROM certificate_configs LIMIT 10')}
                >
                  Example: Certificates
                </Button>
                <Button
                  variant="light"
                  onClick={() => setQueryText('SELECT * FROM certificate_results ORDER BY checked_at DESC LIMIT 20')}
                >
                  Example: Recent Results
                </Button>
              </Group>

              {queryResult && (
                <div>
                  {queryResult.error ? (
                    <Text c="red" size="sm">{queryResult.error}</Text>
                  ) : (
                    <>
                      <Text size="sm" mb="xs" fw={600}>
                        {queryResult.rowCount} row(s) returned
                      </Text>
                      <ScrollArea>
                        <Table striped highlightOnHover withTableBorder withColumnBorders size="sm">
                          {queryResult.rows.length > 0 && (
                            <>
                              <Table.Thead>
                                <Table.Tr>
                                  {Object.keys(queryResult.rows[0]).map((key) => (
                                    <Table.Th key={key}><Code size="sm">{key}</Code></Table.Th>
                                  ))}
                                </Table.Tr>
                              </Table.Thead>
                              <Table.Tbody>
                                {queryResult.rows.map((row, idx) => (
                                  <Table.Tr key={idx}>
                                    {Object.values(row).map((value, vidx) => (
                                      <Table.Td key={vidx}>
                                        <div style={{ fontSize: 'var(--mantine-font-size-xs)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {value !== null ? String(value) : <span style={{color: 'var(--mantine-color-dimmed)'}}>NULL</span>}
                                        </div>
                                      </Table.Td>
                                    ))}
                                  </Table.Tr>
                                ))}
                              </Table.Tbody>
                            </>
                          )}
                        </Table>
                      </ScrollArea>
                    </>
                  )}
                </div>
              )}
            </Card>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
