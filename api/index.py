from fastapi import FastAPI, HTTPException, File, UploadFile, Form, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import json
import re
import os
import fitz  # PyMuPDF
import httpx
from bs4 import BeautifulSoup

from dotenv import load_dotenv, find_dotenv
from openai import OpenAI

load_dotenv(find_dotenv())

# ── LLM Client ───────────────────────────────────────────────
client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=os.getenv("MY_API_KEY"),
)

# ── FastAPI App ───────────────────────────────────────────────
app = FastAPI(
    title="StudyAI API",
    description="AI-powered reading comprehension quiz generator",
    version="1.0.0",
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Models ────────────────────────────────────────────────────
class QuizRequest(BaseModel):
    text: str = Field(..., min_length=50, description="Source text for quiz generation")
    num_questions: int = Field(default=10, ge=3, le=25)
    complexity: str = Field(default="middle", pattern="^(elementary|middle|high|test-prep)$")
    focus_area: str = Field(default="balanced")
    question_types: List[str] = Field(default=["mcq"])


class Question(BaseModel):
    id: int
    question_text: str
    question_type: str = Field(default="mcq", pattern="^(mcq|true-false|short-answer|fill-blank|multiple-select|evidence)$")
    options: List[str] = Field(default_factory=list)
    correct_option: Optional[int] = None  # index for mcq/true-false/multiple-select
    correct_answer: Optional[str] = None  # expected text for short-answer/fill-blank
    explanation: str
    evidence: Optional[str] = None
    category: Optional[str] = None


class QuizResponse(BaseModel):
    title: str
    passage: str  # HTML-formatted passage text
    passage_raw: str  # Original raw text
    questions: List[Question]
    settings: dict


# ── Quiz Generation Endpoint ─────────────────────────────────
@app.post("/api/generate-quiz", response_model=QuizResponse)
async def generate_quiz(request: QuizRequest):
    """Generate a comprehension quiz from the provided text using an LLM."""

    prompt = build_prompt(request)

    try:
        completion = client.chat.completions.create(
            model="meta/llama-3.3-70b-instruct",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert educational assessment designer specializing in "
                        "reading comprehension. Generate high-quality, pedagogically sound quiz "
                        "questions that test genuine understanding of the provided text. "
                        "Always respond with valid JSON only, no additional text."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            top_p=0.8,
            max_tokens=4096,
            stream=False,
        )

        response_text = completion.choices[0].message.content.strip()
        quiz_data = parse_llm_response(response_text, request)
        return quiz_data

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Quiz generation failed: {str(e)}",
        )


def build_prompt(request: QuizRequest) -> str:
    """Construct the LLM prompt for quiz generation."""

    complexity_desc = {
        "elementary": "elementary school level (grades 4-6), using simple vocabulary and straightforward questions",
        "middle": "middle school level (grades 6-8), with moderate complexity and some inferential questions",
        "high": "high school level (grades 9-12), with complex analysis and critical thinking questions",
        "test-prep": "standardized test prep level, with rigorous, exam-style questions requiring deep analysis",
    }

    focus_desc = {
        "balanced": "a balanced mix of detail, main idea, inference, author's purpose, vocabulary, and structure",
        "main-idea": "primarily main idea and central theme identification",
        "inference": "primarily inferential and analytical questions",
        "vocabulary": "primarily vocabulary-in-context questions",
        "detail": "primarily detail recall and evidence-based questions",
        "authors-purpose": "primarily author's purpose, tone, and rhetorical strategy questions",
        "structure": "primarily text structure and organization questions",
    }

    type_desc = ", ".join(request.question_types) if request.question_types else "multiple choice"

    return f"""Based on the following passage, generate exactly {request.num_questions} reading comprehension questions.

**Complexity:** {complexity_desc.get(request.complexity, complexity_desc["middle"])}
**Focus:** {focus_desc.get(request.focus_area, focus_desc["balanced"])}
**Question Types:** {type_desc}

**PASSAGE:**
{request.text}

**MIX QUESTION TYPES:** Produce a variety of question types. Do NOT make all questions the same type. Distribute these types across the quiz:
- **mcq** — standard multiple choice, 4 options, one correct (has "options" + "correct_option")
- **true-false** — statement to judge true/false (has "options":["True","False"], "correct_option": 0 or 1)
- **short-answer** — user writes a short response (omit "options", provide "correct_answer")
- **fill-blank** — sentence with a missing word/phrase marked as _____ (omit "options", provide "correct_answer")
- **multiple-select** — multiple correct answers from a list (has "options" + "correct_option" as any valid index)
- **evidence** — user answers and provides supporting evidence from the passage (omit "options", provide "correct_answer", and include "evidence")

**AVOID REPETITION:** Each question must feel distinct from the one before it. Vary the sentence structure, what aspect of the passage is tested, and the question type. Never repeat the same question format more than twice consecutively.

**OUTPUT FORMAT:** Respond with a JSON object with this exact structure:
{{
  "title": "A short descriptive title for this quiz based on the passage topic",
  "questions": [
    {{
      "id": 1,
      "question_type": "mcq",
      "question_text": "The question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_option": 0,
      "explanation": "Why this answer is correct, referencing the passage",
      "evidence": "The exact sentence or phrase from the passage that supports the answer",
      "category": "detail|main-idea|inference|authors-purpose|vocabulary|structure"
    }}
  ]
}}

TYPE-SPECIFIC RULES:
- For mcq and multiple-select: include "options" (array) and "correct_option" (0-based index)
- For true-false: include "options": ["True", "False"] and "correct_option" (0=True, 1=False)
- For short-answer, fill-blank, and evidence: include "correct_answer" (string) and omit "options" (use empty array [])
- The "question_type" field is REQUIRED for every question
- Evidence must be an exact quote from the passage
- Explanations should be educational and reference specific parts of the text
- For longer quizzes (10+ questions) use all five types at least once
- Respond with ONLY the JSON object, no markdown formatting or additional text"""


