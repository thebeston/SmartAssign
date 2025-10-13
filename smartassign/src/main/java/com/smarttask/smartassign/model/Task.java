package com.smarttask.smartassign.model;

import java.time.LocalDateTime;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;


@Document(collection = "tasks")
public class Task {
    @Id
    private String id;
    private String title;
    private int priority;
    private LocalDateTime dateCreated;
    private LocalDateTime dateDue;
    private String description;
    private boolean completed;

    // Default constructor
    public Task() {
    }

    // Constructor with all fields
    public Task(String id, String title, int priority, LocalDateTime dateCreated, 
                LocalDateTime dateDue, String description, boolean completed) {
        this.id = id;
        this.title = title;
        this.priority = priority;
        this.dateCreated = dateCreated;
        this.dateDue = dateDue;
        this.description = description;
        this.completed = completed;
    }

    // Getters and Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public int getPriority() {
        return priority;
    }

    public void setPriority(int priority) {
        this.priority = priority;
    }

    public LocalDateTime getDateCreated() {
        return dateCreated;
    }

    public void setDateCreated(LocalDateTime dateCreated) {
        this.dateCreated = dateCreated;
    }

    public LocalDateTime getDateDue() {
        return dateDue;
    }

    public void setDateDue(LocalDateTime dateDue) {
        this.dateDue = dateDue;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public boolean isCompleted() {
        return completed;
    }

    public void setCompleted(boolean completed) {
        this.completed = completed;
    }

    @Override
    public String toString() {
        return "Task{" +
                "id='" + id + '\'' +
                ", title='" + title + '\'' +
                ", priority=" + priority +
                ", dateCreated=" + dateCreated +
                ", dateDue=" + dateDue +
                ", description='" + description + '\'' +
                ", completed=" + completed +
                '}';
    }
}
