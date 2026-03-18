import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

interface Task {
  id: string;  // removed ? — every task from the backend has an id
  title: string;
  description: string;
  dateDue: string;
  completed?: boolean;
  subtasks?: Subtask[];
  expanded?: boolean;
}

interface Subtask {
  id?: string;
  parentId?: string;
  title: string;
  description?: string;
  dateDue?: string;
  completed?: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  private readonly http = inject(HttpClient);

  title = 'SmartAssign';
  loading = false;
  error = '';
  tasks: Task[] = [];

  newTask: Omit<Task, 'id'> = {
    title: '',
    description: '',
    dateDue: ''
  };

  subtaskInputs: { [taskId: string]: Partial<Subtask> } = {};
  taskEditInputs: { [taskId: string]: Partial<Task> } = {};
  subtaskEditInputs: { [subtaskId: string]: Partial<Subtask> } = {};
  // per-task flags for async operations
  generating: { [taskId: string]: boolean } = {};

  ngOnInit(): void {
    this.loadTasks();
  }

  getSubtaskInput(taskId: string): Partial<Subtask> {
    if (!this.subtaskInputs[taskId]) this.subtaskInputs[taskId] = {};
    return this.subtaskInputs[taskId];
  }

  toggleExpand(task: Task): void {
    task.expanded = !task.expanded;
    if (!this.subtaskInputs[task.id]) {
      this.subtaskInputs[task.id] = {};
    }
    if (task.expanded && (!task.subtasks || task.subtasks.length === 0)) {
      this.http.get<Task>(`/tasks/${task.id}`).subscribe({
        next: (t) => {
          const idx = this.tasks.findIndex((x) => x.id === t.id);
          if (idx >= 0) this.tasks[idx] = t;
        }
      });
    }
  }

  createSubtask(parent: Task): void {
    const input = this.subtaskInputs[parent.id] || {};
    if (!input.title?.toString().trim()) {
      this.error = 'Subtask title required.';
      return;
    }
    const payload: Subtask = {
      title: input.title.toString().trim(),
      description: (input.description || '').toString().trim(),
      dateDue: input.dateDue ? input.dateDue + ':00' : undefined,
      completed: false
    };

    this.http.post<Subtask>(`/tasks/${parent.id}/subtasks`, payload).subscribe({
      next: (created) => {
        parent.subtasks = parent.subtasks || [];
        parent.subtasks.push(created);
        this.subtaskInputs[parent.id] = {};
      },
      error: () => {
        // fallback to direct backend URL
        this.http.post<Subtask>(`http://localhost:8080/tasks/${parent.id}/subtasks`, payload).subscribe({
          next: (created) => {
            parent.subtasks = parent.subtasks || [];
            parent.subtasks.push(created);
            this.subtaskInputs[parent.id] = {};
          },
          error: () => (this.error = 'Could not create subtask.')
        });
      }
    });
  }

  // Task CRUD on frontend
  deleteTask(task: Task): void {
    this.http.delete<void>(`/tasks/${task.id}`).subscribe({
      next: () => this.loadTasks(),
      error: () => {
        this.http.delete<void>(`http://localhost:8080/tasks/${task.id}`).subscribe({ next: () => this.loadTasks(), error: () => (this.error = 'Could not delete task.') });
      }
    });
  }

  toggleTaskCompleted(task: Task): void {
    const updated: Task = { ...task, completed: !task.completed } as Task;
    this.http.put<Task>(`/tasks/${task.id}`, updated).subscribe({
      next: () => this.loadTasks(),
      error: () => {
        this.http.put<Task>(`http://localhost:8080/tasks/${task.id}`, updated).subscribe({ next: () => this.loadTasks(), error: () => (this.error = 'Could not update task status.') });
      }
    });
  }

  startEditTask(task: Task): void {
    this.taskEditInputs[task.id] = { ...task };
  }

  cancelEditTask(task: Task): void {
    delete this.taskEditInputs[task.id];
  }

