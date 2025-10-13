export default async function handler(request, response) {
  // Add CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  // Check if the request method is POST
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  // Read the prompt from the request body
  const { prompt, isJson } = request.body;

  if (!prompt) {
    response.status(400).json({ error: 'Prompt is required' });
    return;
  }

  // Get the API key securely from Vercel's environment variables
  const API_KEY = process.env.GEMINI_API_KEY;
  
  if (!API_KEY) {
    response.status(500).json({ error: 'API key not configured' });
    return;
  }

  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

  const payload = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {}
  };

  if (isJson) {
    payload.generationConfig.responseMimeType = "application/json";
  }

  try {
    const geminiResponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!geminiResponse.ok) {
        const errorText = await geminiResponse.text();
        response.status(geminiResponse.status).json({ error: `Gemini API Error: ${errorText}` });
        return;
    }

    const result = await geminiResponse.json();
    
    if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
        const content = result.candidates[0].content.parts[0].text;
        
        if (isJson) {
          try {
            // Clean and parse JSON response
            const cleanContent = content.replace(/```json\s*|\s*```/g, '').trim();
            const jsonResult = JSON.parse(cleanContent);
            response.status(200).json({ result: jsonResult });
          } catch (jsonError) {
            console.error('JSON parsing error:', jsonError);
            response.status(500).json({ error: 'Invalid JSON response from AI' });
          }
        } else {
          response.status(200).json({ result: content });
        }
    } else {
        response.status(500).json({ error: 'Unexpected API response structure' });
    }
  } catch (error) {
    console.error('Server error:', error);
    response.status(500).json({ error: `Server error: ${error.message}` });
  }
}
