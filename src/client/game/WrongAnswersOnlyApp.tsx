import { useState, useEffect } from 'react';
import { QuestionDisplay } from '../components/QuestionDisplay';
import { AnswerSubmission } from '../components/AnswerSubmission';
import { AnswerList } from '../components/AnswerList';
import { Leaderboard } from '../components/Leaderboard';
import { useGameState } from '../hooks/useGameState';
import { LeaderboardEntry } from '../../shared/types/game';

export const WrongAnswersOnlyApp: React.FC = () => {
  const { 
    gameState, 
    username, 
    loading, 
    error, 
    submitAnswer, 
    vote, 
    getLeaderboard, 
    getPlayerStats 
  } = useGameState();

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [currentPlayerStats, setCurrentPlayerStats] = useState<any>(null);
  const [userVotes, setUserVotes] = useState<string[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  useEffect(() => {
    if (gameState) {
      const votes = gameState.submissions
        .filter(s => s.voterIds.includes(username))
        .map(s => s.id);
      setUserVotes(votes);
    }
  }, [gameState, username]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const data = await getLeaderboard();
      setLeaderboard(data);
    };
    
    const fetchPlayerStats = async () => {
      const stats = await getPlayerStats();
      setCurrentPlayerStats(stats);
    };

    fetchLeaderboard();
    fetchPlayerStats();
  }, [getLeaderboard, getPlayerStats]);

  const handleVote = async (submissionId: string) => {
    const success = await vote(submissionId);
    if (success) {
      setUserVotes(prev => [...prev, submissionId]);
    }
    return success;
  };

  const handleRefresh = async () => {
    const leaderboardData = await getLeaderboard();
    setLeaderboard(leaderboardData);
    
    const stats = await getPlayerStats();
    setCurrentPlayerStats(stats);
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
        <header className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="text-3xl">🎯</div>
            <h1 className="text-3xl font-bold text-gray-900">Wrong Answers Only</h1>
          </div>
          <p className="text-gray-600">A daily trivia game where creativity wins!</p>
        </header>

        <div className="flex justify-center gap-4 mb-6">
          <button
            onClick={() => setShowLeaderboard(false)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              !showLeaderboard 
                ? 'bg-orange-500 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Game
          </button>
          <button
            onClick={() => setShowLeaderboard(true)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              showLeaderboard 
                ? 'bg-orange-500 text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Leaderboard
          </button>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-white text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Refresh
          </button>
        </div>

        {showLeaderboard ? (
          <Leaderboard 
            leaderboard={leaderboard} 
            currentPlayerStats={currentPlayerStats}
          />
        ) : (
          <div>
            <QuestionDisplay gameState={gameState} username={username} />
            
            {gameState.phase === 'submission' && (
              <AnswerSubmission 
                gameState={gameState}
                username={username}
                onSubmit={submitAnswer}
              />
            )}
            
            {(gameState.phase === 'voting' || gameState.phase === 'results') && (
              <AnswerList
                gameState={gameState}
                currentUsername={username}
                onVote={handleVote}
                userVotes={userVotes}
              />
            )}

            {gameState.phase === 'results' && (
              <div className="mt-6 bg-white rounded-lg shadow-lg p-6 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Share Your Results</h3>
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <p className="text-sm text-gray-600 mb-2">Copy this to share your performance:</p>
                  <div className="bg-white border border-gray-200 rounded p-3 text-sm">
                    🎯 Wrong Answers Only - {new Date().toLocaleDateString()}
                    <br />
                    Q: {gameState.currentQuestion.text}
                    <br />
                    My answer: "{gameState.submissions.find(s => s.odname === username)?.answer || 'Did not play'}"
                    <br />
                    Rank: #{gameState.submissions.sort((a, b) => b.votes - a.votes).findIndex(s => s.odname === username) + 1} of {gameState.submissions.length}
                    <br />
                    Play at r/WrongAnswersOnly
                  </div>
                </div>
                <button
                  onClick={() => {
                    const text = `🎯 Wrong Answers Only - ${new Date().toLocaleDateString()}
Q: ${gameState.currentQuestion.text}
My answer: "${gameState.submissions.find(s => s.odname === username)?.answer || 'Did not play'}"
Rank: #${gameState.submissions.sort((a, b) => b.votes - a.votes).findIndex(s => s.odname === username) + 1} of ${gameState.submissions.length}
Play at r/WrongAnswersOnly`;
                    navigator.clipboard.writeText(text);
                  }}
                  className="w-full bg-orange-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-orange-600 transition-colors"
                >
                  Copy to Clipboard
                </button>
              </div>
            )}
          </div>
        )}

        <footer className="text-center mt-8 text-gray-500 text-sm">
          <p>Daily trivia game for Reddit's Daily Games Hackathon</p>
          <p className="mt-2">
            Made with ❤️ for the Reddit community
          </p>
        </footer>
      </div>
    </div>
  );
};
