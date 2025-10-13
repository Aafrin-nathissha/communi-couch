// --- DOM Element Selection ---
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Status Elements
const apiStatus = document.getElementById('api-status');
const apiStatusText = document.getElementById('api-status-text');

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

// --- Status Management ---
function updateApiStatus(isActive, message = 'Processing...') {
    if (apiStatus) {
        if (isActive) {
            apiStatus.classList.remove('hidden');
            if (apiStatusText) apiStatusText.textContent = message;
        } else {
            apiStatus.classList.add('hidden');
        }
    }
}

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

// --- Secure AI API Integration with Request Queue ---
let requestQueue = [];
let isProcessingQueue = false;
let requestCount = 0;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function processRequestQueue() {
    if (isProcessingQueue || requestQueue.length === 0) return;
    
    isProcessingQueue = true;
    updateApiStatus(true, `Processing ${requestQueue.length} request(s)...`);
    
    while (requestQueue.length > 0) {
        const request = requestQueue.shift();
        try {
            console.log(`Processing queued request ${++requestCount}:`, request.prompt.substring(0, 50) + '...');
            updateApiStatus(true, `Processing request ${requestCount}...`);
            const result = await makeGeminiRequest(request.prompt, request.isJson, request.retryCount || 0);
            request.resolve(result);
        } catch (error) {
            request.reject(error);
        }
        
        // Add delay between requests to avoid rate limiting
        if (requestQueue.length > 0) {
            updateApiStatus(true, `${requestQueue.length} requests remaining...`);
            await sleep(500);
        }
    }
    
    isProcessingQueue = false;
    updateApiStatus(false);
}