def parse_llm_response(response_text: str, request: QuizRequest) -> QuizResponse:
    """Parse the LLM's JSON response into a QuizResponse."""

    # Clean up potential markdown code fences
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse LLM response as JSON: {str(e)}",
        )

    # Build passage HTML
    paragraphs = request.text.strip().split("\n\n")
    passage_html = "".join(f"<p>{p.strip()}</p>" for p in paragraphs if p.strip())

    # Build questions
    questions = []
    for q in data.get("questions", []):
        q_type = q.get("question_type", "mcq")
        questions.append(
            Question(
                id=q["id"],
                question_text=q["question_text"],
                question_type=q_type,
                options=q.get("options", []),
                correct_option=q.get("correct_option"),
                correct_answer=q.get("correct_answer"),
                explanation=q.get("explanation", ""),
                evidence=q.get("evidence", ""),
                category=q.get("category", "detail"),
            )
        )

    return QuizResponse(
        title=data.get("title", "Reading Comprehension Quiz"),
        passage=passage_html,
        passage_raw=request.text,
        questions=questions,
        settings={
            "num_questions": request.num_questions,
            "complexity": request.complexity,
            "focus_area": request.focus_area,
            "question_types": request.question_types,
        },
    )


# ── Summarize Endpoint ────────────────────────────────────────
class SummarizeRequest(BaseModel):
    text: str = Field(..., min_length=50, description="Text to summarize")
    length: str = Field(default="standard", pattern="^(brief|standard|detailed)$")


@app.post("/api/summarize")
async def summarize_text(request: SummarizeRequest):
    """Summarize the provided text using an LLM."""

    length_instructions = {
        "brief": "Provide a very concise summary in 2-3 sentences. Focus only on the single most important point.",
        "standard": "Provide a clear summary in 1-2 short paragraphs. Cover the main ideas and key supporting details.",
        "detailed": "Provide a thorough summary in 2-3 paragraphs. Cover all main ideas, key details, supporting evidence, and the author's perspective.",
    }

    prompt = f"""Summarize the following passage.

**Instructions:** {length_instructions.get(request.length, length_instructions["standard"])}

**PASSAGE:**
{request.text}

Respond with ONLY the summary text. Do not include any labels, prefixes like "Summary:", or markdown formatting."""

    try:
        completion = client.chat.completions.create(
            model="meta/llama-3.3-70b-instruct",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert reading comprehension assistant. "
                        "Provide clear, accurate, and well-structured summaries "
                        "that capture the essential meaning of the source text. "
                        "Respond with only the summary text, no additional formatting."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            top_p=0.8,
            max_tokens=1024,
            stream=False,
        )

        summary = completion.choices[0].message.content.strip()
        return {"summary": summary}

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Summarization failed: {str(e)}",
        )


