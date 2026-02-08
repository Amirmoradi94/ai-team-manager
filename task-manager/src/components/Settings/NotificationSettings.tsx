import { useState } from 'react';
import { Bell, Mail, MessageSquare, Calendar } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface NotificationSettingsProps {
  onUpdate?: (settings: Record<string, boolean>) => void;
}

export function NotificationSettings({ onUpdate }: NotificationSettingsProps) {
  const [notifications, setNotifications] = useState({
    taskAssigned: true,
    taskCompleted: true,
    taskComments: true,
    taskDueDate: true,
    emailNotifications: false,
    dailyDigest: false,
    weeklyReport: true,
  });

  const handleToggle = (key: string) => {
    const updated = {
      ...notifications,
      [key]: !notifications[key as keyof typeof notifications],
    };
    setNotifications(updated);
    if (onUpdate) {
      onUpdate(updated);
    }
  };

  const notificationOptions = [
    {
      id: 'taskAssigned',
      icon: Bell,
      label: 'Task Assigned',
      description: 'Get notified when a task is assigned to you',
    },
    {
      id: 'taskCompleted',
      icon: Bell,
      label: 'Task Completed',
      description: 'Notifications when someone completes a task',
    },
    {
      id: 'taskComments',
      icon: MessageSquare,
      label: 'Task Comments',
      description: 'Notifications for comments on your tasks',
    },
    {
      id: 'taskDueDate',
      icon: Calendar,
      label: 'Due Date Reminders',
      description: 'Reminders for upcoming task deadlines',
    },
  ];

  const emailOptions = [
    {
      id: 'emailNotifications',
      icon: Mail,
      label: 'Email Notifications',
      description: 'Receive notifications via email',
    },
    {
      id: 'dailyDigest',
      icon: Mail,
      label: 'Daily Digest',
      description: 'Daily summary of your tasks and activity',
    },
    {
      id: 'weeklyReport',
      icon: Mail,
      label: 'Weekly Report',
      description: 'Weekly performance and analytics report',
    },
  ];

  return (
    <div className="glass-card p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Bell className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Notifications</h3>
      </div>

      <div>
        <p className="text-sm font-medium text-foreground mb-4">In-App Notifications</p>
        <div className="space-y-1">
          {notificationOptions.map((option) => {
            const Icon = option.icon;
            return (
              <div
                key={option.id}
                className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <Icon className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                </div>
                <Switch
                  checked={notifications[option.id as keyof typeof notifications]}
                  onCheckedChange={() => handleToggle(option.id)}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-4 border-t border-border">
        <p className="text-sm font-medium text-foreground mb-4">Email Preferences</p>
        <div className="space-y-1">
          {emailOptions.map((option) => {
            const Icon = option.icon;
            return (
              <div
                key={option.id}
                className="flex items-center justify-between py-3 px-4 rounded-lg hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <Icon className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                </div>
                <Switch
                  checked={notifications[option.id as keyof typeof notifications]}
                  onCheckedChange={() => handleToggle(option.id)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
