# StudyAI

Single-page app: FastAPI backend (`api/index.py`) + vanilla HTML/CSS/JS frontend (`index.html`, `static/`). AI reading-comprehension quiz generator deployed on Vercel.

## Stack & Setup

- **Python 3.9+** with `pip install -r requirements.txt`
- API key in `.env`: `MY_API_KEY=...` (uses NVIDIA's Llama 3.3 70B via OpenAI-compatible SDK — **not** OpenAI's API)
- Local dev: `uvicorn api.index:app --reload` (serves on `:8000`)
- **macOS `--reload` freeze fix**: `pip uninstall watchfiles` — uvicorn falls back to a stable polling reloader. The `watchfiles` native watcher can hang the worker process on macOS.

## Architecture

- **No build step, no framework** — CSS is custom "Digital Papercraft" design system; JS is a single IIFE with no dependencies
- Frontend auto-detects local vs Vercel: uses `http://localhost:8000/api` on localhost, `/api` on production
- Fallback demo quiz (`generateDemoQuiz` in `static/script.js:455`) runs when backend is unreachable
- `renderQuiz()` uses `textContent` / DOM methods only (no `innerHTML`) — preserve this pattern

## API Endpoints (all in `api/index.py`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/generate-quiz` | Generate quiz from text |
| POST | `/api/summarize` | Summarize passage |
| POST | `/api/generate-custom-quiz` | Generate quiz from topic (LLM generates passage + questions in one call, uses `meta/llama-3.1-8b-instruct` for speed) |
| GET | `/api/health` | Health check |
| POST | `/api/upload-pdf` | Extract text from PDF (PyMuPDF) |
| POST | `/api/fetch-url` | Extract text from URL (httpx + BeautifulSoup) |

## Deploy

`vercel.json` routes `api/index.py` as serverless function and `static/**` + `index.html` as static assets.

## Key conventions

- No tests, no lint/typecheck config — manual verification only
- LLM prompt output is parsed as JSON; the `parse_llm_response` function strips markdown fences
- The `DESIGN.md` file is the design system reference (colors, typography, spacing)
- `screen1.png` / `screen2.png` are design mockups
