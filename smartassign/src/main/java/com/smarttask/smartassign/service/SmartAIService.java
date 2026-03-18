package com.smarttask.smartassign.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smarttask.smartassign.exception.AiServiceException;
import com.smarttask.smartassign.model.Task;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.stream.Collectors;
import java.time.Duration;
import java.util.ArrayList;

@Service
public class SmartAIService {

    private final ChatClient chatClient;
    private final ObjectMapper objectMapper;
    private static final LocalTime DAY_START = LocalTime.of(7, 0);
    private static final LocalTime DAY_END = LocalTime.of(23, 59);

    @Value("${spring.ai.openai.api-key:#{null}}")
    private String apiKey;

    public SmartAIService(ChatClient.Builder builder, ObjectMapper objectMapper) {
        this.chatClient = builder.build();
        this.objectMapper = objectMapper;
    }

    public List<Task.Subtask> generateSubtasks(String prompt) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new AiServiceException("OpenAI API key not configured");
        }

        String formattedPrompt = prompt + "\n\n" +
                "Return an array of JSON objects matching this schema:\n" +
                "{ \"title\": string, \"dateDue\": ISO-8601 datetime string, \"description\": string, \"completed\": boolean }\n\n" +
                "Example:\n" +
                "{\"title\":\"Write tests\",\"dateDue\":\"2025-10-16T18:00:00\",\"description\":\"Add unit tests\",\"completed\":false}";

        String aiResponse = chatClient
                .prompt()
                .user(formattedPrompt)
                .call()
                .content();

        System.out.println("Prompt: " + prompt + "\nAI Response: " + aiResponse);
        return parseSubtasksResponse(aiResponse, "subtask generation");
    }

    public void adjustSubtaskFrame(Task task) {
        List<Task.Subtask> subtasks = task.getSubtasks();
        if (subtasks == null || subtasks.isEmpty()) {
            System.out.println("No subtasks found for task: " + task.getId());
            return;
        }

        List<Task.Subtask> remaining = subtasks.stream()
                .filter(s -> !s.isCompleted())
                .collect(Collectors.toList());

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime finalDue = task.getDateDue();
        LocalDateTime taskStart = task.getDateCreated();
        double totalWork = task.getDuration();

        long availableMinutes = Duration.between(now, finalDue).toMinutes();

        double scale = (double) availableMinutes / totalWork;

        double cumulative = 0;
        LocalDateTime previousDue = now;
        for (Task.Subtask subtask : remaining) {
            subtask.setDateStart(previousDue);
            cumulative += subtask.getDuration();
            long minutesToAdd = (long) (cumulative * scale);
            LocalDateTime newDue = now.plusMinutes(minutesToAdd);
            subtask.setDateDue(newDue);
            previousDue = newDue;
        }

        long originalTimeFrame = Duration.between(taskStart, task.getDateDue()).toMinutes();
        long adjustedTimeFrame = Duration.between(now, task.getDateDue()).toMinutes();
        double compressionRatio = (double) adjustedTimeFrame / originalTimeFrame;

        if (compressionRatio < 0.5) {
            task.setSubtasks(mergeSubTasks(task.getSubtasks()));
            taskStart = now;
        }

        if (Duration.between(task.getDateCreated(), task.getDateDue()).toMinutes() / adjustedTimeFrame < 0.3) {
            // Recommend extended DueDate
        }
    }
    

    public void recommendExtension(Task task, double extensionPercent, double thresholdPercent) {
        List<Task.Subtask> subtasks = task.getSubtasks();

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime originalDue = task.getDateDue();
        LocalDateTime taskStart = task.getDateCreated();

        long totalOriginalMinutes = Duration.between(taskStart, originalDue).toMinutes();
        long elapsedMinutes = Duration.between(taskStart, now).toMinutes();
        double elapsedPercent = (double) elapsedMinutes / totalOriginalMinutes;

        LocalDateTime newFinalDue = originalDue;
        if (elapsedPercent >= thresholdPercent) {
            long extensionMinutes = (long) (totalOriginalMinutes * extensionPercent);
            newFinalDue = addMinutesWithinAllowedHours(originalDue, extensionMinutes);
        }

        if (newFinalDue.isBefore(now)) {
            newFinalDue = addMinutesWithinAllowedHours(now, 24 * 60);
        }
        newFinalDue = snapToAllowedHours(newFinalDue);

        List<Task.Subtask> incomplete = subtasks.stream()
                .filter(s -> !s.isCompleted())
                .collect(Collectors.toList());

        if (incomplete.isEmpty()) {
            task.setDateDue(newFinalDue);
            return;
        }

        long totalRemainingWork = 0;
        for (Task.Subtask s : incomplete) {
            if (s.getDuration() != null && s.getDuration() > 0) {
                totalRemainingWork += s.getDuration();
            } else if (s.getDateStart() != null && s.getDateDue() != null) {
                totalRemainingWork += Duration.between(s.getDateStart(), s.getDateDue()).toMinutes();
            }
        }

        // Available working time
        long availableMinutes = getWorkingMinutesBetween(now, newFinalDue);
        long cumulativeWork = 0;
        LocalDateTime previousDue = snapToAllowedHours(now);
        for (Task.Subtask subtask : incomplete) {
            long subtaskDuration = (subtask.getDuration() != null && subtask.getDuration() > 0)
                    ? subtask.getDuration() : Duration.between(subtask.getDateStart(), subtask.getDateDue()).toMinutes();

            cumulativeWork += subtaskDuration;
            double proportion = (double) cumulativeWork / totalRemainingWork;
            long minutesFromNow = (long) (proportion * availableMinutes);

            LocalDateTime newDue = addMinutesWithinAllowedHours(now, minutesFromNow);

            if (newDue.isBefore(now.plusMinutes(1))) {
                newDue = snapToAllowedHours(now.plusMinutes(1));
            }
            if (newDue.isAfter(newFinalDue)) {
                newDue = newFinalDue;
            }

            subtask.setDateStart(previousDue);
            subtask.setDateDue(newDue);
            previousDue = newDue;
        }

        
        task.setDateDue(newFinalDue);
    }

    private String parseTaskAsString(Task task) {
        StringBuilder sb = new StringBuilder();
        sb.append("Task Title: ").append(task.getTitle()).append("\n");
        sb.append("Description: ").append(task.getDescription()).append("\n");
        sb.append("Created On: ").append(task.getDateCreated()).append("\n");
        sb.append("Due By: ").append(task.getDateDue()).append("\n");
        sb.append("Subtasks:\n");
        if (task.getSubtasks() != null) {
            for (Task.Subtask sub : task.getSubtasks()) {
                sb.append("- ").append(sub.getTitle())
                  .append(" (Due: ").append(sub.getDateDue()).append(")\n");
            }
        }
        return sb.toString();
    }

    private List<Task.Subtask> mergeSubTasks(List<Task.Subtask> subtasks) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new AiServiceException("OpenAI API key not configured");
        }

        if (subtasks == null || subtasks.isEmpty()) {
            System.out.println("No subtasks to merge.");
            return subtasks;
        }

        StringBuilder sb = new StringBuilder("Here are the current subtasks:\n\n");
        int index = 1;
        for (Task.Subtask sub : subtasks) {
            sb.append(index++).append(". ").append(sub.getTitle()).append("\n");
            sb.append("   Description: ").append(sub.getDescription()).append("\n");
            sb.append("   Due: ").append(sub.getDateDue()).append("\n");
            sb.append("   Completed: ").append(sub.isCompleted()).append("\n\n");
        }

        String formattedPrompt = sb.toString() +
                "Some subtasks may overlap, be redundant, or too granular.\n" +
                "Your goal is to intelligently MERGE and REWRITE them into fewer, broader subtasks that keep the logical order, preserve meaning, and remain within the original time range.\n" +
                "Do NOT lose important context. Combine tasks with similar intent that are next to eachother.\n\n" +
                "Return an array of JSON objects matching this schema:\n" +
                "[{ \"title\": string, \"dateDue\": ISO-8601 datetime string, \"description\": string, \"completed\": boolean }]\n\n" +
                "Example:\n" +
                "[{\"title\": \"Develop backend and frontend integration\", \"dateDue\": \"2025-11-14T18:00:00\", \"description\": \"Combine API and UI work for profile customization.\", \"completed\": false}]";

        String aiResponse = chatClient
                .prompt()
                .user(formattedPrompt)
                .call()
                .content();

        System.out.println("AI Merge Prompt:\n" + formattedPrompt);
        System.out.println("AI Merge Response:\n" + aiResponse);
        return parseSubtasksResponse(aiResponse, "subtask merge");
    }

    private List<Task.Subtask> parseSubtasksResponse(String aiResponse, String operation) {
        if (aiResponse == null || aiResponse.isBlank()) {
            throw new AiServiceException("AI returned an empty response for " + operation);
        }

        String normalized = normalizeAiJson(aiResponse);

        try {
            List<Task.Subtask> parsed = objectMapper.readValue(normalized, new TypeReference<List<Task.Subtask>>() {});
            return validateSubtasks(parsed, operation);
        } catch (Exception firstParseException) {
            try {
                Task.Subtask single = objectMapper.readValue(normalized, Task.Subtask.class);
                return validateSubtasks(new ArrayList<>(List.of(single)), operation);
            } catch (Exception secondParseException) {
                throw new AiServiceException("Failed to parse AI response for " + operation, firstParseException);
            }
        }
    }

    private String normalizeAiJson(String aiResponse) {
        String trimmed = aiResponse.trim();

        if (trimmed.startsWith("```")) {
            trimmed = trimmed.replaceAll("^```(?:json)?\\s*", "")
                    .replaceAll("\\s*```$", "")
                    .trim();
        }

        return trimmed;
    }

    private List<Task.Subtask> validateSubtasks(List<Task.Subtask> subtasks, String operation) {
        if (subtasks == null || subtasks.isEmpty()) {
            throw new AiServiceException("AI returned no subtasks for " + operation);
        }

        for (Task.Subtask subtask : subtasks) {
            if (subtask.getTitle() == null || subtask.getTitle().isBlank()) {
                throw new AiServiceException("AI returned a subtask without title for " + operation);
            }

            if (subtask.getDateDue() == null) {
                throw new AiServiceException("AI returned a subtask without due date for " + operation);
            }
        }

        return subtasks;
    }

    private LocalDateTime snapToAllowedHours(LocalDateTime dateTime) {
        if (dateTime == null) return null;

        LocalTime time = dateTime.toLocalTime();

        if (time.isBefore(DAY_START)) {
            return dateTime.withHour(7).withMinute(0).withSecond(0).withNano(0);
        }
            
        if (time.isAfter(DAY_END)) {
            return dateTime.withHour(7).withMinute(0).withSecond(0).withNano(0);
        }
            return dateTime;
    }

    private long getWorkingMinutesBetween(LocalDateTime start, LocalDateTime end) {
        if (start == null || end == null || !start.isBefore(end)) {
            return 0;
        }

        long totalMinutes = 0;
        LocalDateTime current = snapToAllowedHours(start);

        while (current.isBefore(end)) {
            LocalDateTime endOfDay = current.toLocalDate().atTime(DAY_END);

            if (endOfDay.isAfter(end)) {
                totalMinutes += Duration.between(current, end).toMinutes();
                break;
            } else {
                totalMinutes += Duration.between(current, endOfDay).toMinutes();
                current = current.toLocalDate().plusDays(1).atTime(DAY_START);
            }
        }
        return totalMinutes;
    }

    private LocalDateTime addMinutesWithinAllowedHours(LocalDateTime start, long minutesToAdd) {
        LocalDateTime result = snapToAllowedHours(start);
        long remainingMinutes = minutesToAdd;

        while (remainingMinutes > 0) {
            LocalDateTime endOfDay = result.toLocalDate().atTime(DAY_END);
            long minutesUntilEndOfDay = Duration.between(result, endOfDay).toMinutes();

            if (minutesUntilEndOfDay <= 0) {
                result = result.toLocalDate().plusDays(1).atTime(DAY_START);
                continue;
            }

            if (remainingMinutes <= minutesUntilEndOfDay) {
                result = result.plusMinutes(remainingMinutes);
                remainingMinutes = 0;
            } else {
                remainingMinutes -= minutesUntilEndOfDay;
                result = result.toLocalDate().plusDays(1).atTime(DAY_START);
            }
        }

        return snapToAllowedHours(result);
    }

}