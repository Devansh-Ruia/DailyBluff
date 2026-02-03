import { GameState } from '../../shared/types/game';

interface QuestionDisplayProps {
  gameState: GameState;
  username: string;
}

export const QuestionDisplay: React.FC<QuestionDisplayProps> = ({ gameState, username }) => {
  const { currentQuestion, phase, phaseEndsAt } = gameState;

  const getTimeRemaining = () => {
    const now = Date.now();
    const remaining = Math.max(0, phaseEndsAt - now);
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getPhaseText = () => {
    switch (phase) {
      case 'submission':
        return 'Submissions Phase';
      case 'voting':
        return 'Voting Phase';
      case 'results':
        return 'Results Phase';
      default:
        return '';
    }
  };

  const getPhaseDescription = () => {
    switch (phase) {
      case 'submission':
        return `Submit your creative wrong answer! Time remaining: ${getTimeRemaining()}`;
      case 'voting':
        return `Vote for your favorite wrong answers! Time remaining: ${getTimeRemaining()}`;
      case 'results':
        return 'Check out the results and see who won!';
      default:
        return '';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border border-gray-200">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
              {currentQuestion.category}
            </span>
            <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              {getPhaseText()}
            </span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {currentQuestion.text}
          </h2>
          <p className="text-gray-600 text-sm">
            {getPhaseDescription()}
          </p>
        </div>
        <div className="text-right ml-4">
          <div className="text-sm text-gray-500">Welcome,</div>
          <div className="text-lg font-semibold text-gray-900">{username}</div>
        </div>
      </div>
      
      {phase === 'submission' && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            💡 <strong>Tip:</strong> The goal is to be creative and funny! The most entertaining wrong answer will win.
          </p>
        </div>
      )}
      
      {phase === 'voting' && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            🗳️ <strong>Vote:</strong> You can vote for up to 3 answers. You cannot vote for your own submission.
          </p>
        </div>
      )}
      
      {phase === 'results' && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">
            🏆 <strong>Results:</strong> The winner has been crowned! Check out the leaderboard below.
          </p>
        </div>
      )}
    </div>
  );
};
