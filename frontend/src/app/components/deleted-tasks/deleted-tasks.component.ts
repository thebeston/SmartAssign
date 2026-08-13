import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DELETED_RETENTION_DAYS, Task } from '../../models/task.model';
import { TaskService } from '../../services/task.service';
import { NotificationService } from '../../services/notification.service';
import { ConfirmationService } from '../../services/confirmation.service';
import {
  getDeletedAgoLabel,
  getRetentionLabel,
  getRetentionPercent
} from '../../utils/task.utils';

@Component({
  selector: 'app-deleted-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './deleted-tasks.component.html',
  styleUrls: ['./deleted-tasks.component.css']
})
export class DeletedTasksComponent {
  private readonly taskService = inject(TaskService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmation = inject(ConfirmationService);

  @Input() tasks: Task[] = [];
  @Input() loading = false;
  @Input() searchQuery = '';

  @Output() searchQueryChange = new EventEmitter<string>();
  @Output() changed = new EventEmitter<void>();

  readonly retentionDays = DELETED_RETENTION_DAYS;
  restoring: Record<string, boolean> = {};

  readonly getDeletedAgoLabel = getDeletedAgoLabel;
  readonly getRetentionLabel = getRetentionLabel;
  readonly getRetentionPercent = getRetentionPercent;

  get filteredTasks(): Task[] {
    const query = this.searchQuery.trim().toLowerCase();
    if (!query) return this.tasks;
    return this.tasks.filter(task =>
      `${task.title} ${task.description || ''}`.toLowerCase().includes(query)
    );
  }

  onSearch(value: string): void {
    this.searchQueryChange.emit(value);
  }

  restore(task: Task): void {
    this.restoring[task.id] = true;
    this.taskService.restoreTask(task.id).subscribe({
      next: () => {
        this.restoring[task.id] = false;
        this.notifications.success(`"${task.title}" was restored.`);
        this.changed.emit();
      },
      error: () => {
        this.restoring[task.id] = false;
        this.notifications.error('Could not restore task.');
      }
    });
  }

  async permanentlyDelete(task: Task): Promise<void> {
    const confirmed = await this.confirmation.confirm(
      'Delete Forever',
      `"${task.title}" will be permanently deleted. This cannot be undone.`,
      'Delete Forever'
    );
    if (!confirmed) return;

    this.taskService.permanentlyDeleteTask(task.id).subscribe({
      next: () => {
        this.notifications.success('Task permanently deleted.');
        this.changed.emit();
      },
      error: () => this.notifications.error('Could not permanently delete task.')
    });
  }

  trackByTaskId(_index: number, task: Task): string {
    return task.id;
  }
}
