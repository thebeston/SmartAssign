export interface Subtask {
  id?: string;
  parentId?: string;
  title: string;
  description?: string;
  dateStart?: string;
  dateDue?: string;
  originalDateDue?: string;
  completed?: boolean;
  duration?: number;
}

/** API / persistence shape — no UI-only fields. */
export interface Task {
  id: string;
  title: string;
  description: string;
  dateCreated?: string;
  dateDue: string;
  originalDateDue?: string;
  completed?: boolean;
  duration?: number;
  subtasks?: Subtask[];
  deletedAt?: string;
}

/** UI view model — extends Task with presentation state. */
export interface TaskViewModel extends Task {
  expanded: boolean;
}

export interface CreateTaskRequest {
  title: string;
  description: string;
  dateDue: string;
  completed: boolean;
}

export type TaskUpdate = Omit<Task, 'id'> & { id?: string };

export type AppTab = 'tasks' | 'deleted' | 'demo';
export type TaskFilter = 'all' | 'active' | 'completed' | 'overdue';
export type TaskStatus = 'normal' | 'warning' | 'overdue';

export const DELETED_RETENTION_DAYS = 14;
