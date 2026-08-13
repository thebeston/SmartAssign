import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subtask, TaskViewModel } from '../../models/task.model';
import { TaskService } from '../../services/task.service';
import { NotificationService } from '../../services/notification.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { isSubtaskOverdue, withToggledSubtaskCompletion } from '../../utils/task.utils';

@Component({
  selector: 'app-subtask-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './subtask-list.component.html',
  styleUrls: ['./subtask-list.component.css']
})
export class SubtaskListComponent {
  private readonly taskService = inject(TaskService);
  private readonly notifications = inject(NotificationService);
  private readonly confirmation = inject(ConfirmationService);

  @Input({ required: true }) task!: TaskViewModel;
  @Output() changed = new EventEmitter<void>();
  @Output() taskUpdated = new EventEmitter<TaskViewModel>();

  newSubtask: Partial<Subtask> = {};
  editInputs: Record<string, Partial<Subtask>> = {};

  isOverdue = isSubtaskOverdue;

  startEdit(sub: Subtask): void {
    if (!sub.id) return;
    this.editInputs[sub.id] = { ...sub };
  }

  cancelEdit(sub: Subtask): void {
    if (!sub.id) return;
    delete this.editInputs[sub.id];
  }

  save(sub: Subtask): void {
    const sid = sub.id;
    if (!sid) return;
    const payload = { ...this.editInputs[sid] } as Subtask;

    this.taskService.updateSubtask(this.task.id, sid, payload).subscribe({
      next: () => {
        delete this.editInputs[sid];
        this.notifications.success('Subtask updated!');
        this.changed.emit();
      },
      error: () => this.notifications.error('Could not save subtask.')
    });
  }

  async remove(sub: Subtask): Promise<void> {
    const sid = sub.id;
    if (!sid) return;

    const confirmed = await this.confirmation.confirm(
      'Delete Subtask',
      `Are you sure you want to delete "${sub.title}"? This cannot be undone.`,
      'Delete'
    );
    if (!confirmed) return;

    this.taskService.deleteSubtask(this.task.id, sid).subscribe({
      next: () => {
        this.notifications.success('Subtask deleted!');
        this.changed.emit();
      },
      error: () => this.notifications.error('Could not delete subtask.')
    });
  }

  toggleCompleted(sub: Subtask): void {
    const sid = sub.id;
    if (!sid) return;

    const payload = withToggledSubtaskCompletion(this.task, sid);
    const allDone = !!payload.completed;

    this.taskService.updateTask(this.task.id, payload).subscribe({
      next: () => {
        this.changed.emit();
        if (allDone) {
          this.notifications.success('All subtasks complete! Task marked as done.');
        }
      },
      error: () => this.notifications.error('Could not update subtask status.')
    });
  }

  create(): void {
    if (!this.newSubtask.title?.toString().trim()) {
      this.notifications.error('Subtask title is required.');
      return;
    }

    const payload: Subtask = {
      title: this.newSubtask.title.toString().trim(),
      description: (this.newSubtask.description || '').toString().trim(),
      dateDue: this.newSubtask.dateDue ? `${this.newSubtask.dateDue}:00` : undefined,
      completed: false
    };

    this.taskService.createSubtask(this.task.id, payload).subscribe({
      next: (created) => {
        const updated: TaskViewModel = {
          ...this.task,
          subtasks: [...(this.task.subtasks || []), created]
        };
        this.newSubtask = {};
        this.notifications.success('Subtask created successfully!');
        this.taskUpdated.emit(updated);
      },
      error: () => this.notifications.error('Could not create subtask.')
    });
  }
}
