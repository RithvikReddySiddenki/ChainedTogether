/**
 * 0G Compute — thin inference client
 *
 * Exposes:
 *   inferJSON({ systemPrompt, userPrompt, model, temperature, maxTokens })
 *
 * Uses raw fetch to call 0G Compute inference endpoint (OpenAI-compatible).
 * Broker-based auth (SDK with Node.js deps) is handled separately in
 * server-only code — this file is safe for both client and server bundles.
 *
 * Also re-exports the legacy ZeroGComputeClient shim used by profile/intake.
 */

// ─── Environment (read at call time, not module load time) ─
function getEndpoint(): string {
  return process.env.NEXT_PUBLIC_0G_ENDPOINT || process.env.OG_ENDPOINT || '';
}

// ─── Types ────────────────────────────────────────────────
export interface InferJSONParams {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface IntakeMessage {
  role: 'agent' | 'user';
  content: string;
}

export interface ExtractedProfile {
  interests: string[];
  values: string[];
  communicationStyle: string;
  dealbreakers: string[];
  lifestyle: string[];
  goals: string;
}

export interface IntakeStartResponse {
  agentMessage: string;
  intakeSessionId: string;
}

export interface IntakeNextResponse {
  agentMessage: string;
  done: boolean;
  extracted?: ExtractedProfile;
  summary?: string[];
}

// ─── Helpers ──────────────────────────────────────────────

/** Try to parse the *first* JSON object / array in the raw model output. */
function extractJSON(raw: string): any {
  const stripped = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');
  const start = stripped.search(/[{\[]/);
  if (start === -1) throw new Error('No JSON found in model output');

  const openChar = stripped[start];
  const closeChar = openChar === '{' ? '}' : ']';
  let depth = 0;
  for (let i = start; i < stripped.length; i++) {
    if (stripped[i] === openChar) depth++;
    else if (stripped[i] === closeChar) depth--;
    if (depth === 0) {
      return JSON.parse(stripped.slice(start, i + 1));
    }
  }
  throw new Error('Unbalanced JSON in model output');
}

// ─── Core inference function ──────────────────────────────

/**
 * Call 0G Compute inference and return parsed JSON.
 * Uses raw fetch — no Node.js-only broker SDK dependencies.
 * Retries once on JSON-parse failure.
 */
export async function inferJSON<T = any>(params: InferJSONParams): Promise<T> {
  const {
    systemPrompt,
    userPrompt,
    model = 'qwen/qwen-2.5-7b-instruct',
    temperature = 0.2,
    maxTokens = 900,
  } = params;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userPrompt },
  ];

  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  let rawContent: string;

  try {
    rawContent = await callInference(body);
  } catch (networkErr) {
    console.error('[0gCompute] inference call failed:', networkErr);
    throw networkErr;
  }

  // Attempt 1: parse JSON from the response
  try {
    return extractJSON(rawContent) as T;
  } catch {
    console.warn('[0gCompute] JSON parse failed, retrying with correction prompt...');
    const retryMessages = [
      ...messages,
      { role: 'assistant' as const, content: rawContent },
      {
        role: 'user' as const,
        content:
          'Your previous reply was not valid JSON. Please return ONLY a valid JSON object matching the requested schema, with no markdown fences or extra text.',
      },
    ];

    const retryBody = { ...body, messages: retryMessages };
    const retryContent = await callInference(retryBody);
    return extractJSON(retryContent) as T;
  }
}

// ─── Low-level call (raw fetch only — no broker SDK) ──────

async function callInference(body: Record<string, any>): Promise<string> {
  const serviceUrl = getEndpoint();

  if (!serviceUrl) {
    throw new Error(
      '[0gCompute] No service URL configured. Set NEXT_PUBLIC_0G_ENDPOINT or OG_ENDPOINT.'
    );
  }

  const url = serviceUrl.replace(/\/+$/, '') + '/v1/proxy/chat/completions';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`[0gCompute] HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('[0gCompute] Empty response from model');
  }

  return content;
}

// ═══════════════════════════════════════════════════════════
// LEGACY SHIM — ZeroGComputeClient
// Used by profile/page.tsx and IntakeChat.tsx
// Preserves the old mock intake questionnaire flow
// ═══════════════════════════════════════════════════════════

const QUESTION_BANK = [
  "What are your main hobbies or interests?",
  "How would you describe your communication style?",
  "What do you value most in a relationship?",
  "Are there any absolute dealbreakers for you?",
  "How do you typically spend your weekends?",
  "What are your long-term life goals?",
  "Do you prefer quiet nights in or social outings?",
  "How important is physical fitness in your life?",
  "What's your approach to work-life balance?",
  "How do you handle conflicts or disagreements?",
];

function extractProfileFromHistory(history: IntakeMessage[]): ExtractedProfile {
  const userMessages = history.filter(m => m.role === 'user').map(m => m.content.toLowerCase());
  const allText = userMessages.join(' ');

  const interests: string[] = [];
  const values: string[] = [];
  const dealbreakers: string[] = [];
  const lifestyle: string[] = [];

  if (allText.includes('read')) interests.push('reading');
  if (allText.includes('gym') || allText.includes('fitness')) interests.push('fitness');
  if (allText.includes('cook')) interests.push('cooking');
  if (allText.includes('travel')) interests.push('travel');
  if (allText.includes('music')) interests.push('music');
  if (allText.includes('art')) interests.push('art');
  if (allText.includes('tech') || allText.includes('code')) interests.push('technology');
  if (allText.includes('outdoor') || allText.includes('hike')) interests.push('outdoors');

  if (allText.includes('honest') || allText.includes('truth')) values.push('honesty');
  if (allText.includes('loyal')) values.push('loyalty');
  if (allText.includes('family')) values.push('family');
  if (allText.includes('ambition') || allText.includes('career')) values.push('ambition');
  if (allText.includes('kind') || allText.includes('compassion')) values.push('kindness');

  if (allText.includes('smoke') || allText.includes('smoking')) dealbreakers.push('smoking');
  if (allText.includes('dishonest') || allText.includes('lie')) dealbreakers.push('dishonesty');

  if (allText.includes('active') || allText.includes('exercise')) lifestyle.push('active');
  if (allText.includes('introvert') || allText.includes('quiet')) lifestyle.push('introverted');
  if (allText.includes('social') || allText.includes('outgoing')) lifestyle.push('social');

  let communicationStyle = 'balanced';
  if (allText.includes('direct') || allText.includes('straightforward')) communicationStyle = 'direct';
  else if (allText.includes('gentle') || allText.includes('diplomatic')) communicationStyle = 'diplomatic';

  let goals = 'seeking meaningful connection';
  if (allText.includes('marriage') || allText.includes('long-term')) goals = 'long-term commitment';
  else if (allText.includes('casual') || allText.includes('take it slow')) goals = 'taking things slow';

  return {
    interests: interests.length > 0 ? interests : ['general conversation'],
    values: values.length > 0 ? values : ['respect', 'communication'],
    communicationStyle,
    dealbreakers: dealbreakers.length > 0 ? dealbreakers : ['none specified'],
    lifestyle: lifestyle.length > 0 ? lifestyle : ['flexible'],
    goals,
  };
}

function generateSummary(profile: ExtractedProfile): string[] {
  return [
    `Interests: ${profile.interests.join(', ')}`,
    `Values: ${profile.values.join(', ')}`,
    `Communication style: ${profile.communicationStyle}`,
    `Dealbreakers: ${profile.dealbreakers.join(', ')}`,
    `Lifestyle: ${profile.lifestyle.join(', ')}`,
    `Relationship goals: ${profile.goals}`,
  ];
}

function generateEmbedding(profile: ExtractedProfile): number[] {
  const embedding = new Array(128).fill(0);
  const simpleHash = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  };

  profile.interests.forEach((interest) => {
    embedding[simpleHash(interest) % 128] += 0.5;
  });
  profile.values.forEach((value) => {
    embedding[(simpleHash(value) + 20) % 128] += 0.4;
  });
  profile.lifestyle.forEach((item) => {
    embedding[(simpleHash(item) + 40) % 128] += 0.3;
  });

  const magnitude = Math.sqrt(embedding.reduce((sum: number, val: number) => sum + val * val, 0));
  return embedding.map((val: number) => val / (magnitude || 1));
}

export class ZeroGComputeClient {
  private questionIndex = 0;

  async startIntake(): Promise<IntakeStartResponse> {
    this.questionIndex = 0;
    return {
      agentMessage: "Hi! I'm here to help you find your perfect match. Let's start: " + QUESTION_BANK[0],
      intakeSessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  async nextQuestion(params: {
    intakeSessionId: string;
    userMessage: string;
    history: IntakeMessage[];
  }): Promise<IntakeNextResponse> {
    this.questionIndex++;
    const maxQuestions = 8;

    if (this.questionIndex >= maxQuestions || this.questionIndex >= QUESTION_BANK.length) {
      const extracted = extractProfileFromHistory(params.history);
      const summary = generateSummary(extracted);
      return {
        agentMessage: "Thank you! Let me summarize what I've learned. Please review:",
        done: true,
        extracted,
        summary,
      };
    }

    return {
      agentMessage: QUESTION_BANK[this.questionIndex],
      done: false,
    };
  }

  async embedProfile(params: {
    imageUrl: string;
    extractedProfile: ExtractedProfile;
  }): Promise<number[]> {
    return generateEmbedding(params.extractedProfile);
  }
}

// Export singleton for backward compatibility
export const zeroGClient = new ZeroGComputeClient();
