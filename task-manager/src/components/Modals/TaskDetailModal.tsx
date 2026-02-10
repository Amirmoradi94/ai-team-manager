import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Edit3, Trash2, Send, ArrowLeft, CheckCircle2, Clock, Zap, FileEdit, Cpu, Terminal, FolderKanban, Users, FileText, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Task, Priority, Status } from '@/types/task';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { io } from 'socket.io-client';

interface Comment {
  id: string;
  task_id: string;
  user_id: string | null;
  user_name: string;
  content: string;
  is_system: boolean;
  created_at: string;
}

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onStatusChange?: (taskId: string, newStatus: Status) => void;
}

const priorityColors: Record<Priority, { bg: string; text: string }> = {
  low: { bg: 'bg-muted', text: 'text-muted-foreground' },
  medium: { bg: 'bg-info/20', text: 'text-info' },
  high: { bg: 'bg-warning/20', text: 'text-warning' },
  urgent: { bg: 'bg-destructive/20', text: 'text-destructive' },
};

const statusLabels: Record<Status, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  'in-progress': 'In Progress',
  'for-review': 'For Review',
  done: 'Done',
};

const API_URL = 'http://localhost:3001/api';

export function TaskDetailModal({ task, isOpen, onClose, onEdit, onDelete, onStatusChange }: TaskDetailModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [liveLogs, setLiveLogs] = useState<string>('');
  const [newComment, setNewComment] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [showRequestChanges, setShowRequestChanges] = useState(false);

  useEffect(() => {
    if (task && isOpen) {
      loadComments();
      
      // Initialize Socket.io connection
      const socket = io('http://localhost:3001');

      socket.on('connect', () => {
        console.log('[Socket] Connected to backend');
      });

      // Listen for task logs
      socket.on(`task-logs-${task.id}`, (data: { chunk: string; timestamp: string }) => {
        setLiveLogs(prev => prev + data.chunk);
      });

      return () => {
        socket.disconnect();
        console.log('[Socket] Disconnected');
      };
    } else {
      setLiveLogs('');
    }
  }, [task, isOpen]);

  const loadComments = async () => {
    if (!task) return;

    setIsLoadingComments(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/tasks/${task.id}/comments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const handlePostComment = async () => {
    if (!task || !newComment.trim()) return;

    setIsPosting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: newComment.trim() })
      });

      if (res.ok) {
        const comment = await res.json();
        setComments([...comments, comment]);
        setNewComment('');
      }
    } catch (error) {
      console.error('Failed to post comment:', error);
    } finally {
      setIsPosting(false);
    }
  };

  const handleMoveBackToTodo = async () => {
    if (!task || !newComment.trim()) {
      alert('Please add a comment with instructions before moving task back to To Do');
      return;
    }

    setIsPosting(true);

    // Optimistically update UI
    if (onStatusChange) {
      onStatusChange(task.id, 'todo');
    }

    // Close modal immediately for better UX
    onClose();

    try {
      const token = localStorage.getItem('token');

      // Post comment first
      await fetch(`${API_URL}/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: newComment.trim() })
      });

      // Move task back to todo (this will trigger webhook)
      await fetch(`${API_URL}/tasks/${task.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'todo' })
      });
      
      // No reload needed
    } catch (error) {
      console.error('Failed to move task:', error);
      toast.error('Failed to move task');
      setIsPosting(false);
    }
  };

  const handleApprove = async () => {
    if (!task) return;

    setIsPosting(true);

    // Optimistically update UI
    if (onStatusChange) {
      onStatusChange(task.id, 'done');
    }

    // Close modal immediately for better UX
    onClose();

    try {
      const token = localStorage.getItem('token');

      // Move task to done status
      await fetch(`${API_URL}/tasks/${task.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'done' })
      });
      
      // No reload needed
    } catch (error) {
      console.error('Failed to approve task:', error);
      // Revert optimistic update if possible or show error (in a real app we'd revert state)
      toast.error('Failed to approve task');
      setIsPosting(false);
    }
  };

  if (!task) return null;

  const priority = priorityColors[task.priority];
  const isDone = task.status === 'done';
  const isForReview = task.status === 'for-review';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
          >
            <div
              className="glass-card-dark w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 text-sm font-medium rounded-lg ${priority.bg} ${priority.text}`}>
                      {task.priority}
                    </span>
                    <span className="px-3 py-1 text-sm font-medium rounded-lg bg-secondary text-secondary-foreground">
                      {statusLabels[task.status]}
                    </span>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <h2 className="text-2xl font-bold text-foreground mb-4">{task.title}</h2>
                <p className="text-muted-foreground">{task.description}</p>
              </div>

              {/* Details */}
              <div className="p-6 space-y-4 border-b border-border">
                <div className="grid grid-cols-2 gap-4">
                  {/* Project and Team Info */}
                  {task.project_name && (
                    <div className="flex items-center justify-start">
                      <span className="text-sm text-muted-foreground w-32">Project</span>
                      <div className="flex items-center gap-2">
                        <FolderKanban className="w-4 h-4 text-primary" />
                        <span className="text-sm text-foreground font-medium">{task.project_name}</span>
                      </div>
                    </div>
                  )}

                  {task.team_name && (
                    <div className="flex items-center justify-start">
                      <span className="text-sm text-muted-foreground w-32">Team</span>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-info" />
                        <span className="text-sm text-foreground font-medium">{task.team_name}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-start">
                    <span className="text-sm text-muted-foreground w-32">Assigned to</span>
                    {task.assignee ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={task.assignee.avatar} alt={task.assignee.name} />
                          <AvatarFallback className="text-xs">
                            {task.assignee.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-foreground">{task.assignee.name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Unassigned</span>
                    )}
                  </div>

                  <div className="flex items-center justify-start">
                    <span className="text-sm text-muted-foreground w-32">Created by</span>
                    {task.createdBy ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={task.createdBy.avatar} alt={task.createdBy.name} />
                          <AvatarFallback className="text-xs">
                            {task.createdBy.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-foreground">{task.createdBy.name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Unknown</span>
                    )}
                  </div>

                  <div className="flex items-center justify-start">
                    <span className="text-sm text-muted-foreground w-24">Created</span>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">{format(task.createdAt, 'MMM d, yyyy')}</span>
                    </div>
                  </div>

                  {task.dueDate && (
                    <div className="flex items-center justify-start">
                      <span className="text-sm text-muted-foreground w-24">Deadline</span>
                      <div className="flex items-center gap-2">
                        <CalendarClock className="w-4 h-4 text-destructive" />
                        <span className="text-sm text-destructive font-semibold">{format(task.dueDate, 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  )}

                  {task.scheduledDate && (
                    <div className="flex items-center justify-start">
                      <span className="text-sm text-muted-foreground w-32">Scheduled for</span>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        <span className="text-sm text-primary font-medium">
                          {(() => {
                            // Ensure date is treated as local by appending time if needed or just using the string parts
                            // If task.scheduledDate is a Date object, use it directly. If string, handle it.
                            const dateObj = task.scheduledDate instanceof Date
                              ? task.scheduledDate
                              : new Date(task.scheduledDate.toString().includes('T') ? task.scheduledDate : `${task.scheduledDate}T00:00:00`);
                            return format(dateObj, 'MMM d, yyyy');
                          })()}
                          {task.scheduledTime && ` @ ${task.scheduledTime}`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Terminal Logs - Live Stream */}
              {(task.status === 'in-progress' || liveLogs) && (
                <div className="p-6 border-b border-border bg-black/20">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-primary" />
                      Agent Terminal Output
                    </h3>
                    {task.status === 'in-progress' && (
                      <span className="flex items-center gap-1.5 text-[10px] text-primary animate-pulse font-bold uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        Live
                      </span>
                    )}
                  </div>
                  <div className="bg-[#0c0c0c] rounded-lg p-4 border border-white/5 font-mono text-[11px] text-green-400/90 h-48 overflow-y-auto custom-scrollbar shadow-inner">
                    <div className="whitespace-pre-wrap">
                      {liveLogs || (task.status === 'in-progress' ? 'Waiting for agent output...' : 'No terminal logs recorded.')}
                    </div>
                  </div>
                </div>
              )}

              {/* Completion Report - Show for done tasks */}
              {isDone && task.completion_report && (
                <div className="p-6 border-b border-border bg-gradient-to-br from-primary/5 to-transparent">
                  <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Completion Report
                    {task.assignee && (
                      <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary font-normal">
                        by {task.assignee.name}
                      </span>
                    )}
                  </h3>
                  <div className="prose prose-invert prose-sm max-w-none bg-secondary/20 rounded-lg p-4 border border-border">
                    <ReactMarkdown>{task.completion_report}</ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Execution Statistics - Only show for completed tasks */}
              {task.execution_time && (
                <div className="p-6 border-b border-border">
                  <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" />
                    Execution Statistics
                    {task.model_used && (
                      <span className="text-xs px-2 py-1 rounded-full bg-accent/20 text-accent font-normal">
                        {task.model_used}
                      </span>
                    )}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Execution Time */}
                    <div className="bg-secondary/30 rounded-lg p-4 border border-border hover:border-primary/30 transition-colors">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-primary" />
                        <span className="text-xs text-muted-foreground">Duration</span>
                      </div>
                      <p className="text-lg font-semibold text-foreground">
                        {(task.execution_time / 1000).toFixed(1)}s
                      </p>
                    </div>

                    {/* Tokens Used */}
                    {task.tokens_used && (
                      <div className="bg-secondary/30 rounded-lg p-4 border border-border hover:border-primary/30 transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="w-4 h-4 text-warning" />
                          <span className="text-xs text-muted-foreground">Tokens</span>
                        </div>
                        <p className="text-lg font-semibold text-foreground">
                          {task.tokens_used.toLocaleString()}
                        </p>
                      </div>
                    )}

                    {/* Files Modified */}
                    {task.files_modified !== null && task.files_modified !== undefined && (
                      <div className="bg-secondary/30 rounded-lg p-4 border border-border hover:border-primary/30 transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                          <FileEdit className="w-4 h-4 text-info" />
                          <span className="text-xs text-muted-foreground">Files Modified</span>
                        </div>
                        <p className="text-lg font-semibold text-foreground">
                          {task.files_modified}
                        </p>
                      </div>
                    )}

                    {/* Model Used */}
                    {task.model_used && (
                      <div className="bg-secondary/30 rounded-lg p-4 border border-border hover:border-primary/30 transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                          <Cpu className="w-4 h-4 text-accent" />
                          <span className="text-xs text-muted-foreground">AI Provider</span>
                        </div>
                        <p className="text-sm font-semibold text-foreground truncate">
                          {task.model_used.split('-').slice(-2).join('-')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Comments Section */}
              <div className="flex-1 overflow-y-auto p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Comments</h3>

                <div className="space-y-4 mb-4">
                  {isLoadingComments ? (
                    <div className="text-center text-muted-foreground py-4">Loading comments...</div>
                  ) : comments.length > 0 ? (
                    comments.map((comment) => (
                      <div
                        key={comment.id}
                        className={`p-4 rounded-lg ${
                          comment.is_system
                            ? 'bg-primary/10 border border-primary/20'
                            : 'bg-secondary/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Avatar className="w-6 h-6">
                            <AvatarFallback className="text-xs">
                              {comment.user_name?.split(' ').map(n => n[0]).join('') || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium text-foreground">{comment.user_name}</span>
                          {comment.is_system && (
                            <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">System</span>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {format(new Date(comment.created_at), 'MMM d, h:mm a')}
                          </span>
                        </div>
                        <div className="text-sm text-foreground prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown>{comment.content}</ReactMarkdown>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground py-4">No comments yet</div>
                  )}
                </div>

                {/* Add Comment */}
                <div className="space-y-3">
                  {/* Show textarea for non-review tasks or when requesting changes */}
                  {(!isForReview || showRequestChanges) && (
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder={
                        showRequestChanges
                          ? "Add instructions for changes..."
                          : isDone
                          ? "Add instructions to reopen this task..."
                          : "Add a comment..."
                      }
                      className="min-h-[100px]"
                    />
                  )}
                  <div className="flex gap-2">
                    {isDone ? (
                      <Button
                        onClick={handleMoveBackToTodo}
                        disabled={isPosting || !newComment.trim()}
                        className="flex-1 gap-2"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Move Back to To Do & Notify Claude
                      </Button>
                    ) : isForReview ? (
                      showRequestChanges ? (
                        <>
                          <Button
                            onClick={() => {
                              setShowRequestChanges(false);
                              setNewComment('');
                            }}
                            disabled={isPosting}
                            variant="outline"
                            className="flex-1 gap-2"
                          >
                            <X className="w-4 h-4" />
                            Cancel
                          </Button>
                          <Button
                            onClick={handleMoveBackToTodo}
                            disabled={isPosting || !newComment.trim()}
                            className="flex-1 gap-2 bg-warning hover:bg-warning/90"
                          >
                            <Send className="w-4 h-4" />
                            Send Changes & Notify Claude
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            onClick={handleApprove}
                            disabled={isPosting}
                            className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Approve & Mark as Done
                          </Button>
                          <Button
                            onClick={() => setShowRequestChanges(true)}
                            disabled={isPosting}
                            variant="outline"
                            className="flex-1 gap-2 border-warning text-warning hover:bg-warning/10"
                          >
                            <ArrowLeft className="w-4 h-4" />
                            Request Changes
                          </Button>
                        </>
                      )
                    ) : (
                      <Button
                        onClick={handlePostComment}
                        disabled={isPosting || !newComment.trim()}
                        className="flex-1 gap-2"
                      >
                        <Send className="w-4 h-4" />
                        Post Comment
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-6 border-t border-border flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    onEdit(task);
                    onClose();
                  }}
                  className="flex-1 gap-2 border-border hover:border-primary/50"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    onDelete(task.id);
                    onClose();
                  }}
                  className="flex-1 gap-2 border-destructive/50 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
