import {
  DELETED_RETENTION_DAYS,
  Subtask,
  Task,
  TaskStatus,
  TaskUpdate,
  TaskViewModel
} from '../models/task.model';

export function toTaskViewModel(task: Task, expanded = false): TaskViewModel {
  return { ...task, expanded };
}

export function toTaskUpdate(task: Task | TaskViewModel): TaskUpdate {
  const { expanded: _expanded, ...payload } = task as TaskViewModel;
  return payload;
}

export function ensureDateTimeSeconds(dateDue: string | undefined): string | undefined {
  if (!dateDue) return dateDue;
  return dateDue.length === 16 ? `${dateDue}:00` : dateDue;
}

export function formatDuration(minutes: number | undefined): string {
  if (!minutes) return '';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

export function getProgressPercent(task: Task): number {
  if (!task.subtasks || task.subtasks.length === 0) return task.completed ? 100 : 0;
  const completed = task.subtasks.filter(s => s.completed).length;
  return Math.round((completed / task.subtasks.length) * 100);
}

export function isOverdue(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

export function getDaysRemaining(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const due = new Date(dateStr);
  const now = new Date();
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  return `${diff} days left`;
}

export function getElapsedPercentFromLastCompleted(task: Task): number {
  if (!task.dateDue) return 0;

  const due = new Date(task.dateDue).getTime();
  const now = Date.now();
  let startPoint: number;

  if (task.subtasks && task.subtasks.length > 0) {
    const completedSubtasks = task.subtasks.filter(s => s.completed && s.dateDue);
    if (completedSubtasks.length > 0) {
      startPoint = completedSubtasks
        .map(s => new Date(s.dateDue!).getTime())
        .reduce((max, curr) => Math.max(max, curr), 0);
    } else {
      startPoint = task.dateCreated ? new Date(task.dateCreated).getTime() : now;
    }
  } else {
    startPoint = task.dateCreated ? new Date(task.dateCreated).getTime() : now;
  }

  const total = due - startPoint;
  if (total <= 0) return 100;
  const elapsed = now - startPoint;
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

export function isSubtaskOverdue(subtask: Subtask): boolean {
  if (!subtask.dateDue || subtask.completed) return false;
  return new Date(subtask.dateDue) < new Date();
}

export function needsExtensionRecommendation(task: Task): boolean {
  if (task.completed) return false;
  return getElapsedPercentFromLastCompleted(task) >= 50 && !isOverdue(task.dateDue);
}

export function canAdjustTimeframe(task: Task): boolean {
  if (!task.subtasks || task.subtasks.length === 0) return false;
  const incompleteSubtasks = task.subtasks.filter(s => !s.completed);
  if (incompleteSubtasks.length === 0) return false;
  const firstIncomplete = incompleteSubtasks[0];
  if (!firstIncomplete.dateDue) return false;
  return new Date(firstIncomplete.dateDue) < new Date();
}

export function canRecommendExtension(task: Task): boolean {
  if (task.completed) return false;
  return getElapsedPercentFromLastCompleted(task) >= 50;
}

export function getTaskStatus(task: Task): TaskStatus {
  if (task.completed) return 'normal';
  if (isOverdue(task.dateDue)) return 'overdue';
  if (needsExtensionRecommendation(task)) return 'warning';
  return 'normal';
}

export function getRetentionDaysLeft(task: Task, retentionDays = DELETED_RETENTION_DAYS): number {
  if (!task.deletedAt) return retentionDays;
  const expires = new Date(task.deletedAt).getTime() + retentionDays * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((expires - Date.now()) / (1000 * 60 * 60 * 24)));
}

export function getRetentionPercent(task: Task, retentionDays = DELETED_RETENTION_DAYS): number {
  return Math.round((getRetentionDaysLeft(task, retentionDays) / retentionDays) * 100);
}

export function getDeletedAgoLabel(task: Task): string {
  if (!task.deletedAt) return 'Deleted';
  const days = Math.floor((Date.now() - new Date(task.deletedAt).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Deleted today';
  if (days === 1) return 'Deleted yesterday';
  return `Deleted ${days} days ago`;
}

export function getRetentionLabel(task: Task, retentionDays = DELETED_RETENTION_DAYS): string {
  const days = getRetentionDaysLeft(task, retentionDays);
  if (days <= 0) return 'Expires today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

export function withToggledTaskCompletion(task: Task): TaskUpdate {
  const newCompleted = !task.completed;
  let updatedSubtasks = task.subtasks;

  if (task.subtasks && task.subtasks.length > 0) {
    if (newCompleted) {
      updatedSubtasks = task.subtasks.map(st => ({ ...st, completed: true }));
    } else {
      updatedSubtasks = task.subtasks.map((st, index) =>
        index === task.subtasks!.length - 1 ? { ...st, completed: false } : st
      );
    }
  }

  return toTaskUpdate({
    ...task,
    completed: newCompleted,
    subtasks: updatedSubtasks,
    expanded: false
  });
}

export function withToggledSubtaskCompletion(parent: Task, subtaskId: string): TaskUpdate {
  const updatedSubtasks = parent.subtasks?.map(st =>
    st.id === subtaskId ? { ...st, completed: !st.completed } : st
  ) || [];

  const allSubtasksCompleted =
    updatedSubtasks.length > 0 && updatedSubtasks.every(st => st.completed);

  return toTaskUpdate({
    ...parent,
    completed: allSubtasksCompleted,
    subtasks: updatedSubtasks,
    expanded: false
  });
}
