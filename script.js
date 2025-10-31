/* ===========================
   COMMUNICATION COACH
   Modern UI/UX JavaScript
   All Features Combined
   =========================== */

// ===========================
// DOM ELEMENTS
// ===========================

// Status Elements
const statusElement = document.querySelector('.status');
const statusText = document.getElementById('statusText');
const themeToggle = document.getElementById('themeToggle');

// Input Fields
const speechInput = document.getElementById('speechInput');
const textInput = document.getElementById('textInput');
const vocabInput = document.getElementById('vocabInput');

// Result Containers
const speechResult = document.getElementById('speechResult');
const textResult = document.getElementById('textResult');
const vocabResult = document.getElementById('vocabResult');
const quizResult = document.getElementById('quizResult');

// Character Counters
const speechCharCount = document.getElementById('speechCharCount');
const textCharCount = document.getElementById('textCharCount');

// Waveform Canvas
const waveformContainer = document.getElementById('waveformContainer');
const waveformCanvas = document.getElementById('waveformCanvas');

// ===========================
// STATE MANAGEMENT
// ===========================

let isProcessing = false;
let requestQueue = [];
let lastRequestTime = 0;
let requestCount = 0;
let requestResetTime = Date.now();

// Quiz State
let quizScore = 0;
let quizQuestions = [];
let currentQuestionIndex = 0;

// ===========================
// INITIALIZATION
// ===========================

document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    setupEventListeners();
    updateStatus('ready', 'Ready');
    console.log('✅ Communication Coach loaded successfully');
});

// ===========================
// THEME MANAGEMENT
// ===========================

function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggle.textContent = '☀️';
    }
}

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeToggle.textContent = isDark ? '☀️' : '🌙';
});

// ===========================
// EVENT LISTENERS
// ===========================

function setupEventListeners() {
    // Character counters
    speechInput?.addEventListener('input', (e) => {
        speechCharCount.textContent = e.target.value.length;
    });

    textInput?.addEventListener('input', (e) => {
        textCharCount.textContent = e.target.value.length;
    });

    // Tab switching
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            showTab(tabName);
        });
    });
}

// ===========================
// TAB MANAGEMENT
// ===========================

function showTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Deactivate all buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    // Activate selected button
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
}

// ===========================
// STATUS MANAGEMENT
// ===========================

function updateStatus(state, message) {
    if (statusElement) {
        statusElement.className = `status ${state}`;
    }
    if (statusText) {
        statusText.textContent = message;
    }
}

// ===========================
// RESPONSE RENDERING
// ===========================

function renderChatMessage(text, type = 'assistant') {
    const message = document.createElement('div');
    message.className = `chat-message ${type}`;
    
    const bubble = document.createElement('div');
    bubble.className = `message-bubble message-${type}`;
    bubble.textContent = text;
    
    message.appendChild(bubble);
    return message;
}

function renderResult(container, data) {
    if (!container) return;

    container.innerHTML = '';
    container.classList.add('show');

    if (typeof data === 'string') {
        const bubble = renderChatMessage(data, 'assistant');
        container.appendChild(bubble);
    } else if (Array.isArray(data)) {
        data.forEach(item => {
            if (item.type === 'success') {
                const msg = document.createElement('div');
                msg.className = 'message-success';
                msg.innerHTML = `<strong>✓ ${item.title}:</strong><br>${item.content}`;
                container.appendChild(msg);
            } else if (item.type === 'info') {
                const msg = document.createElement('div');
                msg.className = 'message-info';
                msg.innerHTML = `<strong>ℹ ${item.title}:</strong><br>${item.content}`;
                container.appendChild(msg);
            } else {
                const bubble = renderChatMessage(item.text, item.sender || 'assistant');
                container.appendChild(bubble);
            }
        });
    }
}

// ===========================
// API REQUEST MANAGEMENT
// ===========================

async function callGeminiAPI(prompt, isJson = false) {
    // Rate limiting
    const now = Date.now();
    if (now - requestResetTime > 60000) {
        requestCount = 0;
        requestResetTime = now;
    }

    if (requestCount >= 55) {
        updateStatus('warning', 'Rate limit reached. Please wait...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        requestCount = 0;
        requestResetTime = Date.now();
    }

    const requestData = { prompt, isJson };
    requestQueue.push(requestData);

    // Process queue
    while (requestQueue.length > 0 && !isProcessing) {
        isProcessing = true;
        const currentRequest = requestQueue.shift();

        try {
            updateStatus('processing', 'Processing...');

            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentRequest)
            });

            requestCount++;

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const result = await response.json();
            isProcessing = false;

            return result;
        } catch (error) {
            console.error('API Error:', error);
            isProcessing = false;
            updateStatus('error', 'Error processing request');
            return null;
        }
    }
}

// ===========================
// WAVEFORM VISUALIZATION
// ===========================

