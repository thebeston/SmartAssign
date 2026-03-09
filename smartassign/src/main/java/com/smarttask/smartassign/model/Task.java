package com.smarttask.smartassign.model;

import java.time.LocalDateTime;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import org.bson.types.ObjectId;
import org.springframework.cglib.core.Local;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import com.fasterxml.jackson.annotation.JsonFormat;

@Document(collection = "tasks")
public class Task {

    @Id
    private ObjectId id;
    private String title;
    private LocalDateTime dateCreated = LocalDateTime.now();
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime dateDue;
    private String description;
    private boolean completed = false;
    
    // Duration in minutes: sum of subtask durations if subtasks exist, else dateCreated -> dateDue
    private Long duration;

    // List of embedded subtasks
    private List<Subtask> subtasks = new ArrayList<>();

    // --- Constructors ---
    public Task() {
        this.id = new ObjectId();
        this.dateCreated = LocalDateTime.now();
        this.subtasks = new ArrayList<>();
    }

    public Task(String title, LocalDateTime dateDue, String description) {
        this();
        this.title = title;
        this.dateDue = dateDue;
        this.description = description;
    }

    // --- Getters and Setters ---
    public String getId() {
        return id != null ? id.toHexString() : null;
    }

    public void setId(String idHex) {
        this.id = idHex == null ? null : new ObjectId(idHex);
    }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public LocalDateTime getDateCreated() { return dateCreated; }
    public void setDateCreated(LocalDateTime dateCreated) { this.dateCreated = dateCreated; }

    public LocalDateTime getDateDue() { return dateDue; }
    public void setDateDue(LocalDateTime dateDue) { this.dateDue = dateDue; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public boolean isCompleted() { return completed; }
    public void setCompleted(boolean completed) { this.completed = completed; }

    public List<Subtask> getSubtasks() {
        if (subtasks == null) subtasks = new ArrayList<>();
        return subtasks;
    }

    public void setSubtasks(List<Subtask> subtasks) {
        this.subtasks = (subtasks != null) ? subtasks : new ArrayList<>();
    }

    public Long getDuration() { return duration; }
    public void setDuration(Long duration) { this.duration = duration; }

    public void computeDuration() {
        if (subtasks != null && !subtasks.isEmpty()) {
            // Sum all subtask durations
            long totalMinutes = 0;
            List<Task.Subtask> remaining = subtasks.stream()
            .filter(s -> !s.isCompleted())
            .collect(Collectors.toList());

            for (Subtask st : remaining) {
                if (st.getDuration() != null) {
                    totalMinutes += st.getDuration();
                } else {
                    // If subtask doesn't have duration computed, compute it on-the-fly
                    if (st.getDateStart() != null && st.getDateDue() != null) {
                        totalMinutes += Duration.between(st.getDateStart(), st.getDateDue()).toMinutes();
                    }
                }
            }
            this.duration = totalMinutes;
        } else {
            // No subtasks: use task's dateCreated -> dateDue
            if (dateCreated != null && dateDue != null) {
                this.duration = Duration.between(dateCreated, dateDue).toMinutes();
            } else {
                this.duration = null;
            }
        }
    }

    @Override
    public String toString() {
        return "Task{" +
                "id='" + getId() + '\'' +
                ", title='" + title + '\'' +
                ", dateCreated=" + dateCreated +
                ", dateDue=" + dateDue +
                ", description='" + description + '\'' +
                ", completed=" + completed +
                ", duration=" + duration +
                ", subtasks=" + subtasks +
                '}';
    }

    // --- Embedded Subtask Class ---
    public static class Subtask {
        private ObjectId id = new ObjectId();
        private ObjectId parentId;
        private String title;
        private LocalDateTime dateStart = LocalDateTime.now();
        private LocalDateTime dateDue;
        private LocalDateTime originalDateDue;
        private String description;
        private boolean completed = false;
        
        // Duration in minutes: dateStart -> dateDue
        private Long duration;

        public Subtask() {}

        public Subtask(String title, LocalDateTime dateDue, String description, ObjectId parentId) {
            this.title = title;
            this.dateDue = dateDue;
            this.description = description;
            this.parentId = parentId;
        }

        // --- Getters and Setters ---
        public String getId() {
            return id != null ? id.toHexString() : null;
        }

        public void setId(String idHex) {
            this.id = idHex == null ? null : new ObjectId(idHex);
        }

        public String getParentId() {
            return parentId != null ? parentId.toHexString() : null;
        }

        public void setParentId(String parentIdHex) {
            this.parentId = parentIdHex == null ? null : new ObjectId(parentIdHex);
        }

        public ObjectId getParentObjectId() {
            return parentId;
        }

        public void setParentObjectId(ObjectId parentId) {
            this.parentId = parentId;
        }

        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }

        public LocalDateTime getDateStart() { return dateStart; }
        public void setDateStart(LocalDateTime dateStart) { this.dateStart = dateStart; }

        public LocalDateTime getDateDue() { return dateDue; }
        public void setDateDue(LocalDateTime dateDue) { this.dateDue = dateDue; }

        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }

        public boolean isCompleted() { return completed; }
        public void setCompleted(boolean completed) { this.completed = completed; }

        public Long getDuration() { return duration; }
        public void setDuration(Long duration) { this.duration = duration; }

        /**
         * Computes and sets duration in minutes from dateStart to dateDue.
         */
        public void computeDuration() {
            if (dateStart != null && dateDue != null) {
                this.duration = Duration.between(dateStart, dateDue).toMinutes();
            } else {
                this.duration = null;
            }
        }

        @Override
        public String toString() {
            return "Subtask{" +
                    "id='" + getId() + '\'' +
                    ", parentId='" + getParentId() + '\'' +
                    ", title='" + title + '\'' +
                    ", dateStart=" + dateStart +
                    ", dateDue=" + dateDue +
                    ", description='" + description + '\'' +
                    ", completed=" + completed +
                    ", duration=" + duration +
                    '}';
        }
    }
}
