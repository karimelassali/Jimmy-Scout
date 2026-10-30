import { GoogleGenAI, Type } from '@google/genai';
import { GeminiReplyAnalysis } from '@/packages/types/src/lead.ts';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export class GeminiTriageService {
  /**
   * Analyzes an incoming contractor email reply (in German, French, Italian, or English)
   * using Gemini Flash and returns structured JSON with resilient retry.
   */
  async analyzeReply(
    rawSubject: string,
    rawBody: string,
    senderEmail: string
  ): Promise<GeminiReplyAnalysis> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured on the server.');
    }

    const prompt = `Analyze this incoming email received from a Swiss contractor or BTP equipment manager.
Sender: ${senderEmail}
Subject: ${rawSubject}
Email Body:
"""
${rawBody}
"""

Task:
1. Determine the intent:
   - HOT_LEAD: The seller is offering machinery for sale, proposing equipment, asking for price/terms, or expressing interest in selling/retiring fleet.
   - NOT_INTERESTED: Explicitly states they have no machines to sell right now or decline.
   - UNSUBSCRIBE: Requests to be removed, says 'STOP', 'Abmelden', 'Désinscription', or 'CANCELLA'.
   - OUT_OF_OFFICE: Automated vacation or absence response (Abwesenheitsnotiz, Réponse automatique d'absence).
2. If HOT_LEAD: Extract any heavy machinery or equipment mentioned:
   - type (e.g., 'Pelle sur chenilles', 'Camion benne 4 essieux', 'Chargeuse sur pneus', 'Dumper articulé', 'Concasseur mobile')
   - make_model (exact brand and model mentioned in the email)
   - year (manufacturing year number if found)
   - hours (operating hours number if found)
   - asking_price (currency and amount if mentioned, e.g. "CHF 44'000")
3. Extract seller contact name and phone number if present in the email.
4. Provide a clear, accurate executive summary in French (french_summary) based strictly on the email text.`;

    const modelsToTry = ['gemini-3.8-flash', 'gemini-2.5-flash'];
    let lastError: any = null;

    for (const model of modelsToTry) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              systemInstruction:
                'You are an expert Swiss civil engineering & heavy machinery acquisition specialist (BTP / Baumaschinen). You analyze incoming contractor replies with commercial accuracy and output structured JSON only, strictly grounded in the provided email.',
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  intent: {
                    type: Type.STRING,
                    description: 'HOT_LEAD, NOT_INTERESTED, UNSUBSCRIBE, or OUT_OF_OFFICE',
                  },
                  confidence: {
                    type: Type.NUMBER,
                    description: 'Confidence between 0 and 1',
                  },
                  machinery_detected: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        type: { type: Type.STRING, description: 'Equipment category' },
                        make_model: { type: Type.STRING, description: 'Brand and model' },
                        year: { type: Type.INTEGER, description: 'Manufacturing year' },
                        hours: { type: Type.INTEGER, description: 'Operating hours' },
                        asking_price: { type: Type.STRING, description: 'Asking price in CHF/EUR' },
                      },
                      required: ['type', 'make_model'],
                    },
                    description: 'List of detected construction machinery',
                  },
                  contact_name: {
                    type: Type.STRING,
                    description: 'Name of the seller or fleet manager',
                  },
                  contact_phone: {
                    type: Type.STRING,
                    description: 'Phone number of the seller',
                  },
                  french_summary: {
                    type: Type.STRING,
                    description: 'Executive 1-2 sentence French summary of the deal and availability',
                  },
                },
                required: ['intent', 'confidence', 'machinery_detected', 'french_summary'],
              },
            },
          });

          const text = response.text;
          if (!text) {
            throw new Error('Gemini returned an empty response.');
          }

          return JSON.parse(text) as GeminiReplyAnalysis;
        } catch (err: any) {
          lastError = err;
          console.warn(`[Gemini] Attempt ${attempt} on ${model} encountered notice:`, err?.message || err);
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 1200));
          }
        }
      }
    }

    throw lastError || new Error('Gemini analysis failed');
  }
}

export const geminiService = new GeminiTriageService();
