# Cortanyx — ChatGPT Clone

**Full Stack Web Developer final project — Mordehai Levy**

A ChatGPT-style web app that holds a continuous conversation with an AI model.
React SPA → Python FastAPI REST API → MySQL, with OpenAI called **only from the server**.

**GitHub:** https://github.com/mordehailevy/cortanyx

![Cortanyx - chat with history, Markdown table](docs/screenshots/chat-light.jpg)

| Hebrew, dark theme, highlighted code | Mobile | About page |
|---|---|---|
| ![Hebrew conversation in dark theme](docs/screenshots/chat-dark-hebrew.jpg) | ![Mobile layout](docs/screenshots/mobile.jpg) | ![About page](docs/screenshots/about.jpg) |

---

## Features

| Required by the brief | How it is done |
|---|---|
| Continuous conversation with context | Every message is saved in MySQL; the server sends the whole conversation (sliding window of the last 40 messages) + a system prompt to OpenAI |
| User messages on one side, chat on the other | User bubbles on the right, assistant on the left |
| "New conversation" button | In the sidebar and in the chat toolbar. A page refresh also starts a fresh chat |
| OpenAI called from the server only | `Backend/app/services/openai_service.py` is the only module that talks to OpenAI |
| API key in a server-side `.env` | `Backend/.env` (ignored by git), template in `Backend/.env.example` |
| `requirements.txt` | `Backend/requirements.txt` (pinned versions) |
| Home page, About page, main menu | `/` and `/about`, menu in the header |
| Database: who wrote each message, and which conversation | `messages.role` = `user` / `assistant`, `messages.conversation_id` → `conversations.id` (UUID) |

**Extras**

- **Streaming** answers word by word (Server-Sent Events) with a **Stop** button — the partial answer is kept so the context stays exact.
- **Markdown** rendering: tables, lists, **syntax-highlighted code** with a copy button.
- **Hebrew / English / French**: every message sets its own direction automatically (`dir="auto"`), the model answers in the user's language.
- **History sidebar**: AI-generated titles, reopen, rename, delete (grouped by Today / Yesterday / …).
- Clear **error handling**: invalid key, quota, network — friendly message + **Retry**; a failed message is rolled back so the database never holds unanswered messages.
- **Rate limiting** per IP and message length validation (protects the OpenAI budget).
- **Light / dark theme**, responsive 375 → 1440 px, keyboard accessible, `prefers-reduced-motion` respected.
- **10 automated tests** (pytest) with a fake OpenAI client — no network, no cost.
- **Postman collection** with test scripts, and interactive Swagger docs at `/docs`.

---

## Architecture

```
┌──────────────┐  REST / SSE   ┌──────────────────┐   SQL    ┌─────────┐
│  React SPA   │ ────────────▶ │  FastAPI server  │ ───────▶ │  MySQL  │
│  (Frontend)  │ ◀──────────── │    (Backend)     │ ◀─────── │         │
└──────────────┘               └────────┬─────────┘          └─────────┘
                                        │ HTTPS (API key from .env)
                                        ▼
                                   OpenAI API
```

For each message: save the user message → load the conversation from MySQL → send it to OpenAI → stream the answer to the browser → save the answer → (first exchange only) generate a title.

### Database

```
conversations                         messages
─────────────────────────             ──────────────────────────────────────
id          CHAR(36)  PK  ◀────┐      id               BIGINT PK AUTO_INCREMENT
title       VARCHAR(120)       └───── conversation_id  CHAR(36) FK (ON DELETE CASCADE)
model       VARCHAR(64)               role             ENUM('user','assistant')
created_at  DATETIME(3)               content          MEDIUMTEXT
updated_at  DATETIME(3)               tokens           INT NULL
                                      created_at       DATETIME(3)
```

The view **`v_conversation_messages`** shows the data in a human-readable way
(conversation id, title, sender `User` / `ChatGPT`, content, time):

```sql
SELECT * FROM chatgpt_clone.v_conversation_messages;
```

