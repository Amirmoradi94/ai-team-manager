import { Task, Status, User } from '@/types/task';
import { TaskColumn } from './TaskColumn';

interface TaskBoardProps {
  tasks: Task[];
  onAddTask: (status: Status) => void;
  onTaskClick: (task: Task) => void;
  onTaskDelete: (taskId: string) => void;
  onTaskMove?: (taskId: string, newStatus: Status) => void;
  currentUser?: User | null;
}

const columns: { title: string; status: Status; locked?: boolean }[] = [
  { title: 'Backlog', status: 'backlog' },
  { title: 'To Do', status: 'todo' },
  { title: 'Blocked', status: 'blocked' },
  { title: 'In Progress', status: 'in-progress' },
  { title: 'For Review', status: 'for-review' },
  { title: 'Done', status: 'done', locked: true }, // Only admin can move here
];

export function TaskBoard({ tasks, onAddTask, onTaskClick, onTaskDelete, onTaskMove, currentUser }: TaskBoardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 pb-4 px-1">
      {columns.map((column) => (
        <TaskColumn
          key={column.status}
          title={column.title}
          status={column.status}
          tasks={tasks.filter((task) => task.status === column.status)}
          onAddTask={onAddTask}
          onTaskClick={onTaskClick}
          onTaskDelete={onTaskDelete}
          onTaskMove={onTaskMove}
          currentUser={currentUser}
          isLocked={column.locked && currentUser?.role !== 'admin'}
        />
      ))}
    </div>
  );
}