# ── Custom Quiz Generation Endpoint ──────────────────────────
class CustomQuizRequest(BaseModel):
    topic: str = Field(..., min_length=2, description="Topic to research and generate a quiz about")
    custom_prompt: str = Field(..., min_length=1, max_length=500, description="User's custom instructions for quiz generation")
    num_questions: int = Field(default=10, ge=3, le=25)
    complexity: str = Field(default="middle", pattern="^(elementary|middle|high|test-prep)$")
    focus_area: str = Field(default="balanced")
    question_types: List[str] = Field(default=["mcq"])


def sanitize_custom_prompt(prompt: str) -> str:
    """Sanitize the user's custom prompt by stripping control characters and limiting length."""
    sanitized = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', prompt)
    return sanitized[:500].strip()


@app.post("/api/generate-custom-quiz", response_model=QuizResponse)
async def generate_custom_quiz(request: CustomQuizRequest):
    """Generate a quiz about a topic in a single LLM call — the model generates a passage and questions together."""

    sanitized_prompt = sanitize_custom_prompt(request.custom_prompt)

    if not sanitized_prompt:
        raise HTTPException(
            status_code=400,
            detail="Custom prompt cannot be empty after sanitization.",
        )

    complexity_desc = {
        "elementary": "elementary school level (grades 4-6), simple vocabulary, straightforward questions",
        "middle": "middle school level (grades 6-8), moderate complexity, some inference",
        "high": "high school level (grades 9-12), complex analysis, critical thinking",
        "test-prep": "standardized test prep level, rigorous exam-style questions requiring deep analysis",
    }

    focus_desc = {
        "balanced": "detail, main idea, inference, author's purpose, vocabulary, and structure",
        "main-idea": "main idea and central theme identification",
        "inference": "inferential and analytical questions",
        "vocabulary": "vocabulary-in-context questions",
        "detail": "detail recall and evidence-based questions",
        "authors-purpose": "author's purpose, tone, and rhetorical strategy questions",
        "structure": "text structure and organization questions",
    }

    type_desc = ", ".join(request.question_types)

    prompt = f"""You are a quiz generator. Create a quiz on "{request.topic}".

Make {request.num_questions} questions about this topic.

Style: {complexity_desc.get(request.complexity)}. Focus: {focus_desc.get(request.focus_area)}. Types: {type_desc}.
Custom instructions: {sanitized_prompt}

MIX QUESTION TYPES: Do NOT make all questions multiple choice. Distribute these types:
- **mcq** — multiple choice, 4 options ("options" + "correct_option" index)
- **true-false** — true/false statement ("options":["True","False"], "correct_option":0 or 1)
- **short-answer** — user writes a response (provide "correct_answer" string, "options":[])
- **fill-blank** — sentence with _____ blank (provide "correct_answer" string, "options":[])
- **evidence** — user answers and cites passage evidence (provide "correct_answer" string, omit "options")

Vary the type every 1-2 questions. Do not repeat the same question structure consecutively.
Each question must test a different fact or concept about the topic.

Output ONLY valid JSON (keep everything concise):
{{"title":"quiz title","questions":[{{"id":1,"question_type":"mcq","question_text":"question","options":["A","B","C","D"],"correct_option":0,"correct_answer":null,"explanation":"brief","category":"detail"}}]}}"""

    try:
        completion = client.chat.completions.create(
            model="meta/llama-3.1-8b-instruct",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert educational assessment designer. Always respond with valid JSON only, no additional text.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            top_p=0.8,
            max_tokens=min(512 + request.num_questions * 150, 4096),
            stream=False,
        )

        response_text = completion.choices[0].message.content.strip()

        cleaned = response_text
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)

        data = json.loads(cleaned)

        if not data.get("questions"):
            raise HTTPException(
                status_code=502,
                detail=f"Failed to generate questions about '{request.topic}'. Try a more specific topic.",
            )

        quiz_request = QuizRequest(
            text=f"Custom quiz on the topic of: {request.topic}. This quiz tests knowledge about this subject.",
            num_questions=request.num_questions,
            complexity=request.complexity,
            focus_area=request.focus_area,
            question_types=request.question_types,
        )

        quiz_data = parse_llm_response(json.dumps(data), quiz_request)
        return quiz_data

    except HTTPException:
        raise
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse LLM response as JSON: {str(e)}",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Custom quiz generation failed: {str(e)}",
        )


# ── Static Files (local dev) ─────────────────────────────────
_api_dir = os.path.dirname(os.path.abspath(__file__))
_root_dir = os.path.dirname(_api_dir)

