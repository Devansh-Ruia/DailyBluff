import { Submission } from '../../shared/types/game';

interface VotingCardProps {
  submission: Submission;
  currentUsername: string;
  phase: 'submission' | 'voting' | 'results';
  onVote: (submissionId: string) => Promise<boolean>;
  hasVoted: boolean;
  userVotes: string[];
}

export const VotingCard: React.FC<VotingCardProps> = ({ 
  submission, 
  currentUsername, 
  phase, 
  onVote, 
  hasVoted,
  userVotes 
}) => {
  const isOwnSubmission = submission.odname === currentUsername;
  const hasUserVotedForThis = userVotes.includes(submission.id);
  const canVote = phase === 'voting' && !isOwnSubmission && !hasVoted && !hasUserVotedForThis;

  const handleVote = async () => {
    if (canVote) {
      await onVote(submission.id);
    }
  };

  const showVotes = phase === 'results';
  const showAuthor = phase === 'results';

  return (
    <div className={`bg-white rounded-lg shadow-md p-4 mb-3 border transition-all ${
      hasUserVotedForThis ? 'border-orange-400 bg-orange-50' : 'border-gray-200'
    } ${canVote ? 'hover:shadow-lg hover:border-orange-300 cursor-pointer' : ''}`}>
      
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="text-gray-900 text-lg mb-2">
            "{submission.answer}"
          </p>
          
          {showAuthor && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="font-medium">— {submission.odname}</span>
              {submission.votes > 0 && (
                <span className="text-orange-600 font-semibold">
                  🏆 {submission.votes} vote{submission.votes !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>
        
        <div className="flex flex-col items-end gap-2">
          {canVote && (
            <button
              onClick={handleVote}
              className="bg-orange-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-orange-600 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
              </svg>
              Vote
            </button>
          )}
          
          {hasUserVotedForThis && (
            <div className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
              ✓ Voted
            </div>
          )}
          
          {isOwnSubmission && phase === 'voting' && (
            <div className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-medium">
              Your Answer
            </div>
          )}
          
          {showVotes && (
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{submission.votes}</div>
              <div className="text-xs text-gray-500">vote{submission.votes !== 1 ? 's' : ''}</div>
            </div>
          )}
        </div>
      </div>
      
      {showVotes && submission.votes > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {submission.votes === 1 ? '1 person voted' : `${submission.votes} people voted`}
            </span>
            {submission.votes === 1 && (
              <span className="text-orange-600 font-medium">👑 Winner!</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
