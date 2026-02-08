import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  Settings,
  Plus,
  Zap,
  Calendar,
  BarChart3,
  FolderKanban,
  Bot,
  Cpu,
  Plug
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User } from '@/types/task';

interface SidebarProps {
  currentUser: User;
  teamMembers: User[];
  onInvite: () => void;
  onManageUsers?: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
  { icon: FolderKanban, label: 'Projects', id: 'projects' },
  { icon: Plug, label: 'Runner', id: 'runner' },
  { icon: Bot, label: 'AI Team', id: 'team' },
  { icon: Cpu, label: 'Specialists', id: 'specialists' },
  { icon: Calendar, label: 'Calendar', id: 'calendar' },
  { icon: BarChart3, label: 'Analytics', id: 'analytics' },
  { icon: Settings, label: 'Settings', id: 'settings' },
];

export function Sidebar({ currentUser, teamMembers, onInvite, onManageUsers, activeTab = 'dashboard', onTabChange }: SidebarProps) {
  const [localActiveTab, setLocalActiveTab] = useState(activeTab);
  const currentTab = onTabChange ? activeTab : localActiveTab;

  const handleTabClick = (tabId: string) => {
    if (onTabChange) {
      onTabChange(tabId);
    } else {
      setLocalActiveTab(tabId);
    }
  };

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col"
    >
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-info flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold text-lg text-foreground">TaskFlow</h1>
            <p className="text-xs text-muted-foreground">Workspace</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-primary'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium text-sm">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute left-0 w-1 h-6 bg-primary rounded-r-full"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Team Section */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-3 px-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Team Members
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={onInvite}
                className="p-1 rounded hover:bg-sidebar-accent transition-colors text-muted-foreground hover:text-primary"
                title="Invite team member"
              >
                <Plus className="w-4 h-4" />
              </button>
              {currentUser?.role === 'admin' && onManageUsers && (
                <button
                  onClick={onManageUsers}
                  className="p-1 rounded hover:bg-sidebar-accent transition-colors text-muted-foreground hover:text-primary"
                  title="Manage users"
                >
                  <Users className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          
          <div className="space-y-1">
            {teamMembers.map((member) => (
              <button
                key={member.id}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-sidebar-accent transition-colors group"
              >
                <Avatar className="w-7 h-7">
                  <AvatarImage src={member.avatar} alt={member.name} />
                  <AvatarFallback className="text-xs bg-secondary">
                    {member.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="text-sm text-sidebar-foreground group-hover:text-foreground transition-colors">
                    {member.name}
                  </p>
                </div>
                <span className={`w-2 h-2 rounded-full ${member.id === '1' ? 'bg-success' : 'bg-muted'}`} />
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar className="w-9 h-9 ring-2 ring-primary/20">
            <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
            <AvatarFallback>
              {currentUser.name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{currentUser.name}</p>
            <p className="text-xs text-muted-foreground">{currentUser.role}</p>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}
