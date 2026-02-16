import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  Settings,
  Plus,
  Zap,
  Calendar,
  BarChart3,
  FolderKanban,
  Plug,
  Trash2,
  Brain,
  Briefcase,
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User } from '@/types/task';

interface SidebarProps {
  currentUser: User | null;
  teamMembers: User[];
  onInvite: () => void;
  onManageUsers?: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  onDeleteMember?: (memberId: string) => void;
}

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
  { icon: Brain, label: 'CTO', id: 'cto' },
  { icon: FolderKanban, label: 'Projects', id: 'projects' },
  { icon: Users, label: 'Teams', id: 'team' },
  { icon: Zap, label: 'My Employees', id: 'employees' },
  { icon: Briefcase, label: 'Arsenal', id: 'arsenal', badge: 'NEW' },
  { icon: Calendar, label: 'Calendar', id: 'calendar' },
  { icon: BarChart3, label: 'Analytics', id: 'analytics' },
  { icon: Plug, label: 'Runner', id: 'runner' },
  { icon: Settings, label: 'Settings', id: 'settings' },
];

export function Sidebar({
  currentUser,
  teamMembers,
  onInvite,
  activeTab = 'dashboard',
  onTabChange,
  onDeleteMember,
}: SidebarProps) {
  const [localActiveTab, setLocalActiveTab] = useState(activeTab);
  const currentTab = onTabChange ? activeTab : localActiveTab;

  // Filter out AI users from teamMembers (only show humans)
  const humanMembers = teamMembers.filter(member => !member.is_ai);

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
                {item.badge && (
                  <span className="ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold bg-gradient-to-r from-purple-500 to-blue-500 text-white">
                    {item.badge}
                  </span>
                )}
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

        {/* Company Leadership Section removed */}
      </nav>

      {/* User Profile */}
      {currentUser && (
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
              <p className="text-xs text-muted-foreground capitalize">({currentUser.role})</p>
            </div>
          </div>
        </div>
      )}
    </motion.aside>
  );
}
