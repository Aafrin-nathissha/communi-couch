export default async function handler(request, response) {
  // Check if the request method is POST
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  // Read the prompt from the request body
  const { prompt, isJson } = request.body;

  // Get the API key securely from Vercel's environment variables
  const API_KEY = process.env.GEMINI_API_KEY;
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
    
    if (result.candidates && result.candidates[0].content.parts[0].text) {
        const content = result.candidates[0].content.parts[0].text;
        response.status(200).json({ content });
    } else {
        response.status(500).json({ error: 'Unexpected API response structure' });
    }
  } catch (error) {
    response.status(500).json({ error: `Server error: ${error.message}` });
  }
}
