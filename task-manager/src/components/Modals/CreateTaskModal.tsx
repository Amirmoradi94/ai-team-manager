import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  const [tags, setTags] = useState('');
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState<string>('');
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
  const [isCustomTimeActive, setIsCustomTimeActive] = useState<boolean>(false);

  // ... (useEffects)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const assignee = teamMembers.find(m => m.id === assigneeId);

    onSubmit({
      title,
      description,
      priority,
      status,
      assignee,
      project_id: projectId || undefined,
      agent_id: agentId || undefined,
      team_id: teamId || undefined,
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
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
    setTags('');
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
            <div className="glass-card-dark p-6 glow-border max-h-[85vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-6 sticky top-0 bg-background/80 backdrop-blur-md z-10 pb-2">
                <h2 className="text-xl font-semibold text-foreground">{editingTask ? 'Edit Task' : 'Create New Task'}</h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Title
                  </label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter task title..."
                    required
                    className="bg-secondary border-0 focus-visible:ring-1 focus-visible:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Description
                  </label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the task... Mention @Specialists if needed."
                    rows={3}
                    className="bg-secondary border-0 focus-visible:ring-1 focus-visible:ring-primary resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Priority
                    </label>
                    <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                      <SelectTrigger className="bg-secondary border-0">
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
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Status
                    </label>
                    <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                      <SelectTrigger className="bg-secondary border-0">
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
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Project
                    </label>
                    <Select value={projectId} onValueChange={setProjectId}>
                      <SelectTrigger className="bg-secondary border-0">
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
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Agent / Team / Assignee
                    </label>
                    <Select value={agentId || teamId || assigneeId} onValueChange={(val) => {
                      const isTeam = teams?.find(t => t.id === val);
                      const isAi = agents.find(a => a.id === val);
                      
                      if (isTeam) {
                        setTeamId(val);
                        setAgentId('');
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
                      <SelectTrigger className="bg-secondary border-0">
                        <SelectValue placeholder="Select assignee..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        
                        {teams && teams.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-secondary/30">AI Teams</div>
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

                        {agents.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-secondary/30">Individual Agents</div>
                            {agents.map((agent) => (
                              <SelectItem key={agent.id} value={agent.id}>
                                <div className="flex items-center gap-2">
                                  <Avatar className="w-5 h-5">
                                    <AvatarImage src={agent.avatar} />
                                    <AvatarFallback>{agent.name[0]}</AvatarFallback>
                                  </Avatar>
                                  <span>{agent.name}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </>
                        )}
                        
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-secondary/30">Team Members</div>
                        {teamMembers.map((member) => (
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
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Tags
                  </label>
                  <Input
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="Enter tags separated by commas..."
                    className="bg-secondary border-0 focus-visible:ring-1 focus-visible:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Scheduled Date
                    </label>
                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal bg-secondary border-0"
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
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Scheduled Time
                    </label>
                    {isCustomTimeActive ? (
                      // Custom time input
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="bg-secondary border-0 focus-visible:ring-1 focus-visible:ring-primary flex-1"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsCustomTimeActive(false)}
                          className="shrink-0 h-10 px-3"
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
                        <SelectTrigger className="bg-secondary border-0">
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
                    className="flex-1 border-border hover:border-primary/50"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
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
