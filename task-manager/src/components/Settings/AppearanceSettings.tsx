import { Moon, Sun, Monitor, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Theme = 'light' | 'dark' | 'system';

interface AppearanceSettingsProps {
  currentTheme?: Theme;
  onThemeChange?: (theme: Theme) => void;
}

export function AppearanceSettings({ currentTheme = 'dark', onThemeChange }: AppearanceSettingsProps) {
  const themes: { value: Theme; label: string; icon: any; description: string }[] = [
    {
      value: 'light',
      label: 'Light',
      icon: Sun,
      description: 'Light mode with bright colors',
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: Moon,
      description: 'Dark mode for reduced eye strain',
    },
    {
      value: 'system',
      label: 'System',
      icon: Monitor,
      description: 'Follow system preferences',
    },
  ];

  const handleThemeChange = (newTheme: Theme) => {
    if (onThemeChange) {
      onThemeChange(newTheme);
    }
  };

  return (
    <div className="glass-card p-6 space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <Palette className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Appearance</h3>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-3">
          Theme Preference
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {themes.map((themeOption) => {
            const Icon = themeOption.icon;
            const isSelected = currentTheme === themeOption.value;

            return (
              <button
                key={themeOption.value}
                onClick={() => handleThemeChange(themeOption.value)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  isSelected
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-secondary/30 hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Icon className={`w-5 h-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`font-medium ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                    {themeOption.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{themeOption.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pt-4 border-t border-border">
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-foreground">Compact Mode</p>
            <p className="text-xs text-muted-foreground">Reduce spacing for more content</p>
          </div>
          <Button variant="outline" size="sm" disabled className="border-border">
            Coming Soon
          </Button>
        </div>

        <div className="flex items-center justify-between py-3 border-t border-border">
          <div>
            <p className="text-sm font-medium text-foreground">High Contrast</p>
            <p className="text-xs text-muted-foreground">Increase color contrast</p>
          </div>
          <Button variant="outline" size="sm" disabled className="border-border">
            Coming Soon
          </Button>
        </div>

        <div className="flex items-center justify-between py-3 border-t border-border">
          <div>
            <p className="text-sm font-medium text-foreground">Font Size</p>
            <p className="text-xs text-muted-foreground">Adjust text size</p>
          </div>
          <select className="px-3 py-1 rounded border border-border bg-secondary text-sm" disabled>
            <option>Medium</option>
            <option>Small</option>
            <option>Large</option>
          </select>
        </div>
      </div>
    </div>
  );
}
