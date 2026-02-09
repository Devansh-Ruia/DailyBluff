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

  // Send message to Devvit backend
  const sendMessage = (type: string, data?: any) => {
    if (window.parent !== window) {
      window.parent.postMessage({
        type,
        data
      }, '*');
    }
  };

  // Listen for messages from Devvit backend
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      
      // Check if this is a Devvit message
      if (msg.type === 'devvit-message') {
        const { type, data, error: messageError } = msg.data.message;
        
        switch (type) {
          case 'GAME_STATE':
            setGameState(data);
            setUsername(data.username || 'anonymous');
            setLoading(false);
            break;
          case 'SUBMIT_SUCCESS':
            if (gameState) {
              setGameState({
                ...gameState,
                submissions: [...gameState.submissions, data]
              });
            }
            break;
          case 'VOTE_SUCCESS':
            if (gameState) {
              setGameState({
                ...gameState,
                submissions: gameState.submissions.map(s => 
                  s.id === data.submissionId 
                    ? { ...s, votes: s.votes + 1 }
                    : s
                )
              });
            }
            break;
          case 'LEADERBOARD':
            setLeaderboard(data);
            break;
          case 'PLAYER_STATS':
            setCurrentPlayerStats(data);
            break;
          case 'ERROR':
            setError(messageError || 'Unknown error');
            break;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Load initial game state
    sendMessage('GET_GAME_STATE');

    return () => {
      window.removeEventListener('message', handleMessage);
    };
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

  // Submit an answer
  const handleSubmitAnswer = async (answer: string): Promise<boolean> => {
    sendMessage('SUBMIT_ANSWER', { answer });
    return true;
  };

  // Vote for an answer
  const handleVote = async (submissionId: string): Promise<boolean> => {
    sendMessage('VOTE', { submissionId });
    return true;
  };

  // Fetch leaderboard
  const fetchLeaderboard = () => {
    sendMessage('GET_LEADERBOARD');
  };

  // Fetch player stats
  const fetchPlayerStats = () => {
    sendMessage('GET_PLAYER_STATS');
  };

  // Refresh all data
  const handleRefresh = () => {
    sendMessage('GET_GAME_STATE');
    fetchLeaderboard();
    fetchPlayerStats();
  };

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
          {gameState && (
            <QuestionDisplay
              question={gameState.currentQuestion}
              phase={gameState.phase}
              phaseEndsAt={gameState.phaseEndsAt}
            />
          )}
        </div>

        {/* Game Content */}
        {gameState && gameState.phase === 'submission' && (
          <AnswerSubmission
            gameState={gameState}
            username={username}
            onSubmit={handleSubmitAnswer}
          />
        )}

        {gameState && gameState.phase === 'voting' && (
          <AnswerList
            gameState={gameState}
            currentUsername={username}
            onVote={handleVote}
            userVotes={userVotes}
          />
        )}

        {gameState && gameState.phase === 'results' && (
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
