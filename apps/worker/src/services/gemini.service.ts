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

    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
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

  /**
   * Scans one or multiple business cards (visit cards) from photos using Gemini Vision.
   * Can extract multiple cards from a single photo or across multiple photos.
   */
  async extractBusinessCards(
    images: Array<{ base64: string; mimeType?: string }>
  ): Promise<{
    cards: Array<{
      name: string;
      contact_person?: string;
      email: string;
      phone?: string;
      address?: string;
      city?: string;
      postal_code?: string;
      canton: string;
      domain?: string;
      industry: 'civil_engineering' | 'tiefbau' | 'demolition' | 'quarry';
      language: 'fr' | 'de' | 'it';
      notes?: string;
      confidence: number;
    }>;
  }> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured on the server.');
    }
    if (!images || images.length === 0) {
      return { cards: [] };
    }

    const imageParts = images.map((img) => {
      let cleanData = img.base64;
      let mimeType = img.mimeType || 'image/jpeg';

      // Strip data:image/...;base64, prefix if present
      if (cleanData.includes(';base64,')) {
        const parts = cleanData.split(';base64,');
        const header = parts[0];
        cleanData = parts[1];
        const match = header.match(/data:([^;]+)/);
        if (match) mimeType = match[1];
      }

      return {
        inlineData: {
          mimeType,
          data: cleanData,
        },
      };
    });

    const prompt = `You are an expert Swiss business directory specialist for construction, earthworks, demolition, quarrying, and civil engineering (BTP / Baumaschinen / Génie Civil / Tiefbau).

Analyze the attached photo(s) of business cards (visit cards / cartes de visite / Visitenkarten / biglietti da visita).
Task:
1. Identify all business cards shown in the image(s). A single image may contain one or multiple cards.
2. For each card, extract:
   - Company Name (official business name)
   - Contact Person (name and job title if visible, e.g. "Marc Dubois, Directeur Technique")
   - Email address (if an email is visible, extract it. If no email is visible but a website domain is visible, synthesize a realistic contact email e.g. "info@domain.ch". If none, leave empty string)
   - Phone number (direct landline or mobile, format with Swiss code like +41 ... if identifiable)
   - Street address, City, and Postal code (PLZ)
   - Swiss Canton: 2-letter canton code (ZH, BE, VD, GE, TI, VS, FR, AG, SG, LU, NE, ZG, SO, BL, BS, etc.) determined accurately from the postal code or city
   - Website / Domain
   - Industry: classify into one of 'civil_engineering', 'tiefbau', 'demolition', or 'quarry' based on company activities (terrassement, démolition, gravière, baumaschinen, génie civil, etc.)
   - Language: 'fr' for Romandie (VD, GE, NE, JU, FR, VS-French), 'it' for Ticino (TI), 'de' for Swiss German cantons (ZH, BE, AG, LU, SG, ZG, etc.)
   - Notes: Any equipment, machines, or special fleet services mentioned on the card
   - Confidence: score between 0.1 and 1.0 representing legibility and completeness

Return a valid JSON object containing an array 'cards' with all detected companies.`;

    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let lastError: any = null;

    for (const model of modelsToTry) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: [
              ...imageParts,
              prompt,
            ],
            config: {
              systemInstruction:
                'You are an expert OCR and multimodal extraction agent specialized in Swiss business cards. Output structured JSON only, strictly matching the provided cards.',
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  cards: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING, description: 'Company name' },
                        contact_person: { type: Type.STRING, description: 'Contact person and title' },
                        email: { type: Type.STRING, description: 'Email address' },
                        phone: { type: Type.STRING, description: 'Phone number' },
                        address: { type: Type.STRING, description: 'Street address' },
                        city: { type: Type.STRING, description: 'City name' },
                        postal_code: { type: Type.STRING, description: 'Postal code / PLZ' },
                        canton: { type: Type.STRING, description: '2-letter Swiss Canton code (e.g. VD, ZH, BE)' },
                        domain: { type: Type.STRING, description: 'Website domain' },
                        industry: {
                          type: Type.STRING,
                          description: 'civil_engineering, tiefbau, demolition, or quarry',
                        },
                        language: {
                          type: Type.STRING,
                          description: 'fr, de, or it',
                        },
                        notes: { type: Type.STRING, description: 'Any machinery or services noted on the card' },
                        confidence: { type: Type.NUMBER, description: 'Confidence between 0 and 1' },
                      },
                      required: ['name', 'canton', 'language'],
                    },
                  },
                },
                required: ['cards'],
              },
            },
          });

          const text = response.text;
          if (!text) {
            throw new Error('Gemini returned empty response for business card scan.');
          }

          const parsed = JSON.parse(text);
          return {
            cards: Array.isArray(parsed.cards) ? parsed.cards : [],
          };
        } catch (err: any) {
          lastError = err;
          console.warn(`[Gemini Vision] Card scan attempt ${attempt} on ${model} notice:`, err?.message || err);
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 1200));
          }
        }
      }
    }

    throw lastError || new Error('Failed to extract business cards with Gemini Vision');
  }
}

export const geminiService = new GeminiTriageService();
