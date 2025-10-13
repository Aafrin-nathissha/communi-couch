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

// Gemini API endpoint
app.post('/api/gemini', async (req, res) => {
  try {
    const { prompt, isJson } = req.body;

    // Get the API key from environment variables
    const API_KEY = process.env.GEMINI_API_KEY;
    
    if (!API_KEY) {
      return res.status(500).json({ error: 'API key not configured. Please set GEMINI_API_KEY in .env file' });
    }

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {}
    };

    if (isJson) {
      payload.generationConfig.responseMimeType = "application/json";
    }

    const geminiResponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      return res.status(geminiResponse.status).json({ error: `Gemini API Error: ${errorText}` });
    }

    const result = await geminiResponse.json();
    
    if (result.candidates && result.candidates[0].content.parts[0].text) {
      const content = result.candidates[0].content.parts[0].text;
      res.status(200).json({ result: content });
    } else {
      res.status(500).json({ error: 'Unexpected API response structure' });
    }
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: `Server error: ${error.message}` });
  }
});

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});