function drawWaveform() {
    if (!waveformCanvas) return;

    const ctx = waveformCanvas.getContext('2d');
    const width = waveformCanvas.offsetWidth;
    const height = waveformCanvas.offsetHeight;

    waveformCanvas.width = width;
    waveformCanvas.height = height;

    // Draw animated waveform
    const time = Date.now() / 1000;
    const frequency = 2;
    const amplitude = height / 3;

    ctx.fillStyle = 'rgba(102, 126, 234, 0.1)';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(102, 126, 234, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let x = 0; x < width; x += 5) {
        const y = height / 2 + Math.sin((x / width) * frequency * Math.PI * 2 + time) * amplitude;
        if (x === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    ctx.stroke();

    // Draw center line
    ctx.strokeStyle = 'rgba(102, 126, 234, 0.3)';
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
}

function animateWaveform() {
    if (waveformContainer.style.display !== 'none') {
        drawWaveform();
        requestAnimationFrame(animateWaveform);
    }
}

// ===========================
// FEATURE HANDLERS
// ===========================

async function handleSpeechPractice() {
    const text = speechInput?.value.trim();
    if (!text) {
        alert('Please enter some text to practice');
        return;
    }

    // Show waveform
    waveformContainer.style.display = 'block';
    animateWaveform();

    const response = await callGeminiAPI(
        `You are a speech coach. Analyze this speech and provide: 1) Grammatical corrections, 2) Clarity suggestions, 3) Tone improvement tips, 4) Overall feedback.\n\nSpeech: "${text}"`,
        false
    );

    if (response) {
        const results = [
            { type: 'success', title: 'Speech Analysis', content: response.text }
        ];
        renderResult(speechResult, results);
    } else {
        renderResult(speechResult, 'Sorry, I couldn\'t process your speech.');
    }
}

async function handleTextCorrection() {
    const text = textInput?.value.trim();
    if (!text) {
        alert('Please enter some text to correct');
        return;
    }

    const response = await callGeminiAPI(
        `Correct the following text for grammar, punctuation, and clarity. Provide the corrected version and explain key changes:\n\n"${text}"`,
        false
    );

    if (response) {
        const results = [
            { type: 'info', title: 'Corrected Text', content: response.text }
        ];
        renderResult(textResult, results);
    } else {
        renderResult(textResult, 'Sorry, I couldn\'t correct the text.');
    }
}

async function handleVocabulary() {
    const word = vocabInput?.value.trim();
    if (!word) {
        alert('Please enter a word');
        return;
    }

    const response = await callGeminiAPI(
        `For the word "${word}", provide: 1) Definition, 2) Synonyms (3-5), 3) Antonyms (2-3), 4) Example sentences (2), 5) Common usage tips. Format as clear sections.`,
        false
    );

    if (response) {
        const results = [
            { type: 'success', title: 'Vocabulary Insights', content: response.text }
        ];
        renderResult(vocabResult, results);
    } else {
        renderResult(vocabResult, 'Sorry, I couldn\'t find information for that word.');
    }
}

async function handleQuiz() {
    const response = await callGeminiAPI(
        `Generate ONE communication/grammar multiple-choice question with 4 options (A, B, C, D). 
        Format: 
        Question: [question text]
        A) [option]
        B) [option]
        C) [option]
        D) [option]
        Correct: [letter]
        Explanation: [why it's correct]`,
        false
    );

    if (response) {
        displayQuizQuestion(response.text);
    } else {
        renderResult(quizResult, 'Sorry, I couldn\'t generate a question.');
    }
}

// ===========================
// QUIZ DISPLAY
// ===========================

function displayQuizQuestion(text) {
    quizResult.innerHTML = '';
    quizResult.classList.add('show');

    // Parse question
    const lines = text.split('\n').filter(l => l.trim());
    const questionMatch = text.match(/Question:\s*(.+)/i);
    const question = questionMatch ? questionMatch[1].trim() : lines[0];

    const options = [];
    const optionPattern = /^[A-D]\)\s*(.+)$/gm;
    let match;
    while ((match = optionPattern.exec(text)) !== null) {
        options.push(match[1].trim());
    }

    const correctMatch = text.match(/Correct:\s*([A-D])/i);
    const correct = correctMatch ? correctMatch[1] : 'A';

    const explanationMatch = text.match(/Explanation:\s*(.+)/i);
    const explanation = explanationMatch ? explanationMatch[1].trim() : '';

    // Render question
    const questionDiv = document.createElement('div');
    questionDiv.className = 'message-bubble message-info';
    questionDiv.innerHTML = `<strong>Question:</strong><br>${question}`;
    quizResult.appendChild(questionDiv);

    // Render options
    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'quiz-options';

    options.forEach((option, index) => {
        const optionEl = document.createElement('button');
        optionEl.className = 'quiz-option';
        optionEl.textContent = `${String.fromCharCode(65 + index)}) ${option}`;
        optionEl.onclick = () => checkAnswer(String.fromCharCode(65 + index), correct, explanation, optionEl, optionsDiv);
        optionsDiv.appendChild(optionEl);
    });

    quizResult.appendChild(optionsDiv);

    // Result placeholder
    const resultDiv = document.createElement('div');
    resultDiv.id = 'quizFeedbackDiv';
    quizResult.appendChild(resultDiv);
}

function checkAnswer(selected, correct, explanation, clickedOption, optionsContainer) {
    const isCorrect = selected === correct;
    clickedOption.classList.add(isCorrect ? 'correct' : 'incorrect');

    // Disable all options
    document.querySelectorAll('.quiz-option').forEach(opt => {
        opt.disabled = true;
        if (opt !== clickedOption && opt.textContent.startsWith(correct)) {
            opt.classList.add('correct');
        }
    });

    // Show feedback
    const feedbackDiv = document.getElementById('quizFeedbackDiv');
    if (feedbackDiv) {
        feedbackDiv.innerHTML = `
            <div class="message-${isCorrect ? 'success' : 'error'}">
                <strong>${isCorrect ? '✓ Correct!' : '✗ Incorrect'}</strong><br>
                ${explanation}
            </div>
        `;
    }

    // Update score
    if (isCorrect) quizScore++;
}

// ===========================
// EXPORT FOR GLOBAL SCOPE
// ===========================

window.showTab = showTab;
window.handleSpeechPractice = handleSpeechPractice;
window.handleTextCorrection = handleTextCorrection;
window.handleVocabulary = handleVocabulary;
window.handleQuiz = handleQuiz;

console.log('✅ All features initialized successfully');
