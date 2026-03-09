package com.smarttask.smartassign.Repositories;

import org.bson.types.ObjectId;
import org.springframework.data.mongodb.repository.MongoRepository;
import com.smarttask.smartassign.model.Task;

public interface TaskRepository extends MongoRepository<Task, ObjectId> {
    // standard CRUD methods are inherited from MongoRepository
}
