# Cortanyx — ChatGPT Clone

**Full Stack Web Developer final project — Mordehai Levy**

A ChatGPT-style web app that holds a continuous conversation with an AI model.
React SPA → Python FastAPI REST API → MySQL, with OpenAI called **only from the server**.

**GitHub:** https://github.com/mordehailevy/cortanyx

![Cortanyx - chat with history, Markdown, code and the conversation thread](docs/screenshots/chat-light.jpg)

| Hebrew, dark theme, highlighted code | Mobile menu (pinned + recents) | About page |
|---|---|---|
| ![Hebrew conversation in dark theme](docs/screenshots/chat-dark-hebrew.jpg) | ![Mobile layout](docs/screenshots/mobile.jpg) | ![About page](docs/screenshots/about.jpg) |

---

## Features

| Required by the brief | How it is done |
|---|---|
| Continuous conversation with context | Every message is saved in MySQL; the server sends the whole conversation (sliding window of the last 40 messages) + a system prompt to OpenAI |
| User messages on one side, chat on the other | User bubbles on the right, assistant on the left |
| "New conversation" button | "New chat" at the top of the sidebar (and in the mobile top bar). Each conversation also has its own URL (`/chat/<id>`), so reloading it reopens it, which the brief allows |
| OpenAI called from the server only | `Backend/app/services/openai_service.py` is the only module that talks to OpenAI |
| API key in a server-side `.env` | `Backend/.env` (ignored by git), template in `Backend/.env.example` |
| `requirements.txt` | `Backend/requirements.txt` (pinned versions) |
| Home page, About page, main menu | `/` (chat) and `/about`; the main menu is the sidebar: "New chat" (home page) and "About" |
| Database: who wrote each message, and which conversation | `messages.role` = `user` / `assistant`, `messages.conversation_id` → `conversations.id` (UUID) |

**Extras**

