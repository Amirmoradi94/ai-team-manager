import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Priority, Status, User, Task } from '@/types/task';
import { format } from 'date-fns';

import { Users } from 'lucide-react';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: any) => void;
  teamMembers: User[];
  projects: any[];
  agents: any[];
  teams: any[];
  defaultStatus?: Status;
  defaultSchedule?: { date?: Date; time?: string };
  editingTask?: Task | null;
}

export function CreateTaskModal({ isOpen, onClose, onSubmit, teamMembers, projects, agents, teams, defaultStatus = 'todo', defaultSchedule, editingTask }: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [status, setStatus] = useState<Status>(defaultStatus);
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [agentId, setAgentId] = useState<string>('');
  const [teamId, setTeamId] = useState<string>('');
  const [deadline, setDeadline] = useState<Date | undefined>(undefined);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState<string>('');
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
  const [isDeadlineCalendarOpen, setIsDeadlineCalendarOpen] = useState<boolean>(false);
  const [isCustomTimeActive, setIsCustomTimeActive] = useState<boolean>(false);

  useEffect(() => {
    if (editingTask && isOpen) {
      setTitle(editingTask.title || '');
      setDescription(editingTask.description || '');
      setPriority(editingTask.priority || 'medium');
      setStatus(editingTask.status || defaultStatus);
      setAssigneeId(editingTask.assignee?.id || '');
      setProjectId(editingTask.project_id || '');
      setAgentId((editingTask as any).agent_id || '');
      setTeamId(editingTask.team_id || '');
      setDeadline(editingTask.dueDate);
      setScheduledDate(editingTask.scheduledDate);
      setScheduledTime(editingTask.scheduledTime || '');
      setIsCustomTimeActive(false);
      return;
    }

    if (defaultSchedule?.date || defaultSchedule?.time) {
      setScheduledDate(defaultSchedule.date);
      setScheduledTime(defaultSchedule.time || '');
    }
  }, [editingTask, isOpen, defaultSchedule, defaultStatus]);

  // Auto-assign team lead when team is selected
  useEffect(() => {
    if (teamId && teams) {
      const selectedTeam = teams.find(t => t.id === teamId);
      if (selectedTeam?.lead?.id) {
        setAgentId(selectedTeam.lead.id);
        setAssigneeId('');
      }
    }
  }, [teamId, teams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const assignee = teamMembers.find(m => m.id === assigneeId);
    const selectedTeam = teamId && teams ? teams.find(t => t.id === teamId) : null;
    const teamLeadId = selectedTeam?.lead?.id || '';
    const finalAssigneeId = agentId || assigneeId || teamLeadId || undefined;
    const finalAgentId = agentId || teamLeadId || undefined;

    onSubmit({
      title,
      description,
      priority,
      status,
      assignee,
      assignee_id: finalAssigneeId,
      project_id: projectId || undefined,
      agent_id: finalAgentId,
      team_id: teamId || undefined,
      dueDate: deadline,
      scheduledDate,
      scheduledTime: scheduledTime || undefined,
    });

    // Reset form
    setTitle('');
    setDescription('');
    setPriority('medium');
    setStatus(defaultStatus);
    setAssigneeId('');
    setProjectId('');
    setAgentId('');
    setTeamId('');
    setDeadline(undefined);
    setScheduledDate(undefined);
    setScheduledTime('');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm -z-10"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-slate-900/80 via-slate-900/50 to-teal-900/30 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] max-h-[85vh] overflow-y-auto overflow-x-hidden custom-scrollbar">
              <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-teal-500/15 blur-3xl" />
              <div className="flex items-center justify-between mb-6 sticky top-0 bg-slate-900/70 backdrop-blur-md z-10 pb-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-teal-200/80">Execution Order</p>
                  <h2 className="text-xl font-semibold text-foreground">{editingTask ? 'Edit Task' : 'Create New Task'}</h2>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg border border-transparent hover:border-teal-500/40 hover:bg-slate-900/60 transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 relative z-10">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-teal-200/80 mb-2">
                    Title
                  </label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter task title..."
                    required
                    className="bg-slate-900/70 border border-teal-500/20 focus-visible:ring-1 focus-visible:ring-teal-400/60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-teal-200/80 mb-2">
                    Description
                  </label>
                  <RichTextEditor
                    value={description}
                    onChange={setDescription}
                    placeholder="Describe the task... Use @ to mention team members, use ``` for code blocks"
                    minHeight="150px"
                    teamMembers={[...teamMembers, ...agents]}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-teal-200/80 mb-2">
                      Priority
                    </label>
                    <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                      <SelectTrigger className="bg-slate-900/70 border border-teal-500/20 focus:ring-1 focus:ring-teal-400/60 focus:ring-offset-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-teal-200/80 mb-2">
                      Status
                    </label>
                    <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                      <SelectTrigger className="bg-slate-900/70 border border-teal-500/20 focus:ring-1 focus:ring-teal-400/60 focus:ring-offset-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="backlog">Backlog</SelectItem>
                        <SelectItem value="todo">To Do</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="for-review">For Review</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-teal-200/80 mb-2">
                      Project
                    </label>
                    <Select value={projectId} onValueChange={(val) => setProjectId(val === 'none' ? '' : val)}>
                      <SelectTrigger className="bg-slate-900/70 border border-teal-500/20 focus:ring-1 focus:ring-teal-400/60 focus:ring-offset-0">
                        <SelectValue placeholder="Select project..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Global / None</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-teal-200/80 mb-2">
                      Team
                    </label>
                    <Select value={teamId || agentId || assigneeId} onValueChange={(val) => {
                      const isTeam = teams?.find(t => t.id === val);
                      const isAi = agents.find(a => a.id === val);
                      
                      if (isTeam) {
                        setTeamId(val);
                        setAgentId(isTeam?.lead?.id || '');
                        setAssigneeId('');
                      } else if (isAi) {
                        setAgentId(val);
                        setTeamId('');
                        setAssigneeId('');
                      } else {
                        setAssigneeId(val);
                        setAgentId('');
                        setTeamId('');
                      }
                    }}>
                      <SelectTrigger className="bg-slate-900/70 border border-teal-500/20 focus:ring-1 focus:ring-teal-400/60 focus:ring-offset-0">
                        <SelectValue placeholder="Select assignee..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>

                        {teams && teams.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-secondary/30">Teams</div>
                            {teams.map((team) => (
                              <SelectItem key={team.id} value={team.id}>
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Users className="w-3 h-3 text-primary" />
                                  </div>
                                  <span>{team.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </>
                        )}

                        {teamMembers.filter(m => m.name === 'Amir Moradi').length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-secondary/30">Individual</div>
                            {teamMembers.filter(m => m.name === 'Amir Moradi').map((member) => (
                              <SelectItem key={member.id} value={member.id}>
                                <div className="flex items-center gap-2">
                                  <Avatar className="w-5 h-5">
                                    <AvatarImage src={member.avatar} alt={member.name} />
                                    <AvatarFallback className="text-xs">
                                      {member.name.split(' ').map(n => n[0]).join('')}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>{member.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    {teamId && teams && (() => {
                      const selectedTeam = teams.find(t => t.id === teamId);
                      return selectedTeam?.lead ? (
                        <p className="mt-2 text-xs text-teal-200/80 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          Team lead "{selectedTeam.lead.name}" auto-assigned
                        </p>
                      ) : null;
                    })()}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest text-teal-200/80 mb-2 flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-teal-300" />
                    Deadline
                  </label>
                  <Popover open={isDeadlineCalendarOpen} onOpenChange={setIsDeadlineCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal bg-slate-900/70 border border-teal-500/20 focus-visible:ring-1 focus-visible:ring-teal-400/60 focus-visible:ring-offset-0"
                        onClick={() => setIsDeadlineCalendarOpen(true)}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {deadline ? format(deadline, 'PPP') : <span className="text-muted-foreground">Set deadline...</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={deadline}
                        onSelect={(date) => {
                          setDeadline(date);
                          setIsDeadlineCalendarOpen(false);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-teal-200/80 mb-2">
                      Scheduled Date (Optional)
                    </label>
                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal bg-slate-900/70 border border-teal-500/20 focus-visible:ring-1 focus-visible:ring-teal-400/60 focus-visible:ring-offset-0"
                          onClick={() => setIsCalendarOpen(true)}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {scheduledDate ? format(scheduledDate, 'PPP') : <span className="text-muted-foreground">Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={scheduledDate}
                          onSelect={(date) => {
                            setScheduledDate(date);
                            setIsCalendarOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-teal-200/80 mb-2">
                      Scheduled Time
                    </label>
                    {isCustomTimeActive ? (
                      // Custom time input
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="bg-slate-900/70 border border-teal-500/20 focus-visible:ring-1 focus-visible:ring-teal-400/60 flex-1"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsCustomTimeActive(false)}
                          className="shrink-0 h-10 px-3 bg-slate-900/70 border border-teal-500/20"
                        >
                          <Clock className="mr-2 h-4 w-4" /> List
                        </Button>
                      </div>
                    ) : (
                      // Time selection dropdown
                      <Select
                        value={scheduledTime}
                        onValueChange={(value) => {
                          if (value === 'custom') {
                            setIsCustomTimeActive(true);
                            if (!scheduledTime) {
                              setScheduledTime('12:00'); // Default to noon if no time set
                            }
                          } else {
                            setIsCustomTimeActive(false);
                            setScheduledTime(value);
                          }
                        }}
                      >
                      <SelectTrigger className="bg-slate-900/70 border border-teal-500/20 focus:ring-1 focus:ring-teal-400/60 focus:ring-offset-0">
                        <SelectValue placeholder="Pick a time">
                            {scheduledTime ? (
                              <div className="flex items-center">
                                <Clock className="mr-2 h-4 w-4" />
                                {scheduledTime}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Pick a time</span>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 24 * 2 }, (_, i) => {
                            const hour = Math.floor(i / 2);
                            const minute = (i % 2) * 30;
                            const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                            return (
                              <SelectItem key={time} value={time}>
                                {format(new Date().setHours(hour, minute, 0, 0), 'h:mm a')}
                              </SelectItem>
                            );
                          })}
                          <SelectItem key="custom" value="custom">
                            Custom Time...
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    className="flex-1 border border-teal-500/30 bg-slate-900/70 text-teal-100 hover:border-teal-300/70"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-teal-500/90 hover:bg-teal-500 text-slate-900 font-semibold"
                  >
                    {editingTask ? 'Update Task' : 'Create Task'}
                  </Button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
