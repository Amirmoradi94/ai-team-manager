import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import { Header } from '@/components/Header/Header';
import { TaskBoard } from '@/components/TaskBoard/TaskBoard';
import { StatsCards } from '@/components/Stats/StatsCards';
import { CreateTaskModal } from '@/components/Modals/CreateTaskModal';
import { InviteModal } from '@/components/Modals/InviteModal';
import { UserManagementModal } from '@/components/Modals/UserManagementModal';
import { TaskDetailModal } from '@/components/Modals/TaskDetailModal';
import { CreateProjectModal } from '@/components/Modals/CreateProjectModal';
import { CreateAgentModal } from '@/components/Modals/CreateAgentModal';
import { CreateSpecialistModal } from '@/components/Modals/CreateSpecialistModal';
import { Task, Status } from '@/types/task';
import { toast } from 'sonner';
import { startOfWeek, endOfWeek, addWeeks, format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Terminal, Cpu, CheckSquare, Plus } from 'lucide-react';

// Lazy load heavy components
const WeeklyCalendar = lazy(() => import('@/components/Calendar').then(m => ({ default: m.WeeklyCalendar })));
const AnalyticsDashboard = lazy(() => import('@/components/Analytics').then(m => ({ default: m.AnalyticsDashboard })));
const SettingsPage = lazy(() => import('@/components/Settings').then(m => ({ default: m.SettingsPage })));
const LoginPage = lazy(() => import('@/components/Auth/LoginPage').then(m => ({ default: m.LoginPage })));

const API_URL = 'http://localhost:3001/api';

const Index = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]); // Real users
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isCreateAgentOpen, setIsCreateAgentOpen] = useState(false);
  const [isCreateSpecialistOpen, setIsCreateSpecialistOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<Status>('todo');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [scheduledTasks, setScheduledTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
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
      if (token) fetchAgents(token);
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
      // Skip refresh if a delete happened in the last 3 seconds
      // OR if the create modal is open (avoiding race conditions during edit)
      if (Date.now() - lastDeleteTime < 3000 || isCreateModalOpen) {
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
        onInvite={() => setIsInviteModalOpen(true)}
        onManageUsers={() => setIsUserManagementOpen(true)}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        <Header
          action={
            activeTab === 'dashboard' ? { label: 'New Task', onClick: () => setIsCreateModalOpen(true) } :
            activeTab === 'projects' ? { label: 'New Project', onClick: () => setIsCreateProjectOpen(true) } :
            activeTab === 'team' ? { label: 'New Agent', onClick: () => setIsCreateAgentOpen(true) } :
            activeTab === 'specialists' ? { label: 'New Specialist', onClick: () => setIsCreateSpecialistOpen(true) } :
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
                  Good morning, {currentUser.name.split(' ')[0]}! 👋
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

          {activeTab === 'projects' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-foreground">Projects</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {projects.map(project => {
                  const isOnline = project.last_seen && (Date.now() - new Date(project.last_seen).getTime() < 60000);
                  const connectCommand = `npx agent-runner connect --token=${project.runner_token} --url=${API_URL}`;
                  
                  return (
                    <div key={project.id} className="glass-card p-6 border border-border hover:border-primary/50 transition-all group relative flex flex-col">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-semibold text-foreground group-hover:text-primary">{project.name}</h3>
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isOnline ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
                          {isOnline ? 'Online' : 'Offline'}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{project.description}</p>
                      
                      <div className="space-y-3 mt-auto">
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-secondary/50 p-2 rounded truncate">
                          <Terminal className="w-3 h-3 text-primary" />
                          <code className="truncate">{project.repository_path}</code>
                        </div>

                        <div className="bg-black/40 rounded-lg p-3 border border-white/5 group/cmd relative">
                          <p className="text-[9px] text-muted-foreground mb-2 uppercase font-bold tracking-widest">Connect Command</p>
                          <code className="text-[10px] text-primary block truncate font-mono">
                            {connectCommand}
                          </code>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(connectCommand);
                              toast.success('Command copied to clipboard');
                            }}
                            className="absolute top-2 right-2 p-1 rounded bg-secondary opacity-0 group-hover/cmd:opacity-100 transition-opacity"
                          >
                            <CheckSquare className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {projects.length === 0 && <p className="text-muted-foreground">No projects defined yet.</p>}
              </div>
            </motion.div>
          )}

          {activeTab === 'team' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-foreground">AI Team</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {agents.map(agent => (
                  <div key={agent.id} className="glass-card p-6 border border-border hover:border-primary/50 transition-all">
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar className="w-10 h-10 ring-2 ring-primary/20">
                        <AvatarImage src={agent.avatar} />
                        <AvatarFallback>{agent.name[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-semibold text-foreground">{agent.name}</h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase font-bold tracking-wider">
                          {(() => {
                            try {
                              return JSON.parse(agent.model_config || '{}').provider || 'AI';
                            } catch (e) {
                              return 'AI';
                            }
                          })()}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-4 italic border-l-2 border-primary/30 pl-3 py-1">
                      "{agent.system_prompt}"
                    </p>
                  </div>
                ))}
                {agents.length === 0 && <p className="text-muted-foreground">No AI agents defined yet.</p>}
              </div>
            </motion.div>
          )}

          {activeTab === 'specialists' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-foreground">Domain Specialists</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {specialists.map(spec => (
                  <div key={spec.id} className="glass-card p-6 border border-border hover:border-primary/50 transition-all">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 rounded-lg bg-primary/10">
                        <Cpu className="w-4 h-4 text-primary" />
                      </div>
                      <h3 className="font-semibold text-foreground">{spec.name}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4 h-10 line-clamp-2">{spec.description}</p>
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
                {specialists.length === 0 && <p className="text-muted-foreground">No specialists defined yet.</p>}
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
        onClose={() => setIsCreateProjectOpen(false)}
        onSuccess={() => {
          const token = localStorage.getItem('token');
          if (token) fetchProjects(token);
        }}
      />

      <CreateAgentModal
        isOpen={isCreateAgentOpen}
        onClose={() => setIsCreateAgentOpen(false)}
        onSuccess={() => {
          const token = localStorage.getItem('token');
          if (token) fetchAgents(token);
        }}
      />

      <CreateSpecialistModal
        isOpen={isCreateSpecialistOpen}
        onClose={() => setIsCreateSpecialistOpen(false)}
        onSuccess={() => {
          const token = localStorage.getItem('token');
          if (token) fetchSpecialists(token);
        }}
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
    </div>
  );
};

export default Index;
