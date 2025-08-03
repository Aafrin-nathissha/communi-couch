export default async function handler(request) {
  // Read the prompt from the incoming request
  const { prompt, isJson } = await request.json();

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
        return new Response(JSON.stringify({ error: `Gemini API Error: ${errorText}` }), {
          status: geminiResponse.status,
          headers: { 'Content-Type': 'application/json' },
        });
    }

    const result = await geminiResponse.json();
    
    if (result.candidates && result.candidates[0].content.parts[0].text) {
        const content = result.candidates[0].content.parts[0].text;
        return new Response(JSON.stringify({ content }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
    } else {
        return new Response(JSON.stringify({ error: 'Unexpected API response structure' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: `Server error: ${error.message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
