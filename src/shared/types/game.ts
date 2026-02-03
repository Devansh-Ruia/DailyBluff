export interface Question {
  id: string;
  text: string;
  category: string;
  correctAnswer: string;
  date: string;
}

export interface Submission {
  id: string;
  odId: string;
  odname: string;
  answer: string;
  timestamp: number;
  votes: number;
  voterIds: string[];
}

export interface PlayerStats {
  odId: string;
  odname: string;
  totalSubmissions: number;
  totalVotesReceived: number;
  wins: number;
  currentStreak: number;
  longestStreak: number;
  lastPlayedDate: string;
}

export interface GameState {
  currentQuestion: Question;
  phase: 'submission' | 'voting' | 'results';
  phaseEndsAt: number;
  submissions: Submission[];
}

export interface GameResults {
  question: Question;
  submissions: Submission[];
  winner: Submission;
  totalPlayers: number;
  date: string;
}

export type WebViewMessage =
  | { type: 'GET_GAME_STATE' }
  | { type: 'SUBMIT_ANSWER'; answer: string }
  | { type: 'VOTE'; submissionId: string }
  | { type: 'GET_LEADERBOARD' }
  | { type: 'GET_PLAYER_STATS' };

export interface WebViewResponse {
  type: 'GAME_STATE' | 'SUBMIT_SUCCESS' | 'VOTE_SUCCESS' | 'LEADERBOARD' | 'PLAYER_STATS' | 'ERROR';
  data?: any;
  error?: string;
}

export interface LeaderboardEntry {
  odname: string;
  wins: number;
  totalSubmissions: number;
  totalVotesReceived: number;
  longestStreak: number;
}
