export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, isJson } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const API_KEY = process.env.GEMINI_API_KEY;
    
    if (!API_KEY) {
      return res.status(500).json({ error: 'API key not configured' });
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
    
    if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
      const content = result.candidates[0].content.parts[0].text;
      
      if (isJson) {
        try {
          // Clean and parse JSON response
          const cleanContent = content.replace(/```json\s*|\s*```/g, '').trim();
          const jsonResult = JSON.parse(cleanContent);
          return res.status(200).json({ result: jsonResult });
        } catch (jsonError) {
          console.error('JSON parsing error:', jsonError);
          return res.status(500).json({ error: 'Invalid JSON response from AI' });
        }
      } else {
        return res.status(200).json({ result: content });
      }
    } else {
      return res.status(500).json({ error: 'Unexpected API response structure' });
    }
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
}
