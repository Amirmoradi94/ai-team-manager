import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { Header } from '@/components/Header/Header';
import { TaskBoard } from '@/components/TaskBoard/TaskBoard';
import { StatsCards } from '@/components/Stats/StatsCards';
import { CTODashboard } from './CTODashboard';
import { CreateTaskModal } from '@/components/Modals/CreateTaskModal';
import { InviteModal } from '@/components/Modals/InviteModal';
import { UserManagementModal } from '@/components/Modals/UserManagementModal';
import { TaskDetailModal } from '@/components/Modals/TaskDetailModal';
import { CreateProjectModal } from '@/components/Modals/CreateProjectModal';
import { CreateTeamModal } from '@/components/Modals/CreateTeamModal';
import { TeamDetailModal } from '@/components/Modals/TeamDetailModal';
import { AssignTeamsModal } from '@/components/Modals/AssignTeamsModal';
import { AssignSpecialistsModal } from '@/components/Modals/AssignSpecialistsModal';
import { CreateAgentModal } from '@/components/Modals/CreateAgentModal';
import { CreateSpecialistModal } from '@/components/Modals/CreateSpecialistModal';
import { SpecialistTemplatesModal } from '@/components/Modals/SpecialistTemplatesModal';
import { SpecialistTemplate } from '@/data/specialistTemplates';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Task, Status } from '@/types/task';
import { toast } from 'sonner';
import { startOfWeek, endOfWeek, addWeeks, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Terminal, Cpu, CheckSquare, Plus, Bot, Pencil, Trash2, Users, Shield } from 'lucide-react';
import { capitalize } from '@/lib/utils';

// Lazy load heavy components
const WeeklyCalendar = lazy(() => import('@/components/Calendar').then(m => ({ default: m.WeeklyCalendar })));
const AnalyticsDashboard = lazy(() => import('@/components/Analytics').then(m => ({ default: m.AnalyticsDashboard })));
const SettingsPage = lazy(() => import('@/components/Settings').then(m => ({ default: m.SettingsPage })));
const LoginPage = lazy(() => import('@/components/Auth/LoginPage').then(m => ({ default: m.LoginPage })));
const RunnerPage = lazy(() => import('./RunnerPage').then(m => ({ default: m.RunnerPage })));

const API_URL = 'http://localhost:3001/api';

