import { NextRequest, NextResponse } from 'next/server';
import { analyzeEmergencyAudio, AnalysisResult } from '@/lib/ai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { emergencyId, transcript } = body;

    if (!emergencyId || !transcript) {
      return NextResponse.json(
        { error: 'Missing required fields: emergencyId and transcript' },
        { status: 400 }
      );
    }

    if (!process.env.GOOGLE_GENAI_API_KEY) {
      console.warn('GOOGLE_GENAI_API_KEY not configured, using default priority');
      return NextResponse.json({
        priority: 'MEDIUM',
        reason: 'AI analysis not configured, defaulting to MEDIUM priority',
      });
    }

    const result: AnalysisResult = await analyzeEmergencyAudio(transcript);

    return NextResponse.json({
      priority: result.priority,
      reason: result.reason,
    });
  } catch (error) {
    console.error('AI Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze emergency', priority: 'MEDIUM', reason: 'Analysis failed' },
      { status: 500 }
    );
  }
}