### REST API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | API, database and configuration status |
| POST | `/api/conversations` | Start a conversation |
| GET | `/api/conversations` | List conversations (newest first) |
| GET | `/api/conversations/{id}` | One conversation with all its messages |
| PATCH | `/api/conversations/{id}` | Rename |
| DELETE | `/api/conversations/{id}` | Delete (messages are deleted in cascade) |
| POST | `/api/conversations/{id}/messages` | Send a message, get the full answer (JSON) |
| POST | `/api/conversations/{id}/messages/stream` | Send a message, stream the answer (SSE: `user_message`, `delta`, `done`, `title`, `error`) |

---

## Project structure

```
MordehaiLevy/
├── Database/
│   ├── schema.sql              # tables + readable view
│   └── chatgpt_clone.sql       # full export (structure + sample data)
├── Backend/                    # FastAPI
│   ├── app/
│   │   ├── main.py             # app, CORS, error handlers, /api/health
│   │   ├── config.py           # settings from .env
│   │   ├── database.py         # SQLAlchemy engine/session
│   │   ├── models.py           # ORM models
│   │   ├── schemas.py          # request/response validation (Pydantic)
│   │   ├── prompts.py          # system prompt + title prompt
│   │   ├── rate_limit.py
│   │   ├── routers/conversations.py
│   │   └── services/           # openai_service.py, conversation_service.py
│   ├── tests/                  # pytest
│   ├── requirements.txt
│   ├── .env.example
│   └── ChatGPT-Clone.postman_collection.json
├── Frontend/                   # React + TypeScript + Vite + Tailwind
│   └── src/ (pages, components, hooks, lib/api.ts)
├── docs/screenshots/           # images used in this README
├── .githooks/pre-commit        # blocks commits containing secrets
├── docker-compose.yml          # optional MySQL
└── README.md
```

---

## Run it locally

**Requirements:** Python 3.10+, Node.js 20+, MySQL 8+, an OpenAI API key.

### 1. Database

```bash
mysql -u root -p < Database/schema.sql
mysql -u root -p -e "CREATE USER 'chat_app'@'localhost' IDENTIFIED BY 'choose_a_password'; GRANT SELECT,INSERT,UPDATE,DELETE ON chatgpt_clone.* TO 'chat_app'@'localhost';"
```

(or `mysql -u root -p < Database/chatgpt_clone.sql` to also get sample conversations,
or `docker compose up -d` for a ready MySQL on port 3307.)

### 2. Backend

```bash
cd Backend
python3 -m venv env
source env/bin/activate          # Windows: env\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # then put your OPENAI_API_KEY and DATABASE_URL
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs — tests: `pytest`

### 3. Frontend

```bash
cd Frontend
npm install
npm run dev
```

Open http://localhost:5173 (Vite forwards `/api` to the backend).

### Postman

Import `Backend/ChatGPT-Clone.postman_collection.json`, then run the collection
(it creates a conversation, checks the context is kept, renames and deletes it).

---

## Security

- The OpenAI key exists only in `Backend/.env`, which is listed in `.gitignore` and readable only by its owner (`chmod 600`).
- A git hook (`.githooks/pre-commit`, enabled with `git config core.hooksPath .githooks`) refuses any commit containing a `.env` file or anything that looks like an OpenAI key.
- The key itself is a **restricted** key (model requests only, nothing else), expires after 90 days, and the OpenAI project has a monthly budget limit.
- The key is never logged, never returned by the API (`/api/health` only says whether it is configured), and OpenAI error messages are translated before reaching the browser.
- The browser never calls OpenAI; it only calls this REST API.
- The database user `chat_app` only has `SELECT, INSERT, UPDATE, DELETE` on `chatgpt_clone`.
- Input validation (Pydantic), message size limit, per-IP rate limit, restricted CORS.
- Markdown is rendered without raw HTML (no XSS from model output).

---

## Author

**Mordehai Levy** — Full Stack Web Developer program, John Bryce.
