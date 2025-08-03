// --- DOM Element Selection ---
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Speech Section
const startListenBtn = document.getElementById('start-listen-btn');
const listenBtnText = document.getElementById('listen-btn-text');
const rawTextOutput = document.getElementById('raw-text-output');
const correctedTextOutput = document.getElementById('corrected-text-output');
const assistantResponseOutput = document.getElementById('assistant-response-output');
const vocabSuggestionOutput = document.getElementById('vocab-suggestion-output');
const speechLoader = document.getElementById('speech-loader');

// Text Section
const textInput = document.getElementById('text-input');
const correctTextBtn = document.getElementById('correct-text-btn');
const textCorrectionOutput = document.getElementById('text-correction-output');
const textLoader = document.getElementById('text-loader');

// Vocab Section
const vocabInput = document.getElementById('vocab-input');
const enhanceVocabBtn = document.getElementById('enhance-vocab-btn');
const vocabOutput = document.getElementById('vocab-output');
const vocabLoader = document.getElementById('vocab-loader');

// Quiz Section
const startQuizBtn = document.getElementById('start-quiz-btn');
const quizStartScreen = document.getElementById('quiz-start-screen');
const quizGameScreen = document.getElementById('quiz-game-screen');
const quizScoreEl = document.getElementById('quiz-score');
const quizQuestion = document.getElementById('quiz-question');
const quizOptions = document.getElementById('quiz-options');
const quizFeedback = document.getElementById('quiz-feedback');
const quizLoader = document.getElementById('quiz-loader');
const quizQuestionContainer = document.getElementById('quiz-question-container');

// --- Tab Navigation Logic ---
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-tab');

        tabs.forEach(t => {
            t.classList.remove('text-blue-600', 'border-blue-600');
            t.classList.add('text-gray-500');
        });
        tab.classList.add('text-blue-600', 'border-blue-600');
        tab.classList.remove('text-gray-500');

        tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === target) {
                content.classList.add('active');
            }
        });
    });
});

// --- Secure AI API Integration ---
async function callGemini(prompt, isJson = false) {
    try {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, isJson })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `API Error: ${response.statusText}`);
        }

        const result = await response.json();
        const content = result.content;
        
        return isJson ? JSON.parse(content) : content;

    } catch (error) {
        console.error("API call failed:", error);
        return isJson ? { error: "API call failed" } : "Sorry, I couldn't process that request. Please try again.";
    }
}


// --- Speech Synthesis & Voice Selection ---
let femaleVoice = null;

function loadVoices() {
    const voices = window.speechSynthesis.getVoices();
    femaleVoice = voices.find(voice => voice.lang === 'en-US' && voice.name.includes('Female')) || voices.find(voice => voice.lang.includes('en'));
}

loadVoices();
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
}

function speak(text) {
    if (typeof text !== 'string') return;
    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    if (femaleVoice) {
        utterance.voice = femaleVoice;
    }
    // Add an onend event to restart listening
    utterance.onend = () => {
        if (isListening) {
            recognition.start();
        }
    };
    window.speechSynthesis.speak(utterance);
}

// --- Speech Recognition Logic ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let isListening = false;

async function processTranscript(transcript) {
    if (!transcript) return;

    speechLoader.classList.remove('hidden');
    correctedTextOutput.textContent = '';
    vocabSuggestionOutput.textContent = '';
    assistantResponseOutput.textContent = '';
    
    // 1. Correct grammar
    const correctionPrompt = `Correct the grammar of the following text: "${transcript}"`;
    const correctedText = await callGemini(correctionPrompt);
    correctedTextOutput.textContent = correctedText;

    // 2. Get Enhanced Sentence with better vocabulary
    const vocabPrompt = `Analyze this sentence: "${correctedText}". If possible, replace one word with a more sophisticated or suitable one and return the complete, rewritten sentence. If no improvement can be made, return a JSON object with a key "enhanced_sentence" set to "None". Otherwise, return a JSON object with the key "enhanced_sentence" containing the new sentence.`;
    const vocabResult = await callGemini(vocabPrompt, true);

    if (vocabResult && vocabResult.enhanced_sentence && vocabResult.enhanced_sentence.toLowerCase() !== 'none') {
        vocabSuggestionOutput.textContent = vocabResult.enhanced_sentence;
    } else {
        vocabSuggestionOutput.textContent = "The sentence is already well-phrased.";
    }

    // 3. Get assistant feedback that includes a follow-up question
    const responsePrompt = `Act as a friendly communication coach. A user's original sentence was: "${transcript}". The corrected version is: "${correctedText}". Your task is to respond in three parts: First, state the corrected sentence clearly. Second, provide a brief, encouraging reply. Third, ask a natural, open-ended follow-up question to keep the conversation going. Example: "The corrected sentence is: 'I went to the beach yesterday.' That sounds lovely! What was the weather like?"`;
    const assistantFeedback = await callGemini(responsePrompt);
    assistantResponseOutput.textContent = assistantFeedback;
    
    // 4. Speak the full feedback, which will trigger listening again onend
    speak(assistantFeedback);

    speechLoader.classList.add('hidden');
}

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            }
        }
        
        if (finalTranscript.trim()) {
            recognition.stop(); // Stop listening while processing
            rawTextOutput.textContent = finalTranscript.trim();
            processTranscript(finalTranscript.trim());
        }
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        rawTextOutput.textContent = `Error: ${event.error}. Please ensure microphone access is allowed.`;
    };

} else {
    startListenBtn.disabled = true;
    rawTextOutput.textContent = "Sorry, your browser doesn't support Speech Recognition.";
}
        
