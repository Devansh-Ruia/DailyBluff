import { LeaderboardEntry } from '../../shared/types/game';

interface LeaderboardProps {
  leaderboard: LeaderboardEntry[];
  currentPlayerStats?: LeaderboardEntry & { currentStreak: number; longestStreak: number } | null;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ 
  leaderboard, 
  currentPlayerStats 
}) => {
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `#${rank}`;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 2:
        return 'text-gray-600 bg-gray-50 border-gray-200';
      case 3:
        return 'text-orange-600 bg-orange-50 border-orange-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const currentPlayerRank = currentPlayerStats 
    ? leaderboard.findIndex(entry => entry.odname === currentPlayerStats.odname) + 1
    : null;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
      <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        🏆 Leaderboard
      </h3>

      {leaderboard.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">🏆</div>
          <p>No champions yet!</p>
          <p className="text-sm">Be the first to win a game!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((entry, index) => {
            const rank = index + 1;
            const isCurrentPlayer = currentPlayerStats && entry.odname === currentPlayerStats.odname;
            
            return (
              <div
                key={entry.odname}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                  isCurrentPlayer 
                    ? 'bg-orange-50 border-orange-300 shadow-md' 
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${getRankColor(rank)}`}>
                    {getRankIcon(rank)}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">
                      {entry.odname}
                      {isCurrentPlayer && (
                        <span className="ml-2 text-xs bg-orange-200 text-orange-800 px-2 py-1 rounded-full">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      {entry.totalSubmissions} submissions • {entry.totalVotesReceived} votes received
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="font-bold text-lg text-orange-600">
                    {entry.wins}
                  </div>
                  <div className="text-xs text-gray-500">
                    win{entry.wins !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            );
          })}

          {currentPlayerRank && currentPlayerRank > 10 && currentPlayerStats && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="bg-orange-50 border border-orange-300 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-orange-200 text-orange-800 flex items-center justify-center text-sm font-bold">
                      #{currentPlayerRank}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {currentPlayerStats.odname} (You)
                      </div>
                      <div className="text-sm text-gray-600">
                        {currentPlayerStats.totalSubmissions} submissions • {currentPlayerStats.totalVotesReceived} votes received
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg text-orange-600">
                      {currentPlayerStats.wins}
                    </div>
                    <div className="text-xs text-gray-500">
                      win{currentPlayerStats.wins !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {currentPlayerStats && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">Your Stats</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Current Streak:</span>
                <span className="ml-2 font-medium text-blue-800">
                  {currentPlayerStats.currentStreak} day{currentPlayerStats.currentStreak !== 1 ? 's' : ''}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Longest Streak:</span>
                <span className="ml-2 font-medium text-blue-800">
                  {currentPlayerStats.longestStreak} day{currentPlayerStats.longestStreak !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
