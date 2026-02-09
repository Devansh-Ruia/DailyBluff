import { useState, useEffect } from 'react';
import { QuestionDisplay } from '../components/QuestionDisplay';
import { AnswerSubmission } from '../components/AnswerSubmission';
import { AnswerList } from '../components/AnswerList';
import { Leaderboard } from '../components/Leaderboard';
import { LeaderboardEntry } from '../../shared/types/game';

interface GameState {
  currentQuestion: {
    id: string;
    text: string;
    category: string;
    correctAnswer: string;
    date: string;
  };
  phase: 'submission' | 'voting' | 'results';
  phaseEndsAt: number;
  submissions: Array<{
    id: string;
    odId: string;
    odname: string;
    answer: string;
    timestamp: number;
    votes: number;
    voterIds: string[];
  }>;
}

export const WrongAnswersOnlyApp: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [username, setUsername] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [currentPlayerStats, setCurrentPlayerStats] = useState<any>(null);
  const [userVotes, setUserVotes] = useState<string[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Fetch game state from Express API
  const fetchGameState = async () => {
    try {
      const response = await fetch('/api/game');
      if (!response.ok) throw new Error('Failed to fetch game state');
      const data = await response.json();
      setGameState(data);
      setUsername(data.username || 'anonymous');
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  // Submit an answer
  const handleSubmitAnswer = async (answer: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answer }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to submit answer');
        return false;
      }

      const result = await response.json();
      if (gameState) {
        setGameState({
          ...gameState,
          submissions: [...gameState.submissions, result.data]
        });
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  };

  // Vote for an answer
  const handleVote = async (submissionId: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ submissionId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to vote');
        return false;
      }

      const result = await response.json();
      if (gameState) {
        setGameState({
          ...gameState,
          submissions: gameState.submissions.map(s => 
            s.id === result.data.submissionId 
              ? { ...s, votes: s.votes + 1 }
              : s
          )
        });
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  };

  // Fetch leaderboard
  const fetchLeaderboard = async () => {
    try {
      const response = await fetch('/api/leaderboard');
      if (!response.ok) throw new Error('Failed to fetch leaderboard');
      const data = await response.json();
      setLeaderboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Fetch player stats
  const fetchPlayerStats = async () => {
    try {
      const response = await fetch('/api/player-stats');
      if (!response.ok) throw new Error('Failed to fetch player stats');
      const data = await response.json();
      setCurrentPlayerStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Refresh all data
  const handleRefresh = () => {
    fetchGameState();
    fetchLeaderboard();
    fetchPlayerStats();
  };

  // Load initial data
  useEffect(() => {
    fetchGameState();
    fetchLeaderboard();
    fetchPlayerStats();
  }, []);

  // Update user votes when game state changes
  useEffect(() => {
    if (gameState) {
      const votes = gameState.submissions
        .filter(s => s.voterIds.includes(username))
        .map(s => s.id);
      setUserVotes(votes);
    }
  }, [gameState, username]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Wrong Answers Only...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto border border-red-200">
          <div className="text-red-600 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Something went wrong</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-orange-500 text-white py-2 px-4 rounded-lg hover:bg-orange-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🎯</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Wrong Answers Only</h1>
          <p className="text-gray-600">Game not found or still initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">🎯 Wrong Answers Only</h1>
            <div className="flex gap-4">
              <button
                onClick={() => setShowLeaderboard(!showLeaderboard)}
                className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition-colors"
              >
                {showLeaderboard ? 'Game' : 'Leaderboard'}
              </button>
              <button
                onClick={handleRefresh}
                className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Game Info */}
          <QuestionDisplay
            question={gameState.currentQuestion}
            phase={gameState.phase}
            phaseEndsAt={gameState.phaseEndsAt}
          />
        </div>

        {/* Game Content */}
        {gameState.phase === 'submission' && (
          <AnswerSubmission
            gameState={gameState}
            username={username}
            onSubmit={handleSubmitAnswer}
          />
        )}

        {gameState.phase === 'voting' && (
          <AnswerList
            gameState={gameState}
            currentUsername={username}
            onVote={handleVote}
            userVotes={userVotes}
          />
        )}

        {gameState.phase === 'results' && (
          <AnswerList
            gameState={gameState}
            currentUsername={username}
            onVote={handleVote}
            userVotes={userVotes}
          />
        )}

        {/* Leaderboard */}
        {showLeaderboard && (
          <Leaderboard
            leaderboard={leaderboard}
            currentPlayerStats={currentPlayerStats}
            onRefresh={fetchLeaderboard}
          />
        )}
      </div>
    </div>
  );
};
