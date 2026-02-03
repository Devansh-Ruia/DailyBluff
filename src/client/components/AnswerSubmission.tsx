import { useState } from 'react';
import { GameState } from '../../shared/types/game';

interface AnswerSubmissionProps {
  gameState: GameState;
  username: string;
  onSubmit: (answer: string) => Promise<boolean>;
}

export const AnswerSubmission: React.FC<AnswerSubmissionProps> = ({ gameState, username, onSubmit }) => {
  const [answer, setAnswer] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!answer.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      const success = await onSubmit(answer.trim());
      if (success) {
        setHasSubmitted(true);
        setAnswer('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const userSubmission = gameState.submissions.find(s => s.odname === username);
  const canSubmit = gameState.phase === 'submission' && !userSubmission && !hasSubmitted;

  if (userSubmission || hasSubmitted) {
    const submission = userSubmission || { answer: 'Your answer has been submitted!' };
    
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-green-800">Answer Submitted!</h3>
        </div>
        <div className="bg-white rounded-lg p-4 border border-green-100">
          <p className="text-gray-900 italic">"{submission.answer}"</p>
        </div>
        <p className="text-sm text-green-700 mt-3">
          Come back during the voting phase to vote for your favorites!
        </p>
      </div>
    );
  }

  if (!canSubmit) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Submit Your Wrong Answer
      </h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your creative wrong answer here... (280 characters max)"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none transition-colors"
            rows={3}
            maxLength={280}
            disabled={isSubmitting}
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm text-gray-500">
              {answer.length}/280 characters
            </span>
            <span className="text-sm text-gray-500">
              Be creative, funny, and completely wrong!
            </span>
          </div>
        </div>
        
        <button
          type="submit"
          disabled={!answer.trim() || isSubmitting}
          className="w-full bg-orange-500 text-white py-3 px-6 rounded-lg font-medium hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Answer'}
        </button>
      </form>
      
      <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
        <p className="text-sm text-orange-800">
          <strong>Remember:</strong> The goal is to be creative and entertaining! The most popular wrong answer wins.
        </p>
      </div>
    </div>
  );
};
