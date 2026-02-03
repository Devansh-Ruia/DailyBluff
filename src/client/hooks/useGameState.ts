import { useState, useEffect } from 'react';
import { GameState, Submission, PlayerStats, LeaderboardEntry } from '../../shared/types/game';

const API_BASE = '/api';

interface ApiResponse<T> {
  type: string;
  data?: T;
  error?: string;
}

export const useGameState = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [username, setUsername] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const fetchGameState = async () => {
    try {
      const response = await fetch(`${API_BASE}/game-state`);
      const result: ApiResponse<GameState & { username: string; currentTime: number }> = await response.json();
      
      if (result.type === 'GAME_STATE' && result.data) {
        setGameState(result.data);
        setUsername(result.data.username);
      } else if (result.type === 'ERROR') {
        setError(result.error || 'Failed to fetch game state');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGameState();
    
    const interval = setInterval(fetchGameState, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const submitAnswer = async (answer: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/submit-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer })
      });
      
      const result: ApiResponse<Submission> = await response.json();
      
      if (result.type === 'SUBMIT_SUCCESS') {
        await fetchGameState();
        return true;
      } else if (result.type === 'ERROR') {
        setError(result.error || 'Failed to submit answer');
        return false;
      }
    } catch (err) {
      setError('Network error');
    }
    return false;
  };

  const vote = async (submissionId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId })
      });
      
      const result: ApiResponse<{ submissionId: string }> = await response.json();
      
      if (result.type === 'VOTE_SUCCESS') {
        await fetchGameState();
        return true;
      } else if (result.type === 'ERROR') {
        setError(result.error || 'Failed to vote');
        return false;
      }
    } catch (err) {
      setError('Network error');
    }
    return false;
  };

  const getLeaderboard = async (): Promise<LeaderboardEntry[]> => {
    try {
      const response = await fetch(`${API_BASE}/leaderboard`);
      const result: ApiResponse<LeaderboardEntry[]> = await response.json();
      
      if (result.type === 'LEADERBOARD' && result.data) {
        return result.data;
      }
    } catch (err) {
      setError('Failed to fetch leaderboard');
    }
    return [];
  };

  const getPlayerStats = async (): Promise<PlayerStats | null> => {
    try {
      const response = await fetch(`${API_BASE}/player-stats`);
      const result: ApiResponse<PlayerStats> = await response.json();
      
      if (result.type === 'PLAYER_STATS' && result.data) {
        return result.data;
      }
    } catch (err) {
      setError('Failed to fetch player stats');
    }
    return null;
  };

  return {
    gameState,
    username,
    loading,
    error,
    submitAnswer,
    vote,
    getLeaderboard,
    getPlayerStats,
    refreshGameState: fetchGameState
  };
};
