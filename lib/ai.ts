export interface AnalysisResult {
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
}

export async function analyzeEmergencyAudio(
  transcript: string
): Promise<AnalysisResult> {
  try {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('No API key configured');
    }

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Analyze this emergency audio transcript and determine urgency level.
Return JSON:
{
priority: LOW | MEDIUM | HIGH,
reason: short explanation
}

Consider:
- Screaming indicates HIGH priority
- Crying indicates HIGH priority
- Violence words (kill, hurt, attack, help) indicate HIGH priority
- Calm speech lowers priority
- The exact phrase "help me now" should be considered HIGH priority

Transcript: "${transcript}"

Return ONLY valid JSON, no additional text.`
          }]
        }],
        generationConfig: {
          responseMimeType: 'text/plain',
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No valid JSON in response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      priority: parsed.priority || 'MEDIUM',
      reason: parsed.reason || 'Analysis completed',
    };
  } catch (error) {
    console.error('AI Analysis error:', error);
    return {
      priority: 'MEDIUM',
      reason: 'Analysis failed, defaulting to MEDIUM',
    };
  }
}
