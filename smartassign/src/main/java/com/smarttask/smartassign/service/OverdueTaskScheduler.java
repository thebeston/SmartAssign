package com.smarttask.smartassign.service;

import com.smarttask.smartassign.Repositories.TaskRepository;
import com.smarttask.smartassign.model.Task;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class OverdueTaskScheduler {

    private static final Logger log = LoggerFactory.getLogger(OverdueTaskScheduler.class);

    private final TaskRepository taskRepository;
    private final SmartAIService smartAIService;
    private final TaskService taskService;

    public OverdueTaskScheduler(TaskRepository taskRepository, SmartAIService smartAIService, TaskService taskService) {
        this.taskRepository = taskRepository;
        this.smartAIService = smartAIService;
        this.taskService = taskService;
    }

    /**
     * Runs every 60 seconds to check for tasks with overdue incomplete subtasks
     * and automatically adjusts their timeframes.
     */
    @Scheduled(fixedRate = 60000) // Every 60 seconds
    public void checkAndAdjustOverdueTasks() {
        log.debug("Running overdue subtask check...");
        
        List<Task> allTasks = taskRepository.findByDeletedAtIsNull();
        LocalDateTime now = LocalDateTime.now();
        int adjustedCount = 0;

        for (Task task : allTasks) {
            if (task.isDeleted() || task.isCompleted()) {
                continue;
            }

            if (hasOverdueIncompleteSubtask(task, now)) {
                log.info("Auto-adjusting timeframe for task: {} ({})", task.getTitle(), task.getId());
                try {
                    smartAIService.adjustSubtaskFrame(task);
                    computeAllDurations(task);
                    taskRepository.save(task);
                    adjustedCount++;
                } catch (Exception e) {
                    log.error("Failed to auto-adjust task {}: {}", task.getId(), e.getMessage());
                }
            }
        }

        if (adjustedCount > 0) {
            log.info("Auto-adjusted {} task(s) with overdue subtasks", adjustedCount);
        }
    }

    @Scheduled(cron = "0 0 3 * * *")
    public void purgeExpiredDeletedTasks() {
        int removed = taskService.purgeExpiredDeletedTasks();
        if (removed > 0) {
            log.info("Permanently removed {} expired deleted task(s)", removed);
        }
    }

    private boolean hasOverdueIncompleteSubtask(Task task, LocalDateTime now) {
        if (task.getSubtasks() == null || task.getSubtasks().isEmpty()) {
            return false;
        }

        return task.getSubtasks().stream()
                .anyMatch(st -> !st.isCompleted() 
                             && st.getDateDue() != null 
                             && st.getDateDue().isBefore(now));
    }

    private void computeAllDurations(Task task) {
        if (task.getSubtasks() != null) {
            for (Task.Subtask subtask : task.getSubtasks()) {
                subtask.computeDuration();
            }
        }
        task.computeDuration();
    }
}
