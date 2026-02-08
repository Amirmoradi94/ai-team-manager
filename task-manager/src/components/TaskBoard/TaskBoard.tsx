import { Task, Status, User } from '@/types/task';
import { TaskColumn } from './TaskColumn';

interface TaskBoardProps {
  tasks: Task[];
  onAddTask: (status: Status) => void;
  onTaskClick: (task: Task) => void;
  onTaskMove?: (taskId: string, newStatus: Status) => void;
  currentUser?: User | null;
}

const columns: { title: string; status: Status; locked?: boolean }[] = [
  { title: 'Backlog', status: 'backlog' },
  { title: 'To Do', status: 'todo' },
  { title: 'In Progress', status: 'in-progress' },
  { title: 'For Review', status: 'for-review' },
  { title: 'Done', status: 'done', locked: true }, // Only admin can move here
];

export function TaskBoard({ tasks, onAddTask, onTaskClick, onTaskMove, currentUser }: TaskBoardProps) {
  return (
    <div className="flex gap-6 overflow-x-auto pb-4 px-1">
      {columns.map((column) => (
        <TaskColumn
          key={column.status}
          title={column.title}
          status={column.status}
          tasks={tasks.filter((task) => task.status === column.status)}
          onAddTask={onAddTask}
          onTaskClick={onTaskClick}
          onTaskMove={onTaskMove}
          currentUser={currentUser}
          isLocked={column.locked && currentUser?.role !== 'admin'}
        />
      ))}
    </div>
  );
}
