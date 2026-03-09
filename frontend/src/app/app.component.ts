import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DatePipe, NgClass } from '@angular/common';

interface Task {
  id?: string;
  title: string;
  description: string;
  dateDue: string;
  completed?: boolean;
}

@Component({
  selector: 'app-root',
  imports: [FormsModule, DatePipe, NgClass],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  private readonly http = inject(HttpClient);

  title = 'SmartAssign';
  loading = false;
  error = '';
  tasks: Task[] = [];

  newTask: Task = {
    title: '',
    description: '',
    dateDue: ''
  };

  ngOnInit(): void {
    this.loadTasks();
  }

  loadTasks(): void {
    this.loading = true;
    this.error = '';

    this.http.get<Task[]>('/tasks').subscribe({
      next: (tasks) => {
        this.tasks = tasks ?? [];
        this.loading = false;
      },
      error: () => {
        this.error = 'Could not load tasks. Make sure backend runs on port 8080.';
        this.loading = false;
      }
    });
  }

  createTask(): void {
    if (!this.newTask.title.trim() || !this.newTask.dateDue) {
      this.error = 'Title and Due Date are required.';
      return;
    }

    this.error = '';
    const payload: Task = {
      title: this.newTask.title.trim(),
      description: this.newTask.description.trim(),
      dateDue: this.newTask.dateDue,
      completed: false
    };

    this.http.post<Task>('/tasks', payload).subscribe({
      next: () => {
        this.newTask = { title: '', description: '', dateDue: '' };
        this.loadTasks();
      },
      error: () => {
        this.error = 'Could not create task.';
      }
    });
  }
}
