import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CreateTaskRequest } from '../../models/task.model';
import { TaskService } from '../../services/task.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-create-task',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-task.component.html',
  styleUrls: ['./create-task.component.css']
})
export class CreateTaskComponent {
  private readonly taskService = inject(TaskService);
  private readonly notifications = inject(NotificationService);

  @Input() open = false;
  @Output() closed = new EventEmitter<void>();
  @Output() created = new EventEmitter<void>();

  submitting = false;
  form = {
    title: '',
    description: '',
    dateDue: ''
  };

  close(): void {
    this.closed.emit();
  }

  submit(): void {
    if (!this.form.title.trim() || !this.form.dateDue) {
      this.notifications.error('Title and Due Date are required.');
      return;
    }

    const payload: CreateTaskRequest = {
      title: this.form.title.trim(),
      description: this.form.description.trim(),
      dateDue: `${this.form.dateDue}:00`,
      completed: false
    };

    this.submitting = true;
    this.taskService.createTask(payload).subscribe({
      next: () => {
        this.submitting = false;
        this.form = { title: '', description: '', dateDue: '' };
        this.notifications.success('Task created successfully!');
        this.created.emit();
        this.close();
      },
      error: () => {
        this.submitting = false;
        this.notifications.error('Could not create task.');
      }
    });
  }
}