async function makeGeminiRequest(prompt, isJson = false, retryCount = 0) {
    try {
        console.log(`Making API call (attempt ${retryCount + 1}):`, prompt.substring(0, 50) + '...', 'isJson:', isJson);
        
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, isJson })
        });

        console.log('Response status:', response.status);

        if (!response.ok) {
            if (response.status === 429 && retryCount < MAX_RETRIES) {
                console.log(`Rate limited, retrying in ${RETRY_DELAY * (retryCount + 1)}ms...`);
                await sleep(RETRY_DELAY * (retryCount + 1));
                return makeGeminiRequest(prompt, isJson, retryCount + 1);
            }
            
            const errorData = await response.json().catch(() => ({ error: response.statusText }));
            console.error('API Error Response:', errorData);
            throw new Error(errorData.error || `API Error: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('API Success Response:', result);
        
        if (result.error) {
            throw new Error(result.error);
        }
        
        if (isJson && typeof result.result === 'string') {
            try {
                return JSON.parse(result.result);
            } catch (parseError) {
                console.error('JSON parsing failed:', parseError);
                throw new Error('Invalid JSON response from API');
            }
        }
        
        return result.result;

    } catch (error) {
        if (retryCount < MAX_RETRIES && !error.message.includes('JSON')) {
            console.log(`Request failed, retrying in ${RETRY_DELAY * (retryCount + 1)}ms...`);
            await sleep(RETRY_DELAY * (retryCount + 1));
            return makeGeminiRequest(prompt, isJson, retryCount + 1);
        }
        
        console.error("API call failed after retries:", error);
        throw error;
    }
}

async function callGemini(prompt, isJson = false) {
    return new Promise((resolve, reject) => {
        requestQueue.push({
            prompt,
            isJson,
            resolve: (result) => {
                if (result && typeof result === 'object' && result.error) {
                    resolve(isJson ? { error: "API call failed" } : "Sorry, I couldn't process that request. Please try again.");
                } else {
                    resolve(result);
                }
            },
            reject: (error) => {
                console.error("Queued API call failed:", error);
                resolve(isJson ? { error: "API call failed" } : "Sorry, I couldn't process that request. Please try again.");
            }
        });
        
        processRequestQueue();
    });
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
    
    try {
        // 1. Enhanced grammar correction with better prompt
        const correctionPrompt = `You are an expert English grammar checker. Please correct any grammatical errors, spelling mistakes, and punctuation issues in the following text. If the text is already correct, return it as is. Only return the corrected text, nothing else.

Text to correct: "${transcript}"

Corrected text:`;
        
        const correctedText = await callGemini(correctionPrompt);
        correctedTextOutput.textContent = correctedText;

        // 2. Enhanced vocabulary suggestion
        const vocabPrompt = `Analyze this sentence and suggest ONE vocabulary enhancement by replacing a common word with a more sophisticated synonym. Return ONLY a JSON object in this exact format:
        
{"enhanced_sentence": "the improved sentence here"}

If no improvement is possible, return:
{"enhanced_sentence": "None"}

Sentence to analyze: "${correctedText}"`;

        const vocabResult = await callGemini(vocabPrompt, true);

        if (vocabResult && vocabResult.enhanced_sentence && vocabResult.enhanced_sentence.toLowerCase() !== 'none') {
            vocabSuggestionOutput.textContent = vocabResult.enhanced_sentence;
        } else {
            vocabSuggestionOutput.textContent = "The sentence is already well-phrased.";
        }

        // 3. Enhanced assistant response
        const responsePrompt = `You are a friendly English conversation coach. A student just said: "${correctedText}"

Give a brief, encouraging response (1-2 sentences) and ask ONE follow-up question to continue the conversation. Be natural and supportive. Do not mention grammar corrections.

Response:`;
        
        const assistantFeedback = await callGemini(responsePrompt);
        assistantResponseOutput.textContent = assistantFeedback;
        
        // 4. Speak the conversational reply
        speak(assistantFeedback);
    } catch (error) {
        console.error('Error processing transcript:', error);
        correctedTextOutput.textContent = 'Error processing your speech. Please try again.';
    }

    speechLoader.classList.add('hidden');
}

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        console.log("Speech recognition started successfully");
        rawTextOutput.textContent = "Listening... Speak now!";
    };

    recognition.onresult = (event) => {
        console.log("Speech recognition result received:", event);
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        
        // Show interim results
        if (interimTranscript) {
            rawTextOutput.textContent = `Listening: ${interimTranscript}`;
        }
        
        if (finalTranscript.trim()) {
            console.log("Final transcript:", finalTranscript.trim());
            recognition.stop(); // Stop listening while processing
            rawTextOutput.textContent = finalTranscript.trim();
            processTranscript(finalTranscript.trim());
        }
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        isListening = false;
        listenBtnText.textContent = "Start Conversation";
        startListenBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
        startListenBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
        
        switch(event.error) {
            case 'not-allowed':
                rawTextOutput.textContent = "Microphone access denied. Please allow microphone access and try again.";
                break;
            case 'no-speech':
                rawTextOutput.textContent = "No speech detected. Please try speaking louder or closer to the microphone.";
                break;
            case 'network':
                rawTextOutput.textContent = "Network error. Please check your internet connection.";
                break;
            default:
                rawTextOutput.textContent = `Error: ${event.error}. Please ensure microphone access is allowed.`;
        }
    };

    recognition.onend = () => {
        console.log("Speech recognition ended");
        if (isListening) {
            // If we're still supposed to be listening, restart
            setTimeout(() => {
                if (isListening) {
                    console.log("Restarting speech recognition...");
                    recognition.start();
                }
            }, 1000);
        }
    };

} else {
    startListenBtn.disabled = true;
    rawTextOutput.textContent = "Sorry, your browser doesn't support Speech Recognition.";
}
        
startListenBtn.addEventListener('click', async () => {
    if (isListening) {
        isListening = false;
        if (recognition) recognition.stop();
        window.speechSynthesis.cancel();
        listenBtnText.textContent = "Start Conversation";
        startListenBtn.classList.remove('bg-red-600', 'hover:bg-red-700');
        startListenBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
    } else {
        // Check microphone permission first
        try {
            console.log("Requesting microphone access...");
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log("Microphone access granted");
            stream.getTracks().forEach(track => track.stop()); // Stop the stream immediately
            
            isListening = true;
            if (recognition) {
                rawTextOutput.textContent = 'Starting microphone...';
                correctedTextOutput.textContent = '';
                vocabSuggestionOutput.textContent = '';
                assistantResponseOutput.textContent = '';
                
                console.log("Starting speech recognition...");
                recognition.start();
            }
            listenBtnText.textContent = "Stop Conversation";
            startListenBtn.classList.add('bg-red-600', 'hover:bg-red-700');
            startListenBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        } catch (error) {
            console.error("Microphone access error:", error);
            rawTextOutput.textContent = "Microphone access denied. Please allow microphone access in your browser settings and try again.";
        }
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
    
    const prompt = `You are an expert English grammar checker and writing coach. Please:
1. Correct any grammatical errors, spelling mistakes, and punctuation issues
2. Improve sentence structure and clarity if needed
3. Keep the original meaning intact
4. If the text is already perfect, return it as is

Text to improve: "${text}"

Improved text:`;
    
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
    
    console.log(`Making vocabulary API call for word: ${word}`);
    
    try {
        const prompt = `Analyze the word "${word}" and provide vocabulary information. Return ONLY a JSON object in this exact format:

{
  "synonyms": ["synonym1", "synonym2", "synonym3"],
  "antonyms": ["antonym1", "antonym2", "antonym3"],
  "example": "A clear example sentence using the word '${word}' in context."
}

If the word is invalid or you cannot find information, return:
{
  "synonyms": ["No synonyms found"],
  "antonyms": ["No antonyms found"],
  "example": "Invalid word or no information available."
}`;
        
        const result = await callGemini(prompt, true);
        console.log("Vocabulary API response:", result);

        vocabLoader.classList.add('hidden');
        
        if (result && typeof result === 'object' && result.synonyms && result.antonyms && result.example) {
            vocabOutput.innerHTML = `
                <div class="space-y-4">
                    <div class="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                        <h4 class="font-bold text-lg text-blue-800 mb-2">📝 Word: "${word}"</h4>
                    </div>
                    <div class="p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
                        <h4 class="font-bold text-lg text-green-800 mb-2">✅ Synonyms:</h4>
                        <p class="text-green-700">${Array.isArray(result.synonyms) ? result.synonyms.join(', ') : result.synonyms}</p>
                    </div>
                    <div class="p-4 bg-red-50 rounded-lg border-l-4 border-red-500">
                        <h4 class="font-bold text-lg text-red-800 mb-2">❌ Antonyms:</h4>
                        <p class="text-red-700">${Array.isArray(result.antonyms) ? result.antonyms.join(', ') : result.antonyms}</p>
                    </div>
                    <div class="p-4 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                        <h4 class="font-bold text-lg text-purple-800 mb-2">💡 Example:</h4>
                        <p class="text-purple-700 italic">"${result.example}"</p>
                    </div>
                </div>
            `;
        } else {
            console.error("Invalid vocabulary response format:", result);
            // Fallback to simple text request if JSON parsing fails
            const fallbackPrompt = `Provide synonyms, antonyms, and an example sentence for the word "${word}". Format your response clearly with sections for synonyms, antonyms, and example.`;
            const fallbackResult = await callGemini(fallbackPrompt, false);
            
            vocabOutput.innerHTML = `
                <div class="p-4 bg-gray-50 rounded-lg border-l-4 border-gray-500">
                    <h4 class="font-bold text-lg mb-2">📝 Information for "${word}":</h4>
                    <div class="whitespace-pre-line text-gray-700">${fallbackResult}</div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Vocabulary enhancement error:', error);
        vocabLoader.classList.add('hidden');
        vocabOutput.innerHTML = `
            <div class="p-4 bg-red-50 rounded-lg border-l-4 border-red-500">
                <h4 class="font-bold text-lg text-red-800 mb-2">❌ Error</h4>
                <p class="text-red-700">Sorry, I couldn't process the word "${word}". Please try again or check your internet connection.</p>
            </div>
        `;
    }
});

