package com.smarttask.smartassign.service;

import com.smarttask.smartassign.Repositories.TaskRepository;
import com.smarttask.smartassign.exception.TaskNotFoundException;
import com.smarttask.smartassign.model.Task;
import org.bson.types.ObjectId;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Comparator;

@Service
public class TaskService {

    private final TaskRepository taskRepository;
    private final SmartAIService smartAIService;

    @Autowired
    public TaskService(TaskRepository taskRepository, SmartAIService smartAIService) {
        this.taskRepository = taskRepository;
        this.smartAIService = smartAIService;
    }

    public static final int DELETED_RETENTION_DAYS = 14;

    public List<Task> getAllTasks() {
        return taskRepository.findByDeletedAtIsNull();
    }

    public List<Task> getDeletedTasks() {
        purgeExpiredDeletedTasks();
        LocalDateTime cutoff = LocalDateTime.now().minusDays(DELETED_RETENTION_DAYS);
        List<Task> deleted = taskRepository.findByDeletedAtGreaterThanEqualOrderByDeletedAtDesc(cutoff);
        deleted.sort(Comparator.comparing(Task::getDeletedAt, Comparator.nullsLast(Comparator.reverseOrder())));
        return deleted;
    }

    public Task getTaskById(String id) {
        ObjectId oid;
        try {
            oid = new ObjectId(id);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Invalid task id format: " + id);
        }

        return taskRepository.findById(oid)
                .orElseThrow(() -> new TaskNotFoundException("Task not found with id: " + id));
    }

    @Transactional
    public Task createTask(Task task) {
        if (task.getDateCreated() == null) {
            task.setDateCreated(LocalDateTime.now());
        }

        if (task.getId() == null) {
            task.setId(new ObjectId().toHexString());
        }

        if (task.getSubtasks() != null) {
            LocalDateTime previousDue = null;
            for (int i = 0; i < task.getSubtasks().size(); i++) {
                Task.Subtask st = task.getSubtasks().get(i);

                if (st.getId() == null) {
                    st.setId(new ObjectId().toHexString());
                }

                st.setParentId(task.getId());

                if (st.getDateStart() == null) {
                    st.setDateStart(i == 0 ? task.getDateCreated() : previousDue);
                }

                st.computeDuration();
                previousDue = st.getDateDue();
            }
        }

        task.computeDuration();
        return taskRepository.save(task);
    }

    @Transactional
    public Task generateSubTask(String taskId, Boolean rearrange) {
        Task task = getTaskById(taskId);
        String prompt = """
            You are an intelligent task optimizer. The user has an existing task with no existing subtasks.
            The goal is to create new subtasks to fit better with the main task's due date and logical order. The due date of the subtasks should be between the date created and the duedate of the main task logically. THEY SHOULD NOT BE OUTSIDE THIS RANGE.
            Each subtask should be highly descriptive and detailed. And if you feel that the main task description is not detailed enough, return the json object {fix: "detail description"}

            MAIN TASK:
            %s

            MAIN TASK DESCRIPTION:
            %s

            MAIN TASK CREATION DATE:
            %s

            MAIN TASK DUE DATE:
            %s

            Please revise and return at least EIGHT (8) or more improved subtask JSON objects that should replace or refine one of the existing subtasks. MAKE SURE THE SUBTASK DATES ARE LOGICALLY PLACED AND NOT OUTSIDE THE MAIN TASK DATE RANGE.
            """.formatted(task.getTitle(), task.getDescription(), task.getDateCreated(), task.getDateDue());
        if (rearrange) {
            prompt = """
                You are an intelligent task optimizer. The user has an existing task with subtasks that may not be well organized or time-balanced.
                The goal is to improve the subtasks to fit better with the main task's due date and logical order. The due date of the subtasks should be between the date created and the duedate of the main task logically.
                You do not have to add new tasks and can just edit the tasks that already exist, but adding a task or two can be an option (try not to do it too often).
                Adjust or merge subtasks if needed, and add more details to each description.

                MAIN TASK:
                %s

                EXISTING SUBTASKS:
                %s

                Please revise and return at least THREE or more improved subtask JSON object that should replace or refine one of the existing subtasks. MAKE SURE THE SUBTASK DATES ARE LOGICALLY PLACED AND NOT OUTSIDE THE MAIN TASK DATE RANGE.
                """.formatted(task.getDescription(), task.getSubtasks().toString());
        }
        List<Task.Subtask> subtasks = smartAIService.generateSubtasks(prompt);
        for (Task.Subtask sub : task.getSubtasks()) {
            sub.setParentId(task.getId());
        }
        task.getSubtasks().addAll(subtasks);
        
        for (Task.Subtask st : task.getSubtasks()) {
            st.computeDuration();
        }
        
        task.computeDuration();
        
        return taskRepository.save(task);
    }

