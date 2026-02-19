/**
 * 0g Labs Compute Client - AI Service Abstraction
 *
 * This module abstracts all AI operations for the matchmaking system.
 *
 * DEMO MODE: Uses deterministic MOCK implementation
 * PRODUCTION: Replace with actual 0g compute endpoint calls
 */

// =====================
// TYPES
// =====================

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

export interface MatchCandidate {
  wallet: string;
  embedding: number[];
}

export interface RankedMatch {
  wallet: string;
  score: number;
}

// =====================
// MOCK IMPLEMENTATION
// =====================

/**
 * Fixed question bank for deterministic demo
 */
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

/**
 * Simple branching logic for adaptive questions
 */
function shouldAskBranchQuestion(history: IntakeMessage[]): { ask: boolean; question: string } | null {
  const userMessages = history.filter(m => m.role === 'user').map(m => m.content.toLowerCase());
  const lastMessage = userMessages[userMessages.length - 1] || '';

  // Fitness branch
  if ((lastMessage.includes('fitness') || lastMessage.includes('gym') || lastMessage.includes('sports')) &&
      !userMessages.some(m => m.includes('workout') || m.includes('exercise'))) {
    return {
      ask: true,
      question: "That's interesting! How often do you work out or stay active?"
    };
  }

  // Introvert branch
  if ((lastMessage.includes('introvert') || lastMessage.includes('quiet') || lastMessage.includes('alone')) &&
      !userMessages.some(m => m.includes('date') || m.includes('setting'))) {
    return {
      ask: true,
      question: "I understand. What kind of date setting would make you most comfortable?"
    };
  }

  // Travel branch
  if (lastMessage.includes('travel') &&
      !userMessages.some(m => m.includes('frequency') || m.includes('often'))) {
    return {
      ask: true,
      question: "How often do you like to travel, and what's your travel style?"
    };
  }

  return null;
}

/**
 * Extract structured profile from conversation history
 */
function extractProfileFromHistory(history: IntakeMessage[]): ExtractedProfile {
  const userMessages = history.filter(m => m.role === 'user').map(m => m.content.toLowerCase());
  const allText = userMessages.join(' ');

  // Simple keyword extraction
  const interests: string[] = [];
  const values: string[] = [];
  const dealbreakers: string[] = [];
  const lifestyle: string[] = [];

  // Interests detection
  if (allText.includes('read')) interests.push('reading');
  if (allText.includes('gym') || allText.includes('fitness')) interests.push('fitness');
  if (allText.includes('cook')) interests.push('cooking');
  if (allText.includes('travel')) interests.push('travel');
  if (allText.includes('music')) interests.push('music');
  if (allText.includes('art')) interests.push('art');
  if (allText.includes('tech') || allText.includes('code')) interests.push('technology');
  if (allText.includes('outdoor') || allText.includes('hike')) interests.push('outdoors');

  // Values detection
  if (allText.includes('honest') || allText.includes('truth')) values.push('honesty');
  if (allText.includes('loyal')) values.push('loyalty');
  if (allText.includes('family')) values.push('family');
  if (allText.includes('ambition') || allText.includes('career')) values.push('ambition');
  if (allText.includes('kind') || allText.includes('compassion')) values.push('kindness');

  // Dealbreakers detection
  if (allText.includes('smoke') || allText.includes('smoking')) dealbreakers.push('smoking');
  if (allText.includes('dishonest') || allText.includes('lie')) dealbreakers.push('dishonesty');
  if (allText.includes('no kids') || allText.includes('child-free')) dealbreakers.push('wants children');

  // Lifestyle detection
  if (allText.includes('active') || allText.includes('exercise')) lifestyle.push('active');
  if (allText.includes('introvert') || allText.includes('quiet')) lifestyle.push('introverted');
  if (allText.includes('social') || allText.includes('outgoing')) lifestyle.push('social');
  if (allText.includes('work-life balance')) lifestyle.push('balanced');

  // Communication style
  let communicationStyle = 'balanced';
  if (allText.includes('direct') || allText.includes('straightforward')) {
    communicationStyle = 'direct';
  } else if (allText.includes('gentle') || allText.includes('diplomatic')) {
    communicationStyle = 'diplomatic';
  }

  // Goals
  let goals = 'seeking meaningful connection';
  if (allText.includes('marriage') || allText.includes('long-term')) {
    goals = 'long-term commitment';
  } else if (allText.includes('casual') || allText.includes('take it slow')) {
    goals = 'taking things slow';
  }

  return {
    interests: interests.length > 0 ? interests : ['general conversation'],
    values: values.length > 0 ? values : ['respect', 'communication'],
    communicationStyle,
    dealbreakers: dealbreakers.length > 0 ? dealbreakers : ['none specified'],
    lifestyle: lifestyle.length > 0 ? lifestyle : ['flexible'],
    goals,
  };
}

/**
 * Generate summary bullets from extracted profile
 */
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

/**
 * Simple embedding generation (deterministic for demo)
 */