// --- Quiz Logic ---
let quizScore = 0;
let currentQuizQuestion = null;

// Comprehensive Quiz Question Bank
const quizQuestionBank = [
    // Synonyms
    {
        question: "What is the synonym of 'happy'?",
        options: ["joyful", "sad", "angry", "tired"],
        correctAnswerIndex: 0
    },
    {
        question: "Which word means the same as 'difficult'?",
        options: ["easy", "simple", "challenging", "clear"],
        correctAnswerIndex: 2
    },
    {
        question: "What is a synonym for 'beautiful'?",
        options: ["ugly", "plain", "boring", "gorgeous"],
        correctAnswerIndex: 3
    },
    {
        question: "Which word has the same meaning as 'intelligent'?",
        options: ["stupid", "smart", "silly", "lazy"],
        correctAnswerIndex: 1
    },
    {
        question: "What is a synonym for 'enormous'?",
        options: ["tiny", "small", "medium", "huge"],
        correctAnswerIndex: 3
    },
    
    // Antonyms
    {
        question: "What is the antonym of 'hot'?",
        options: ["cold", "warm", "cool", "freezing"],
        correctAnswerIndex: 0
    },
    {
        question: "Which word is opposite to 'bright'?",
        options: ["shiny", "light", "clear", "dark"],
        correctAnswerIndex: 3
    },
    {
        question: "What is the antonym of 'strong'?",
        options: ["powerful", "weak", "mighty", "tough"],
        correctAnswerIndex: 1
    },
    {
        question: "Which word means the opposite of 'ancient'?",
        options: ["modern", "old", "historic", "classic"],
        correctAnswerIndex: 0
    },
    {
        question: "What is the antonym of 'generous'?",
        options: ["kind", "giving", "selfish", "helpful"],
        correctAnswerIndex: 2
    },
    
    // Grammar
    {
        question: "Which sentence uses correct grammar?",
        options: ["She doesn't like pizza", "She don't like pizza", "She not like pizza", "She no like pizza"],
        correctAnswerIndex: 0
    },
    {
        question: "What is the past tense of 'run'?",
        options: ["runned", "running", "runs", "ran"],
        correctAnswerIndex: 3
    },
    {
        question: "Which sentence is grammatically correct?",
        options: ["I have went to school", "I have gone to school", "I have go to school", "I have going to school"],
        correctAnswerIndex: 1
    },
    {
        question: "What is the correct plural form of 'child'?",
        options: ["childs", "childrens", "child", "children"],
        correctAnswerIndex: 3
    },
    {
        question: "Which sentence uses the correct verb form?",
        options: ["He are coming", "He am coming", "He be coming", "He is coming"],
        correctAnswerIndex: 3
    },
    
    // Vocabulary
    {
        question: "What does 'procrastinate' mean?",
        options: ["to delay or postpone", "to hurry up", "to finish quickly", "to organize"],
        correctAnswerIndex: 0
    },
    {
        question: "What is the meaning of 'benevolent'?",
        options: ["cruel", "angry", "kind and generous", "confused"],
        correctAnswerIndex: 2
    },
    {
        question: "What does 'meticulous' mean?",
        options: ["careless", "quick", "loud", "very careful and precise"],
        correctAnswerIndex: 3
    },
    {
        question: "What is the meaning of 'eloquent'?",
        options: ["fluent and persuasive", "unable to speak", "quiet", "rude"],
        correctAnswerIndex: 0
    },
    {
        question: "What does 'perplexed' mean?",
        options: ["happy", "excited", "confused", "calm"],
        correctAnswerIndex: 2
    },
    
    // Common Mistakes
    {
        question: "Which is the correct usage?",
        options: ["You're welcome", "Your welcome", "Youre welcome", "Your welcom"],
        correctAnswerIndex: 0
    },
    {
        question: "Which sentence is correct?",
        options: ["There going to the store", "Their going to the store", "Theyre going to the store", "They're going to the store"],
        correctAnswerIndex: 3
    },
    {
        question: "What is the correct form?",
        options: ["I could of done it", "I could have done it", "I could off done it", "I could've did it"],
        correctAnswerIndex: 1
    },
    {
        question: "Which is correct?",
        options: ["Its a beautiful day", "Its' a beautiful day", "Its a beatiful day", "It's a beautiful day"],
        correctAnswerIndex: 3
    },
    {
        question: "What is the correct spelling?",
        options: ["definately", "definitely", "definatly", "definitly"],
        correctAnswerIndex: 1
    },
    
    // Advanced Vocabulary
    {
        question: "What does 'ubiquitous' mean?",
        options: ["rare", "invisible", "everywhere at once", "ancient"],
        correctAnswerIndex: 2
    },
    {
        question: "What is the meaning of 'serendipity'?",
        options: ["bad luck", "hard work", "pleasant surprise or discovery", "confusion"],
        correctAnswerIndex: 2
    },
    {
        question: "What does 'pragmatic' mean?",
        options: ["practical and realistic", "idealistic", "emotional", "theoretical"],
        correctAnswerIndex: 0
    },
    {
        question: "What is the meaning of 'ephemeral'?",
        options: ["permanent", "heavy", "lasting a very short time", "bright"],
        correctAnswerIndex: 2
    },
    {
        question: "What does 'ambiguous' mean?",
        options: ["clear", "simple", "having multiple meanings", "colorful"],
        correctAnswerIndex: 2
    },
    
    // Idioms
    {
        question: "What does 'break the ice' mean?",
        options: ["to destroy something", "to be cold", "to slip and fall", "to start a conversation"],
        correctAnswerIndex: 3
    },
    {
        question: "What does 'piece of cake' mean?",
        options: ["something easy", "a dessert", "something expensive", "a celebration"],
        correctAnswerIndex: 0
    },
    {
        question: "What does 'spill the beans' mean?",
        options: ["to cook dinner", "to make a mess", "to reveal a secret", "to plant seeds"],
        correctAnswerIndex: 2
    },
    {
        question: "What does 'bite the bullet' mean?",
        options: ["to eat metal", "to be angry", "to shoot a gun", "to face a difficult situation"],
        correctAnswerIndex: 3
    },
    {
        question: "What does 'hit the nail on the head' mean?",
        options: ["to use a hammer", "to be exactly right", "to hurt yourself", "to build something"],
        correctAnswerIndex: 1
    }
];