  saveTask(task: Task): void {
    const payload = { ...this.taskEditInputs[task.id] } as Task;
    this.http.put<Task>(`/tasks/${task.id}`, payload).subscribe({
      next: () => { delete this.taskEditInputs[task.id]; this.loadTasks(); },
      error: () => {
        this.http.put<Task>(`http://localhost:8080/tasks/${task.id}`, payload).subscribe({ next: () => { delete this.taskEditInputs[task.id]; this.loadTasks(); }, error: () => (this.error = 'Could not save task.') });
      }
    });
  }

  // Subtask edit/delete
  deleteSubtask(parent: Task, sub: Subtask): void {
    const sid = sub.id;
    if (!sid) return;
    this.http.delete<void>(`/tasks/${parent.id}/subtasks/${sid}`).subscribe({
      next: () => this.loadTasks(),
      error: () => {
        this.http.delete<void>(`http://localhost:8080/tasks/${parent.id}/subtasks/${sid}`).subscribe({ next: () => this.loadTasks(), error: () => (this.error = 'Could not delete subtask.') });
      }
    });
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
    this.http.put<Subtask>(`/tasks/${parent.id}/subtasks/${sid}`, payload).subscribe({
      next: () => { delete this.subtaskEditInputs[sid]; this.loadTasks(); },
      error: () => {
        this.http.put<Subtask>(`http://localhost:8080/tasks/${parent.id}/subtasks/${sid}`, payload).subscribe({ next: () => { delete this.subtaskEditInputs[sid]; this.loadTasks(); }, error: () => (this.error = 'Could not save subtask.') });
      }
    });
  }

  toggleSubtaskCompleted(parent: Task, sub: Subtask): void {
    const sid = sub.id;
    if (!sid) return;
    const payload = { ...sub, completed: !sub.completed } as Subtask;
    this.http.put<Subtask>(`/tasks/${parent.id}/subtasks/${sid}`, payload).subscribe({
      next: () => this.loadTasks(),
      error: () => {
        this.http.put<Subtask>(`http://localhost:8080/tasks/${parent.id}/subtasks/${sid}`, payload).subscribe({ next: () => this.loadTasks(), error: () => (this.error = 'Could not update subtask status.') });
      }
    });
  }

  generateAiSubtasks(parent: Task): void {
    const tid = parent.id;
    if (!tid) return;
    this.error = '';
    this.generating[tid] = true;
    this.http.put<Task>(`/tasks/${tid}/subtasks/generate`, null).subscribe({
      next: (updated) => {
        const idx = this.tasks.findIndex((x) => x.id === updated.id);
        if (idx >= 0) this.tasks[idx] = updated;
        else this.loadTasks();
        this.generating[tid] = false;
      },
      error: () => {
        // fallback to direct backend
        this.http.put<Task>(`http://localhost:8080/tasks/${tid}/subtasks/generate`, null).subscribe({
          next: (updated) => { const idx = this.tasks.findIndex((x) => x.id === updated.id); if (idx >= 0) this.tasks[idx] = updated; else this.loadTasks(); this.generating[tid] = false; },
          error: () => { this.error = 'AI generation failed.'; this.generating[tid] = false; }
        });
      }
    });
  }

  loadTasks(): void {
    this.loading = true;
    this.error = '';
    // try proxy first, then direct backend
    this.http.get<Task[]>('/tasks').subscribe({
      next: (tasks) => this.handleLoadedTasks(tasks),
      error: () => {
        this.http.get<Task[]>('http://localhost:8080/tasks').subscribe({ next: (tasks) => this.handleLoadedTasks(tasks), error: () => { this.error = 'Could not load tasks. Make sure backend runs on port 8080.'; this.loading = false; } });
      }
    });
  }

  private handleLoadedTasks(tasks: Task[] | null): void {
    this.tasks = tasks ?? [];
    for (const t of this.tasks) {
      if (!this.subtaskInputs[t.id]) this.subtaskInputs[t.id] = {};
    }
    this.loading = false;
  }

  createTask(): void {
    if (!this.newTask.title.trim() || !this.newTask.dateDue) {
      this.error = 'Title and Due Date are required.';
      return;
    }

    this.error = '';
    const payload = {
      title: this.newTask.title.trim(),
      description: this.newTask.description.trim(),
      dateDue: this.newTask.dateDue + ':00',
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