function generateEmbedding(profile: ExtractedProfile, imageUrl: string): number[] {
  // In production, this would call 0g compute to generate real embeddings
  // For demo: create deterministic 128-dim vector based on profile features
  const embedding = new Array(128).fill(0);

  // Hash interests into embedding dimensions
  profile.interests.forEach((interest, idx) => {
    const hash = simpleHash(interest);
    embedding[hash % 128] += 0.5;
  });

  // Hash values
  profile.values.forEach((value, idx) => {
    const hash = simpleHash(value);
    embedding[(hash + 20) % 128] += 0.4;
  });

  // Add noise from lifestyle
  profile.lifestyle.forEach((item, idx) => {
    const hash = simpleHash(item);
    embedding[(hash + 40) % 128] += 0.3;
  });

  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / (magnitude || 1));
}

/**
 * Simple hash function for deterministic embedding generation
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

// =====================
// PUBLIC API
// =====================

export class ZeroGComputeClient {
  private questionIndex = 0;
  private branchQuestions: string[] = [];

  /**
   * Start a new intake session
   */
  async startIntake(): Promise<IntakeStartResponse> {
    // PRODUCTION: POST to 0g compute endpoint
    // const response = await fetch(`${process.env.NEXT_PUBLIC_0G_ENDPOINT}/intake/start`, {
    //   method: 'POST',
    //   headers: { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_0G_API_KEY}` }
    // });
    // return response.json();

    // MOCK:
    this.questionIndex = 0;
    this.branchQuestions = [];

    return {
      agentMessage: "Hi! I'm here to help you find your perfect match. I'll ask you a few questions to understand you better. Let's start: " + QUESTION_BANK[0],
      intakeSessionId: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  /**
   * Process user response and get next question or finalize
   */
  async nextQuestion(params: {
    intakeSessionId: string;
    userMessage: string;
    history: IntakeMessage[];
  }): Promise<IntakeNextResponse> {
    const { intakeSessionId, userMessage, history } = params;

    // PRODUCTION: POST to 0g compute endpoint
    // const response = await fetch(`${process.env.NEXT_PUBLIC_0G_ENDPOINT}/intake/next`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${process.env.NEXT_PUBLIC_0G_API_KEY}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({ sessionId: intakeSessionId, message: userMessage, history })
    // });
    // return response.json();

    // MOCK:
    this.questionIndex++;

    // Check if user gave very short answer (< 10 words)
    const isShortAnswer = userMessage.split(' ').length < 10;

    // Check for branch questions
    const branchCheck = shouldAskBranchQuestion(history);
    if (branchCheck && branchCheck.ask && !this.branchQuestions.includes(branchCheck.question)) {
      this.branchQuestions.push(branchCheck.question);
      return {
        agentMessage: branchCheck.question,
        done: false,
      };
    }

    // Decide when to stop (8 base questions, up to 10 if short answers)
    const maxQuestions = isShortAnswer ? 10 : 8;
    const totalAsked = this.questionIndex + this.branchQuestions.length;

    if (totalAsked >= maxQuestions || this.questionIndex >= QUESTION_BANK.length) {
      // Finalize
      const extracted = extractProfileFromHistory(history);
      const summary = generateSummary(extracted);

      return {
        agentMessage: "Thank you for sharing! Let me summarize what I've learned about you. Please review and confirm if this looks correct.",
        done: true,
        extracted,
        summary,
      };
    }

    // Continue with next question
    return {
      agentMessage: QUESTION_BANK[this.questionIndex],
      done: false,
    };
  }

  /**
   * Generate embedding for a completed profile
   */
  async embedProfile(params: {
    imageUrl: string;
    extractedProfile: ExtractedProfile;
  }): Promise<number[]> {
    const { imageUrl, extractedProfile } = params;

    // PRODUCTION: POST to 0g compute endpoint
    // const response = await fetch(`${process.env.NEXT_PUBLIC_0G_ENDPOINT}/embed`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${process.env.NEXT_PUBLIC_0G_API_KEY}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({ imageUrl, profile: extractedProfile })
    // });
    // const data = await response.json();
    // return data.embedding;

    // MOCK:
    return generateEmbedding(extractedProfile, imageUrl);
  }

  /**
   * Rank match candidates by similarity
   */
  async rankMatches(params: {
    userEmbedding: number[];
    candidateEmbeddings: MatchCandidate[];
  }): Promise<RankedMatch[]> {
    const { userEmbedding, candidateEmbeddings } = params;

    // PRODUCTION: POST to 0g compute endpoint
    // const response = await fetch(`${process.env.NEXT_PUBLIC_0G_ENDPOINT}/rank`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${process.env.NEXT_PUBLIC_0G_API_KEY}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({ userEmbedding, candidates: candidateEmbeddings })
    // });
    // return response.json();

    // MOCK: Compute cosine similarity
    const ranked = candidateEmbeddings.map(candidate => ({
      wallet: candidate.wallet,
      score: cosineSimilarity(userEmbedding, candidate.embedding),
    }));

    // Sort descending by score
    ranked.sort((a, b) => b.score - a.score);

    return ranked;
  }
}

// Export singleton instance
export const zeroGClient = new ZeroGComputeClient();
