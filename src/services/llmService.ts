import { MedicalRecord } from '@/context/MedicalContext';

/**
 * LLM Service for Groq Cloud API Integration
 * 
 * This service handles all interactions with the Groq Cloud API using
 * the llama-3.3-70b-versatile model for medical record analysis.
 * 
 * The bot is strictly grounded to only answer from provided medical data.
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL_ID = 'llama-3.3-70b-versatile';

// System prompt that enforces strict grounding to medical records
const SYSTEM_PROMPT = `You are a medical record analyzer bot for a University Hospital. Your role is to help patients understand their medical records.

STRICT RULES:
1. Answer ONLY using the provided medical data from the patient's records
2. Do NOT guess, assume, or use external medical knowledge
3. Do NOT make diagnoses or provide medical advice beyond what's in the records
4. If the answer is not present in the provided data, respond with: "Not found in your medical records"
5. Always mention the document type and date when citing information
6. Be helpful, clear, and professional in your responses
7. Format responses for easy reading with bullet points when appropriate

When referencing information, clearly state which document it came from (document type and date).`;

export interface LLMResponse {
  answer: string;
  evidence: {
    documentType: string;
    date: string;
    snippet: string;
  }[];
}

/**
 * Build context from medical records for the LLM
 */
function buildMedicalContext(records: MedicalRecord[]): string {
  if (records.length === 0) {
    return 'No medical records available.';
  }

  const contextParts = records.map((record, index) => {
    const typeLabels: Record<string, string> = {
      'blood-report': 'Blood Report',
      'prescription': 'Prescription',
      'scan': 'Scan/Imaging Report',
      'receipt': 'Medical Receipt',
    };

    return `--- DOCUMENT ${index + 1} ---
Type: ${typeLabels[record.documentType] || record.documentType}
Date: ${record.date}
File: ${record.fileName}
Content:
${record.text}
--- END DOCUMENT ${index + 1} ---`;
  });

  return contextParts.join('\n\n');
}

/**
 * Find relevant snippets from records that might answer the query
 */
function findRelevantEvidence(
  records: MedicalRecord[],
  query: string,
  answer: string
): LLMResponse['evidence'] {
  const evidence: LLMResponse['evidence'] = [];
  const queryTerms = query.toLowerCase().split(/\s+/);
  const answerTerms = answer.toLowerCase().split(/\s+/);
  const allTerms = [...new Set([...queryTerms, ...answerTerms])];

  for (const record of records) {
    const lines = record.text.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const lineLower = line.toLowerCase();
      // Check if line contains relevant terms
      const isRelevant = allTerms.some(term => 
        term.length > 3 && lineLower.includes(term)
      );

      if (isRelevant && line.trim().length > 10) {
        const typeLabels: Record<string, string> = {
          'blood-report': 'Blood Report',
          'prescription': 'Prescription',
          'scan': 'Scan/Imaging Report',
          'receipt': 'Medical Receipt',
        };

        evidence.push({
          documentType: typeLabels[record.documentType] || record.documentType,
          date: record.date,
          snippet: line.trim().substring(0, 200),
        });

        // Limit evidence items
        if (evidence.length >= 5) break;
      }
    }
    if (evidence.length >= 5) break;
  }

  return evidence;
}

/**
 * Query the Groq Cloud API with medical records context
 */
export async function queryMedicalBot(
  apiKey: string,
  userQuery: string,
  records: MedicalRecord[]
): Promise<LLMResponse> {
  if (!apiKey) {
    throw new Error('Groq API key is required. Please enter your API key in the sidebar.');
  }

  if (records.length === 0) {
    return {
      answer: 'No medical records have been uploaded yet. Please upload your medical documents first using the "Upload Medical Records" page.',
      evidence: [],
    };
  }

  const medicalContext = buildMedicalContext(records);

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `PATIENT'S MEDICAL RECORDS:
${medicalContext}

PATIENT'S QUESTION:
${userQuery}

Please answer the patient's question using ONLY the information from their medical records above.`,
    },
  ];

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL_ID,
        messages,
        temperature: 0.3, // Lower temperature for more factual responses
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your Groq Cloud API key.');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      }
      throw new Error(errorData.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content || 'Unable to generate a response.';

    // Find relevant evidence from the records
    const evidence = findRelevantEvidence(records, userQuery, answer);

    return { answer, evidence };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to connect to Groq API. Please check your internet connection.');
  }
}
