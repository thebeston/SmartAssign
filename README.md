# SmartAssign

SmartAssign is a full-stack task manager with AI-assisted subtask generation and schedule adjustment.

## Project Structure

- `frontend/`: Angular app (task creation + task list)
- `smartassign/`: Spring Boot + MongoDB REST API

## Prerequisites

- Java 17+
- Node.js 18+
- MongoDB instance
- Optional: OpenAI API key for AI endpoints

## Environment Variables (Backend)

Set these before running the Spring app:

- `SPRING_DATA_MONGODB_URI` (required)
- `SPRING_DATA_MONGODB_DATABASE` (optional, default: `smarttask`)
- `SPRING_AI_OPENAI_API_KEY` (required only for AI features)
- `SPRING_AI_OPENAI_CHAT_OPTIONS_MODEL` (optional, default in properties)
- `SERVER_PORT` (optional, default: `8080`)

## Run Backend

```bash
cd smartassign
./mvnw spring-boot:run
```

Windows:

```bash
cd smartassign
mvnw.cmd spring-boot:run
```

## Run Frontend

```bash
cd frontend
npm install
npm start
```

Frontend defaults to `http://localhost:4200` and proxies API requests to backend.

## Key API Endpoints

- `GET /tasks`
- `GET /tasks/{id}`
- `POST /tasks`
- `PUT /tasks/{id}`
- `DELETE /tasks/{id}`
- `POST /tasks/{id}/subtasks`
- `PUT /tasks/{taskId}/subtasks/{subtaskId}`
- `DELETE /tasks/{taskId}/subtasks/{subtaskId}`
- `PUT /tasks/{id}/subtasks/generate?rearrange=true|false`
- `PUT /tasks/{id}/subtasks/adjustFrame`
- `PUT /tasks/{id}/recommendExtension`

## Notes

- The backend now uses a single Spring Boot entrypoint: `SmartassignApplication`.
- API errors are returned in a consistent JSON shape via global exception handling.