- **Streaming** answers word by word (Server-Sent Events) with a **Stop** button. Stopped mid-answer, the partial answer is kept (and marked *Stopped*) so the context stays exact; stopped before the first word, the question is removed.
- **Regenerate** the last answer (after a Stop, a cut connection, or just to get another version); the old answer is replaced only once the new one exists.
- **Markdown** rendering: tables, lists, **syntax-highlighted code** with a copy button.
- **Any language**: the model answers in the user's language, and every message sets its own direction automatically (`dir="auto"`, Hebrew and Arabic right-to-left).
- **Claude-style sidebar**: collapsible, **pinned** and recent conversations (**drag and drop** with the mouse to pin, reorder or unpin; *Move up / Move down* in the menu for keyboard and touch), search, per-conversation menu (pin, rename, delete), AI-generated titles, a URL per conversation (`/chat/<id>`).
- Clear **error handling**: missing or invalid key, quota, network: friendly message + **Retry**; a failed message is rolled back so the database never holds unanswered messages.
- **Spending guards**: 20 messages per minute per client, a daily token budget (`DAILY_TOKEN_BUDGET`) read from a usage log that deleting or regenerating cannot reset, 8000-character messages, context capped at 40 messages and 48 000 characters.
- **Visual identity "nodes and threads"**, taken from the logo: the conversation is drawn as a thread with one node per message (hollow: you, filled: Cortanyx; pointing at a question lights the thread to its answer), a light runs along the M while Cortanyx thinks, the streaming caret is a breathing node, and the home logo weaves itself once per visit. CSS and Framer Motion only; every animation stops with *reduced motion*.
- **Light / dark theme**, responsive 375 → 1440 px, accessible (WCAG 2.1 AA contrast, full keyboard use, focus kept in dialogs and the mobile drawer, screen-reader labels, `lang="he"` on Hebrew text, `prefers-reduced-motion`).
- **65 automated tests**: 46 server tests (pytest, fake OpenAI client: no network, no cost) for context, streaming contract (Stop before / during an answer), regenerate, pinning, validation, limits, security; and 19 browser-side tests (Vitest) for the streaming reader, the pinned order (drag and drop, search filter) and the plain-text fallback shown while Markdown loads.
- **Postman collection** (18 requests with test scripts, including the SSE stream) and interactive Swagger docs at `/docs`.
- **Audited** before delivery by 7 specialised review agents (brief compliance, senior code review, real users, security, design and accessibility, the course grader, QA), round after round until all of them validated the project.

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
pinned      BOOLEAN                   content          MEDIUMTEXT
pin_order   INT NULL (sidebar order)  tokens           INT NULL
created_at  DATETIME(3)               interrupted      BOOLEAN (stopped by the user)
updated_at  DATETIME(3)               created_at       DATETIME(3)
```

A third table, **`usage_log`**, records the tokens of every OpenAI call (answer, regeneration, title, stopped answer). It is not linked to conversations on purpose: deleting a conversation must not reset the daily budget.

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
| GET | `/api/conversations?limit=100` | List conversations: pinned first, then most recent activity (max 500) |
| GET | `/api/conversations/{id}` | One conversation with all its messages |
| PATCH | `/api/conversations/{id}` | Rename and/or pin (`{"title": "...", "pinned": true}`) |
| PUT | `/api/conversations/pinned-order` | Reorder the pinned conversations (`{"ids": [...]}`, first to last) |
| DELETE | `/api/conversations/{id}` | Delete (messages are deleted in cascade) |
| POST | `/api/conversations/{id}/messages` | Send a message, get the full answer (JSON) |
| POST | `/api/conversations/{id}/messages/stream` | Send a message, stream the answer (SSE: `user_message`, `delta`, `done`, `title`, `error`) |
| POST | `/api/conversations/{id}/regenerate` | Replace the last answer with a new one (SSE; 409 if there is no question to answer) |

---

## Project structure

```
MordehaiLevy/
├── Database/
│   ├── schema.sql              # tables + readable view
│   ├── chatgpt_clone.sql       # full export (structure + sample data)
│   └── migrations/             # upgrade an older database without re-importing
├── Backend/                    # FastAPI
│   ├── app/
│   │   ├── main.py             # app, CORS, error handlers, /api/health
│   │   ├── config.py           # settings from .env
│   │   ├── database.py         # SQLAlchemy engine/session
│   │   ├── models.py           # ORM models
│   │   ├── schemas.py          # request/response validation (Pydantic)
│   │   ├── prompts.py          # system prompt + title prompt
│   │   ├── rate_limit.py       # per-client limit + daily token budget
│   │   ├── security.py         # body size limit + security headers
│   │   ├── routers/conversations.py
│   │   └── services/           # openai_service.py, conversation_service.py
│   ├── tests/                  # pytest
│   ├── requirements.txt        # app dependencies (requirements-dev.txt adds the test tools)
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

**Requirements:** Python 3.10+, Node.js 20+, MySQL 8+, and an **OpenAI API key** (without a key everything works except the answers, which show a clear "not configured" message).

### 1. Database

Import the export (structure + view + sample conversations). Drop `-p` if your local `root` has no password.

```bash
mysql -u root -p < Database/chatgpt_clone.sql
```

(`Database/schema.sql` creates the same structure without data. Both **drop and recreate** the `chatgpt_clone` database tables. A database created before drag and drop is upgraded, without losing data, by `Database/migrations/001_pin_order.sql`.)

The app connects with its own user, which only gets data rights. Create it (or put your own user in `DATABASE_URL`):

```bash
mysql -u root -p -e "CREATE USER 'chat_app'@'localhost' IDENTIFIED BY 'choose_a_password'; GRANT SELECT,INSERT,UPDATE,DELETE ON chatgpt_clone.* TO 'chat_app'@'localhost';"
```

No MySQL installed? `docker compose up -d` starts one on port 3307, already initialised; then use
`DATABASE_URL=mysql+pymysql://chat_app:chat_app_password@localhost:3307/chatgpt_clone?charset=utf8mb4`.

