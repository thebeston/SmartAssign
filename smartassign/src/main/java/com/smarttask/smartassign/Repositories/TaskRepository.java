package com.smarttask.smartassign.Repositories;

import java.time.LocalDateTime;
import java.util.List;

import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;
import com.smarttask.smartassign.model.Task;

public interface TaskRepository extends MongoRepository<Task, ObjectId> {
    List<Task> findByDeletedAtIsNull();

    List<Task> findByDeletedAtGreaterThanEqualOrderByDeletedAtDesc(LocalDateTime cutoff);

    List<Task> findByDeletedAtLessThan(LocalDateTime cutoff);
}
