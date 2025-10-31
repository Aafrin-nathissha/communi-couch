const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Log API key status on startup
console.log('🔑 API Key loaded:', process.env.GEMINI_API_KEY ? '✓ YES' : '✗ NO');
if (process.env.GEMINI_API_KEY) {
  console.log('🔑 API Key preview:', process.env.GEMINI_API_KEY.substring(0, 15) + '...');
}

// Gemini API endpoint with auto model detection
app.post('/api/gemini', async (req, res) => {
  try {
    const { prompt, isJson } = req.body;

    // Get the API key from environment variables
    const API_KEY = process.env.GEMINI_API_KEY;
    
    if (!API_KEY) {
      console.error('❌ API key not configured');
      return res.status(500).json({ error: 'API key not configured. Please set GEMINI_API_KEY in .env file' });
    }

    console.log('🔄 API call received for prompt:', prompt.substring(0, 50) + '...');

    // Try models in order of availability
    const models = ['gemini-2.0-flash-exp', 'gemini-exp-1121', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
    let success = false;
    let lastError = null;

    for (const model of models) {
      try {
        console.log(`🔄 Trying model: ${model}`);
        
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

        const payload = {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 }
        };

        if (isJson) {
          payload.generationConfig.responseMimeType = "application/json";
        }

        const geminiResponse = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        console.log(`📊 Model ${model} response status:`, geminiResponse.status);

        if (!geminiResponse.ok) {
          const errorText = await geminiResponse.text();
          console.warn(`⚠️ Model ${model} failed:`, errorText.substring(0, 100));
          lastError = errorText;
          continue; // Try next model
        }

        const result = await geminiResponse.json();
        console.log(`✅ Model ${model} successful!`);
        
        if (result.candidates && result.candidates[0] && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts[0]) {
          const content = result.candidates[0].content.parts[0].text;
          res.status(200).json({ result: content });
          success = true;
          break;
        }
      } catch (modelError) {
        console.warn(`⚠️ Model ${model} error:`, modelError.message);
        lastError = modelError.message;
        continue; // Try next model
      }
    }

    if (!success) {
      console.error('❌ All models failed');
      res.status(500).json({ error: `All models failed. Last error: ${lastError}` });
    }

  } catch (error) {
    console.error('❌ Server error:', error.message);
    res.status(500).json({ error: `Server error: ${error.message}` });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    apiKey: process.env.GEMINI_API_KEY ? 'configured' : 'missing'
  });
});

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
});