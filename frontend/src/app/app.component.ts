import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

interface Task {
  id: string;
  title: string;
  description: string;
  dateCreated?: string;
  dateDue: string;
  originalDateDue?: string;
  completed?: boolean;
  duration?: number;
  subtasks?: Subtask[];
  expanded?: boolean;
  deletedAt?: string;
}

interface Subtask {
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

type AppTab = 'tasks' | 'deleted' | 'demo';
type TaskFilter = 'all' | 'active' | 'completed' | 'overdue';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly API_BASE = 'http://localhost:8080';
  private overdueCheckInterval: any = null;

  title = 'SmartAssign';
  loading = false;
  deletedLoading = false;
  error = '';
  successMessage = '';
  tasks: Task[] = [];
  deletedTasks: Task[] = [];
  activeTab: AppTab = 'tasks';
  taskFilter: TaskFilter = 'all';
  searchQuery = '';
  deletedSearchQuery = '';
  showCompletedSection = false;

  newTask: Omit<Task, 'id'> = {
    title: '',
    description: '',
    dateDue: ''
  };

  subtaskInputs: { [taskId: string]: Partial<Subtask> } = {};
  taskEditInputs: { [taskId: string]: Partial<Task> } = {};
  subtaskEditInputs: { [subtaskId: string]: Partial<Subtask> } = {};

  generating: { [taskId: string]: boolean } = {};
  rearranging: { [taskId: string]: boolean } = {};
  adjustingFrame: { [taskId: string]: boolean } = {};
  recommendingExtension: { [taskId: string]: boolean } = {};
  restoring: { [taskId: string]: boolean } = {};
  editingTask: { [taskId: string]: boolean } = {};
  showCreateForm = false;

  showDeleteModal = false;
  deleteModalTitle = '';
  deleteModalMessage = '';
  deleteModalConfirmLabel = 'Delete';
  pendingDeleteAction: (() => void) | null = null;

  readonly retentionDays = 14;

  ngOnInit(): void {
    this.loadTasks();
    this.loadDeletedTasks();
    this.startOverdueCheck();
  }

  ngOnDestroy(): void {
    this.stopOverdueCheck();
  }

  private startOverdueCheck(): void {
    this.overdueCheckInterval = setInterval(() => {
      this.checkAndAdjustOverdueSubtasks();
    }, 60000);
  }

  private stopOverdueCheck(): void {
    if (this.overdueCheckInterval) {
      clearInterval(this.overdueCheckInterval);
      this.overdueCheckInterval = null;
    }
  }

  private checkAndAdjustOverdueSubtasks(): void {
    const now = new Date();

    for (const task of this.tasks) {
      if (task.completed) continue;

      const hasOverdueIncomplete = task.subtasks?.some(st =>
        !st.completed &&
        st.dateDue &&
        new Date(st.dateDue) < now
      );

      if (hasOverdueIncomplete && !this.adjustingFrame[task.id]) {
        this.autoAdjustTimeframe(task);
      }
    }
  }

  private autoAdjustTimeframe(task: Task): void {
    this.adjustingFrame[task.id] = true;
    this.http.put<Task>(`${this.API_BASE}/tasks/${task.id}/subtasks/adjustFrame`, null).subscribe({
      next: (updated) => {
        const idx = this.tasks.findIndex((x) => x.id === updated.id);
        if (idx >= 0) {
          updated.expanded = this.tasks[idx].expanded;
          this.tasks[idx] = updated;
        }
        this.adjustingFrame[task.id] = false;
        this.showSuccess(`Auto-adjusted timeframe for "${task.title}"`);
      },
      error: () => {
        this.adjustingFrame[task.id] = false;
      }
    });
  }

  setActiveTab(tab: AppTab): void {
    this.activeTab = tab;
    if (tab === 'deleted') {
      this.loadDeletedTasks();
    }
  }

  setTaskFilter(filter: TaskFilter): void {
    this.taskFilter = filter;
    if (filter === 'completed') {
      this.showCompletedSection = true;
    }
  }

