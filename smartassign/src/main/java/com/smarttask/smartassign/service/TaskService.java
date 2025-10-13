package com.smarttask.smartassign.service;

import com.smarttask.smartassign.Repositories.TaskRepository;
import com.smarttask.smartassign.model.Task;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class TaskService {

	private final TaskRepository taskRepository;

	@Autowired
	public TaskService(TaskRepository taskRepository) {
		this.taskRepository = taskRepository;
	}

	public List<Task> getAllTasks() {
		return taskRepository.findAll();
	}

	public Task getTaskById(String id) {
		return taskRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("Employee not found with id: " + id));
	}

	public Task createTask(Task task) {
		return taskRepository.save(task);
	}

	public Task updateTask(String id, Task updatedTask) {
		return taskRepository.save(updatedTask);
	}

	public void deleteTask(String id) {
		taskRepository.deleteById(id);
	}
}
