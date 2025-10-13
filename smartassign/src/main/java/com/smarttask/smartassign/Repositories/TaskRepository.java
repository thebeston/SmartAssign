package com.smarttask.smartassign.Repositories;
import org.springframework.data.mongodb.repository.MongoRepository;
import com.smarttask.smartassign.model.Task;
import java.util.Optional;

public interface TaskRepository extends MongoRepository<Task, String> {
    void deleteById(String id);
    Optional<Task> findById(String id);
}
