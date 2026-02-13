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
import { AssignEmployeesModal } from '@/components/Modals/AssignEmployeesModal';
import { CreateAgentModal } from '@/components/Modals/CreateAgentModal';
import { CreateEmployeeModal } from '@/components/Modals/CreateEmployeeModal';
import { EmployeeTemplatesModal } from '@/components/Modals/EmployeeTemplatesModal';
import { EmployeeTemplate } from '@/data/employeeTemplates';
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
const ArsenalPage = lazy(() => import('./ArsenalPage').then(m => ({ default: m.ArsenalPage })));
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
  const [employeeToDelete, setEmployeeToDelete] = useState<string | null>(null);
  const [isCreateAgentOpen, setIsCreateAgentOpen] = useState(false);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<any | null>(null);
  const [teamAssigningEmployees, setTeamAssigningEmployees] = useState<any | null>(null);
  const [selectedTeamForDetail, setSelectedTeamForDetail] = useState<any | null>(null);
  const [isCreateEmployeeOpen, setIsCreateEmployeeOpen] = useState(false);
  const [isEmployeeTemplatesOpen, setIsEmployeeTemplatesOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmployeeTemplate | null>(null);
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
  const [employees, setEmployees] = useState<any[]>([]);
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
          await fetchEmployees(token);
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
    } else if (activeTab === 'employees') {
      const token = localStorage.getItem('token');
      if (token) fetchEmployees(token);
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
        scheduledDate: t.scheduled_date
          ? (() => {
              const [y, m, d] = t.scheduled_date.split('-').map(Number);
              return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
            })()
          : undefined,
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
        failed_at: t.failed_at,
        parent_id: t.parent_id,
        task_type: t.task_type,
        project_id: t.project_id,
        project_name: t.project_name,
        team_id: t.team_id,
        team_name: t.team_name,
        resource_metadata: t.resource_metadata
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
      if (!Array.isArray(data)) {
        setTeamMembers([]);
        return;
      }
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
      setTeamMembers([]);
    }
  };

  const fetchProjects = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/projects`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setProjects(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setProjects([]);
    }
  };

  const fetchAgents = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/agents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setAgents(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setAgents([]);
    }
  };

  const fetchTeams = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/teams`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setTeams(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setTeams([]);
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

  const fetchEmployees = async (token: string) => {
    try {
      const res = await fetch(`${API_URL}/employees`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setEmployees(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setEmployees([]);
    }
  };


  const deleteEmployee = (id: string) => {
    setEmployeeToDelete(id);
  };

  const handleConfirmDeleteEmployee = async () => {
    if (!employeeToDelete) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/employees/${employeeToDelete}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        toast.success('Role deleted successfully');
        fetchEmployees(token!);
      } else {
        throw new Error('Failed to delete role');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete role');
    } finally {
      setEmployeeToDelete(null);
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
        scheduledDate: t.scheduled_date
          ? (() => {
              const [y, m, d] = t.scheduled_date.split('-').map(Number);
              return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
            })()
          : undefined,
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
        failed_at: t.failed_at,
        parent_id: t.parent_id,
        task_type: t.task_type
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
            due_date: taskData.dueDate ? taskData.dueDate.toISOString().split('T')[0] : undefined,
            assignee_id: (taskData as any).assignee_id || taskData.assignee?.id,
            team_id: (taskData as any).team_id,
            agent_id: (taskData as any).agent_id,
            project_id: (taskData as any).project_id,
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
            due_date: taskData.dueDate ? taskData.dueDate.toISOString().split('T')[0] : undefined,
            assignee_id: (taskData as any).assignee_id || taskData.assignee?.id,
            team_id: (taskData as any).team_id,
            agent_id: (taskData as any).agent_id,
            project_id: (taskData as any).project_id,
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
        employees={employees}
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
        onDeleteEmployee={(employeeId) => {
          // TODO: Implement employee deletion
          toast.error('Employee deletion not yet implemented');
        }}
        onEditEmployee={(employee) => {
          // TODO: Implement employee editing
          toast.error('Employee editing not yet implemented');
        }}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <Header
          action={
            activeTab === 'dashboard' ? { label: 'New Task', onClick: () => setIsCreateModalOpen(true) } :
            activeTab === 'projects' ? { label: 'New Project', onClick: () => setIsCreateProjectOpen(true) } :
            activeTab === 'team' ? { label: 'Create Team', onClick: () => setIsCreateTeamOpen(true) } :
            activeTab === 'employees' ? { label: 'Add Employee', onClick: () => setIsEmployeeTemplatesOpen(true) } :
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
                  onTaskDelete={handleDeleteTask}
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.isArray(projects) && projects.map(project => {
                  const lastSeen = project.last_seen || project.creator_runner_last_seen;
                  // SQLite uses YYYY-MM-DD HH:MM:SS in UTC. Append 'Z' and replace space with 'T' for reliable ISO parsing
                  const isOnline = lastSeen && (Date.now() - new Date(lastSeen.replace(' ', 'T') + 'Z').getTime() < 60000);
                  const connectCommand = `npx agent-runner connect --token=${project.runner_token} --url=${API_URL}`;

                  return (
                    <div key={project.id} className="glass-card p-5 border-2 border-transparent hover:border-gradient transition-all duration-300 group relative flex flex-col bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-cyan-500/10 hover:from-emerald-500/15 hover:via-teal-500/15 hover:to-cyan-500/15 shadow-lg hover:shadow-2xl hover:shadow-emerald-500/20 rounded-xl">
                      {/* Action buttons - top right */}
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 flex gap-2 z-10">
                        <button
                          onClick={() => setProjectAssigningTeams(project)}
                          className="p-2 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 text-white hover:from-teal-600 hover:to-cyan-600 transition-all shadow-md hover:shadow-lg hover:scale-105"
                          title="Assign teams"
                        >
                          <Users className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEditProject(project)}
                          className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600 transition-all shadow-md hover:shadow-lg hover:scale-105"
                          title="Edit project"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProject(project.id)}
                          className="p-2 rounded-lg bg-gradient-to-br from-rose-500 to-red-500 text-white hover:from-rose-600 hover:to-red-600 transition-all shadow-md hover:shadow-lg hover:scale-105"
                          title="Delete project"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="mb-3">
                        <h3 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent group-hover:from-emerald-300 group-hover:via-teal-300 group-hover:to-cyan-300 transition-all pr-16">{capitalize(project.name)}</h3>
                      </div>
                      <h4 className="text-xs text-emerald-400 mb-2 uppercase font-bold tracking-wider flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></span>
                        Project Overview
                      </h4>
                      <p className="text-base text-gray-200 mb-4 line-clamp-2 leading-relaxed">{project.description}</p>

                      <div className="space-y-3 mt-auto">
                        <div className="flex items-center gap-3 text-sm bg-gradient-to-r from-teal-500/20 to-cyan-500/20 border-2 border-teal-400/30 p-3 rounded-lg backdrop-blur-sm hover:border-teal-400/50 transition-colors">
                          <Terminal className="w-5 h-5 text-teal-400 flex-shrink-0 animate-pulse" />
                          <code className="truncate text-teal-100 text-xs font-medium">{project.repository_path}</code>
                        </div>

                        {project.global_rules && (
                          <div className="bg-gradient-to-br from-emerald-500/20 via-teal-500/20 to-cyan-500/20 border-2 border-emerald-400/40 rounded-lg p-4 backdrop-blur-sm hover:border-emerald-400/60 transition-colors">
                            <p className="text-xs text-emerald-300 mb-2 uppercase font-bold tracking-wider flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse"></span>
                              Global Rules
                            </p>
                            <p className="text-sm text-gray-100 line-clamp-2 italic leading-relaxed">{project.global_rules}</p>
                          </div>
                        )}

                        {/* Assigned Teams Badges */}
                        {project.teams && project.teams.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2">
                            {project.teams.map((team: any) => (
                              <div
                                key={team.id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-200 border-2 border-cyan-400/40 hover:from-cyan-500/40 hover:to-blue-500/40 hover:border-cyan-400/60 transition-all hover:scale-105 shadow-sm"
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.isArray(teams) && teams.map(team => (
                  <div
                    key={team.id}
                    onClick={() => setSelectedTeamForDetail(team)}
                    className="glass-card p-5 border-2 border-transparent hover:border-gradient transition-all duration-300 group relative cursor-pointer bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-cyan-500/10 hover:from-emerald-500/15 hover:via-teal-500/15 hover:to-cyan-500/15 shadow-lg hover:shadow-2xl hover:shadow-emerald-500/20 rounded-xl"
                  >
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 flex gap-2 z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTeamAssigningEmployees(team);
                        }}
                        className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 transition-all shadow-md hover:shadow-lg hover:scale-105"
                        title="Assign AI employees"
                      >
                        <Cpu className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTeam(team);
                        }}
                        className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600 transition-all shadow-md hover:shadow-lg hover:scale-105"
                        title="Edit team"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTeam(team.id);
                        }}
                        className="p-2 rounded-lg bg-gradient-to-br from-rose-500 to-red-500 text-white hover:from-rose-600 hover:to-red-600 transition-all shadow-md hover:shadow-lg hover:scale-105"
                        title="Delete team"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/30 to-teal-500/30 shadow-lg">
                        <Users className="w-7 h-7 text-emerald-200" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xl font-bold bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent group-hover:from-emerald-300 group-hover:via-teal-300 group-hover:to-cyan-300 transition-all truncate">{capitalize(team.name)}</h3>
                      </div>
                    </div>

                    <p className="text-base text-gray-200 line-clamp-2 mb-4 h-12 leading-relaxed">{team.mission_statement}</p>

                    {/* Team Composition */}
                    <div className="space-y-3 border-t-2 border-gradient pt-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 bg-gradient-to-r from-teal-500/20 to-cyan-500/20 border-2 border-teal-400/30 rounded-lg p-2 backdrop-blur-sm">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center flex-shrink-0 shadow-md">
                            <Bot className="w-4 h-4 text-white" />
                          </div>
                          <p className="text-sm font-bold text-teal-200 truncate">
                            {team.lead?.name ? capitalize(team.lead.name) : 'No Lead'}
                          </p>
                        </div>

                        {team.employees && team.employees.length > 0 && (
                          <div className="flex -space-x-2 overflow-hidden px-1">
                            <TooltipProvider>
                              {team.employees.slice(0, 3).map((spec: any) => (
                                <Tooltip key={spec.id}>
                                  <TooltipTrigger asChild>
                                    <div className="inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-background bg-gradient-to-br from-emerald-500 to-teal-500 text-[10px] font-bold text-white hover:scale-110 transition-all cursor-help shadow-md">
                                      {spec.name.charAt(0).toUpperCase()}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs font-semibold">{capitalize(spec.name)}</p>
                                    <p className="text-[10px] text-muted-foreground">{spec.description}</p>
                                  </TooltipContent>
                                </Tooltip>
                              ))}
                              {team.employees.length > 3 && (
                                <div className="inline-flex items-center justify-center w-7 h-7 rounded-full border-2 border-background bg-gradient-to-br from-cyan-500 to-blue-500 text-[9px] font-bold text-white shadow-md">
                                  +{team.employees.length - 3}
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

          {activeTab === 'employees' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-foreground">My Employees</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {Array.isArray(employees) && employees.map(spec => (
                  <div key={spec.id} className="glass-card p-5 border-2 border-transparent hover:border-gradient transition-all duration-300 relative group bg-gradient-to-br from-emerald-500/10 via-teal-500/10 to-cyan-500/10 hover:from-emerald-500/15 hover:via-teal-500/15 hover:to-cyan-500/15 shadow-lg hover:shadow-2xl hover:shadow-emerald-500/20 rounded-xl">
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 flex gap-1">
                      <button
                        onClick={() => deleteEmployee(spec.id)}
                        className="p-2 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 text-white hover:from-rose-600 hover:to-pink-600 transition-all shadow-md hover:shadow-lg hover:scale-105"
                        title="Delete employee"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex flex-col items-center gap-3 mb-3">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/30 to-teal-500/30 shadow-lg">
                        <Cpu className="w-6 h-6 text-emerald-200" />
                      </div>
                      <h3 className="text-lg font-bold text-center bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent group-hover:from-emerald-300 group-hover:via-teal-300 group-hover:to-cyan-300 transition-all">{capitalize(spec.name)}</h3>
                    </div>
                    <p className="text-sm text-gray-200 text-center mb-4 h-12 line-clamp-2 leading-relaxed">{spec.description}</p>
                    <div className="flex flex-wrap gap-1.5 pt-3 border-t-2 border-gradient justify-center">
                      {(() => {
                        try {
                          return (JSON.parse(spec.tools || '[]')).map((tool: string) => (
                            <span key={tool} className="text-[9px] px-2 py-1 rounded-full bg-gradient-to-r from-cyan-500/30 to-blue-500/30 text-cyan-200 border-2 border-cyan-400/30 uppercase font-bold hover:from-cyan-500/40 hover:to-blue-500/40 hover:border-cyan-400/50 transition-all hover:scale-105 shadow-sm">
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
                {employees.length === 0 && <p className="text-muted-foreground">No employees hired yet. Click "Add Employee" to get started.</p>}
              </div>
            </motion.div>
          )}

          {activeTab === 'arsenal' && (
            <Suspense fallback={<LoadingSpinner />}>
              <ArsenalPage />
            </Suspense>
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

      <AssignEmployeesModal
        team={teamAssigningEmployees}
        isOpen={!!teamAssigningEmployees}
        onClose={() => setTeamAssigningEmployees(null)}
        onSuccess={() => {
          const token = localStorage.getItem('token');
          if (token) fetchTeams(token);
        }}
      />

      <EmployeeTemplatesModal
        isOpen={isEmployeeTemplatesOpen}
        onClose={() => setIsEmployeeTemplatesOpen(false)}
        onSelectTemplate={(template) => {
          setSelectedTemplate(template);
          setIsEmployeeTemplatesOpen(false);
          setIsCreateEmployeeOpen(true);
        }}
        onCreateFromScratch={() => {
          setSelectedTemplate(null);
          setIsEmployeeTemplatesOpen(false);
          setIsCreateEmployeeOpen(true);
        }}
      />

      <CreateEmployeeModal
        isOpen={isCreateEmployeeOpen}
        onClose={() => {
          setIsCreateEmployeeOpen(false);
          setSelectedTemplate(null);
        }}
        onSuccess={() => {
          const token = localStorage.getItem('token');
          if (token) fetchEmployees(token);
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

      <AlertDialog open={!!employeeToDelete} onOpenChange={(open) => !open && setEmployeeToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Team Role?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this role from the global library and unassign it from all teams. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDeleteEmployee} className="bg-destructive hover:bg-destructive/90">
              Delete Role
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Index;
