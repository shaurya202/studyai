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
    currentView: 'generator', // 'generator' | 'summarizer' | 'custom-test' | 'quiz'
    quizSource: 'generator',  // which view launched the quiz
    quizData: null,            // { title, passage, questions[] }
    currentQuestion: 0,
    answers: {},               // { questionIndex: selectedOptionIndex }
    bookmarked: new Set(),
    timer: { seconds: 0, interval: null },
    isSubmitted: {},           // { questionIndex: true }
    correctCount: 0,
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

    // Extract key phrases for question generation
    const words = text.split(/\s+/);
    const title = sentences[0] ? sentences[0].substring(0, 60).trim() + '…' : 'Reading Comprehension Quiz';

    // Build passage paragraphs
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim());
    const passageHTML = paragraphs.map(p => `<p>${p.trim()}</p>`).join('');

    // Generate questions from the text
    const questions = [];
    const usedSentences = new Set();

    for (let i = 0; i < numQ; i++) {
      // Pick a sentence to base the question on
      let sentIdx = i % sentences.length;
      while (usedSentences.has(sentIdx) && usedSentences.size < sentences.length) {
        sentIdx = (sentIdx + 1) % sentences.length;
      }
      usedSentences.add(sentIdx);

      const baseSentence = sentences[sentIdx] || sentences[0];
      const question = generateQuestionFromSentence(baseSentence, i, settings.complexity, settings.focus_area);
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

  function generateQuestionFromSentence(sentence, index, complexity, focus) {
    // Create a comprehension question from a sentence
    const questionTemplates = [
      `According to the passage, what does the text suggest about: "${truncate(sentence, 50)}"?`,
      `What is the main idea conveyed in the statement: "${truncate(sentence, 50)}"?`,
      `Based on the passage, which of the following best explains: "${truncate(sentence, 50)}"?`,
      `What can be inferred from the following: "${truncate(sentence, 50)}"?`,
      `The author's primary purpose in stating "${truncate(sentence, 40)}" is to:`,
      `Which detail from the passage best supports the claim made in: "${truncate(sentence, 45)}"?`,
    ];

    const template = questionTemplates[index % questionTemplates.length];

    // Generate plausible options
    const correctOption = `It directly relates to the key concept described in the passage.`;
    const distractors = [
      `It contradicts the main argument presented by the author.`,
      `It introduces an unrelated concept not discussed in the passage.`,
      `It provides a counter-example to the author's thesis.`,
    ];

    // Shuffle options
    const allOptions = [correctOption, ...distractors];
    const shuffled = shuffleArray([...allOptions]);
    const correctIndex = shuffled.indexOf(correctOption);

    return {
      id: index + 1,
      question_text: template,
      options: shuffled,
      correct_option: correctIndex,
      explanation: `This question tests comprehension of the passage. The correct answer relates directly to the ideas presented in: "${truncate(sentence, 80)}"`,
      evidence: sentence,
      category: ['detail', 'main-idea', 'inference', 'authors-purpose', 'vocabulary', 'structure'][index % 6],
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

    // Render options using safe DOM methods
    answerOptions.replaceChildren();
    question.options.forEach((option, i) => {
      const div = document.createElement('div');
      div.className = 'answer-option';
      div.dataset.index = i;

      // Apply previous selection state
      if (state.answers[qIdx] === i) {
        div.classList.add('selected');
      }

      // If already submitted, show correct/incorrect states
      if (state.isSubmitted[qIdx]) {
        if (i === question.correct_option) {
          div.classList.add('correct');
        } else if (state.answers[qIdx] === i && i !== question.correct_option) {
          div.classList.add('incorrect');
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
      btnSubmitAnswer.disabled = state.answers[qIdx] === undefined;
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
    state.answers[qIdx] = optionIdx;

    // Update UI
    answerOptions.querySelectorAll('.answer-option').forEach((opt, i) => {
      opt.classList.toggle('selected', i === optionIdx);
    });

    btnSubmitAnswer.disabled = false;
  }

  function handleSubmitAnswer() {
    const qIdx = state.currentQuestion;
    if (state.answers[qIdx] === undefined || state.isSubmitted[qIdx]) return;

    const question = state.quizData.questions[qIdx];
    state.isSubmitted[qIdx] = true;

    // Check correctness
    const isCorrect = state.answers[qIdx] === question.correct_option;
    if (isCorrect) state.correctCount++;

    // Re-render with correct/incorrect states
    renderQuestion();
  }

  function showFeedback(question, selectedIdx) {
    const isCorrect = selectedIdx === question.correct_option;

    feedbackContainer.replaceChildren();

    const panel = document.createElement('div');
    panel.className = `feedback-panel ${isCorrect ? 'feedback-panel--correct' : 'feedback-panel--incorrect'}`;

    const titleDiv = document.createElement('div');
    titleDiv.className = 'feedback-panel__title';
    titleDiv.textContent = isCorrect ? '✓ Correct!' : '✗ Not Quite';

    const textDiv = document.createElement('div');
    textDiv.className = 'feedback-panel__text';
    textDiv.textContent = question.explanation;

    panel.appendChild(titleDiv);
    panel.appendChild(textDiv);
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