    @Transactional
    public Task adjustSubtaskFrame(String taskID) {
        Task task = getTaskById(taskID);

        if (task != null && task.getSubtasks() != null && !task.getSubtasks().isEmpty()) {
            System.out.println("Calling adjustSubtaskFrame for task: " + taskID);
            smartAIService.adjustSubtaskFrame(task);
            computeAllDurations(task);
            return taskRepository.save(task);
        }
        
        System.out.println("No subtasks to adjust for task: " + taskID);
        return task;
    }

    public Task extendTaskDueDate(String taskID) {
        Task task = getTaskById(taskID);
        if (task != null) {
            smartAIService.recommendExtension(task, 0.4, 0.5);
            computeAllDurations(task);
            return taskRepository.save(task);
        }
        return null;
    }

    private void computeAllDurations(Task task) {
        if (task.getSubtasks() != null) {
            for (Task.Subtask subtask : task.getSubtasks()) {
                subtask.computeDuration();
            }
        }
        task.computeDuration();
    }


    public Task updateTask(String id, Task updatedTask) {
        updatedTask.setId(id);
        ObjectId parentId = new ObjectId(id);
        Task existingTask = getTaskById(id);

        if (updatedTask.getDateCreated() == null) {
            updatedTask.setDateCreated(existingTask.getDateCreated());
        }
        if (updatedTask.getDeletedAt() == null) {
            updatedTask.setDeletedAt(existingTask.getDeletedAt());
        }

        if (updatedTask.getSubtasks() != null) {
            LocalDateTime previousDue = null;
            for (int i = 0; i < updatedTask.getSubtasks().size(); i++) {
                Task.Subtask st = updatedTask.getSubtasks().get(i);
                if (st.getId() == null) {
                    st.setId(new ObjectId().toHexString());
                }
                st.setParentId(parentId.toHexString());
                if (st.getDateStart() == null) {
                    if (i == 0) {
                        st.setDateStart(existingTask.getDateCreated());
                    } else {
                        st.setDateStart(previousDue);
                    }
                }
                st.computeDuration();
                previousDue = st.getDateDue();
            }
        }
        
        updatedTask.computeDuration();

        return taskRepository.save(updatedTask);
    }

    @Transactional
    public void deleteTask(String id) {
        Task task = getTaskById(id);
        if (task.getDeletedAt() == null) {
            task.setDeletedAt(LocalDateTime.now());
            taskRepository.save(task);
        }
    }

    @Transactional
    public Task restoreTask(String id) {
        Task task = getTaskById(id);
        task.setDeletedAt(null);
        return taskRepository.save(task);
    }

    @Transactional
    public void permanentlyDeleteTask(String id) {
        taskRepository.deleteById(new ObjectId(id));
    }

    @Transactional
    public int purgeExpiredDeletedTasks() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(DELETED_RETENTION_DAYS);
        List<Task> expired = taskRepository.findByDeletedAtLessThan(cutoff);
        if (expired.isEmpty()) {
            return 0;
        }
        taskRepository.deleteAll(expired);
        return expired.size();
    }

    @Transactional
    public void deleteSubTask(String taskId, String subtaskId) {
        Task task = getTaskById(taskId);
        if (task.getSubtasks() != null) {
            task.getSubtasks().removeIf(subtask ->
                    subtask.getId() != null && subtask.getId().equals(subtaskId)
            );
            task.computeDuration();
            taskRepository.save(task);
        }
    }
}