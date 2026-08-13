import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { AppTab, Task, TaskFilter, TaskViewModel } from './models/task.model';
import { TaskService } from './services/task.service';
import { NotificationService } from './services/notification.service';
import { canAdjustTimeframe, toTaskViewModel } from './utils/task.utils';
import { TaskListComponent } from './components/task-list/task-list.component';
import { DeletedTasksComponent } from './components/deleted-tasks/deleted-tasks.component';
import { CreateTaskComponent } from './components/create-task/create-task.component';
import { ConfirmationModalComponent } from './components/confirmation-modal/confirmation-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    TaskListComponent,
    DeletedTasksComponent,
    CreateTaskComponent,
    ConfirmationModalComponent
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly taskService = inject(TaskService);
  private readonly notifications = inject(NotificationService);

  private overdueCheckInterval: ReturnType<typeof setInterval> | null = null;
  private notificationSubs: Subscription[] = [];
  private adjustingIds = new Set<string>();

  title = 'SmartAssign';
  loading = false;
  deletedLoading = false;
  error = '';
  successMessage = '';
  tasks: TaskViewModel[] = [];
  deletedTasks: Task[] = [];
  activeTab: AppTab = 'tasks';
  taskFilter: TaskFilter = 'all';
  searchQuery = '';
  deletedSearchQuery = '';
  showCompletedSection = false;
  showCreateForm = false;

  ngOnInit(): void {
    this.notificationSubs.push(
      this.notifications.success$.subscribe(message => {
        this.successMessage = message;
        setTimeout(() => (this.successMessage = ''), 3000);
      }),
      this.notifications.error$.subscribe(message => {
        this.error = message;
        setTimeout(() => (this.error = ''), 5000);
      })
    );

    this.loadTasks();
    this.loadDeletedTasks();
    this.startOverdueCheck();
  }

  ngOnDestroy(): void {
    this.stopOverdueCheck();
    this.notificationSubs.forEach(sub => sub.unsubscribe());
  }

  setActiveTab(tab: AppTab): void {
    this.activeTab = tab;
    if (tab === 'deleted') {
      this.loadDeletedTasks();
    }
  }

  openCreateForm(): void {
    this.showCreateForm = true;
  }

  hideCreateForm(): void {
    this.showCreateForm = false;
  }

  goToTasksAndCreate(): void {
    this.activeTab = 'tasks';
    this.showCreateForm = true;
  }

  onTaskCreated(): void {
    this.loadTasks();
  }

  onDeletedChanged(): void {
    this.loadTasks();
    this.loadDeletedTasks();
  }

  replaceTask(updated: TaskViewModel): void {
    const index = this.tasks.findIndex(t => t.id === updated.id);
    if (index >= 0) {
      this.tasks[index] = updated;
      this.tasks = [...this.tasks];
    } else {
      this.loadTasks();
    }
  }

  onTaskRemoved(taskId: string): void {
    this.tasks = this.tasks.filter(t => t.id !== taskId);
    this.loadDeletedTasks();
  }

  loadTasks(): void {
    this.loading = true;
    this.taskService.getTasks().subscribe({
      next: tasks => this.handleLoadedTasks(tasks),
      error: () => {
        this.notifications.error('Could not load tasks.');
        this.loading = false;
      }
    });
  }

  loadDeletedTasks(): void {
    this.deletedLoading = true;
    this.taskService.getDeletedTasks().subscribe({
      next: tasks => {
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
    this.tasks = (tasks ?? []).map(task => toTaskViewModel(task, expandedIds.has(task.id)));
    this.loading = false;
  }

  private startOverdueCheck(): void {
    this.overdueCheckInterval = setInterval(() => this.checkAndAdjustOverdueSubtasks(), 60000);
  }

  private stopOverdueCheck(): void {
    if (this.overdueCheckInterval) {
      clearInterval(this.overdueCheckInterval);
      this.overdueCheckInterval = null;
    }
  }

  private checkAndAdjustOverdueSubtasks(): void {
    for (const task of this.tasks) {
      if (task.completed || this.adjustingIds.has(task.id)) continue;
      if (!canAdjustTimeframe(task)) continue;

      this.adjustingIds.add(task.id);
      this.taskService.adjustTimeframe(task.id).subscribe({
        next: updated => {
          this.replaceTask(toTaskViewModel(updated, task.expanded));
          this.adjustingIds.delete(task.id);
          this.notifications.success(`Auto-adjusted timeframe for "${task.title}"`);
        },
        error: () => this.adjustingIds.delete(task.id)
      });
    }
  }
}
