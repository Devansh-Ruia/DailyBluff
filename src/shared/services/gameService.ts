import { GameState, Submission, PlayerStats } from '../types/game';
import { QUESTION_POOL, PHASE_DURATION } from '../constants/questions';

export class GameService {
  static async getCurrentGameState(redis: any, postId: string): Promise<GameState | null> {
    try {
      const gameState = await redis.hGet(`game:${postId}`, 'state');
      return gameState ? JSON.parse(gameState) : null;
    } catch (error) {
      console.error('Error getting game state:', error);
      return null;
    }
  }

  static async saveGameState(redis: any, postId: string, gameState: GameState): Promise<void> {
    try {
      await redis.hSet(`game:${postId}`, { state: JSON.stringify(gameState) });
    } catch (error) {
      console.error('Error saving game state:', error);
      throw error;
    }
  }

  static async initializeGame(redis: any, postId: string): Promise<GameState> {
    const today = new Date().toISOString().split('T')[0];
    if (!today) {
      throw new Error('Could not determine current date');
    }
    
    const availableQuestions = QUESTION_POOL.filter(q => !q.date || q.date < today);
    
    if (availableQuestions.length === 0) {
      throw new Error('No available questions for today');
    }
    
    const randomQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)]!;
    
    randomQuestion.date = today;

    const gameState: GameState = {
      currentQuestion: randomQuestion,
      phase: 'submission',
      phaseEndsAt: Date.now() + PHASE_DURATION.SUBMISSION,
      submissions: []
    };

    await this.saveGameState(redis, postId, gameState);
    return gameState;
  }

  static async submitAnswer(redis: any, postId: string, submission: Submission): Promise<boolean> {
    try {
      const gameState = await this.getCurrentGameState(redis, postId);
      if (!gameState || gameState.phase !== 'submission') {
        return false;
      }

      const existingSubmission = gameState.submissions.find(s => s.odId === submission.odId);
      if (existingSubmission) {
        return false;
      }

      gameState.submissions.push(submission);
      await this.saveGameState(redis, postId, gameState);
      return true;
    } catch (error) {
      console.error('Error submitting answer:', error);
      return false;
    }
  }

  static async vote(redis: any, postId: string, voterId: string, submissionId: string): Promise<boolean> {
    try {
      const gameState = await this.getCurrentGameState(redis, postId);
      if (!gameState || gameState.phase !== 'voting') {
        return false;
      }

      const submission = gameState.submissions.find(s => s.id === submissionId);
      if (!submission || submission.odId === voterId) {
        return false;
      }

      const playerVotes = gameState.submissions.filter(s => s.voterIds.includes(voterId));
      if (playerVotes.length >= 3) {
        return false;
      }

      if (submission.voterIds.includes(voterId)) {
        return false;
      }

      submission.votes++;
      submission.voterIds.push(voterId);
      
      await this.saveGameState(redis, postId, gameState);
      return true;
    } catch (error) {
      console.error('Error voting:', error);
      return false;
    }
  }

  static async getPlayerStats(redis: any, odId: string): Promise<PlayerStats | null> {
    try {
      const stats = await redis.hGetAll(`player:${odId}`);
      if (!stats || Object.keys(stats).length === 0) {
        return null;
      }
      return {
        odId,
        odname: stats.odname,
        totalSubmissions: parseInt(stats.totalSubmissions) || 0,
        totalVotesReceived: parseInt(stats.totalVotesReceived) || 0,
        wins: parseInt(stats.wins) || 0,
        currentStreak: parseInt(stats.currentStreak) || 0,
        longestStreak: parseInt(stats.longestStreak) || 0,
        lastPlayedDate: stats.lastPlayedDate || ''
      };
    } catch (error) {
      console.error('Error getting player stats:', error);
      return null;
    }
  }

  static async updatePlayerStats(redis: any, odId: string, odname: string, submission: Submission, isWin: boolean): Promise<void> {
    try {
      const existingStats = await this.getPlayerStats(redis, odId);
      const today = new Date().toISOString().split('T')[0] || '';
      
      const stats: PlayerStats = existingStats || {
        odId,
        odname,
        totalSubmissions: 0,
        totalVotesReceived: 0,
        wins: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastPlayedDate: ''
      };

      stats.totalSubmissions++;
      stats.totalVotesReceived += submission.votes;
      
      if (isWin) {
        stats.wins++;
      }

      if (stats.lastPlayedDate && this.isConsecutiveDay(stats.lastPlayedDate, today || '')) {
        stats.currentStreak++;
        if (stats.currentStreak > stats.longestStreak) {
          stats.longestStreak = stats.currentStreak;
        }
      } else {
        stats.currentStreak = 1;
        stats.longestStreak = Math.max(stats.longestStreak, 1);
      }

      stats.lastPlayedDate = today || '';

      await redis.hSet(`player:${odId}`, {
        odId: stats.odId,
        odname: stats.odname,
        totalSubmissions: stats.totalSubmissions.toString(),
        totalVotesReceived: stats.totalVotesReceived.toString(),
        wins: stats.wins.toString(),
        currentStreak: stats.currentStreak.toString(),
        longestStreak: stats.longestStreak.toString(),
        lastPlayedDate: stats.lastPlayedDate
      });

      await redis.zAdd('leaderboard:alltime', {
        member: stats.odname,
        score: stats.wins
      });
    } catch (error) {
      console.error('Error updating player stats:', error);
    }
  }

  static async getLeaderboard(redis: any, limit: number = 10): Promise<Array<{member: string, score: number}>> {
    try {
      return await redis.zRange('leaderboard:alltime', 0, limit - 1, { reverse: true });
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      return [];
    }
  }

  static async rotatePhase(redis: any, postId: string): Promise<GameState | null> {
    try {
      const gameState = await this.getCurrentGameState(redis, postId);
      if (!gameState) {
        return null;
      }

      const now = Date.now();
      
      if (gameState.phase === 'submission' && now >= gameState.phaseEndsAt) {
        gameState.phase = 'voting';
        gameState.phaseEndsAt = now + PHASE_DURATION.VOTING;
        
        // Randomize submission order for voting
        gameState.submissions = [...gameState.submissions].sort(() => Math.random() - 0.5);
      } else if (gameState.phase === 'voting' && now >= gameState.phaseEndsAt) {
        gameState.phase = 'results';
        
        // Calculate winner
        if (gameState.submissions.length > 0) {
          const winner = gameState.submissions.reduce((prev, current) => 
            prev.votes > current.votes ? prev : current
          );
          
          // Update all players' stats
          for (const submission of gameState.submissions) {
            const isWin = submission.id === winner.id;
            await this.updatePlayerStats(redis, submission.odId, submission.odname, submission, isWin);
          }
        }
      } else if (gameState.phase === 'results') {
        // Start new game
        return await this.initializeGame(redis, postId);
      }

      await this.saveGameState(redis, postId, gameState);
      return gameState;
    } catch (error) {
      console.error('Error rotating phase:', error);
      return null;
    }
  }

  private static isConsecutiveDay(lastDate: string, currentDate: string): boolean {
    if (!lastDate || !currentDate) {
      return false;
    }
    
    const last = new Date(lastDate);
    const current = new Date(currentDate);
    const diffTime = Math.abs(current.getTime() - last.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 1;
  }
}