async function loadNewQuestion() {
    quizLoader.classList.remove('hidden');
    quizQuestionContainer.classList.add('hidden');
    quizFeedback.textContent = '';
    quizOptions.innerHTML = '';

    try {
        // 70% chance to use question bank, 30% chance to generate new AI question
        const useQuestionBank = Math.random() < 0.7;
        
        if (useQuestionBank) {
            // Use pre-defined question from question bank
            const randomIndex = Math.floor(Math.random() * quizQuestionBank.length);
            currentQuizQuestion = quizQuestionBank[randomIndex];
            
            quizLoader.classList.add('hidden');
            quizQuestionContainer.classList.remove('hidden');
            displayQuestion();
        } else {
            // Generate new AI question
            const prompt = `Generate a multiple choice question about English language skills. Return ONLY a JSON object in this exact format:

{
  "question": "What is the synonym of 'happy'?",
  "options": ["sad", "joyful", "angry", "tired"],
  "correctAnswerIndex": 1
}

Topics: synonyms, antonyms, grammar rules, vocabulary, idioms, or common English mistakes. Make it moderately challenging. Ensure the correctAnswerIndex is a number (0, 1, 2, or 3).`;
            
            currentQuizQuestion = await callGemini(prompt, true);
            
            quizLoader.classList.add('hidden');
            quizQuestionContainer.classList.remove('hidden');

            if (currentQuizQuestion && currentQuizQuestion.question && currentQuizQuestion.options && Array.isArray(currentQuizQuestion.options) && currentQuizQuestion.options.length === 4) {
                displayQuestion();
            } else {
                throw new Error('Invalid AI question format received');
            }
        }
    } catch (error) {
        console.error('Quiz generation error:', error);
        
        // Fallback to question bank if AI generation fails
        const randomIndex = Math.floor(Math.random() * quizQuestionBank.length);
        currentQuizQuestion = quizQuestionBank[randomIndex];
        
        quizLoader.classList.add('hidden');
        quizQuestionContainer.classList.remove('hidden');
        displayQuestion();
    }
}

function displayQuestion() {
    quizQuestion.textContent = currentQuizQuestion.question;
    
    currentQuizQuestion.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.textContent = option;
        button.className = 'w-full p-3 text-left bg-white border border-gray-300 rounded hover:bg-blue-50 transition-colors';
        button.onclick = () => handleAnswer(index);
        quizOptions.appendChild(button);
    });
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
