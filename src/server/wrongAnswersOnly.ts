import express from 'express';
import { redis, reddit, createServer, context, getServerPort } from '@devvit/web/server';
import { GameService } from '../shared/services/gameService';
import { Submission, LeaderboardEntry } from '../shared/types/game';
import { MAX_ANSWER_LENGTH, MAX_VOTES_PER_PLAYER } from '../shared/constants/questions';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text());

const router = express.Router();

router.get('/api/game-state', async (_req, res) => {
  const { postId } = context;
  
  if (!postId) {
    return res.status(400).json({ type: 'ERROR', error: 'postId not found in context' });
  }

  try {
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
    
    res.json({
      type: 'GAME_STATE',
      data: {
        ...gameState,
        username: username || 'anonymous',
        currentTime: Date.now()
      }
    });
  } catch (error) {
    console.error('Error getting game state:', error);
    res.status(500).json({ type: 'ERROR', error: 'Failed to get game state' });
  }
});

router.post('/api/submit-answer', async (req, res) => {
  const { postId } = context;
  const { answer } = req.body;

  if (!postId) {
    return res.status(400).json({ type: 'ERROR', error: 'postId not found in context' });
  }

  if (!answer || typeof answer !== 'string') {
    return res.status(400).json({ type: 'ERROR', error: 'Answer is required' });
  }

  if (answer.length > MAX_ANSWER_LENGTH) {
    return res.status(400).json({ type: 'ERROR', error: `Answer must be ${MAX_ANSWER_LENGTH} characters or less` });
  }

  try {
    const gameState = await GameService.getCurrentGameState(redis, postId);
    if (!gameState) {
      return res.status(400).json({ type: 'ERROR', error: 'Game not found' });
    }

    if (gameState.phase !== 'submission') {
      return res.status(400).json({ type: 'ERROR', error: 'Submission phase is closed' });
    }

    const username = await reddit.getCurrentUsername();
    const currentUser = await reddit.getCurrentUser();
    const userId = currentUser?.id;
    
    if (!username || !userId) {
      return res.status(400).json({ type: 'ERROR', error: 'User not authenticated' });
    }

    const existingSubmission = gameState.submissions.find(s => s.odId === userId);
    if (existingSubmission) {
      return res.status(400).json({ type: 'ERROR', error: 'You have already submitted an answer' });
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
      res.json({ type: 'SUBMIT_SUCCESS', data: submission });
    } else {
      res.status(500).json({ type: 'ERROR', error: 'Failed to submit answer' });
    }
  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({ type: 'ERROR', error: 'Failed to submit answer' });
  }
});

router.post('/api/vote', async (req, res) => {
  const { postId } = context;
  const { submissionId } = req.body;

  if (!postId) {
    return res.status(400).json({ type: 'ERROR', error: 'postId not found in context' });
  }

  if (!submissionId) {
    return res.status(400).json({ type: 'ERROR', error: 'submissionId is required' });
  }

  try {
    const gameState = await GameService.getCurrentGameState(redis, postId);
    if (!gameState) {
      return res.status(400).json({ type: 'ERROR', error: 'Game not found' });
    }

    if (gameState.phase !== 'voting') {
      return res.status(400).json({ type: 'ERROR', error: 'Voting phase is not active' });
    }

    const currentUser = await reddit.getCurrentUser();
    const userId = currentUser?.id;
    if (!userId) {
      return res.status(400).json({ type: 'ERROR', error: 'User not authenticated' });
    }

    const playerVotes = gameState.submissions.filter(s => s.voterIds.includes(userId));
    if (playerVotes.length >= MAX_VOTES_PER_PLAYER) {
      return res.status(400).json({ type: 'ERROR', error: `You have already used all ${MAX_VOTES_PER_PLAYER} votes` });
    }

    const success = await GameService.vote(redis, postId, userId, submissionId);
    
    if (success) {
      res.json({ type: 'VOTE_SUCCESS', data: { submissionId } });
    } else {
      res.status(400).json({ type: 'ERROR', error: 'Failed to vote. You may have already voted for this answer or cannot vote for your own submission.' });
    }
  } catch (error) {
    console.error('Error voting:', error);
    res.status(500).json({ type: 'ERROR', error: 'Failed to vote' });
  }
});

router.get('/api/leaderboard', async (_req, res) => {
  try {
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

    res.json({ type: 'LEADERBOARD', data: leaderboardEntries });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({ type: 'ERROR', error: 'Failed to get leaderboard' });
  }
});

router.get('/api/player-stats', async (_req, res) => {
  try {
    const currentUser = await reddit.getCurrentUser();
    const userId = currentUser?.id;
    if (!userId) {
      return res.status(400).json({ type: 'ERROR', error: 'User not authenticated' });
    }

    const stats = await GameService.getPlayerStats(redis, userId);
    
    res.json({ type: 'PLAYER_STATS', data: stats });
  } catch (error) {
    console.error('Error getting player stats:', error);
    res.status(500).json({ type: 'ERROR', error: 'Failed to get player stats' });
  }
});

router.post('/internal/rotate-phase', async (_req, res) => {
  const { postId } = context;
  
  if (!postId) {
    return res.status(400).json({ status: 'error', message: 'postId not found in context' });
  }

  try {
    const gameState = await GameService.rotatePhase(redis, postId);
    
    res.json({
      status: 'success',
      message: 'Phase rotated successfully',
      gameState
    });
  } catch (error) {
    console.error('Error rotating phase:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to rotate phase'
    });
  }
});

router.post('/internal/menu/create-game', async (_req, res) => {
  try {
    const post = await reddit.submitPost({
      title: '🎯 Wrong Answers Only - Daily Trivia Challenge',
      subredditName: context.subredditName,
      kind: 'self',
      text: 'Welcome to Wrong Answers Only! A daily trivia game where the goal is to submit the most creative *wrong* answers.\n\n📅 **Daily Schedule:**\n• **12 hours:** Submit your creative wrong answers\n• **12 hours:** Vote for your favorite wrong answers\n• **Winner announced:** The most creative wrong answer wins!\n\n🏆 **Prizes:**\n• Daily winner glory\n• Streak bonuses for consecutive days\n• Leaderboard recognition\n\nThink you have what it takes to be creatively wrong? Play now!'
    });

    console.log('Post created successfully:', post.id);

    res.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`
    });
  } catch (error) {
    console.error('Error creating game post:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create game post'
    });
  }
});

app.use(router);

const port = getServerPort();
const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port);
