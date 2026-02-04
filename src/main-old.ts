import { Devvit, RedisClient, RedditAPIClient } from '@devvit/public-api';
import { GameState, Submission, Question, PlayerStats, LeaderboardEntry } from '../shared/types/game';
import { QUESTION_POOL, PHASE_DURATION, MAX_ANSWER_LENGTH, MAX_VOTES_PER_PLAYER } from '../shared/constants/questions';

// Configure Devvit
Devvit.configure({
  redditAPI: true,
  redis: true,
});

// Redis keys
const REDIS_KEYS = {
  GAME_STATE: (postId: string) => `game:${postId}:state`,
  PLAYER_STATS: (userId: string) => `player:${userId}:stats`,
  LEADERBOARD: 'leaderboard:alltime',
  QUESTION_POOL: 'questions:pool',
};

// Game Service
class GameService {
  static async getCurrentGameState(redis: RedisClient, postId: string): Promise<GameState | null> {
    try {
      const gameState = await redis.hGet(REDIS_KEYS.GAME_STATE(postId), 'data');
      return gameState ? JSON.parse(gameState) : null;
    } catch (error) {
      console.error('Error getting game state:', error);
      return null;
    }
  }

  static async saveGameState(redis: RedisClient, postId: string, gameState: GameState): Promise<void> {
    try {
      await redis.hSet(REDIS_KEYS.GAME_STATE(postId), { data: JSON.stringify(gameState) });
    } catch (error) {
      console.error('Error saving game state:', error);
      throw error;
    }
  }

