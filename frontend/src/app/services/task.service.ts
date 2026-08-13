import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateTaskRequest, Subtask, Task, TaskUpdate } from '../models/task.model';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private readonly http = inject(HttpClient);
  private readonly API_BASE = 'http://localhost:8080';

  getTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.API_BASE}/tasks`);
  }

  getDeletedTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(`${this.API_BASE}/tasks/deleted`);
  }

  getTask(id: string): Observable<Task> {
    return this.http.get<Task>(`${this.API_BASE}/tasks/${id}`);
  }

  createTask(task: CreateTaskRequest): Observable<Task> {
    return this.http.post<Task>(`${this.API_BASE}/tasks`, task);
  }

  updateTask(id: string, task: TaskUpdate): Observable<Task> {
    return this.http.put<Task>(`${this.API_BASE}/tasks/${id}`, task);
  }

  deleteTask(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_BASE}/tasks/${id}`);
  }

  restoreTask(id: string): Observable<Task> {
    return this.http.put<Task>(`${this.API_BASE}/tasks/${id}/restore`, null);
  }

  permanentlyDeleteTask(id: string): Observable<void> {
    return this.http.delete<void>(`${this.API_BASE}/tasks/${id}/permanent`);
  }

  createSubtask(taskId: string, subtask: Subtask): Observable<Subtask> {
    return this.http.post<Subtask>(`${this.API_BASE}/tasks/${taskId}/subtasks`, subtask);
  }

  updateSubtask(taskId: string, subtaskId: string, subtask: Subtask): Observable<Subtask> {
    return this.http.put<Subtask>(`${this.API_BASE}/tasks/${taskId}/subtasks/${subtaskId}`, subtask);
  }

  deleteSubtask(taskId: string, subtaskId: string): Observable<void> {
    return this.http.delete<void>(`${this.API_BASE}/tasks/${taskId}/subtasks/id/${subtaskId}`);
  }

  generateSubtasks(taskId: string): Observable<Task> {
    return this.http.put<Task>(`${this.API_BASE}/tasks/${taskId}/subtasks/generate`, null);
  }

  rearrangeSubtasks(taskId: string): Observable<Task> {
    return this.http.put<Task>(`${this.API_BASE}/tasks/${taskId}/subtasks/generate?rearrange=true`, null);
  }

  adjustTimeframe(taskId: string): Observable<Task> {
    return this.http.put<Task>(`${this.API_BASE}/tasks/${taskId}/subtasks/adjustFrame`, null);
  }

  recommendExtension(taskId: string): Observable<Task> {
    return this.http.put<Task>(`${this.API_BASE}/tasks/${taskId}/recommendExtension`, null);
  }
}