startListenBtn.addEventListener('click', () => {
    if (isListening) {
        isListening = false;
        if (recognition) recognition.stop();
        window.speechSynthesis.cancel();
        listenBtnText.textContent = "Start Conversation";
        startListenBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
        startListenBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
    } else {
        isListening = true;
        if (recognition) {
            rawTextOutput.textContent = '';
            correctedTextOutput.textContent = '';
            vocabSuggestionOutput.textContent = '';
            assistantResponseOutput.textContent = '';
            recognition.start();
        }
        listenBtnText.textContent = "Stop Conversation";
        startListenBtn.classList.add('bg-red-600', 'hover:bg-red-700');
        startListenBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
    }
});

// --- Text Correction Logic ---
correctTextBtn.addEventListener('click', async () => {
    const text = textInput.value;
    if (!text.trim()) {
        textCorrectionOutput.textContent = "Please enter some text first.";
        return;
    }
    textLoader.classList.remove('hidden');
    textCorrectionOutput.textContent = '';
    const prompt = `Correct the grammar of the following text: "${text}"`;
    const correctedText = await callGemini(prompt);
    textCorrectionOutput.textContent = correctedText;
    textLoader.classList.add('hidden');
});

// --- Vocabulary Enhancer Logic ---
enhanceVocabBtn.addEventListener('click', async () => {
    const word = vocabInput.value;
    if (!word.trim()) {
        vocabOutput.innerHTML = `<p class="text-red-500">Please enter a word.</p>`;
        return;
    }
    vocabLoader.classList.remove('hidden');
    vocabOutput.innerHTML = '';
    
    const prompt = `Provide synonyms, antonyms, and a clear example sentence for the word: "${word}". Format the response as a single JSON object with three keys: "synonyms" (an array of strings), "antonyms" (an array of strings), and "example" (a string).`;
    
    const result = await callGemini(prompt, true);

    vocabLoader.classList.add('hidden');
    
    if (typeof result === 'object' && result.synonyms) {
        vocabOutput.innerHTML = `
            <div class="p-4 bg-gray-50 rounded-lg">
                <h4 class="font-bold text-lg">Synonyms:</h4>
                <p>${result.synonyms.join(', ')}</p>
            </div>
            <div class="p-4 bg-gray-50 rounded-lg">
                <h4 class="font-bold text-lg">Antonyms:</h4>
                <p>${result.antonyms.join(', ')}</p>
            </div>
            <div class="p-4 bg-gray-50 rounded-lg">
                <h4 class="font-bold text-lg">Example:</h4>
                <p>"${result.example}"</p>
            </div>
        `;
    } else {
        vocabOutput.innerHTML = `<p class="text-red-500">Could not retrieve information for that word.</p>`;
    }
});

// --- Quiz Logic ---
let quizScore = 0;
let currentQuizQuestion = null;

async function loadNewQuestion() {
    quizLoader.classList.remove('hidden');
    quizQuestionContainer.classList.add('hidden');
    quizFeedback.textContent = '';
    quizOptions.innerHTML = '';

    const prompt = `Generate a simple multiple-choice quiz question about English communication (synonyms, antonyms, or basic grammar) with 4 options. Format the response as a single JSON object with three keys: "question" (a string), "options" (an array of 4 strings), and "correctAnswerIndex" (a number from 0 to 3).`;
    
    currentQuizQuestion = await callGemini(prompt, true);

    quizLoader.classList.add('hidden');
    quizQuestionContainer.classList.remove('hidden');

    if (currentQuizQuestion && currentQuizQuestion.question) {
        quizQuestion.textContent = currentQuizQuestion.question;
        currentQuizQuestion.options.forEach((option, index) => {
            const button = document.createElement('button');
            button.textContent = option;
            button.classList.add('w-full', 'p-3', 'bg-gray-200', 'rounded-lg', 'hover:bg-gray-300', 'transition-colors');
            button.onclick = () => handleAnswer(index);
            quizOptions.appendChild(button);
        });
    } else {
         quizQuestion.textContent = "Failed to load a question. Please try again.";
    }
}

function handleAnswer(selectedIndex) {
    const correctIndex = currentQuizQuestion.correctAnswerIndex;
    const optionButtons = quizOptions.querySelectorAll('button');

    optionButtons.forEach(btn => btn.disabled = true);

    if (selectedIndex === correctIndex) {
        quizFeedback.textContent = "Correct!";
        quizFeedback.classList.add('text-green-600');
        quizFeedback.classList.remove('text-red-600');
        quizScore++;
        quizScoreEl.textContent = quizScore;
        optionButtons[selectedIndex].classList.add('bg-green-500', 'text-white');
    } else {
        quizFeedback.textContent = `Wrong! The correct answer was: ${currentQuizQuestion.options[correctIndex]}`;
        quizFeedback.classList.add('text-red-600');
        quizFeedback.classList.remove('text-green-600');
        optionButtons[selectedIndex].classList.add('bg-red-500', 'text-white');
        optionButtons[correctIndex].classList.add('bg-green-500', 'text-white');
    }

    setTimeout(loadNewQuestion, 2500);
}

startQuizBtn.addEventListener('click', () => {
    quizStartScreen.classList.add('hidden');
    quizGameScreen.classList.remove('hidden');
    quizScore = 0;
    quizScoreEl.textContent = 0;
    loadNewQuestion();
});
