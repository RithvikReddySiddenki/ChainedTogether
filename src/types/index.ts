// Shared TypeScript types

export interface Profile {
  wallet_address: string;
  name: string;
  bio?: string;
  age: number;
  location: string;
  image_url: string;
  answers_json: ExtractedProfile;
  embedding: number[];
  created_at: string;
  updated_at: string;
}

export interface ExtractedProfile {
  interests: string[];
  values: string[];
  communicationStyle: string;
  dealbreakers: string[];
  lifestyle: string[];
  goals: string;
  /** New onboarding fields */
  job?: string;
  hobbies?: string;
  fun?: string;
}

export interface IntakeSession {
  id: string;
  wallet_address: string;
  image_url: string;
  status: 'active' | 'done';
  created_at: string;
  updated_at: string;
}

export interface IntakeMessage {
  id: number;
  session_id: string;
  role: 'agent' | 'user';
  content: string;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  match_id: number;
  sender: string;
  message: string;
  created_at: string;
}

// On-chain types (mirror contract structs)
export enum ProposalStatus {
  OPEN = 0,
  APPROVED = 1,
  REJECTED = 2,
  EXPIRED = 3,
}

export interface MatchProposal {
  userA: string;
  userB: string;
  aiScoreHash: `0x${string}`;
  metadataHash: `0x${string}`;
  createdAt: bigint;
  deadline: bigint;
  yesVotes: number;
  noVotes: number;
  status: ProposalStatus;
}

export interface RankedMatch {
  profile: Profile;
  score: number;
}
