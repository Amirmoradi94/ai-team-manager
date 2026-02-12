export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type Status = 'backlog' | 'todo' | 'in-progress' | 'for-review' | 'done' | 'blocked';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'admin' | 'member';
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: Status;
  assignee?: User;
  createdBy: User;
  createdAt: Date;
  dueDate?: Date;
  scheduledDate?: Date;
  scheduledTime?: string; // "HH:MM" format
  tags: string[];
  // Execution metadata (populated after Claude completes a task)
  execution_time?: number; // in milliseconds
  tokens_used?: number;
  files_modified?: number;
  model_used?: string;
  execution_started_at?: string;
  execution_completed_at?: string;
  completion_report?: string; // AI-generated summary of completed work
  // Project and Team context
  project_id?: string;
  project_name?: string;
  team_id?: string;
  team_name?: string;
  // Error tracking
  failed_at?: string;
}

export interface Team {
  id: string;
  name: string;
  members: User[];
}
