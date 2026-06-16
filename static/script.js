 /* ============================================================
   StudyAI — Main Application Logic
   ============================================================ */

(() => {
  'use strict';

  // ── Configuration ──────────────────────────────────────────
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const API_BASE = isLocal ? 'http://localhost:8000/api' : '/api';

  // ── State ──────────────────────────────────────────────────
  const state = {
    currentView: 'generator',
    quizSource: 'generator',
    quizData: null,
    currentQuestion: 0,
    answers: {},
    bookmarked: new Set(),
    timer: { seconds: 0, interval: null },
    isSubmitted: {},
    correctCount: 0,
    gradeResults: {},
    evidenceAnswers: {},
  };

  // ── DOM References ─────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // Views
  const generatorView = $('#generator-view');
  const summarizerView = $('#summarizer-view');
  const customTestView = $('#custom-test-view');
  const quizView = $('#quiz-view');
  const generatingOverlay = $('#generating-overlay');
  const generatingOverlayText = $('#generating-overlay-text');
  const generatingOverlaySubtext = $('#generating-overlay-subtext');
  const resultsOverlay = $('#results-overlay');

  // Generator controls
  const sourceText = $('#source-text');
  const charCount = $('#char-count');
  const numQuestions = $('#num-questions');
  const complexityLevel = $('#complexity-level');
  const focusArea = $('#focus-area');
  const btnGenerate = $('#btn-generate');

  // Summarizer controls
  const summarizerText = $('#summarizer-text');
  const summarizerCharCount = $('#summarizer-char-count');
  const btnSummarize = $('#btn-summarize');
  const summaryResult = $('#summary-result');
  const summaryTextOutput = $('#summary-text-output');
  const btnCopySummary = $('#btn-copy-summary');
  const summarizerError = $('#summarizer-error');
  const summarizerErrorText = $('#summarizer-error-text');

  // Custom test controls
  const customTestTopic = $('#custom-test-topic');
  const customPromptInput = $('#custom-prompt-input');
  const customPromptCharCount = $('#custom-prompt-char-count');
  const customNumQuestions = $('#custom-num-questions');
  const customComplexityLevel = $('#custom-complexity-level');
  const customFocusArea = $('#custom-focus-area');
  const customQuestionTypes = $('#custom-question-types');
  const btnCustomGenerate = $('#btn-custom-generate');
  const customTestError = $('#custom-test-error');
  const customTestErrorText = $('#custom-test-error-text');

  // Quiz controls
  const quizTitleBar = $('#quiz-title-bar');
  const progressLabel = $('#progress-label');
  const progressBar = $('#progress-bar');
  const progressPercent = $('#progress-percent');
  const timerDisplay = $('#timer-display');
  const passageTitle = $('#passage-title');
  const passageText = $('#passage-text');
  const questionText = $('#question-text');
  const answerOptions = $('#answer-options');
  const btnSubmitAnswer = $('#btn-submit-answer');
  const feedbackContainer = $('#feedback-container');
  const btnBookmark = $('#btn-bookmark');
  const btnSaveExit = $('#btn-save-exit');

  // Results
  const resultsScore = $('#results-score');
  const resultsCorrect = $('#results-correct');
  const resultsTime = $('#results-time');
  const resultsEmoji = $('#results-emoji');
  const resultsTitle = $('#results-title');
  const resultsSubtitle = $('#results-subtitle');
  const btnReviewQuiz = $('#btn-review-quiz');
  const btnBackToLab = $('#btn-back-to-lab');

  // ── Initialize ─────────────────────────────────────────────
  function init() {
    bindEvents();
  }

  // ── Event Bindings ─────────────────────────────────────────
  function bindEvents() {
    // Character counts
    sourceText.addEventListener('input', () => {
      const len = sourceText.value.length;
      charCount.textContent = `${len.toLocaleString()} character${len !== 1 ? 's' : ''}`;
    });

    summarizerText.addEventListener('input', () => {
      const len = summarizerText.value.length;
      summarizerCharCount.textContent = `${len.toLocaleString()} character${len !== 1 ? 's' : ''}`;
    });

    customPromptInput.addEventListener('input', () => {
      const len = customPromptInput.value.length;
      customPromptCharCount.textContent = `${len} / 500 characters`;
    });

    // Question type chips (toggle)
    $$('#question-types .chip, #custom-question-types .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        chip.classList.toggle('active');
      });
    });

    // Summary length chips (single select)
    $$('#summary-length-chips .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        $$('#summary-length-chips .chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      });
    });

    // Prompt suggestion chips
    $$('#prompt-suggestions .prompt-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        // Deselect all others
        $$('#prompt-suggestions .prompt-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
        // Fill the custom prompt textarea
        customPromptInput.value = chip.dataset.prompt;
        const len = customPromptInput.value.length;
        customPromptCharCount.textContent = `${len} / 500 characters`;
      });
    });

    // Navigation (all nav-link buttons across all views)
    $$('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        const targetView = link.dataset.view;
        if (targetView) {
          switchView(targetView);
        }
      });
    });

    // Generate quiz
    btnGenerate.addEventListener('click', handleGenerate);

    // Summarize
    btnSummarize.addEventListener('click', handleSummarize);

    // Custom test generate
    btnCustomGenerate.addEventListener('click', handleCustomGenerate);

    // Copy summary
    btnCopySummary.addEventListener('click', handleCopySummary);

    // Quiz controls
    btnSubmitAnswer.addEventListener('click', handleSubmitAnswer);
    btnBookmark.addEventListener('click', handleBookmark);
    btnSaveExit.addEventListener('click', handleSaveExit);

    // Results actions
    btnBackToLab.addEventListener('click', () => {
      resultsOverlay.classList.remove('active');
      switchView(state.quizSource);
    });
    btnReviewQuiz.addEventListener('click', () => {
      resultsOverlay.classList.remove('active');
      // Go back to first question in review mode
      state.currentQuestion = 0;
      renderQuestion();
    });

    // Hint FAB
    $('#btn-hint').addEventListener('click', handleHint);

  }

  // ── View Switching ─────────────────────────────────────────
  function switchView(view) {
    state.currentView = view;

    // Hide all views
    generatorView.classList.remove('active');
    summarizerView.classList.remove('active');
    customTestView.classList.remove('active');
    quizView.classList.remove('active');

    // Show the target view
    if (view === 'generator') {
      generatorView.classList.add('active');
      stopTimer();
    } else if (view === 'summarizer') {
      summarizerView.classList.add('active');
      stopTimer();
    } else if (view === 'custom-test') {
      customTestView.classList.add('active');
      stopTimer();
    } else if (view === 'quiz') {
      quizView.classList.add('active');
    }

    // Update nav link active states across ALL headers
    $$('.nav-link').forEach(link => {
      if (link.dataset.view === view) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  // ── Inline Error Helpers ───────────────────────────────────
  function showInlineError(errorEl, textEl, message) {
    textEl.textContent = message;
    errorEl.style.display = 'flex';
    // Auto-hide after 6 seconds
    setTimeout(() => { errorEl.style.display = 'none'; }, 6000);
  }

  function hideInlineError(errorEl) {
    errorEl.style.display = 'none';
  }

  // ── Quiz Generation ────────────────────────────────────────
  async function handleGenerate() {
    const text = sourceText.value.trim();
    if (!text) {
      sourceText.focus();
      sourceText.style.borderColor = 'var(--error-red)';
      setTimeout(() => { sourceText.style.borderColor = ''; }, 2000);
      return;
    }

    if (text.length < 100) {
      sourceText.focus();
      sourceText.style.borderColor = 'var(--error-red)';
      setTimeout(() => { sourceText.style.borderColor = ''; }, 2000);
      return;
    }

    // Collect settings
    const settings = {
      text,
      num_questions: parseInt(numQuestions.value),
      complexity: complexityLevel.value,
      focus_area: focusArea.value,
      question_types: Array.from($$('#question-types .chip.active')).map(c => c.dataset.type),
    };

    // Show loading overlay
    generatingOverlayText.textContent = 'Crafting your quiz…';
    generatingOverlaySubtext.textContent = 'Our AI is analyzing your passage and generating pedagogically-sound questions.';
    generatingOverlay.classList.add('active');

    try {
      const quizData = await generateQuiz(settings);
      state.quizData = quizData;
      state.quizSource = 'generator';
      state.currentQuestion = 0;
      state.answers = {};
      state.isSubmitted = {};
      state.bookmarked = new Set();
      state.correctCount = 0;
      state.gradeResults = {};
      state.evidenceAnswers = {};

      // Switch to quiz view
      switchView('quiz');
      renderQuiz();
      startTimer();
    } catch (err) {
      // Use inline error instead of alert - show error via border flash
      sourceText.style.borderColor = 'var(--error-red)';
      setTimeout(() => { sourceText.style.borderColor = ''; }, 3000);
    } finally {
      generatingOverlay.classList.remove('active');
    }
  }

  async function generateQuiz(settings) {
    try {
      const response = await fetch(`${API_BASE}/generate-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      return generateDemoQuiz(settings);
    }
  }

  // ── Summarizer ─────────────────────────────────────────────
  async function handleSummarize() {
    const text = summarizerText.value.trim();
    hideInlineError(summarizerError);

    if (!text) {
      summarizerText.focus();
      summarizerText.style.borderColor = 'var(--error-red)';
      setTimeout(() => { summarizerText.style.borderColor = ''; }, 2000);
      return;
    }

    if (text.length < 50) {
      showInlineError(summarizerError, summarizerErrorText, 'Please provide at least 50 characters of text for a meaningful summary.');
      return;
    }

    // Get selected summary length
    const activeChip = $('#summary-length-chips .chip.active');
    const length = activeChip ? activeChip.dataset.length : 'standard';

    // Show loading overlay
    generatingOverlayText.textContent = 'Summarizing your passage…';
    generatingOverlaySubtext.textContent = 'Our AI is analyzing your text and generating a clear summary.';
    generatingOverlay.classList.add('active');

    try {
      const response = await fetch(`${API_BASE}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, length }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server returned ${response.status}`);
      }

      const data = await response.json();

      // Render summary using safe textContent
      summaryTextOutput.textContent = data.summary;
      summaryResult.style.display = 'block';

      // Scroll to result
      summaryResult.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (err) {
      showInlineError(summarizerError, summarizerErrorText, 'Failed to generate summary. Please check that the backend server is running and try again.');
    } finally {
      generatingOverlay.classList.remove('active');
    }
  }

  function handleCopySummary() {
    const summaryText = summaryTextOutput.textContent;
    if (!summaryText) return;

    navigator.clipboard.writeText(summaryText).then(() => {
      // Visual feedback for copy
      const copyBtn = btnCopySummary;
      copyBtn.classList.add('copied');
      const originalText = copyBtn.querySelector('.answer-option__text');

      // Change button text temporarily using safe DOM
      const spans = copyBtn.querySelectorAll('span');
      // Simple approach: just toggle a class for visual feedback
      setTimeout(() => {
        copyBtn.classList.remove('copied');
      }, 1500);
    }).catch(() => {
      // Fallback - silently fail
    });
  }

  // ── Custom Test Generation ─────────────────────────────────
  async function handleCustomGenerate() {
    const topic = customTestTopic.value.trim();
    const customPrompt = customPromptInput.value.trim();
    hideInlineError(customTestError);

    if (!topic) {
      customTestTopic.focus();
      customTestTopic.style.borderColor = 'var(--error-red)';
      setTimeout(() => { customTestTopic.style.borderColor = ''; }, 2000);
      return;
    }

    const numQ = parseInt(customNumQuestions.value);
    const complexity = customComplexityLevel.value;
    const focusArea = customFocusArea.value;
    const questionTypes = Array.from($$('#custom-question-types .chip.active')).map(c => c.dataset.type);

    // Show loading overlay
    generatingOverlayText.textContent = 'Generating your custom quiz…';
    generatingOverlaySubtext.textContent = 'Our AI is crafting a personalized quiz based on your topic.';
    generatingOverlay.classList.add('active');

    try {
      const response = await fetch(`${API_BASE}/generate-custom-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          custom_prompt: customPrompt || 'Create balanced, well-rounded comprehension questions.',
          num_questions: numQ,
          complexity,
          focus_area: focusArea,
          question_types: questionTypes.length > 0 ? questionTypes : ['mcq'],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server returned ${response.status}`);
      }

      const quizData = await response.json();
      state.quizData = quizData;
      state.quizSource = 'custom-test';
      state.currentQuestion = 0;
      state.answers = {};
      state.isSubmitted = {};
      state.bookmarked = new Set();
      state.correctCount = 0;
      state.gradeResults = {};
      state.evidenceAnswers = {};

      // Switch to quiz view
      switchView('quiz');
      renderQuiz();
      startTimer();
    } catch (err) {
      customTestErrorText.textContent = 'Failed to generate custom quiz. Please check that the backend server is running and try again.';
      customTestError.style.display = 'flex';
    } finally {
      generatingOverlay.classList.remove('active');
    }
  }

  // ── Demo Quiz (Fallback when backend is unavailable) ───────
  function generateDemoQuiz(settings) {
    const text = settings.text;
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 10);
    const numQ = Math.min(settings.num_questions, Math.max(3, Math.floor(sentences.length / 2)));

    // Extract all words for distractor generation
    const allWords = text.split(/\s+/).filter(w => w.length > 3);
    const uniqueWords = [...new Set(allWords)];

    const title = sentences[0] ? sentences[0].substring(0, 60).trim() + '…' : 'Reading Comprehension Quiz';

    const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
    const passageHTML = paragraphs.map(p => `<p>${p.trim()}</p>`).join('');

    // Cycle through question types to ensure variety
    const typeCycle = ['mcq', 'true-false', 'short-answer', 'fill-blank', 'evidence', 'mcq', 'true-false', 'short-answer', 'evidence', 'mcq', 'fill-blank', 'mcq'];

    const questions = [];
    const usedSentences = new Set();
    const usedPhrases = new Set();

    for (let i = 0; i < numQ; i++) {
      let sentIdx = i % sentences.length;
      while (usedSentences.has(sentIdx) && usedSentences.size < sentences.length) {
        sentIdx = (sentIdx + 1) % sentences.length;
      }
      usedSentences.add(sentIdx);

      const baseSentence = sentences[sentIdx] || sentences[0];
      const qType = typeCycle[i % typeCycle.length];
      const categories = ['detail', 'main-idea', 'inference', 'authors-purpose', 'vocabulary', 'structure'];
      const category = categories[i % categories.length];

      const question = generateDemoQuestion(baseSentence, i, uniqueWords, qType, category, usedPhrases);
      questions.push(question);
    }

    return {
      title: `Comprehension Quiz: ${title}`,
      passage: passageHTML,
      passage_raw: text,
      questions,
      settings,
    };
  }

  function generateDemoQuestion(sentence, index, wordPool, qType, category, usedPhrases) {
    const id = index + 1;
    const sentenceWords = sentence.split(/\s+/).filter(w => w.length > 2);
    const nouns = sentenceWords.filter(w => /^[A-Z]/.test(w) || w.length > 5);
    const keyWord = sentenceWords.length > 0 ? sentenceWords[Math.floor(Math.random() * sentenceWords.length)] : 'concept';
    const truncated = sentence.length > 80 ? sentence.substring(0, 77).trim() + '…' : sentence;

    // Pick distractors from the word pool that aren't in the current sentence
    const distractors = [];
    const pool = wordPool.filter(w => !sentenceWords.includes(w) && w !== keyWord && !usedPhrases.has(w));
    for (let d = 0; d < 3 && d < pool.length; d++) {
      const idx = Math.floor(Math.random() * pool.length);
      const pick = pool.splice(idx, 1)[0];
      usedPhrases.add(pick);
      distractors.push(pick);
    }
    while (distractors.length < 3) {
      distractors.push(['concept', 'argument', 'example', 'theory', 'analysis'][distractors.length]);
    }

    if (qType === 'true-false') {
      const isTrue = Math.random() > 0.4;
      const statement = isTrue
        ? truncated
        : `The passage states that ${keyWord} is the main cause of this phenomenon.`;
      return {
        id,
        question_type: 'true-false',
        question_text: `True or False: ${statement}`,
        options: ['True', 'False'],
        correct_option: isTrue ? 0 : 1,
        correct_answer: null,
        explanation: isTrue
          ? `This statement is true based on the passage.`
          : `This statement is false. The passage does not claim that ${keyWord} is the main cause.`,
        evidence: sentence,
        category,
      };
    }

    if (qType === 'short-answer') {
      const questionTexts = [
        `In your own words, what does the passage suggest about ${keyWord}?`,
        `According to the passage, why is ${keyWord} significant?`,
        `What conclusion can you draw from the passage about ${keyWord}?`,
        `How does the passage describe the role of ${keyWord}?`,
      ];
      const qText = questionTexts[index % questionTexts.length];
      return {
        id,
        question_type: 'short-answer',
        question_text: qText,
        options: [],
        correct_option: null,
        correct_answer: `A response that references ${keyWord} and connects it to the passage's main idea about "${truncated}"`,
        explanation: `A strong answer would reference ${keyWord} and show understanding of how it relates to the passage.`,
        evidence: sentence,
        category,
      };
    }

    if (qType === 'fill-blank') {
      // Pick a word to blank out from the sentence
      const blankCandidates = sentenceWords.filter(w => w.length > 4);
      const blankWord = blankCandidates.length > 0
        ? blankCandidates[Math.floor(Math.random() * blankCandidates.length)]
        : keyWord;
      const blankedSentence = sentence.replace(new RegExp(blankWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '_____');
      return {
        id,
        question_type: 'fill-blank',
        question_text: `Fill in the blank: ${blankedSentence}`,
        options: [],
        correct_option: null,
        correct_answer: blankWord.replace(/[^a-zA-Z'-]/g, ''),
        explanation: `The correct word is "${blankWord.replace(/[^a-zA-Z'-]/g, '')}". This word completes the sentence meaningfully.`,
        evidence: sentence,
        category,
      };
    }

    if (qType === 'evidence') {
      const questionTexts = [
        `Based on the passage, what does the text reveal about ${keyWord}? Support your answer with evidence from the passage.`,
        `How does the author develop the idea of ${keyWord} in the passage? Cite specific evidence.`,
        `What evidence from the passage supports the claim about ${keyWord}? Quote directly from the text.`,
      ];
      const qText = questionTexts[index % questionTexts.length];
      return {
        id,
        question_type: 'evidence',
        question_text: qText,
        options: [],
        correct_option: null,
        correct_answer: `A response that references ${keyWord} and cites supporting evidence from the passage.`,
        explanation: `A strong answer would reference ${keyWord} and include a direct quote or close paraphrase from the passage as evidence.`,
        evidence: sentence,
        category,
      };
    }

    // MCQ: generate unique options per question
    const questionStems = [
      `According to the passage, what does the text suggest about ${keyWord}?`,
      `Which of the following best describes ${keyWord} as presented in the passage?`,
      `What is the primary role of ${keyWord} in the passage?`,
      `Based on the passage, which statement about ${keyWord} is most accurate?`,
      `What can be inferred from the passage regarding ${keyWord}?`,
    ];
    const questionText = questionStems[index % questionStems.length];

    // Create unique answer options using words/phrases from text
    const correctText = `The passage describes ${keyWord} as central to understanding the topic.`;
    const distractorTexts = distractors.map((d, di) => {
      const templates = [
        `The passage primarily focuses on ${d}, not ${keyWord}.`,
        `This describes ${d}, which is a separate concept from ${keyWord}.`,
        `The author mentions ${d} only as a supporting detail, not a main concept.`,
        `This contradicts the passage's description of ${keyWord}.`,
        `The passage does not discuss the relationship between ${d} and ${keyWord}.`,
      ];
      return templates[di % templates.length];
    });
    const allOptions = [correctText, ...distractorTexts];
    const shuffled = shuffleArray([...allOptions]);
    const correctIndex = shuffled.indexOf(correctText);

    return {
      id,
      question_type: 'mcq',
      question_text: questionText,
      options: shuffled,
      correct_option: correctIndex,
      correct_answer: null,
      explanation: `The passage discusses ${keyWord} in the context of the main topic. The correct answer connects to the text's central ideas.`,
      evidence: sentence,
      category,
    };
  }

  function truncate(str, len) {
    if (str.length <= len) return str;
    return str.substring(0, len).trim() + '…';
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ── Render Quiz ────────────────────────────────────────────
  function renderQuiz() {
    if (!state.quizData) return;

    const quiz = state.quizData;
    quizTitleBar.textContent = quiz.title || 'Quiz';
    passageTitle.textContent = (quiz.title || 'Reading Passage').replace('Comprehension Quiz: ', '');

    // Hide reading pane for custom-test (Wikipedia-scraped) quizzes
    const quizMain = $('#quiz-main');
    if (state.quizSource === 'custom-test') {
      quizMain.classList.add('quiz-main--no-passage');
      passageText.replaceChildren();
    } else {
      quizMain.classList.remove('quiz-main--no-passage');
      passageText.replaceChildren();
      if (quiz.passage) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(quiz.passage, 'text/html');
        const paragraphs = doc.body.querySelectorAll('p');
        paragraphs.forEach(p => {
          const newP = document.createElement('p');
          newP.textContent = p.textContent;
          passageText.appendChild(newP);
        });
      }
    }

    renderQuestion();
  }

  function renderQuestion() {
    const quiz = state.quizData;
    if (!quiz) return;

    const qIdx = state.currentQuestion;
    const question = quiz.questions[qIdx];
    const total = quiz.questions.length;

    // Update progress
    const answeredCount = Object.keys(state.isSubmitted).length;
    progressLabel.textContent = `Question ${qIdx + 1} of ${total}`;
    progressBar.style.width = `${((answeredCount) / total) * 100}%`;
    progressPercent.textContent = `${Math.round((answeredCount / total) * 100)}% Complete`;

    // Update question text
    questionText.textContent = question.question_text;

    // Update bookmark state
    btnBookmark.classList.toggle('active', state.bookmarked.has(qIdx));
    if (state.bookmarked.has(qIdx)) {
      btnBookmark.querySelector('svg').setAttribute('fill', 'currentColor');
    } else {
      btnBookmark.querySelector('svg').setAttribute('fill', 'none');
    }

    // Determine question type label
    const qType = question.question_type || 'mcq';
    const typeLabels = {
      'mcq': 'Multiple Choice',
      'true-false': 'True / False',
      'short-answer': 'Short Answer',
      'fill-blank': 'Fill in the Blank',
      'multiple-select': 'Select All That Apply',
      'evidence': 'Evidence-Based',
    };

    // Render answer area based on question type
    answerOptions.replaceChildren();

    if (qType === 'short-answer' || qType === 'fill-blank' || qType === 'evidence') {
      // Text input for short-answer / fill-blank / evidence
      const inputWrapper = document.createElement('div');
      inputWrapper.className = 'answer-input-wrapper';

      const input = document.createElement('textarea');
      input.className = 'answer-input';
      input.rows = 3;
      input.placeholder = qType === 'fill-blank' ? 'Type the missing word or phrase…' : 'Type your answer here…';

      // For evidence type, store answer separately from evidence
      const storedAnswer = state.answers[qIdx];
      const storedEvidence = state.evidenceAnswers ? state.evidenceAnswers[qIdx] : '';
      const answerText = qType === 'evidence' && typeof storedAnswer === 'object'
        ? (storedAnswer.answer || '') : (typeof storedAnswer === 'string' ? storedAnswer : '');

      if (answerText) {
        input.value = answerText;
      }

      if (!state.isSubmitted[qIdx]) {
        input.addEventListener('input', () => {
          if (qType === 'evidence') {
            const existing = state.answers[qIdx];
            const ev = state.evidenceAnswers ? state.evidenceAnswers[qIdx] : '';
            state.answers[qIdx] = { answer: input.value.trim(), evidence: ev || '' };
          } else {
            state.answers[qIdx] = input.value.trim();
          }
          const cur = qType === 'evidence'
            ? state.answers[qIdx]?.answer?.trim()
            : state.answers[qIdx];
          btnSubmitAnswer.disabled = !cur;
        });
      } else {
        input.disabled = true;
      }

      inputWrapper.appendChild(input);

      // Evidence-specific: second textarea for quoting passage evidence
      if (qType === 'evidence') {
        const evidenceLabel = document.createElement('div');
        evidenceLabel.className = 'evidence-label';
        evidenceLabel.textContent = 'Supporting evidence from the passage:';

        const evInput = document.createElement('textarea');
        evInput.className = 'answer-input answer-input--evidence';
        evInput.rows = 2;
        evInput.placeholder = 'Paste or type a quote from the passage that supports your answer…';

        if (storedEvidence) {
          evInput.value = storedEvidence;
        }

        if (!state.isSubmitted[qIdx]) {
          evInput.addEventListener('input', () => {
            const ans = state.answers[qIdx];
            const answerText = ans && typeof ans === 'object' ? ans.answer || '' : '';
            state.answers[qIdx] = { answer: answerText, evidence: evInput.value.trim() };
          });
        } else {
          evInput.disabled = true;
        }

        inputWrapper.appendChild(evidenceLabel);
        inputWrapper.appendChild(evInput);
      }

      // If submitted, show grading result or expected answer
      if (state.isSubmitted[qIdx]) {
        const gradeResult = state.gradeResults ? state.gradeResults[qIdx] : null;
        if (gradeResult) {
          const gradeDiv = document.createElement('div');
          gradeDiv.className = `feedback-panel ${gradeResult.is_correct ? 'feedback-panel--correct' : 'feedback-panel--incorrect'}`;
          const gradeTitle = document.createElement('div');
          gradeTitle.className = 'feedback-panel__title';
          gradeTitle.textContent = gradeResult.is_correct ? '✓ Correct!' : '✗ Not Quite';
          const gradeText = document.createElement('div');
          gradeText.className = 'feedback-panel__text';
          gradeText.textContent = gradeResult.feedback || question.explanation;
          gradeDiv.appendChild(gradeTitle);
          gradeDiv.appendChild(gradeText);
          inputWrapper.appendChild(gradeDiv);
        } else if (question.correct_answer) {
          const expected = document.createElement('div');
          expected.className = 'answer-expected';
          expected.textContent = `Expected answer: ${question.correct_answer}`;
          inputWrapper.appendChild(expected);
        }
      }

      answerOptions.appendChild(inputWrapper);

      // Update submit button disable state for text inputs
      if (!state.isSubmitted[qIdx]) {
        const cur = qType === 'evidence'
          ? (state.answers[qIdx]?.answer?.trim())
          : state.answers[qIdx];
        btnSubmitAnswer.disabled = !cur;
      }
    } else {
      // Option-based: mcq, true-false, multiple-select
      const isMulti = qType === 'multiple-select';
      const userAnswer = state.answers[qIdx];
      const userArray = isMulti && Array.isArray(userAnswer) ? userAnswer : [];

      question.options.forEach((option, i) => {
        const div = document.createElement('div');
        div.className = 'answer-option';
        if (isMulti) div.classList.add('answer-option--multi');
        div.dataset.index = i;

        // Apply previous selection state
        if (isMulti) {
          if (userArray.includes(i)) {
            div.classList.add('selected');
          }
        } else if (userAnswer === i) {
          div.classList.add('selected');
        }

        // If already submitted, show correct/incorrect states
        if (state.isSubmitted[qIdx]) {
          if (isMulti) {
            // For multiple-select, correct options get the correct class
            const isCorrectOpt = question.correct_option !== null && i === question.correct_option;
            // Note: the LLM uses correct_option as a single index per the prompt constraint.
            // We still show it.
            if (isCorrectOpt) {
              div.classList.add('correct');
            }
          } else {
            if (i === question.correct_option) {
              div.classList.add('correct');
            } else if (userAnswer === i && i !== question.correct_option) {
              div.classList.add('incorrect');
            }
          }
        }

        // Build the checkbox element
        const checkbox = document.createElement('div');
        checkbox.className = 'answer-checkbox';

        const svgNS = 'http://www.w3.org/2000/svg';
        const checkSvg = document.createElementNS(svgNS, 'svg');
        checkSvg.setAttribute('class', 'answer-checkbox__check');
        checkSvg.setAttribute('viewBox', '0 0 24 24');
        checkSvg.setAttribute('fill', 'none');
        checkSvg.setAttribute('stroke', 'currentColor');
        checkSvg.setAttribute('stroke-width', '3');
        checkSvg.setAttribute('stroke-linecap', 'round');
        checkSvg.setAttribute('stroke-linejoin', 'round');
        const polyline = document.createElementNS(svgNS, 'polyline');
        polyline.setAttribute('points', '20 6 9 17 4 12');
        checkSvg.appendChild(polyline);
        checkbox.appendChild(checkSvg);

        // Build the text span
        const textSpan = document.createElement('span');
        textSpan.className = 'answer-option__text';
        textSpan.textContent = option;

        div.appendChild(checkbox);
        div.appendChild(textSpan);

        if (!state.isSubmitted[qIdx]) {
          div.addEventListener('click', () => selectOption(qIdx, i));
        }

        answerOptions.appendChild(div);
      });

      // Update submit button disable state for option-based
      if (!state.isSubmitted[qIdx]) {
        if (isMulti) {
          btnSubmitAnswer.disabled = userArray.length === 0;
        } else {
          btnSubmitAnswer.disabled = userAnswer === undefined;
        }
      }
    }

    // Question type badge (update or create)
    let typeBadge = questionText.parentNode.querySelector('.question-type-badge');
    if (!typeBadge) {
      typeBadge = document.createElement('span');
      typeBadge.className = 'question-type-badge';
      questionText.parentNode.insertBefore(typeBadge, questionText.nextSibling);
    }
    typeBadge.textContent = typeLabels[qType] || 'Question';

    // Update submit button
    if (state.isSubmitted[qIdx]) {
      btnSubmitAnswer.textContent = qIdx < total - 1 ? 'Next Question →' : 'See Results';
      btnSubmitAnswer.disabled = false;
      btnSubmitAnswer.onclick = () => {
        if (qIdx < total - 1) {
          state.currentQuestion++;
          renderQuestion();
          feedbackContainer.replaceChildren();
        } else {
          showResults();
        }
      };
    } else {
      btnSubmitAnswer.textContent = 'Submit Answer';
      btnSubmitAnswer.onclick = handleSubmitAnswer;
    }

    // Show/hide feedback
    if (state.isSubmitted[qIdx]) {
      showFeedback(question, state.answers[qIdx]);
    } else {
      feedbackContainer.replaceChildren();
    }

    // Highlight evidence in passage
    highlightEvidence(question.evidence);
  }

  function selectOption(qIdx, optionIdx) {
    const question = state.quizData.questions[qIdx];
    const isMulti = question.question_type === 'multiple-select';

    if (isMulti) {
      // Toggle selection for multiple-select
      const current = state.answers[qIdx];
      const arr = Array.isArray(current) ? [...current] : [];
      const idx = arr.indexOf(optionIdx);
      if (idx === -1) {
        arr.push(optionIdx);
      } else {
        arr.splice(idx, 1);
      }
      arr.sort((a, b) => a - b);
      state.answers[qIdx] = arr;

      // Update UI
      answerOptions.querySelectorAll('.answer-option').forEach((opt, i) => {
        opt.classList.toggle('selected', arr.includes(i));
      });

      btnSubmitAnswer.disabled = arr.length === 0;
    } else {
      // Single select for mcq / true-false
      state.answers[qIdx] = optionIdx;

      answerOptions.querySelectorAll('.answer-option').forEach((opt, i) => {
        opt.classList.toggle('selected', i === optionIdx);
      });

      btnSubmitAnswer.disabled = false;
    }
  }

  function handleSubmitAnswer() {
    const qIdx = state.currentQuestion;
    const answer = state.answers[qIdx];
    if (answer === undefined || answer === '' || state.isSubmitted[qIdx]) return;

    const question = state.quizData.questions[qIdx];
    const passage = state.quizData.passage_raw || '';
    const qType = question.question_type || 'mcq';
    state.isSubmitted[qIdx] = true;

    // For free-response types, grade via AI
    if (qType === 'short-answer' || qType === 'evidence' || qType === 'fill-blank') {
      const answerText = qType === 'evidence' && typeof answer === 'object'
        ? (answer.answer || '') : (typeof answer === 'string' ? answer : '');
      const evidenceText = qType === 'evidence' && typeof answer === 'object'
        ? (answer.evidence || '') : (state.evidenceAnswers[qIdx] || '');

      if (qType === 'evidence') {
        state.evidenceAnswers[qIdx] = evidenceText;
      }

      // Call grading API (async, then re-render)
      gradeAnswer(question, answerText, evidenceText, passage, qIdx);
      return;
    }

    // Client-side grading for MCQ / true-false / multiple-select
    let isCorrect = false;
    if (qType === 'multiple-select') {
      const selected = Array.isArray(answer) ? answer : [];
      isCorrect = selected.includes(question.correct_option);
    } else {
      isCorrect = answer === question.correct_option;
    }

    if (isCorrect) state.correctCount++;
    renderQuestion();
  }

  async function gradeAnswer(question, answerText, evidenceText, passage, qIdx) {
    try {
      const response = await fetch(`${API_BASE}/grade-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_text: question.question_text,
          question_type: question.question_type || 'short-answer',
          student_answer: answerText,
          passage: passage.substring(0, 2000),
          correct_answer: question.correct_answer || '',
          evidence: question.evidence || '',
          student_evidence: evidenceText,
        }),
      });

      if (!response.ok) throw new Error(`Server returned ${response.status}`);

      const result = await response.json();
      state.gradeResults[qIdx] = result;
      if (result.is_correct) state.correctCount++;
    } catch (err) {
      console.warn('Grading API unavailable, using local fallback:', err.message);
      // Fallback: simple string matching
      const userStr = answerText.trim().toLowerCase();
      const expected = (question.correct_answer || '').trim().toLowerCase();
      const isCorrect = userStr === expected || (userStr.length > 3 && userStr.includes(expected));
      state.gradeResults[qIdx] = {
        is_correct: isCorrect,
        feedback: isCorrect
          ? 'Your answer aligns with the expected response.'
          : `The expected answer relates to: ${question.correct_answer || 'the passage content'}.`,
        score: isCorrect ? 1.0 : 0.0,
      };
      if (isCorrect) state.correctCount++;
    }

    renderQuestion();
  }

  function showFeedback(question, answer) {
    const qIdx = state.currentQuestion;
    const qType = question.question_type || 'mcq';
    let isCorrect = false;

    // Check if there's a grading result from the AI
    const gradeResult = state.gradeResults ? state.gradeResults[qIdx] : null;

    if (gradeResult) {
      isCorrect = gradeResult.is_correct;
    } else if (qType === 'short-answer' || qType === 'fill-blank' || qType === 'evidence') {
      const userStr = String(answer || '').trim().toLowerCase();
      const expected = (question.correct_answer || '').trim().toLowerCase();
      isCorrect = userStr === expected || (userStr.length > 3 && userStr.includes(expected));
    } else if (qType === 'multiple-select') {
      const selected = Array.isArray(answer) ? answer : [];
      isCorrect = selected.includes(question.correct_option);
    } else {
      isCorrect = answer === question.correct_option;
    }

    feedbackContainer.replaceChildren();

    const panel = document.createElement('div');
    panel.className = `feedback-panel ${isCorrect ? 'feedback-panel--correct' : 'feedback-panel--incorrect'}`;

    const titleDiv = document.createElement('div');
    titleDiv.className = 'feedback-panel__title';
    titleDiv.textContent = isCorrect ? '✓ Correct!' : '✗ Not Quite';

    const textDiv = document.createElement('div');
    textDiv.className = 'feedback-panel__text';
    textDiv.textContent = gradeResult ? gradeResult.feedback : question.explanation;

    panel.appendChild(titleDiv);
    panel.appendChild(textDiv);

    // For text-input types, show what the correct answer was
    if (!isCorrect && !gradeResult && (qType === 'short-answer' || qType === 'fill-blank') && question.correct_answer) {
      const correctDiv = document.createElement('div');
      correctDiv.className = 'feedback-panel__correct-answer';
      correctDiv.textContent = `Correct answer: ${question.correct_answer}`;
      panel.appendChild(correctDiv);
    }

    feedbackContainer.appendChild(panel);
  }

  function highlightEvidence(evidence) {
    if (!evidence) return;

    // Reset passage to clean state - rebuild from quizData
    const quiz = state.quizData;
    passageText.replaceChildren();
    if (quiz && quiz.passage) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(quiz.passage, 'text/html');
      const paragraphs = doc.body.querySelectorAll('p');
      paragraphs.forEach(p => {
        const newP = document.createElement('p');
        newP.textContent = p.textContent;
        passageText.appendChild(newP);
      });
    }

    // Find and highlight the evidence sentence
    if (evidence && evidence.length > 15) {
      const walker = document.createTreeWalker(passageText, NodeFilter.SHOW_TEXT);
      let node;
      while (node = walker.nextNode()) {
        const idx = node.textContent.indexOf(evidence);
        if (idx !== -1) {
          const range = document.createRange();
          range.setStart(node, idx);
          range.setEnd(node, idx + evidence.length);
          const span = document.createElement('span');
          span.className = 'highlight';
          range.surroundContents(span);
          break;
        }
      }
    }
  }

  // ── Bookmark ───────────────────────────────────────────────
  function handleBookmark() {
    const qIdx = state.currentQuestion;
    if (state.bookmarked.has(qIdx)) {
      state.bookmarked.delete(qIdx);
    } else {
      state.bookmarked.add(qIdx);
    }
    renderQuestion();
  }

  // ── Hint ───────────────────────────────────────────────────
  function handleHint() {
    const question = state.quizData?.questions[state.currentQuestion];
    if (!question) return;

    // Highlight the evidence in the passage as a hint
    if (question.evidence) {
      highlightEvidence(question.evidence);
      // Scroll reading pane to highlight
      const highlight = passageText.querySelector('.highlight');
      if (highlight) {
        highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
        highlight.style.animation = 'none';
        highlight.offsetHeight; // trigger reflow
        highlight.style.animation = 'pulseHighlight 1s ease-out 2';
      }
    }

    // Add pulse animation (only once)
    if (!document.querySelector('#pulse-highlight-style')) {
      const style = document.createElement('style');
      style.id = 'pulse-highlight-style';
      style.textContent = `
        @keyframes pulseHighlight {
          0%, 100% { background: linear-gradient(180deg, transparent 55%, rgba(249,232,151,0.5) 55%, rgba(249,232,151,0.5) 95%, transparent 95%); }
          50% { background: linear-gradient(180deg, transparent 45%, rgba(249,232,151,0.8) 45%, rgba(249,232,151,0.8) 95%, transparent 95%); }
        }
      `;
      document.head.appendChild(style);
    }
  }

  // ── Timer ──────────────────────────────────────────────────
  function startTimer() {
    state.timer.seconds = 0;
    updateTimerDisplay();
    state.timer.interval = setInterval(() => {
      state.timer.seconds++;
      updateTimerDisplay();
    }, 1000);
  }

  function stopTimer() {
    if (state.timer.interval) {
      clearInterval(state.timer.interval);
      state.timer.interval = null;
    }
  }

  function updateTimerDisplay() {
    const mins = Math.floor(state.timer.seconds / 60);
    const secs = state.timer.seconds % 60;
    timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }

  // ── Results ────────────────────────────────────────────────
  function showResults() {
    stopTimer();

    const total = state.quizData.questions.length;
    const correct = state.correctCount;
    const scorePercent = Math.round((correct / total) * 100);
    const timeStr = formatTime(state.timer.seconds);

    resultsScore.textContent = `${scorePercent}%`;
    resultsCorrect.textContent = `${correct}/${total}`;
    resultsTime.textContent = timeStr;

    // Dynamic emoji & message
    if (scorePercent >= 90) {
      resultsEmoji.textContent = '🌟';
      resultsTitle.textContent = 'Outstanding!';
      resultsSubtitle.textContent = 'You have an excellent grasp of this material!';
    } else if (scorePercent >= 70) {
      resultsEmoji.textContent = '🎉';
      resultsTitle.textContent = 'Great Job!';
      resultsSubtitle.textContent = 'You demonstrated solid comprehension. Keep it up!';
    } else if (scorePercent >= 50) {
      resultsEmoji.textContent = '💪';
      resultsTitle.textContent = 'Good Effort!';
      resultsSubtitle.textContent = 'Review the feedback on questions you missed to improve.';
    } else {
      resultsEmoji.textContent = '📖';
      resultsTitle.textContent = 'Keep Practicing!';
      resultsSubtitle.textContent = 'Re-read the passage and try again. You\'ll get there!';
    }

    resultsOverlay.classList.add('active');
  }

  // ── Save/Exit ──────────────────────────────────────────────
  function handleSaveExit() {
    stopTimer();
    // Switch back to the source view instead of using confirm()
    switchView(state.quizSource);
  }

  // ── Boot ───────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);

})();