### 2. Backend

```bash
cd Backend
python3 -m venv env
source env/bin/activate          # Windows: env\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # then put your OPENAI_API_KEY and DATABASE_URL (chat_app password)
uvicorn app.main:app --reload --port 8000 --no-proxy-headers
```

API docs: http://localhost:8000/docs. Tests: `pip install -r requirements-dev.txt` then `pytest`.
(`--no-proxy-headers`: the per-client limit uses the real address, a client cannot fake it with `X-Forwarded-For`.)

### 3. Frontend

```bash
cd Frontend
npm install
npm run dev
```

Open http://localhost:5173 (Vite forwards `/api` to the backend). Front-end tests: `npm test`.

### Postman

Import `Backend/ChatGPT-Clone.postman_collection.json`, then run the collection
(it creates a conversation, checks the context is kept, streams and regenerates an answer, renames, pins and deletes it).
From the command line: `npx newman run Backend/ChatGPT-Clone.postman_collection.json`.


---

### Manual checks (browser)

The server is covered by pytest; these user flows are checked by hand before each release:

1. Send a message, then a follow-up that depends on it: the answer uses the context.
2. Press **Stop** mid-answer: the partial answer stays, marked *Stopped*; **Regenerate** replaces it.
3. Press **Stop** before the first word (or stop the server): the question disappears and its text comes back in the input.
4. While an answer is streaming (or right after pressing Enter on a new chat), open another conversation: the URL, title and messages are those of the new one.
5. Browser **Back** / **Forward** between `/` and conversations: the screen always matches the URL.
6. Delete the open conversation, open `/chat/unknown-id`: you land on a new chat ("Conversation not found." for the bad link).
7. Drag a recent conversation into Pinned (a blue line shows where it lands), reorder it, drag it back to Recents.
8. Mobile width: open the menu, a conversation's "…" menu, Rename, then Escape: only the dialog closes and focus goes back to the "…" button.

---

## Security

- The OpenAI key exists only in `Backend/.env`, which is listed in `.gitignore` and readable only by its owner (`chmod 600`).
- A git hook (`.githooks/pre-commit`, enabled with `git config core.hooksPath .githooks`) refuses any commit containing a `.env` file or anything that looks like an OpenAI key.
- The key itself is a **restricted** key (model requests only, nothing else), expires after 90 days, and the OpenAI project has a monthly budget limit.
- The key is never logged, never returned by the API (`/api/health` only says whether it is configured), and OpenAI error messages are translated before reaching the browser.
- The browser never calls OpenAI; it only calls this REST API.
- The database user `chat_app` only has `SELECT, INSERT, UPDATE, DELETE` on `chatgpt_clone`.
- Input validation (Pydantic), message size limit, 64 KB request limit, per-client rate limit, daily token budget, restricted CORS, allowed host names (`ALLOWED_HOSTS`), `nosniff` / `no-referrer` / `DENY` headers, validation errors never echo the submitted data.
- Markdown is rendered without raw HTML and images become links (no XSS, no automatic loading of URLs chosen by the model).
- **Single-user, local app**: there are no accounts, so anyone who can reach the API sees every conversation. The API listens on `127.0.0.1` only. Before putting it online: add authentication (a `user_id` per conversation), serve it behind HTTPS with `--forwarded-allow-ips=<proxy>`, and set `ENABLE_DOCS=false`.

## Design choices

- The interface is in English; conversations work in any language (the model answers in the user's language, Hebrew is shown right-to-left).
- Search filters conversation **titles** (the 100 most recent conversations are loaded; `?limit=` goes up to 500).
- Dates are stored in the server's local time and always returned by the API in UTC (`2026-10-30T00:21:09.409Z`).
- The context sent to the model is the last 40 messages, capped at 48 000 characters (about 12 000 tokens).

---

## Author

**Mordehai Levy** — Full Stack Web Developer program, John Bryce.
