package com.smarttask.smartassign.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;

import java.util.ArrayList;

import java.util.List;
import com.smarttask.smartassign.model.Task;
import com.smarttask.smartassign.service.TaskService;


@RestController
@RequestMapping("/tasks")
public class TaskController {
    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }
    
    @GetMapping("/")
    public String redirectToHome() {
        return "🚀 API is running! Visit /api/... for endpoints.";
    }


    @GetMapping
    public List<Task> getAllTasks() {
        return taskService.getAllTasks();
    }

    @GetMapping("/{id}")
    public Task getTaskById(@PathVariable String id) {
        return taskService.getTaskById(id);
    }

    @PostMapping()
    public Task createTask(@RequestBody Task task) {
        return taskService.createTask(task);
    }

    // Create a subtask under a parent task
    @PostMapping("/{id}/subtasks")
    public ResponseEntity<Task.Subtask> createSubtask(@PathVariable String id, @RequestBody Task.Subtask subtask) {
        Task task = taskService.getTaskById(id);
        if (task.getSubtasks() == null) {
            task.setSubtasks(new ArrayList<>());
        }
        task.getSubtasks().add(subtask);
        Task saved = taskService.updateTask(id, task);
        // return the last subtask (service populates id and parentId)
        if (saved.getSubtasks() != null && !saved.getSubtasks().isEmpty()) {
            Task.Subtask created = saved.getSubtasks().get(saved.getSubtasks().size() - 1);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        }
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
    }

    // Update a specific subtask
    @PutMapping("/{taskId}/subtasks/{subtaskId}")
    public ResponseEntity<Task.Subtask> updateSubtask(@PathVariable String taskId, @PathVariable String subtaskId, @RequestBody Task.Subtask subtask) {
        Task task = taskService.getTaskById(taskId);
        if (task.getSubtasks() != null) {
            boolean found = false;
            for (Task.Subtask st : task.getSubtasks()) {
                if (subtaskId.equals(st.getId())) {
                    st.setTitle(subtask.getTitle());
                    st.setDescription(subtask.getDescription());
                    st.setDateDue(subtask.getDateDue());
                    st.setCompleted(subtask.isCompleted());
                    found = true;
                    break;
                }
            }
            if (found) {
                Task saved = taskService.updateTask(taskId, task);
                for (Task.Subtask st : saved.getSubtasks()) {
                    if (subtaskId.equals(st.getId())) {
                        return ResponseEntity.ok(st);
                    }
                }
            }
        }
        return ResponseEntity.notFound().build();
    }

    // Additional endpoints (POST, PUT, DELETE) can be added here
    @PutMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public Task updateTask(@PathVariable String id, @RequestBody Task updatedTask) {
        return taskService.updateTask(id, updatedTask);
    }

    @DeleteMapping("/{id}")
    public void deleteTask(@PathVariable String id) {
        taskService.deleteTask(id);
    }

    // Delete a subtask by id
    @DeleteMapping("/{taskId}/subtasks/{subtaskId}")
    public ResponseEntity<Void> deleteSubtask(@PathVariable String taskId, @PathVariable String subtaskId) {
        taskService.deleteSubTask(taskId, subtaskId);
        return ResponseEntity.noContent().build();
    }

    // Generate (AI) a new or improved subtask for the given task. Use ?rearrange=true to ask the AI to
    // reorganize/improve existing subtasks instead of creating a new one from scratch.
    @PutMapping("/{id}/subtasks/generate")
    public ResponseEntity<Task> generateSubtask(@PathVariable String id,
                                                @RequestParam(name = "rearrange", required = false, defaultValue = "false") boolean rearrange) {
        Task updated = taskService.generateSubTask(id, rearrange);
        if (updated == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(updated);
    }

    @PutMapping("/{id}/subtasks/adjustFrame")
    public ResponseEntity<Task> adjustSubtaskFrame(@PathVariable String id) {
        Task updated = taskService.adjustSubtaskFrame(id);
        if (updated == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(updated);
    }

    @PutMapping("/{id}/recommendExtension")
    public ResponseEntity<Task> recommendExtension(@PathVariable String id) {
        Task updated = taskService.extendTaskDueDate(id);
        if (updated == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(updated);
    }
    
}