# Serve index.html at root
@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(_root_dir, "index.html"))

# Mount /static for local dev (Vercel handles this in production)
app.mount("/static", StaticFiles(directory=os.path.join(_root_dir, "static")), name="static")


# ── Health Check ──────────────────────────────────────────────
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "StudyAI API"}


# ── PDF Upload Endpoint ───────────────────────────────────────
@app.post("/api/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    try:
        content = await file.read()
        doc = fitz.open(stream=content, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text() + "\n"
        doc.close()
        
        if not text.strip():
            raise HTTPException(status_code=400, detail="No readable text found in PDF.")
            
        return {"text": text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {str(e)}")


class UrlRequest(BaseModel):
    url: str

# ── URL Fetch Endpoint ────────────────────────────────────────
@app.post("/api/fetch-url")
async def fetch_url(request: UrlRequest):
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
            # Provide a user-agent to avoid simple blocks
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
            response = await client.get(request.url, headers=headers)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Remove script, style, nav, header, footer elements
            for element in soup(["script", "style", "nav", "header", "footer", "aside"]):
                element.decompose()
                
            # Extract text
            text = soup.get_text(separator='\n\n')
            
            # Clean up excessive newlines and spaces
            lines = (line.strip() for line in text.splitlines())
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            text = '\n\n'.join(chunk for chunk in chunks if chunk)
            
            if not text.strip():
                raise HTTPException(status_code=400, detail="No readable text found at URL.")
                
            return {"text": text.strip()}
            
    except httpx.HTTPError as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error extracting text from URL: {str(e)}")


# ── AI Answer Grading Endpoint ──────────────────────────────────
class GradeRequest(BaseModel):
    question_text: str = Field(..., min_length=1)
    question_type: str = Field(default="short-answer")
    student_answer: str = Field(..., min_length=1)
    passage: str = Field(..., min_length=10)
    correct_answer: Optional[str] = None
    options: List[str] = Field(default_factory=list)
    correct_option: Optional[int] = None
    evidence: Optional[str] = None
    student_evidence: Optional[str] = None


class GradeResponse(BaseModel):
    is_correct: bool
    feedback: str
    score: float = Field(..., ge=0.0, le=1.0)


@app.post("/api/grade-answer", response_model=GradeResponse)
async def grade_answer(request: GradeRequest):
    """Use the LLM to evaluate a student's free-response answer."""

    prompt = build_grade_prompt(request)

    try:
        completion = client.chat.completions.create(
            model="meta/llama-3.3-70b-instruct",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a fair and constructive educational assessment grader. "
                        "Evaluate the student's answer against the expected answer and passage. "
                        "Grade leniently for partial understanding. Always respond with valid JSON only."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            top_p=0.8,
            max_tokens=512,
            stream=False,
        )

        response_text = completion.choices[0].message.content.strip()

        cleaned = response_text
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)

        data = json.loads(cleaned)

        return GradeResponse(
            is_correct=data.get("is_correct", False),
            feedback=data.get("feedback", "No feedback provided."),
            score=min(1.0, max(0.0, float(data.get("score", 0.0)))),
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Grading failed: {str(e)}",
        )


def build_grade_prompt(request: GradeRequest) -> str:
    """Construct the LLM prompt for grading a student answer."""

    type_instructions = {
        "short-answer": (
            "Evaluate the student's short-answer response. "
            "Consider whether they captured the key idea even if phrasing differs."
        ),
        "evidence": (
            "Evaluate both the student's answer AND the evidence they cited from the passage. "
            "The student's evidence must be a direct quote or close paraphrase from the passage that supports their answer."
        ),
        "fill-blank": (
            "Evaluate the student's fill-in-the-blank response. "
            "Accept close synonyms and minor spelling variations."
        ),
    }

    type_instr = type_instructions.get(
        request.question_type,
        "Evaluate the student's response for correctness based on the passage.",
    )

    evidence_section = ""
    if request.student_evidence and request.question_type == "evidence":
        evidence_section = f"\nEvidence cited by student:\n{request.student_evidence}"

    return f"""Evaluate this student's answer based on the passage.

Passage excerpt:
{request.passage[:1500]}

Question: {request.question_text}
Expected answer: {request.correct_answer or "See passage"}
Student's answer: {request.student_answer}{evidence_section}

{type_instr}

Respond with JSON only:
{{"is_correct": true/false, "feedback": "Constructive feedback (1-2 sentences)", "score": 0.0-1.0}}"""
