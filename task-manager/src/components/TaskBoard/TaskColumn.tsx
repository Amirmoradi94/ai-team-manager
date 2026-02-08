import { motion } from 'framer-motion';
import { Task, Status, User } from '@/types/task';
import { TaskCard } from './TaskCard';
import { Plus, Lock } from 'lucide-react';
import { useState } from 'react';

interface TaskColumnProps {
  title: string;
  status: Status;
  tasks: Task[];
  onAddTask: (status: Status) => void;
  onTaskClick: (task: Task) => void;
  onTaskMove?: (taskId: string, newStatus: Status) => void;
  currentUser?: User | null;
  isLocked?: boolean;
}

const statusColors: Record<Status, string> = {
  backlog: 'bg-muted-foreground/20',
  todo: 'bg-info/20',
  'in-progress': 'bg-warning/20',
  'for-review': 'bg-purple-500/20',
  done: 'bg-success/20',
};

const statusDots: Record<Status, string> = {
  backlog: 'bg-muted-foreground',
  todo: 'bg-info',
  'in-progress': 'bg-warning',
  'for-review': 'bg-purple-500',
  done: 'bg-success',
};

export function TaskColumn({
  title,
  status,
  tasks,
  onAddTask,
  onTaskClick,
  onTaskMove,
  currentUser,
  isLocked
}: TaskColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isLocked) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (isLocked) {
      alert(`Only ${currentUser?.role === 'admin' ? 'admins' : 'Amir Moradi'} can move tasks to Done`);
      return;
    }

    const taskId = e.dataTransfer.getData('taskId');
    if (taskId && onTaskMove) {
      onTaskMove(taskId, status);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col w-80 min-w-[320px]"
    >
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusDots[status]}`} />
          <h3 className="font-medium text-foreground">{title}</h3>
          {isLocked && <Lock className="w-3 h-3 text-muted-foreground" />}
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[status]} text-foreground`}>
            {tasks.length}
          </span>
        </div>
        <button
          onClick={() => onAddTask(status)}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div
        className={`flex flex-col gap-3 flex-1 min-h-[200px] p-2 rounded-lg transition-colors ${
          isDragOver ? 'bg-primary/10 border-2 border-primary border-dashed' : 'border-2 border-transparent'
        } ${isLocked ? 'opacity-60' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {tasks.map((task, index) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <TaskCard task={task} onClick={() => onTaskClick(task)} />
          </motion.div>
        ))}

        {tasks.length === 0 && (
          <div className="glass-card p-6 text-center">
            <p className="text-muted-foreground text-sm">
              {isLocked ? '🔒 Admin Only' : 'No tasks yet'}
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
