import express from 'express';
import { InitResponse, IncrementResponse, DecrementResponse } from '../shared/types/api';
import { redis, reddit, createServer, context, getServerPort } from '@devvit/web/server';
import { createPost } from './core/post';

const app = express();

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());

const router = express.Router();

// GET /api/game - Get current game state
router.get('/api/game', async (_req, res) => {
  const { postId } = context;
  if (!postId) {
    res.status(400).json({ error: 'postId required' });
    return;
  }
  
  let state = await redis.hGet(`game:${postId}`, 'state');
  
  if (!state) {
    // Initialize new game
    const questions = [
      { id: "q001", text: "What year did the French Revolution begin?", category: "History" },
      { id: "q002", text: "What is the chemical symbol for gold?", category: "Science" },
      { id: "q003", text: "Who painted the Mona Lisa?", category: "Art" },
      { id: "q004", text: "What is the capital of Australia?", category: "Geography" },
      { id: "q005", text: "How many planets are in our solar system?", category: "Science" },
      { id: "q006", text: "Who wrote Romeo and Juliet?", category: "Literature" },
      { id: "q007", text: "What is the largest ocean on Earth?", category: "Geography" },
      { id: "q008", text: "In which year did World War II end?", category: "History" },
      { id: "q009", text: "What is the speed of light?", category: "Science" },
      { id: "q010", text: "Who composed the Four Seasons?", category: "Music" }
    ];
    const gameState = {
      currentQuestion: questions[Math.floor(Math.random() * questions.length)],
      phase: 'submission',
      phaseEndsAt: Date.now() + (12 * 60 * 60 * 1000),
      submissions: []
    };
    await redis.hSet(`game:${postId}`, { state: JSON.stringify(gameState) });
    state = JSON.stringify(gameState);
  }
  
  const username = await reddit.getCurrentUsername();
  res.json({
    ...JSON.parse(state),
    username: username ?? 'anonymous',
    postId
  });
});

// POST /api/submit - Submit an answer
router.post('/api/submit', async (req, res) => {
  const { postId } = context;
  const { answer } = req.body;
  
  if (!answer) {
    res.status(400).json({ error: 'Answer required' });
    return;
  }
  
  if (answer.length > 280) {
    res.status(400).json({ error: 'Answer must be 280 characters or less' });
    return;
  }
  
  const state = await redis.hGet(`game:${postId}`, 'state');
  const parsed = JSON.parse(state!);
  
  if (parsed.phase !== 'submission') {
    res.status(400).json({ error: 'Submissions closed' });
    return;
  }
  
  const username = await reddit.getCurrentUsername();
  const user = await reddit.getCurrentUser();
  
  if (!username || !user?.id) {
    res.status(400).json({ error: 'User not authenticated' });
    return;
  }
  
  const existingSubmission = parsed.submissions.find((s: any) => s.odId === user.id);
  if (existingSubmission) {
    res.status(400).json({ error: 'You have already submitted an answer' });
    return;
  }
  
  const submission = {
    id: `${user.id}-${Date.now()}`,
    odId: user.id,
    odname: username,
    answer: answer.trim(),
    timestamp: Date.now(),
    votes: 0,
    voterIds: []
  };
  
  parsed.submissions.push(submission);
  await redis.hSet(`game:${postId}`, { state: JSON.stringify(parsed) });
  
  res.json({ success: true, submission });
});

// POST /api/vote - Vote for an answer
router.post('/api/vote', async (req, res) => {
  const { postId } = context;
  const { submissionId } = req.body;
  
  if (!submissionId) {
    res.status(400).json({ error: 'submissionId required' });
    return;
  }
  
  const state = await redis.hGet(`game:${postId}`, 'state');
  const parsed = JSON.parse(state!);
  
  if (parsed.phase !== 'voting') {
    res.status(400).json({ error: 'Voting not active' });
    return;
  }
  
  const user = await reddit.getCurrentUser();
  if (!user?.id) {
    res.status(400).json({ error: 'User not authenticated' });
    return;
  }
  
  const submission = parsed.submissions.find((s: any) => s.id === submissionId);
  
  if (!submission) {
    res.status(400).json({ error: 'Submission not found' });
    return;
  }
  
  if (submission.odId === user.id) {
    res.status(400).json({ error: 'Cannot vote for your own submission' });
    return;
  }
  
  const playerVotes = parsed.submissions.filter((s: any) => s.voterIds.includes(user.id));
  if (playerVotes.length >= 3) {
    res.status(400).json({ error: 'You have already used all 3 votes' });
    return;
  }
  
  if (submission.voterIds.includes(user.id)) {
    res.status(400).json({ error: 'You have already voted for this answer' });
    return;
  }
  
  submission.votes++;
  submission.voterIds.push(user.id);
  await redis.hSet(`game:${postId}`, { state: JSON.stringify(parsed) });
  
  res.json({ success: true });
});

