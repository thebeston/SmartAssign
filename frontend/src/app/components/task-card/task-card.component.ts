import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { DELETED_RETENTION_DAYS, Task, TaskUpdate, TaskViewModel } from '../../models/task.model';
import { TaskService } from '../../services/task.service';
import { NotificationService } from '../../services/notification.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { DaysRemainingPipe } from '../../pipes/days-remaining.pipe';
import { SubtaskListComponent } from '../subtask-list/subtask-list.component';
import {
  canAdjustTimeframe,
  canRecommendExtension,
  ensureDateTimeSeconds,
  getProgressPercent,
  getTaskStatus,
  isOverdue,
  needsExtensionRecommendation,
  toTaskViewModel,
  withToggledTaskCompletion
} from '../../utils/task.utils';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [CommonModule, FormsModule, DaysRemainingPipe, SubtaskListComponent],
  templateUrl: './task-card.component.html',
  styleUrls: ['./task-card.component.css']
})
export class TaskCardComponent {
  private readonly taskService = inject(TaskService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmation = inject(ConfirmationService);

  @Input({ required: true }) task!: TaskViewModel;
  @Output() taskUpdated = new EventEmitter<TaskViewModel>();
  @Output() taskRemoved = new EventEmitter<string>();
  @Output() reloadRequested = new EventEmitter<void>();

  editing = false;
  editModel: Partial<Task> = {};
  generating = false;
  rearranging = false;
  adjustingFrame = false;
  recommendingExtension = false;

  readonly getProgressPercent = getProgressPercent;
  readonly getTaskStatus = getTaskStatus;
  readonly isOverdue = isOverdue;
  readonly needsExtensionRecommendation = needsExtensionRecommendation;
  readonly canAdjustTimeframe = canAdjustTimeframe;
  readonly canRecommendExtension = canRecommendExtension;
  readonly retentionDays = DELETED_RETENTION_DAYS;

  toggleExpand(): void {
    const nextExpanded = !this.task.expanded;
    this.task = { ...this.task, expanded: nextExpanded };
    this.taskUpdated.emit(this.task);

    if (nextExpanded && (!this.task.subtasks || this.task.subtasks.length === 0)) {
      this.taskService.getTask(this.task.id).subscribe({
        next: (loaded) => this.emitUpdated(loaded, true)
      });
    }
  }

  toggleCompleted(): void {
    const payload = withToggledTaskCompletion(this.task);
    const completed = !!payload.completed;

    this.taskService.updateTask(this.task.id, payload).subscribe({
      next: () => {
        this.notifications.success(completed ? 'Task marked complete!' : 'Task marked incomplete.');
        this.reloadRequested.emit();
      },
      error: () => this.notifications.error('Could not update task status.')
    });
  }

  startEdit(): void {
    this.editModel = {
      ...this.task,
      dateDue: this.task.dateDue ? this.task.dateDue.substring(0, 16) : ''
    };
    this.editing = true;
  }

  cancelEdit(): void {
    this.editing = false;
    this.editModel = {};
  }

  saveEdit(): void {
    const payload: TaskUpdate = {
      id: this.task.id,
      title: this.editModel.title ?? this.task.title,
      description: this.editModel.description ?? this.task.description,
      dateDue: ensureDateTimeSeconds(this.editModel.dateDue) ?? this.task.dateDue,
      completed: this.editModel.completed ?? this.task.completed,
      subtasks: this.task.subtasks
    };

    this.taskService.updateTask(this.task.id, payload).subscribe({
      next: () => {
        this.editing = false;
        this.editModel = {};
        this.notifications.success('Task updated successfully!');
        this.reloadRequested.emit();
      },
      error: () => this.notifications.error('Could not save task.')
    });
  }

  async deleteTask(): Promise<void> {
    const confirmed = await this.confirmation.confirm(
      'Move to Recently Deleted',
      `"${this.task.title}" will be moved to Recently Deleted and kept for ${this.retentionDays} days. You can restore it anytime during that period.`,
      'Move to Deleted'
    );
    if (!confirmed) return;

    this.taskService.deleteTask(this.task.id).subscribe({
      next: () => {
        this.notifications.success('Task moved to Recently Deleted.');
        this.taskRemoved.emit(this.task.id);
      },
      error: () => this.notifications.error('Could not delete task.')
    });
  }

  generateAiSubtasks(): void {
    this.runAiAction(
      () => this.taskService.generateSubtasks(this.task.id),
      'generating',
      'AI generated subtasks successfully!',
      'AI generation failed. Check your API key.'
    );
  }

  rearrangeSubtasks(): void {
    this.runAiAction(
      () => this.taskService.rearrangeSubtasks(this.task.id),
      'rearranging',
      'AI reorganized subtasks successfully!',
      'AI rearrangement failed.'
    );
  }

  adjustTimeframe(): void {
    this.runAiAction(
      () => this.taskService.adjustTimeframe(this.task.id),
      'adjustingFrame',
      'Subtask timeframes adjusted!',
      'Could not adjust timeframes.'
    );
  }

  recommendExtension(): void {
    this.runAiAction(
      () => this.taskService.recommendExtension(this.task.id),
      'recommendingExtension',
      'Due date extended based on AI recommendation!',
      'Could not recommend extension.'
    );
  }

  onSubtasksChanged(): void {
    this.reloadRequested.emit();
  }

  onLocalTaskUpdated(task: TaskViewModel): void {
    this.task = task;
    this.taskUpdated.emit(task);
  }

  private runAiAction(
    request: () => Observable<Task>,
    flag: 'generating' | 'rearranging' | 'adjustingFrame' | 'recommendingExtension',
    successMessage: string,
    errorMessage: string
  ): void {
    this[flag] = true;
    request().subscribe({
      next: (updated) => {
        this[flag] = false;
        this.emitUpdated(updated, true);
        this.notifications.success(successMessage);
      },
      error: () => {
        this[flag] = false;
        this.notifications.error(errorMessage);
      }
    });
  }

  private emitUpdated(updated: Task, expanded = true): void {
    const viewModel = toTaskViewModel(updated, expanded);
    this.task = viewModel;
    this.taskUpdated.emit(viewModel);
  }
}
