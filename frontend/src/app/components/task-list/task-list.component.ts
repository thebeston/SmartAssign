import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskFilter, TaskViewModel } from '../../models/task.model';
import { TaskCardComponent } from '../task-card/task-card.component';
import { isOverdue } from '../../utils/task.utils';

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TaskCardComponent],
  templateUrl: './task-list.component.html',
  styleUrls: ['./task-list.component.css']
})
export class TaskListComponent {
  @Input() tasks: TaskViewModel[] = [];
  @Input() loading = false;
  @Input() taskFilter: TaskFilter = 'all';
  @Input() searchQuery = '';
  @Input() showCompletedSection = false;

  @Output() taskFilterChange = new EventEmitter<TaskFilter>();
  @Output() searchQueryChange = new EventEmitter<string>();
  @Output() showCompletedSectionChange = new EventEmitter<boolean>();
  @Output() createRequested = new EventEmitter<void>();
  @Output() taskUpdated = new EventEmitter<TaskViewModel>();
  @Output() taskRemoved = new EventEmitter<string>();
  @Output() reloadRequested = new EventEmitter<void>();

  get activeCount(): number {
    return this.tasks.filter(t => !t.completed).length;
  }

  get completedCount(): number {
    return this.tasks.filter(t => t.completed).length;
  }

  get overdueCount(): number {
    return this.tasks.filter(t => !t.completed && isOverdue(t.dateDue)).length;
  }

  get filteredTasks(): TaskViewModel[] {
    const query = this.searchQuery.trim().toLowerCase();
    return this.tasks.filter(task => {
      if (this.taskFilter === 'active' && task.completed) return false;
      if (this.taskFilter === 'completed' && !task.completed) return false;
      if (this.taskFilter === 'overdue' && (task.completed || !isOverdue(task.dateDue))) return false;
      if (query) {
        const haystack = `${task.title} ${task.description || ''}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }

  get activeFilteredTasks(): TaskViewModel[] {
    return this.filteredTasks.filter(t => !t.completed);
  }

  get completedFilteredTasks(): TaskViewModel[] {
    return this.filteredTasks.filter(t => t.completed);
  }

  get showCompletedBlock(): boolean {
    if (this.taskFilter === 'active' || this.taskFilter === 'overdue') return false;
    return this.completedFilteredTasks.length > 0;
  }

  setFilter(filter: TaskFilter): void {
    this.taskFilterChange.emit(filter);
    if (filter === 'completed') {
      this.showCompletedSectionChange.emit(true);
    }
  }

  onSearch(value: string): void {
    this.searchQueryChange.emit(value);
  }

  clearFilters(): void {
    this.searchQueryChange.emit('');
    this.taskFilterChange.emit('all');
  }

  toggleCompletedSection(): void {
    this.showCompletedSectionChange.emit(!this.showCompletedSection);
  }

  trackByTaskId(_index: number, task: TaskViewModel): string {
    return task.id;
  }
}
