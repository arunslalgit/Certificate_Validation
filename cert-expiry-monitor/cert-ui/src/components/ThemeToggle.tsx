import { ActionIcon } from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';
import { useTheme } from '@/contexts/ThemeContext';

export default function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useTheme();
  const dark = colorScheme === 'dark';

  return (
    <ActionIcon
      variant="subtle"
      onClick={toggleColorScheme}
      title="Toggle color scheme"
    >
      {dark ? <IconSun size={18} /> : <IconMoon size={18} />}
    </ActionIcon>
  );
}
