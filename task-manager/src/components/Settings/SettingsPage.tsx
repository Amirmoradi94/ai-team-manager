import { ProfileSettings } from './ProfileSettings';
// import { AppearanceSettings } from './AppearanceSettings';
// import { NotificationSettings } from './NotificationSettings';
// import { WorkspaceSettings } from './WorkspaceSettings';
import { IntegrationSettings } from './IntegrationSettings';

interface SettingsPageProps {
  currentUser: any;
  onProfileUpdate: (updates: { name?: string; email?: string }) => void;
  onLogout: () => void;
  currentTheme?: 'light' | 'dark' | 'system';
  onThemeChange?: (theme: 'light' | 'dark' | 'system') => void;
}

export function SettingsPage({ currentUser, onProfileUpdate, onLogout, currentTheme, onThemeChange }: SettingsPageProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Column */}
      <div className="space-y-6">
        <ProfileSettings
          currentUser={currentUser}
          onUpdate={onProfileUpdate}
          onLogout={onLogout}
        />
        {/* <NotificationSettings /> */}
      </div>

      {/* Right Column */}
      <div className="space-y-6">
        {/* <AppearanceSettings
          currentTheme={currentTheme}
          onThemeChange={onThemeChange}
        /> */}
        {/* <WorkspaceSettings /> */}
        <IntegrationSettings />
      </div>
    </div>
  );
}