// GET /api/leaderboard - Get leaderboard
router.get('/api/leaderboard', async (_req, res) => {
  try {
    const leaderboard = await redis.zRange('leaderboard:alltime', 0, 9, { 
      by: 'score', 
      reverse: true 
    });
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// GET /api/player-stats - Get current player stats
router.get('/api/player-stats', async (_req, res) => {
  try {
    const user = await reddit.getCurrentUser();
    if (!user?.id) {
      res.status(400).json({ error: 'User not authenticated' });
      return;
    }
    
    const stats = await redis.hGetAll(`player:${user.id}`);
    res.json(stats || {});
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch player stats' });
  }
});

// POST /api/rotate-phase - Rotate game phase (for testing/admin)
router.post('/api/rotate-phase', async (_req, res) => {
  try {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({ error: 'postId required' });
      return;
    }
    
    const state = await redis.hGet(`game:${postId}`, 'state');
    const parsed = JSON.parse(state!);
    
    const now = Date.now();
    if (parsed.phase === 'submission') {
      parsed.phase = 'voting';
      parsed.phaseEndsAt = now + (12 * 60 * 60 * 1000);
      // Randomize submission order for voting
      parsed.submissions = [...parsed.submissions].sort(() => Math.random() - 0.5);
    } else if (parsed.phase === 'voting') {
      parsed.phase = 'results';
      
      if (parsed.submissions.length > 0) {
        const winner = parsed.submissions.reduce((prev: any, current: any) => 
          prev.votes > current.votes ? prev : current
        );
        
        // Update player stats
        for (const submission of parsed.submissions) {
          const isWin = submission.id === winner.id;
          await updatePlayerStats(redis, submission.odId, submission.odname, submission.votes, isWin);
        }
      }
    } else if (parsed.phase === 'results') {
      // Start new game
      const questions = [
        { id: "q001", text: "What year did the French Revolution begin?", category: "History" },
        { id: "q002", text: "What is the chemical symbol for gold?", category: "Science" },
        { id: "q003", text: "Who painted the Mona Lisa?", category: "Art" },
        { id: "q004", text: "What is the capital of Australia?", category: "Geography" },
        { id: "q005", text: "How many planets are in our solar system?", category: "Science" }
      ];
      parsed.currentQuestion = questions[Math.floor(Math.random() * questions.length)];
      parsed.phase = 'submission';
      parsed.phaseEndsAt = now + (12 * 60 * 60 * 1000);
      parsed.submissions = [];
    }
    
    await redis.hSet(`game:${postId}`, { state: JSON.stringify(parsed) });
    res.json({ success: true, phase: parsed.phase });
  } catch (error) {
    res.status(500).json({ error: 'Failed to rotate phase' });
  }
});

// Helper function to update player stats
async function updatePlayerStats(redis: any, userId: string, username: string, votesReceived: number, isWin: boolean) {
  try {
    const existingStats = await redis.hGetAll(`player:${userId}`);
    
    const stats = {
      odId: userId,
      odname: username,
      totalSubmissions: parseInt(existingStats.totalSubmissions || '0') + 1,
      totalVotesReceived: parseInt(existingStats.totalVotesReceived || '0') + votesReceived,
      wins: parseInt(existingStats.wins || '0') + (isWin ? 1 : 0),
      currentStreak: isWin ? parseInt(existingStats.currentStreak || '0') + 1 : 0,
      longestStreak: Math.max(parseInt(existingStats.longestStreak || '0'), isWin ? parseInt(existingStats.currentStreak || '0') + 1 : 0),
      lastPlayedDate: new Date().toISOString().split('T')[0]
    };

    await redis.hSet(`player:${userId}`, stats);
    
    // Update leaderboard
    await redis.zAdd('leaderboard:alltime', {
      member: username,
      score: stats.wins
    });
  } catch (error) {
    console.error('Error updating player stats:', error);
  }
}

// Use router middleware
app.use(router);

// Get port from environment variable with fallback
const port = getServerPort();

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port);

export const handler = server;