  static async initializeGame(redis: RedisClient, postId: string): Promise<GameState> {
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

  static async submitAnswer(redis: RedisClient, postId: string, submission: Submission): Promise<boolean> {
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

  static async vote(redis: RedisClient, postId: string, voterId: string, submissionId: string): Promise<boolean> {
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
      if (playerVotes.length >= MAX_VOTES_PER_PLAYER) {
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

  static async getPlayerStats(redis: RedisClient, userId: string): Promise<PlayerStats | null> {
    try {
      const stats = await redis.hGetAll(REDIS_KEYS.PLAYER_STATS(userId));
      if (!stats || Object.keys(stats).length === 0) {
        return null;
      }
      return {
        odId: userId,
        odname: stats.odname || '',
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

  static async updatePlayerStats(redis: RedisClient, userId: string, username: string, submission: Submission, isWin: boolean): Promise<void> {
    try {
      const existingStats = await this.getPlayerStats(redis, userId);
      const today = new Date().toISOString().split('T')[0] || '';
      
      const stats: PlayerStats = existingStats || {
        odId: userId,
        odname: username,
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

      if (stats.lastPlayedDate && this.isConsecutiveDay(stats.lastPlayedDate, today)) {
        stats.currentStreak++;
        if (stats.currentStreak > stats.longestStreak) {
          stats.longestStreak = stats.currentStreak;
        }
      } else {
        stats.currentStreak = 1;
        stats.longestStreak = Math.max(stats.longestStreak, 1);
      }

      stats.lastPlayedDate = today || '';

      await redis.hSet(REDIS_KEYS.PLAYER_STATS(userId), {
        odId: stats.odId,
        odname: stats.odname,
        totalSubmissions: stats.totalSubmissions.toString(),
        totalVotesReceived: stats.totalVotesReceived.toString(),
        wins: stats.wins.toString(),
        currentStreak: stats.currentStreak.toString(),
        longestStreak: stats.longestStreak.toString(),
        lastPlayedDate: stats.lastPlayedDate
      });

      await redis.zAdd(REDIS_KEYS.LEADERBOARD, {
        member: stats.odname,
        score: stats.wins
      });
    } catch (error) {
      console.error('Error updating player stats:', error);
    }
  }

  static async getLeaderboard(redis: RedisClient, limit: number = 10): Promise<Array<{member: string, score: number}>> {
    try {
      return await redis.zRange(REDIS_KEYS.LEADERBOARD, 0, limit - 1, { reverse: true });
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      return [];
    }
  }

  static async rotatePhase(redis: RedisClient, postId: string): Promise<GameState | null> {
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
        
        // Calculate winner and update stats
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

// Custom Post Type
Devvit.addCustomPostType({
  name: 'Wrong Answers Only',
  render: (context) => {
    const { postId, redis, reddit } = context;

    return {
      aspectRatio: 1,
      url: `https://${context.hostname}/game.html?postId=${postId}`,
    };
  },
});

// Message Handlers
Devvit.addWebViewListener('game', {
  onMessage: async (data, context) => {
    const { postId, redis, reddit } = context;
    const { type } = data;

    try {
      switch (type) {
        case 'GET_GAME_STATE': {
          let gameState = await GameService.getCurrentGameState(redis, postId);
          
          if (!gameState) {
            gameState = await GameService.initializeGame(redis, postId);
          } else {
            const now = Date.now();
            if (now >= gameState.phaseEndsAt) {
              gameState = await GameService.rotatePhase(redis, postId);
            }
          }

          const username = await reddit.getCurrentUsername();
          
          return {
            type: 'GAME_STATE',
            data: {
              ...gameState,
              username: username || 'anonymous',
              currentTime: Date.now()
            }
          };
        }

        case 'SUBMIT_ANSWER': {
          const { answer } = data;
          
          if (!answer || typeof answer !== 'string') {
            return { type: 'ERROR', error: 'Answer is required' };
          }

          if (answer.length > MAX_ANSWER_LENGTH) {
            return { type: 'ERROR', error: `Answer must be ${MAX_ANSWER_LENGTH} characters or less` };
          }

          const gameState = await GameService.getCurrentGameState(redis, postId);
          if (!gameState) {
            return { type: 'ERROR', error: 'Game not found' };
          }

          if (gameState.phase !== 'submission') {
            return { type: 'ERROR', error: 'Submission phase is closed' };
          }

          const username = await reddit.getCurrentUsername();
          const currentUser = await reddit.getCurrentUser();
          const userId = currentUser?.id;
          
          if (!username || !userId) {
            return { type: 'ERROR', error: 'User not authenticated' };
          }

          const existingSubmission = gameState.submissions.find(s => s.odId === userId);
          if (existingSubmission) {
            return { type: 'ERROR', error: 'You have already submitted an answer' };
          }

          const submission: Submission = {
            id: `${userId}-${Date.now()}`,
            odId: userId,
            odname: username,
            answer: answer.trim(),
            timestamp: Date.now(),
            votes: 0,
            voterIds: []
          };

          const success = await GameService.submitAnswer(redis, postId, submission);
          
          if (success) {
            return { type: 'SUBMIT_SUCCESS', data: submission };
          } else {
            return { type: 'ERROR', error: 'Failed to submit answer' };
          }
        }

        case 'VOTE': {
          const { submissionId } = data;
          
          if (!submissionId) {
            return { type: 'ERROR', error: 'submissionId is required' };
          }

          const gameState = await GameService.getCurrentGameState(redis, postId);
          if (!gameState) {
            return { type: 'ERROR', error: 'Game not found' };
          }

          if (gameState.phase !== 'voting') {
            return { type: 'ERROR', error: 'Voting phase is not active' };
          }

          const currentUser = await reddit.getCurrentUser();
          const userId = currentUser?.id;
          if (!userId) {
            return { type: 'ERROR', error: 'User not authenticated' };
          }

          const playerVotes = gameState.submissions.filter(s => s.voterIds.includes(userId));
          if (playerVotes.length >= MAX_VOTES_PER_PLAYER) {
            return { type: 'ERROR', error: `You have already used all ${MAX_VOTES_PER_PLAYER} votes` };
          }

          const success = await GameService.vote(redis, postId, userId, submissionId);
          
          if (success) {
            return { type: 'VOTE_SUCCESS', data: { submissionId } };
          } else {
            return { type: 'ERROR', error: 'Failed to vote. You may have already voted for this answer or cannot vote for your own submission.' };
          }
        }

        case 'GET_LEADERBOARD': {
          const leaderboard = await GameService.getLeaderboard(redis, 10);
          
          const leaderboardEntries: LeaderboardEntry[] = [];
          
          for (const entry of leaderboard) {
            const stats = await GameService.getPlayerStats(redis, entry.member);
            if (stats) {
              leaderboardEntries.push({
                odname: stats.odname,
                wins: stats.wins,
                totalSubmissions: stats.totalSubmissions,
                totalVotesReceived: stats.totalVotesReceived,
                longestStreak: stats.longestStreak
              });
            }
          }

          return { type: 'LEADERBOARD', data: leaderboardEntries };
        }

        case 'GET_PLAYER_STATS': {
          const currentUser = await reddit.getCurrentUser();
          const userId = currentUser?.id;
          if (!userId) {
            return { type: 'ERROR', error: 'User not authenticated' };
          }

          const stats = await GameService.getPlayerStats(redis, userId);
          
          return { type: 'PLAYER_STATS', data: stats };
        }

        default:
          return { type: 'ERROR', error: 'Unknown message type' };
      }
    } catch (error) {
      console.error('Error handling message:', error);
      return { type: 'ERROR', error: 'Internal server error' };
    }
  },
});

// Menu Item to Create Game Post
Devvit.addMenuItem({
  label: 'Create Wrong Answers Only Game',
  location: 'subreddit',
  onPress: async (event, context) => {
    const { reddit, redis } = context;

    try {
      const post = await reddit.submitPost({
        title: '🎯 Wrong Answers Only - Daily Trivia Challenge',
        subredditName: context.subredditName,
        kind: 'self',
        text: 'Welcome to Wrong Answers Only! A daily trivia game where the goal is to submit the most creative *wrong* answers.\n\n📅 **Daily Schedule:**\n• **12 hours:** Submit your creative wrong answers\n• **12 hours:** Vote for your favorite wrong answers\n• **Winner announced:** The most creative wrong answer wins!\n\n🏆 **Prizes:**\n• Daily winner glory\n• Streak bonuses for consecutive days\n• Leaderboard recognition\n\nThink you have what it takes to be creatively wrong? Play now!'
      });

      // Initialize game state for the new post
      await GameService.initializeGame(redis, post.id);

      context.ui.showToast({
        text: 'Wrong Answers Only game created successfully!',
        appearance: 'success'
      });

    } catch (error) {
      console.error('Error creating game post:', error);
      context.ui.showToast({
        text: 'Failed to create game post',
        appearance: 'error'
      });
    }
  },
});

// Scheduler for Phase Rotation
Devvit.addSchedulerJob({
  name: 'rotate-phase',
  onRun: async (event, context) => {
    const { redis } = context;
    
    // This would need to be implemented to find all active games and rotate their phases
    // For now, phase rotation happens on-demand when game state is requested
    console.log('Phase rotation scheduler triggered');
  },
});

export default Devvit;
