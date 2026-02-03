import { GameState } from '../../shared/types/game';
import { VotingCard } from './VotingCard';

interface AnswerListProps {
  gameState: GameState;
  currentUsername: string;
  onVote: (submissionId: string) => Promise<boolean>;
  userVotes: string[];
}

export const AnswerList: React.FC<AnswerListProps> = ({ 
  gameState, 
  currentUsername, 
  onVote, 
  userVotes 
}) => {
  const { phase, submissions } = gameState;

  if (submissions.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <div className="text-gray-400 mb-2">
          <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {phase === 'submission' ? 'No answers yet' : 'No answers submitted'}
        </h3>
        <p className="text-gray-600">
          {phase === 'submission' 
            ? 'Be the first to submit a creative wrong answer!' 
            : 'No one submitted an answer for this question.'
          }
        </p>
      </div>
    );
  }

  const sortedSubmissions = [...submissions].sort((a, b) => {
    if (phase === 'results') {
      return b.votes - a.votes;
    }
    return 0;
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {phase === 'submission' && `${submissions.length} Answer${submissions.length !== 1 ? 's' : ''} Submitted`}
          {phase === 'voting' && `${submissions.length} Answer${submissions.length !== 1 ? 's' : ''} to Vote On`}
          {phase === 'results' && 'Final Results'}
        </h3>
        
        {phase === 'voting' && (
          <div className="text-sm text-gray-600">
            {3 - userVotes.length} vote{3 - userVotes.length !== 1 ? 's' : ''} remaining
          </div>
        )}
      </div>

      {sortedSubmissions.map((submission) => (
        <VotingCard
          key={submission.id}
          submission={submission}
          currentUsername={currentUsername}
          phase={phase}
          onVote={onVote}
          hasVoted={userVotes.length >= 3}
          userVotes={userVotes}
        />
      ))}

      {phase === 'results' && sortedSubmissions[0] && sortedSubmissions[0].votes > 0 && (
        <div className="mt-6 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🏆</div>
            <div>
              <h4 className="font-semibold text-orange-900">Today's Winner!</h4>
              <p className="text-orange-700">
                {sortedSubmissions[0]?.odname} with {sortedSubmissions[0]?.votes} vote{(sortedSubmissions[0]?.votes ?? 0) !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