  showSuccess(message: string): void {
    this.successMessage = message;
    setTimeout(() => this.successMessage = '', 3000);
  }

  showError(message: string): void {
    this.error = message;
    setTimeout(() => this.error = '', 5000);
  }

  getSubtaskInput(taskId: string): Partial<Subtask> {
    if (!this.subtaskInputs[taskId]) this.subtaskInputs[taskId] = {};
    return this.subtaskInputs[taskId];
  }

  get filteredTasks(): Task[] {
    const query = this.searchQuery.trim().toLowerCase();
    return this.tasks.filter(task => {
      if (this.taskFilter === 'active' && task.completed) return false;
      if (this.taskFilter === 'completed' && !task.completed) return false;
      if (this.taskFilter === 'overdue' && (task.completed || !this.isOverdue(task.dateDue))) return false;
      if (query) {
        const haystack = `${task.title} ${task.description || ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }

  get activeFilteredTasks(): Task[] {
    return this.filteredTasks.filter(t => !t.completed);
  }

  get completedFilteredTasks(): Task[] {
    return this.filteredTasks.filter(t => t.completed);
  }

  get filteredDeletedTasks(): Task[] {
    const query = this.deletedSearchQuery.trim().toLowerCase();
    if (!query) return this.deletedTasks;
    return this.deletedTasks.filter(task =>
      `${task.title} ${task.description || ''}`.toLowerCase().includes(query)
    );
  }

  get showCompletedBlock(): boolean {
    if (this.taskFilter === 'active' || this.taskFilter === 'overdue') return false;
    return this.completedFilteredTasks.length > 0;
  }

  toggleExpand(task: Task): void {
    task.expanded = !task.expanded;
    if (!this.subtaskInputs[task.id]) {
      this.subtaskInputs[task.id] = {};
    }
    if (task.expanded && (!task.subtasks || task.subtasks.length === 0)) {
      this.http.get<Task>(`${this.API_BASE}/tasks/${task.id}`).subscribe({
        next: (t) => {
          const idx = this.tasks.findIndex((x) => x.id === t.id);
          if (idx >= 0) {
            t.expanded = true;
            this.tasks[idx] = t;
          }
        }
      });
    }
  }

  createSubtask(parent: Task): void {
    const input = this.subtaskInputs[parent.id] || {};
    if (!input.title?.toString().trim()) {
      this.showError('Subtask title is required.');
      return;
    }
    const payload: Subtask = {
      title: input.title.toString().trim(),
      description: (input.description || '').toString().trim(),
      dateDue: input.dateDue ? input.dateDue + ':00' : undefined,
      completed: false
    };

    this.http.post<Subtask>(`${this.API_BASE}/tasks/${parent.id}/subtasks`, payload).subscribe({
      next: (created) => {
        parent.subtasks = parent.subtasks || [];
        parent.subtasks.push(created);
        this.subtaskInputs[parent.id] = {};
        this.showSuccess('Subtask created successfully!');
      },
      error: () => this.showError('Could not create subtask.')
    });
  }

  deleteTask(task: Task): void {
    this.showDeleteConfirmation(
      'Move to Recently Deleted',
      `"${task.title}" will be moved to Recently Deleted and kept for ${this.retentionDays} days. You can restore it anytime during that period.`,
      'Move to Deleted',
      () => {
        this.http.delete<void>(`${this.API_BASE}/tasks/${task.id}`).subscribe({
          next: () => {
            this.loadTasks();
            this.loadDeletedTasks();
            this.showSuccess('Task moved to Recently Deleted.');
          },
          error: () => this.showError('Could not delete task.')
        });
      }
    );
  }

  restoreTask(task: Task): void {
    this.restoring[task.id] = true;
    this.http.put<Task>(`${this.API_BASE}/tasks/${task.id}/restore`, null).subscribe({
      next: () => {
        this.restoring[task.id] = false;
        this.loadTasks();
        this.loadDeletedTasks();
        this.showSuccess(`"${task.title}" was restored.`);
      },
      error: () => {
        this.restoring[task.id] = false;
        this.showError('Could not restore task.');
      }
    });
  }

  permanentlyDeleteTask(task: Task): void {
    this.showDeleteConfirmation(
      'Delete Forever',
      `"${task.title}" will be permanently deleted. This cannot be undone.`,
      'Delete Forever',
      () => {
        this.http.delete<void>(`${this.API_BASE}/tasks/${task.id}/permanent`).subscribe({
          next: () => {
            this.loadDeletedTasks();
            this.showSuccess('Task permanently deleted.');
          },
          error: () => this.showError('Could not permanently delete task.')
        });
      }
    );
  }

  toggleTaskCompleted(task: Task): void {
    const newCompleted = !task.completed;

    let updatedSubtasks = task.subtasks;
    if (task.subtasks && task.subtasks.length > 0) {
      if (newCompleted) {
        updatedSubtasks = task.subtasks.map(st => ({ ...st, completed: true }));
      } else {
        updatedSubtasks = task.subtasks.map((st, index) => {
          if (index === task.subtasks!.length - 1) {
            return { ...st, completed: false };
          }
          return st;
        });
      }
    }

    const updated: Task = {
      ...task,
      completed: newCompleted,
      subtasks: updatedSubtasks
    } as Task;

    delete (updated as any).expanded;

    this.http.put<Task>(`${this.API_BASE}/tasks/${task.id}`, updated).subscribe({
      next: () => {
        this.loadTasks();
        this.showSuccess(newCompleted ? 'Task marked complete!' : 'Task marked incomplete.');
      },
      error: () => this.showError('Could not update task status.')
    });
  }

  startEditTask(task: Task): void {
    const editData = { ...task };
    if (editData.dateDue) {
      editData.dateDue = editData.dateDue.substring(0, 16);
    }
    this.taskEditInputs[task.id] = editData;
    this.editingTask[task.id] = true;
  }

  cancelEditTask(task: Task): void {
    delete this.taskEditInputs[task.id];
    this.editingTask[task.id] = false;
  }

  saveTask(task: Task): void {
    const editData = this.taskEditInputs[task.id];
    const payload: any = {
      id: task.id,
      title: editData.title,
      description: editData.description,
      dateDue: editData.dateDue,
      completed: editData.completed ?? task.completed,
      subtasks: task.subtasks
    };
    if (payload.dateDue && payload.dateDue.length === 16) {
      payload.dateDue = payload.dateDue + ':00';
    }
    this.http.put<Task>(`${this.API_BASE}/tasks/${task.id}`, payload).subscribe({
      next: () => {
        delete this.taskEditInputs[task.id];
        this.editingTask[task.id] = false;
        this.loadTasks();
        this.showSuccess('Task updated successfully!');
      },
      error: (err) => {
        console.error('Save task error:', err);
        this.showError('Could not save task.');
      }
    });
  }

  deleteSubtask(parent: Task, sub: Subtask): void {
    const sid = sub.id;
    if (!sid) return;
    this.showDeleteConfirmation(
      'Delete Subtask',
      `Are you sure you want to delete "${sub.title}"? This cannot be undone.`,
      'Delete',
      () => {
        this.http.delete<void>(`${this.API_BASE}/tasks/${parent.id}/subtasks/id/${sid}`).subscribe({
          next: () => {
            this.loadTasks();
            this.showSuccess('Subtask deleted!');
          },
          error: () => this.showError('Could not delete subtask.')
        });
      }
    );
  }

  startEditSubtask(parent: Task, sub: Subtask): void {
    const sid = sub.id;
    if (!sid) return;
    this.subtaskEditInputs[sid] = { ...sub };
  }

  cancelEditSubtask(sub: Subtask): void {
    const sid = sub.id;
    if (!sid) return;
    delete this.subtaskEditInputs[sid];
  }

  saveSubtask(parent: Task, sub: Subtask): void {
    const sid = sub.id;
    if (!sid) return;
    const payload = { ...this.subtaskEditInputs[sid] } as Subtask;
    this.http.put<Subtask>(`${this.API_BASE}/tasks/${parent.id}/subtasks/${sid}`, payload).subscribe({
      next: () => {
        delete this.subtaskEditInputs[sid];
        this.loadTasks();
        this.showSuccess('Subtask updated!');
      },
      error: () => this.showError('Could not save subtask.')
    });
  }

  toggleSubtaskCompleted(parent: Task, sub: Subtask): void {
    const sid = sub.id;
    if (!sid) return;

    const newSubtaskCompleted = !sub.completed;

    const updatedSubtasks = parent.subtasks?.map(st =>
      st.id === sid ? { ...st, completed: newSubtaskCompleted } : st
    ) || [];

    const allSubtasksCompleted = updatedSubtasks.every(st => st.completed);
    const anySubtaskIncomplete = updatedSubtasks.some(st => !st.completed);

    let newTaskCompleted = parent.completed;
    if (allSubtasksCompleted && updatedSubtasks.length > 0) {
      newTaskCompleted = true;
    } else if (anySubtaskIncomplete) {
      newTaskCompleted = false;
    }

    const updatedTask: any = {
      ...parent,
      completed: newTaskCompleted,
      subtasks: updatedSubtasks
    };
    delete updatedTask.expanded;

    this.http.put<Task>(`${this.API_BASE}/tasks/${parent.id}`, updatedTask).subscribe({
      next: () => {
        this.loadTasks();
        if (allSubtasksCompleted && updatedSubtasks.length > 0) {
          this.showSuccess('All subtasks complete! Task marked as done.');
        }
      },
      error: () => this.showError('Could not update subtask status.')
    });
  }

  generateAiSubtasks(parent: Task): void {
    const tid = parent.id;
    if (!tid) return;
    this.error = '';
    this.generating[tid] = true;
    this.http.put<Task>(`${this.API_BASE}/tasks/${tid}/subtasks/generate`, null).subscribe({
      next: (updated) => {
        const idx = this.tasks.findIndex((x) => x.id === updated.id);
        if (idx >= 0) {
          updated.expanded = true;
          this.tasks[idx] = updated;
        } else {
          this.loadTasks();
        }
        this.generating[tid] = false;
        this.showSuccess('AI generated subtasks successfully!');
      },
      error: () => {
        this.showError('AI generation failed. Check your API key.');
        this.generating[tid] = false;
      }
    });
  }

  rearrangeSubtasks(parent: Task): void {
    const tid = parent.id;
    if (!tid) return;
    this.error = '';
    this.rearranging[tid] = true;
    this.http.put<Task>(`${this.API_BASE}/tasks/${tid}/subtasks/generate?rearrange=true`, null).subscribe({
      next: (updated) => {
        const idx = this.tasks.findIndex((x) => x.id === updated.id);
        if (idx >= 0) {
          updated.expanded = true;
          this.tasks[idx] = updated;
        } else {
          this.loadTasks();
        }
        this.rearranging[tid] = false;
        this.showSuccess('AI reorganized subtasks successfully!');
      },
      error: () => {
        this.showError('AI rearrangement failed.');
        this.rearranging[tid] = false;
      }
    });
  }

  adjustTimeframe(parent: Task): void {
    const tid = parent.id;
    if (!tid) return;
    this.error = '';
    this.adjustingFrame[tid] = true;
    this.http.put<Task>(`${this.API_BASE}/tasks/${tid}/subtasks/adjustFrame`, null).subscribe({
      next: (updated) => {
        const idx = this.tasks.findIndex((x) => x.id === updated.id);
        if (idx >= 0) {
          updated.expanded = true;
          this.tasks[idx] = updated;
        } else {
          this.loadTasks();
        }
        this.adjustingFrame[tid] = false;
        this.showSuccess('Subtask timeframes adjusted!');
      },
      error: () => {
        this.showError('Could not adjust timeframes.');
        this.adjustingFrame[tid] = false;
      }
    });
  }

  recommendExtension(parent: Task): void {
    const tid = parent.id;
    if (!tid) return;
    this.error = '';
    this.recommendingExtension[tid] = true;
    this.http.put<Task>(`${this.API_BASE}/tasks/${tid}/recommendExtension`, null).subscribe({
      next: (updated) => {
        const idx = this.tasks.findIndex((x) => x.id === updated.id);
        if (idx >= 0) {
          updated.expanded = true;
          this.tasks[idx] = updated;
        } else {
          this.loadTasks();
        }
        this.recommendingExtension[tid] = false;
        this.showSuccess('Due date extended based on AI recommendation!');
      },
      error: () => {
        this.showError('Could not recommend extension.');
        this.recommendingExtension[tid] = false;
      }
    });
  }

  loadTasks(): void {
    this.loading = true;
    this.error = '';
    this.http.get<Task[]>(`${this.API_BASE}/tasks`).subscribe({
      next: (tasks) => this.handleLoadedTasks(tasks),
      error: () => {
        this.showError('Could not load tasks. Make sure backend runs on port 8080.');
        this.loading = false;
      }
    });
  }

  loadDeletedTasks(): void {
    this.deletedLoading = true;
    this.http.get<Task[]>(`${this.API_BASE}/tasks/deleted`).subscribe({
      next: (tasks) => {
        this.deletedTasks = tasks ?? [];
        this.deletedLoading = false;
      },
      error: () => {
        this.deletedLoading = false;
      }
    });
  }

  private handleLoadedTasks(tasks: Task[] | null): void {
    const expandedIds = new Set(this.tasks.filter(t => t.expanded).map(t => t.id));
    this.tasks = tasks ?? [];
    for (const t of this.tasks) {
      if (!this.subtaskInputs[t.id]) this.subtaskInputs[t.id] = {};
      if (expandedIds.has(t.id)) {
        t.expanded = true;
      }
    }
    this.loading = false;
  }

  createTask(): void {
    if (!this.newTask.title.trim() || !this.newTask.dateDue) {
      this.showError('Title and Due Date are required.');
      return;
    }

    this.error = '';
    const payload = {
      title: this.newTask.title.trim(),
      description: this.newTask.description.trim(),
      dateDue: this.newTask.dateDue + ':00',
      completed: false
    };

    this.http.post<Task>(`${this.API_BASE}/tasks`, payload).subscribe({
      next: () => {
        this.newTask = { title: '', description: '', dateDue: '' };
        this.showCreateForm = false;
        this.loadTasks();
        this.showSuccess('Task created successfully!');
      },
      error: () => this.showError('Could not create task.')
    });
  }

  formatDuration(minutes: number | undefined): string {
    if (!minutes) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  }

  getProgressPercent(task: Task): number {
    if (!task.subtasks || task.subtasks.length === 0) return task.completed ? 100 : 0;
    const completed = task.subtasks.filter(s => s.completed).length;
    return Math.round((completed / task.subtasks.length) * 100);
  }

  isOverdue(dateStr: string | undefined): boolean {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  }

  getDaysRemaining(dateStr: string | undefined): string {
    if (!dateStr) return '';
    const due = new Date(dateStr);
    const now = new Date();
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return `${Math.abs(diff)}d overdue`;
    if (diff === 0) return 'Due today';
    if (diff === 1) return 'Due tomorrow';
    return `${diff} days left`;
  }

  getCompletedCount(): number {
    return this.tasks.filter(t => t.completed).length;
  }

  getOverdueCount(): number {
    return this.tasks.filter(t => !t.completed && this.isOverdue(t.dateDue)).length;
  }

  getActiveCount(): number {
    return this.tasks.filter(t => !t.completed).length;
  }

  getElapsedPercentFromLastCompleted(task: Task): number {
    if (!task.dateDue) return 0;

    const due = new Date(task.dateDue).getTime();
    const now = new Date().getTime();

    let startPoint: number;

    if (task.subtasks && task.subtasks.length > 0) {
      const completedSubtasks = task.subtasks.filter(s => s.completed && s.dateDue);
      if (completedSubtasks.length > 0) {
        const lastCompletedDue = completedSubtasks
          .map(s => new Date(s.dateDue!).getTime())
          .reduce((max, curr) => Math.max(max, curr), 0);
        startPoint = lastCompletedDue;
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

  isSubtaskOverdue(subtask: Subtask): boolean {
    if (!subtask.dateDue || subtask.completed) return false;
    return new Date(subtask.dateDue) < new Date();
  }

  needsExtensionRecommendation(task: Task): boolean {
    if (task.completed) return false;
    const elapsedPercent = this.getElapsedPercentFromLastCompleted(task);
    return elapsedPercent >= 50 && !this.isOverdue(task.dateDue);
  }

  canAdjustTimeframe(task: Task): boolean {
    if (!task.subtasks || task.subtasks.length === 0) return false;
    const incompleteSubtasks = task.subtasks.filter(s => !s.completed);
    if (incompleteSubtasks.length === 0) return false;
    const firstIncomplete = incompleteSubtasks[0];
    if (!firstIncomplete.dateDue) return false;
    return new Date(firstIncomplete.dateDue) < new Date();
  }

  canRecommendExtension(task: Task): boolean {
    if (task.completed) return false;
    return this.getElapsedPercentFromLastCompleted(task) >= 50;
  }

  getTaskStatus(task: Task): 'normal' | 'warning' | 'overdue' {
    if (task.completed) return 'normal';
    if (this.isOverdue(task.dateDue)) return 'overdue';
    if (this.needsExtensionRecommendation(task)) return 'warning';
    return 'normal';
  }

  getRetentionDaysLeft(task: Task): number {
    if (!task.deletedAt) return this.retentionDays;
    const expires = new Date(task.deletedAt).getTime() + this.retentionDays * 24 * 60 * 60 * 1000;
    return Math.max(0, Math.ceil((expires - Date.now()) / (1000 * 60 * 60 * 24)));
  }

  getRetentionPercent(task: Task): number {
    return Math.round((this.getRetentionDaysLeft(task) / this.retentionDays) * 100);
  }

  getDeletedAgoLabel(task: Task): string {
    if (!task.deletedAt) return 'Deleted';
    const days = Math.floor((Date.now() - new Date(task.deletedAt).getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return 'Deleted today';
    if (days === 1) return 'Deleted yesterday';
    return `Deleted ${days} days ago`;
  }

  getRetentionLabel(task: Task): string {
    const days = this.getRetentionDaysLeft(task);
    if (days <= 0) return 'Expires today';
    if (days === 1) return '1 day left';
    return `${days} days left`;
  }

  trackByTaskId(_index: number, task: Task): string {
    return task.id;
  }

  toggleCreateForm(): void {
    this.showCreateForm = !this.showCreateForm;
  }

  hideCreateForm(): void {
    this.showCreateForm = false;
  }

  openCreateForm(): void {
    this.showCreateForm = true;
  }

  goToTasksAndCreate(): void {
    this.activeTab = 'tasks';
    this.showCreateForm = true;
  }

  showDeleteConfirmation(title: string, message: string, confirmLabel: string, action: () => void): void {
    this.deleteModalTitle = title;
    this.deleteModalMessage = message;
    this.deleteModalConfirmLabel = confirmLabel;
    this.pendingDeleteAction = action;
    this.showDeleteModal = true;
  }

  confirmDelete(): void {
    if (this.pendingDeleteAction) {
      this.pendingDeleteAction();
    }
    this.closeDeleteModal();
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.pendingDeleteAction = null;
    this.deleteModalTitle = '';
    this.deleteModalMessage = '';
    this.deleteModalConfirmLabel = 'Delete';
  }
}