const Index = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]); // Real users
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any | null>(null);
  const [projectAssigningTeams, setProjectAssigningTeams] = useState<any | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [teamToDelete, setTeamToDelete] = useState<string | null>(null);
  const [specialistToDelete, setSpecialistToDelete] = useState<string | null>(null);
  const [isCreateAgentOpen, setIsCreateAgentOpen] = useState(false);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<any | null>(null);
  const [teamAssigningSpecialists, setTeamAssigningSpecialists] = useState<any | null>(null);
  const [selectedTeamForDetail, setSelectedTeamForDetail] = useState<any | null>(null);
  const [isCreateSpecialistOpen, setIsCreateSpecialistOpen] = useState(false);
  const [isSpecialistTemplatesOpen, setIsSpecialistTemplatesOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<SpecialistTemplate | null>(null);
  const [editingAgent, setEditingAgent] = useState<any>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<Status>('todo');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [scheduledTasks, setScheduledTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [specialists, setSpecialists] = useState<any[]>([]);
  const [defaultSchedule, setDefaultSchedule] = useState<{ date?: Date; time?: string }>({});
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'dark';
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [lastDeleteTime, setLastDeleteTime] = useState<number>(0);

  // Auth Check
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');

      if (token) {
        try {
          await fetchCurrentUser(token);
          await fetchTasks(token);
          await fetchUsers(token);
          await fetchProjects(token);
          await fetchAgents(token);
          await fetchTeams(token);
          await fetchSpecialists(token);
          setIsAuthenticated(true);
        } catch (e) {
          // Token invalid, clear it
          localStorage.removeItem('token');
          setIsAuthenticated(false);
        }
      }

      setIsCheckingAuth(false);
    };
    initAuth();
  }, []);

  // Fetch scheduled tasks when calendar tab is active or week changes
  useEffect(() => {
    if (activeTab === 'calendar') {
      const token = localStorage.getItem('token');
      if (token) {
        fetchScheduledTasks(token, currentWeek);
      }
    } else if (activeTab === 'projects') {
      const token = localStorage.getItem('token');
      if (token) fetchProjects(token);
    } else if (activeTab === 'team') {
      const token = localStorage.getItem('token');
      if (token) fetchTeams(token);
    } else if (activeTab === 'specialists') {
      const token = localStorage.getItem('token');
      if (token) fetchSpecialists(token);
    }
  }, [activeTab, currentWeek]);

  // Auto-refresh tasks every 5 seconds when on dashboard
  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'dashboard') {
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    // Set up polling interval
    const intervalId = setInterval(() => {
      // Skip refresh if a delete happened in the last 6 seconds
      // This prevents deleted tasks from "re-appearing" before the DB is synced
      // OR if the create modal is open (avoiding race conditions during edit)
      if (Date.now() - lastDeleteTime < 6000 || isCreateModalOpen) {
        return;
      }
      fetchTasks(token);
    }, 5000); // Refresh every 5 seconds

    // Cleanup on unmount or when dependencies change
    return () => clearInterval(intervalId);
  }, [isAuthenticated, activeTab, lastDeleteTime, isCreateModalOpen]);

  const fetchCurrentUser = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setCurrentUser({ ...data, avatar: data.avatar || '/placeholder.svg' });
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTasks = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      const formattedTasks = data.map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        dueDate: t.due_date ? new Date(t.due_date) : undefined,
        scheduledDate: t.scheduled_date ? new Date(t.scheduled_date) : undefined,
        scheduledTime: t.scheduled_time || undefined,
        tags: [],
        assignee: t.assignee_id ? { id: t.assignee_id, name: t.assignee_name, avatar: t.assignee_avatar || '/placeholder.svg', email: t.assignee_email, role: t.assignee_role } : undefined,
        createdAt: new Date(t.created_at),
        createdBy: { id: t.created_by, name: t.creator_name || 'Unknown', avatar: t.creator_avatar || '/placeholder.svg' },
        // Execution metadata
        execution_time: t.execution_time,
        tokens_used: t.tokens_used,
        files_modified: t.files_modified,
        model_used: t.model_used,
        execution_started_at: t.execution_started_at,
        execution_completed_at: t.execution_completed_at,
        failed_at: t.failed_at
      }));
      setTasks(formattedTasks);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load tasks');
    }
  };

  const fetchUsers = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      // Format users for UI
      const formattedUsers = data.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: 'Member', // Default role for now
        avatar: u.avatar || '/placeholder.svg'
      }));
      setTeamMembers(formattedUsers);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProjects = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/projects`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setProjects(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAgents = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/agents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setAgents(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchTeams = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/teams`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setTeams(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditTeam = (team: any) => {
    setEditingTeam(team);
    setIsCreateTeamOpen(true);
  };

  const deleteTeam = (teamId: string) => {
    setTeamToDelete(teamId);
  };

  const handleConfirmDeleteTeam = async () => {
    if (!teamToDelete) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/teams/${teamToDelete}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        toast.success('Team deleted successfully');
        fetchTeams(token!);
      } else {
        throw new Error('Failed to delete team');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete team');
    } finally {
      setTeamToDelete(null);
    }
  };

  const deleteAgent = async (agentId: string) => {
    if (!confirm('Are you sure you want to delete this AI agent? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/agents/${agentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        toast.success('Agent deleted successfully');
        fetchAgents(token!);
      } else {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete agent');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete agent');
    }
  };

  const fetchSpecialists = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/specialists`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setSpecialists(data);
    } catch (e) {
      console.error(e);
    }
  };


  const deleteSpecialist = (id: string) => {
    setSpecialistToDelete(id);
  };

  const handleConfirmDeleteSpecialist = async () => {
    if (!specialistToDelete) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/specialists/${specialistToDelete}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        toast.success('Role deleted successfully');
        fetchSpecialists(token!);
      } else {
        throw new Error('Failed to delete role');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete role');
    } finally {
      setSpecialistToDelete(null);
    }
  };

  const fetchScheduledTasks = async (token: string, week: Date) => {
    try {
      const weekStart = startOfWeek(week, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(week, { weekStartsOn: 1 });
      const startDate = format(weekStart, 'yyyy-MM-dd');
      const endDate = format(weekEnd, 'yyyy-MM-dd');

      const res = await fetch(`${API_URL}/tasks/scheduled?start_date=${startDate}&end_date=${endDate}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch scheduled tasks: ${res.status}`);
      }

      const data = await res.json();
      if (!Array.isArray(data)) {
        throw new Error('Invalid response format');
      }

      const formattedTasks = data.map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        dueDate: t.due_date ? new Date(t.due_date) : undefined,
        scheduledDate: t.scheduled_date ? new Date(t.scheduled_date) : undefined,
        scheduledTime: t.scheduled_time || undefined,
        tags: [],
        assignee: t.assignee_id ? { id: t.assignee_id, name: t.assignee_name, avatar: t.assignee_avatar || '/placeholder.svg', email: t.assignee_email, role: t.assignee_role } : undefined,
        createdAt: new Date(t.created_at),
        createdBy: { id: t.created_by, name: t.creator_name || 'Unknown', avatar: t.creator_avatar || '/placeholder.svg' },
        // Execution metadata
        execution_time: t.execution_time,
        tokens_used: t.tokens_used,
        files_modified: t.files_modified,
        model_used: t.model_used,
        execution_started_at: t.execution_started_at,
        execution_completed_at: t.execution_completed_at,
        failed_at: t.failed_at
      }));
      setScheduledTasks(formattedTasks);
    } catch (e: any) {
      console.error('Error fetching scheduled tasks:', e);
      toast.error(e.message || 'Failed to load scheduled tasks');
    }
  };

  const filteredTasks = useMemo(() => {
    if (!searchQuery) return tasks;
    const query = searchQuery.toLowerCase();
    return tasks.filter(
      (task) =>
        task.title.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query)
    );
  }, [tasks, searchQuery]);

  const handleAddTask = (status: Status) => {
    setDefaultStatus(status);
    setIsCreateModalOpen(true);
  };

  const handleCreateTask = async (taskData: Omit<Task, 'id' | 'createdAt' | 'createdBy'>) => {
    try {
      const token = localStorage.getItem('token');

      // If editingTask exists, update instead of create
      if (editingTask) {
        const res = await fetch(`${API_URL}/tasks/${editingTask.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: taskData.title,
            description: taskData.description,
            status: taskData.status,
            priority: taskData.priority,
            due_date: taskData.dueDate,
            assignee_id: taskData.assignee?.id,
            team_id: (taskData as any).team_id,
            agent_id: (taskData as any).agent_id,
            scheduled_date: taskData.scheduledDate ? taskData.scheduledDate.toISOString().split('T')[0] : undefined,
            scheduled_time: taskData.scheduledTime
          })
        });

        if (res.ok) {
          fetchTasks(token!);
          if (taskData.scheduledDate) {
            fetchScheduledTasks(token!, currentWeek);
          }
          setEditingTask(null);
          toast.success('Task updated successfully!');
        }
      } else {
        // Create new task
        const res = await fetch(`${API_URL}/tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: taskData.title,
            description: taskData.description,
            status: taskData.status || defaultStatus,
            priority: taskData.priority,
            due_date: taskData.dueDate,
            assignee_id: taskData.assignee?.id,
            team_id: (taskData as any).team_id,
            agent_id: (taskData as any).agent_id,
            scheduled_date: taskData.scheduledDate ? taskData.scheduledDate.toISOString().split('T')[0] : undefined,
            scheduled_time: taskData.scheduledTime
          })
        });

        if (res.ok) {
          fetchTasks(token!);
          if (taskData.scheduledDate) {
            fetchScheduledTasks(token!, currentWeek);
          }
          toast.success('Task created successfully!');
        }
      }
    } catch (e) {
      toast.error(editingTask ? 'Failed to update task' : 'Failed to create task');
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsCreateModalOpen(true);
  };

  const handleLocalTaskUpdate = (taskId: string, newStatus: Status) => {
    setTasks(prevTasks =>
      prevTasks.map(task =>
        task.id === taskId ? { ...task, status: newStatus } : task
      )
    );
  };

  const handleTaskMove = async (taskId: string, newStatus: Status) => {
    try {
      const token = localStorage.getItem('token');

      // Check if moving to "done" and user is not admin
      if (newStatus === 'done' && currentUser?.role !== 'admin') {
        toast.error('Only Amir Moradi (admin) can move tasks to Done');
        return;
      }

      const res = await fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        // Update local state
        setTasks(prevTasks =>
          prevTasks.map(task =>
            task.id === taskId ? { ...task, status: newStatus } : task
          )
        );
        toast.success(`Task moved to ${newStatus}`);
      } else {
        throw new Error('Failed to update task status');
      }
    } catch (error) {
      console.error('Error moving task:', error);
      toast.error('Failed to move task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const token = localStorage.getItem('token');

      // Optimistically remove from UI first for instant feedback
      const originalTasks = tasks;
      setTasks((prev) => prev.filter((task) => task.id !== taskId));

      // Mark deletion time to pause auto-refresh
      setLastDeleteTime(Date.now());

      const res = await fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        // Rollback if delete failed
        setTasks(originalTasks);
        throw new Error('Failed to delete task');
      }

      toast.success('Task deleted');
    } catch (e) {
      toast.error('Failed to delete task');
    }
  };

  const handleEditProject = (project: any) => {
    setEditingProject(project);
    setIsCreateProjectOpen(true);
  };

  const handleDeleteProject = (projectId: string) => {
    setProjectToDelete(projectId); // Set the project to be deleted and open the AlertDialog
  };

  const handleConfirmDeleteProject = async () => {
    if (!projectToDelete) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/projects/${projectToDelete}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setProjects(prev => prev.filter(p => p.id !== projectToDelete));
        fetchTasks(token!); // Also refresh tasks since they might have been deleted on cascade
        toast.success('Project and associated tasks deleted');
      } else {
        throw new Error('Failed to delete project');
      }
    } catch (e) {
      toast.error('Error deleting project');
    } finally {
      setProjectToDelete(null); // Close the AlertDialog
    }
  };

  const handleCalendarSlotClick = (date: Date, hour: number) => {
    const time = `${hour.toString().padStart(2, '0')}:00`;
    setDefaultSchedule({ date, time });
    setIsCreateModalOpen(true);
  };

  const handlePreviousWeek = () => setCurrentWeek((prev) => addWeeks(prev, -1));
  const handleNextWeek = () => setCurrentWeek((prev) => addWeeks(prev, 1));
  const handleToday = () => setCurrentWeek(new Date());

  const handleProfileUpdate = async (updates: { name?: string; email?: string }) => {
    try {
      const token = localStorage.getItem('token');
      if (!token || !currentUser?.id) {
        toast.error('Not authenticated');
        return;
      }

      const res = await fetch(`${API_URL}/users/${currentUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      // Update local state with the server response
      setCurrentUser((prev: any) => ({ ...prev, ...data.user }));
      toast.success('Profile updated successfully');
    } catch (e: any) {
      toast.error(e.message || 'Failed to update profile');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
    setCurrentUser(null);
    setTasks([]);
  };

  const handleLoginSuccess = async (token: string) => {
    await fetchCurrentUser(token);
    await fetchTasks(token);
    await fetchUsers(token);
    setIsAuthenticated(true);
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);

    // Apply theme to document
    const root = document.documentElement;
    const isDark = newTheme === 'dark' || (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  if (isCheckingAuth) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      </Suspense>
    );
  }

  // Loading component for lazy-loaded tabs
  const LoadingSpinner = () => (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Background glow effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1.5s' }} />
      </div>

      <Sidebar
        currentUser={currentUser}
        teamMembers={teamMembers}
        teams={teams}
        specialists={specialists}
        onInvite={() => setIsInviteModalOpen(true)}
        onManageUsers={() => setIsUserManagementOpen(true)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onDeleteMember={(memberId) => {
          // TODO: Implement member deletion
          toast.error('Member deletion not yet implemented');
        }}
        onDeleteTeam={deleteTeam}
        onEditTeam={handleEditTeam}
        onDeleteSpecialist={(specialistId) => {
          // TODO: Implement specialist deletion
          toast.error('Specialist deletion not yet implemented');
        }}
        onEditSpecialist={(specialist) => {
          // TODO: Implement specialist editing
          toast.error('Specialist editing not yet implemented');
        }}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <Header
          action={
            activeTab === 'dashboard' ? { label: 'New Task', onClick: () => setIsCreateModalOpen(true) } :
            activeTab === 'projects' ? { label: 'New Project', onClick: () => setIsCreateProjectOpen(true) } :
            activeTab === 'team' ? { label: 'Create Team', onClick: () => setIsCreateTeamOpen(true) } :
            activeTab === 'specialists' ? { label: 'Add Role', onClick: () => setIsSpecialistTemplatesOpen(true) } :
            undefined
          }
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'dashboard' && (
            <>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
              >
                <h2 className="text-2xl font-bold text-foreground mb-1">
                  Good morning, {currentUser?.name?.split(' ')[0] || 'User'}! 👋
                </h2>
                <p className="text-muted-foreground">
                  Here's what's happening with your projects today.
                </p>
              </motion.div>

              <StatsCards tasks={tasks} />

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <h3 className="text-lg font-semibold text-foreground mb-4">Task Board</h3>
                <TaskBoard
                  tasks={filteredTasks}
                  onAddTask={handleAddTask}
                  onTaskClick={setSelectedTask}
                  onTaskMove={handleTaskMove}
                  currentUser={currentUser}
                />
              </motion.div>
            </>
          )}

          {activeTab === 'cto' && (
            <CTODashboard />
          )}

          {activeTab === 'projects' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-foreground">Projects</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {projects.map(project => {
                  const lastSeen = project.last_seen || project.creator_runner_last_seen;
                  // SQLite uses YYYY-MM-DD HH:MM:SS in UTC. Append 'Z' and replace space with 'T' for reliable ISO parsing
                  const isOnline = lastSeen && (Date.now() - new Date(lastSeen.replace(' ', 'T') + 'Z').getTime() < 60000);
                  const connectCommand = `npx agent-runner connect --token=${project.runner_token} --url=${API_URL}`;

                  return (
                    <div key={project.id} className="glass-card p-4 border border-border hover:border-primary/50 transition-all group relative flex flex-col">
                      {/* Action buttons - top right */}
                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                        <button
                          onClick={() => setProjectAssigningTeams(project)}
                          className="p-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          title="Assign teams"
                        >
                          <Users className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleEditProject(project)}
                          className="p-1.5 rounded bg-secondary/80 hover:bg-secondary transition-colors"
                          title="Edit project"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProject(project.id)}
                          className="p-1.5 rounded bg-destructive/20 hover:bg-destructive/30 text-destructive transition-colors"
                          title="Delete project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="mb-2">
                        <h3 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors pr-16">{capitalize(project.name)}</h3>
                      </div>
                      <h4 className="text-xs text-muted-foreground mb-1 uppercase font-bold tracking-wider">Project Overview</h4>
                      <p className="text-base text-muted-foreground mb-3 line-clamp-2">{project.description}</p>

                      <div className="space-y-2 mt-auto">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/50 p-2.5 rounded">
                          <Terminal className="w-4 h-4 text-primary flex-shrink-0" />
                          <code className="truncate">{project.repository_path}</code>
                        </div>

                        {project.global_rules && (
                          <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
                            <p className="text-xs text-muted-foreground mb-1.5 uppercase font-bold tracking-wider">Global Rules</p>
                            <p className="text-sm text-muted-foreground line-clamp-2 italic">{project.global_rules}</p>
                          </div>
                        )}

                        {/* Assigned Teams Badges */}
                        {project.teams && project.teams.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-2">
                            {project.teams.map((team: any) => (
                              <div
                                key={team.id}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                                title={team.mission_statement || team.name}
                              >
                                <Users className="w-3 h-3" />
                                {team.name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {projects.length === 0 && <p className="text-muted-foreground">No projects defined yet.</p>}
              </div>
            </motion.div>
          )}

          {activeTab === 'runner' && (
            <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
              <RunnerPage />
            </Suspense>
          )}

          {activeTab === 'team' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-foreground">Teams</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {teams.map(team => (
                  <div
                    key={team.id}
                    onClick={() => setSelectedTeamForDetail(team)}
                    className="glass-card p-4 border border-border hover:border-primary/50 transition-all group hover:shadow-lg relative cursor-pointer"
                  >
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTeamAssigningSpecialists(team);
                        }}
                        className="p-1.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        title="Assign AI specialists"
                      >
                        <Cpu className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTeam(team);
                        }}
                        className="p-1.5 rounded bg-secondary/80 hover:bg-secondary transition-colors"
                        title="Edit team"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTeam(team.id);
                        }}
                        className="p-1.5 rounded bg-destructive/20 hover:bg-destructive/30 text-destructive transition-colors"
                        title="Delete team"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-3 rounded-full bg-primary/10 text-primary">
                        <Users className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors truncate">{capitalize(team.name)}</h3>
                      </div>
                    </div>

                    <p className="text-base text-muted-foreground line-clamp-2 mb-3 h-12">{team.mission_statement}</p>

                    {/* Team Composition */}
                    <div className="space-y-3 border-t border-border/50 pt-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                            <Bot className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <p className="text-sm font-medium text-foreground truncate">
                            Lead: {team.lead?.name ? capitalize(team.lead.name) : 'Unassigned'}
                          </p>
                        </div>

                        {team.specialists && team.specialists.length > 0 && (
                          <div className="flex -space-x-2 overflow-hidden px-1">
                            <TooltipProvider>
                              {team.specialists.slice(0, 3).map((spec: any) => (
                                <Tooltip key={spec.id}>
                                  <TooltipTrigger asChild>
                                    <div className="inline-flex items-center justify-center w-6 h-6 rounded-full border-2 border-background bg-sidebar-accent text-[10px] font-bold text-primary hover:bg-primary/20 transition-colors cursor-help">
                                      {spec.name.charAt(0).toUpperCase()}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs font-semibold">{capitalize(spec.name)}</p>
                                    <p className="text-[10px] text-muted-foreground">{spec.description}</p>
                                  </TooltipContent>
                                </Tooltip>
                              ))}
                              {team.specialists.length > 3 && (
                                <div className="inline-flex items-center justify-center w-6 h-6 rounded-full border-2 border-background bg-muted text-[9px] font-bold text-muted-foreground">
                                  +{team.specialists.length - 3}
                                </div>
                              )}
                            </TooltipProvider>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {teams.length === 0 && (
                  <div className="col-span-full text-center py-12">
                    <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-muted-foreground">No teams defined yet.</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">Click "Create Team" to define your first AI squad</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'specialists' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-foreground">Team Roles</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {specialists.map(spec => (
                  <div key={spec.id} className="glass-card p-6 border border-border hover:border-primary/50 transition-all relative group">
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button
                        onClick={() => deleteSpecialist(spec.id)}
                        className="p-1.5 rounded bg-destructive/20 hover:bg-destructive/30 text-destructive transition-colors"
                        title="Delete role"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 rounded-lg bg-primary/10">
                        <Cpu className="w-4 h-4 text-primary" />
                      </div>
                      <h3 className="text-xl font-semibold text-foreground">{capitalize(spec.name)}</h3>
                    </div>
                    <p className="text-base text-muted-foreground mb-4 h-12 line-clamp-2">{spec.description}</p>
                    <div className="flex flex-wrap gap-1.5 pt-4 border-t border-border/50">
                      {(() => {
                        try {
                          return (JSON.parse(spec.tools || '[]')).map((tool: string) => (
                            <span key={tool} className="text-[9px] px-2 py-0.5 rounded bg-secondary text-secondary-foreground border border-border uppercase font-bold">
                              {tool.replace('_', ' ')}
                            </span>
                          ));
                        } catch (e) {
                          return null;
                        }
                      })()}
                    </div>
                  </div>
                ))}
                {specialists.length === 0 && <p className="text-muted-foreground">No roles defined yet. Click "Add Role" to get started.</p>}
              </div>
            </motion.div>
          )}

          {activeTab === 'tasks' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-2xl font-bold text-foreground mb-4">My Tasks</h2>
              <div className="space-y-3">
                {tasks.filter(t => t.assignee?.id === currentUser?.id || t.createdBy?.id === currentUser?.id).length > 0 ? (
                  tasks
                    .filter(t => t.assignee?.id === currentUser?.id || t.createdBy?.id === currentUser?.id)
                    .map(task => (
                      <div key={task.id} onClick={() => setSelectedTask(task)} className="glass-card p-4 cursor-pointer hover:border-primary/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium text-foreground">{task.title}</h3>
                            <p className="text-sm text-muted-foreground">{task.description}</p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-md ${task.status === 'done' ? 'bg-success/20 text-success' : 'bg-info/20 text-info'}`}>
                            {task.status}
                          </span>
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="text-muted-foreground">No tasks assigned to you yet.</p>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'calendar' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-2xl font-bold text-foreground mb-4">Calendar</h2>
              <Suspense fallback={<LoadingSpinner />}>
                <WeeklyCalendar
                  currentWeek={currentWeek}
                  tasks={scheduledTasks}
                  onPreviousWeek={handlePreviousWeek}
                  onNextWeek={handleNextWeek}
                  onToday={handleToday}
                  onTaskClick={setSelectedTask}
                  onSlotClick={handleCalendarSlotClick}
                />
              </Suspense>
            </motion.div>
          )}

          {activeTab === 'analytics' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-2xl font-bold text-foreground mb-6">Analytics & Performance</h2>
              <Suspense fallback={<LoadingSpinner />}>
                <AnalyticsDashboard tasks={tasks} teamMembers={teamMembers} />
              </Suspense>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h2 className="text-2xl font-bold text-foreground mb-6">Settings</h2>
              <Suspense fallback={<LoadingSpinner />}>
                <SettingsPage
                  currentUser={currentUser}
                  onProfileUpdate={handleProfileUpdate}
                  onLogout={handleLogout}
                  currentTheme={theme}
                  onThemeChange={handleThemeChange}
                />
              </Suspense>
            </motion.div>
          )}
        </div>
      </main>

      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingTask(null);
          setDefaultSchedule({});
        }}
        onSubmit={handleCreateTask}
        teamMembers={teamMembers}
        projects={projects}
        agents={agents}
        teams={teams}
        defaultStatus={defaultStatus}
        defaultSchedule={defaultSchedule}
        editingTask={editingTask}
      />

      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      />

      <CreateProjectModal
        isOpen={isCreateProjectOpen}
        onClose={() => {
          setIsCreateProjectOpen(false);
          setEditingProject(null);
        }}
        onSuccess={() => {
          const token = localStorage.getItem('token');
          if (token) fetchProjects(token);
        }}
        editingProject={editingProject}
      />

      <AssignTeamsModal
        project={projectAssigningTeams}
        isOpen={!!projectAssigningTeams}
        onClose={() => setProjectAssigningTeams(null)}
        onSuccess={() => {
          const token = localStorage.getItem('token');
          if (token) fetchProjects(token);
        }}
      />

      <CreateAgentModal
        isOpen={isCreateAgentOpen}
        onClose={() => {
          setIsCreateAgentOpen(false);
          setEditingAgent(null);
        }}
        onSuccess={() => {
          const token = localStorage.getItem('token');
          if (token) fetchAgents(token);
          setEditingAgent(null);
        }}
        editingAgent={editingAgent}
      />

      <CreateTeamModal
        isOpen={isCreateTeamOpen}
        onClose={() => {
          setIsCreateTeamOpen(false);
          setEditingTeam(null);
        }}
        onSuccess={() => {
          const token = localStorage.getItem('token');
          if (token) fetchTeams(token);
          setEditingTeam(null);
        }}
        editingTeam={editingTeam}
      />

      <AssignSpecialistsModal
        team={teamAssigningSpecialists}
        isOpen={!!teamAssigningSpecialists}
        onClose={() => setTeamAssigningSpecialists(null)}
        onSuccess={() => {
          const token = localStorage.getItem('token');
          if (token) fetchTeams(token);
        }}
      />

      <SpecialistTemplatesModal
        isOpen={isSpecialistTemplatesOpen}
        onClose={() => setIsSpecialistTemplatesOpen(false)}
        onSelectTemplate={(template) => {
          setSelectedTemplate(template);
          setIsSpecialistTemplatesOpen(false);
          setIsCreateSpecialistOpen(true);
        }}
        onCreateFromScratch={() => {
          setSelectedTemplate(null);
          setIsSpecialistTemplatesOpen(false);
          setIsCreateSpecialistOpen(true);
        }}
      />

      <CreateSpecialistModal
        isOpen={isCreateSpecialistOpen}
        onClose={() => {
          setIsCreateSpecialistOpen(false);
          setSelectedTemplate(null);
        }}
        onSuccess={() => {
          const token = localStorage.getItem('token');
          if (token) fetchSpecialists(token);
          setSelectedTemplate(null);
        }}
        template={selectedTemplate}
      />

      <UserManagementModal
        isOpen={isUserManagementOpen}
        onClose={() => setIsUserManagementOpen(false)}
        currentUserId={currentUser?.id || ''}
        onUserDeleted={() => {
          const token = localStorage.getItem('token');
          if (token) fetchUsers(token);
        }}
      />

      <TaskDetailModal
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onEdit={handleEditTask}
        onDelete={handleDeleteTask}
        onStatusChange={handleLocalTaskUpdate}
      />

      <TeamDetailModal
        team={selectedTeamForDetail}
        isOpen={!!selectedTeamForDetail}
        onClose={() => setSelectedTeamForDetail(null)}
        onEdit={(team) => {
          setSelectedTeamForDetail(null);
          handleEditTeam(team);
        }}
      />

      <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your project and remove all associated tasks from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteProject} className="bg-destructive hover:bg-destructive/90">
              Delete Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!teamToDelete} onOpenChange={(open) => !open && setTeamToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete AI Team?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the team and its associated lead agent. Tasks currently assigned to this team will remain but will need reassignment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteTeam} className="bg-destructive hover:bg-destructive/90">
              Delete Team
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!specialistToDelete} onOpenChange={(open) => !open && setSpecialistToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team Role?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this role from the global library and unassign it from all teams. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteSpecialist} className="bg-destructive hover:bg-destructive/90">
              Delete Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Index;
