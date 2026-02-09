import express from 'express';
import { redis, reddit, createServer, context, getServerPort } from '@devvit/web/server';
import { createPost } from './core/post';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text());

// ─── Game Data ────────────────────────────────────────────────

const questions = [
  { id: "q001", text: "What year did the French Revolution begin?", category: "History", correctAnswer: "1789" },
  { id: "q002", text: "What is the chemical symbol for gold?", category: "Science", correctAnswer: "Au" },
  { id: "q003", text: "Who painted the Mona Lisa?", category: "Art", correctAnswer: "Leonardo da Vinci" },
  { id: "q004", text: "What is the capital of Australia?", category: "Geography", correctAnswer: "Canberra" },
  { id: "q005", text: "How many planets are in our solar system?", category: "Science", correctAnswer: "8" },
  { id: "q006", text: "Who wrote Romeo and Juliet?", category: "Literature", correctAnswer: "William Shakespeare" },
  { id: "q007", text: "What is the largest ocean on Earth?", category: "Geography", correctAnswer: "Pacific Ocean" },
  { id: "q008", text: "In which year did World War II end?", category: "History", correctAnswer: "1945" },
  { id: "q009", text: "What is the speed of light?", category: "Science", correctAnswer: "299,792,458 meters per second" },
  { id: "q010", text: "Who composed the Four Seasons?", category: "Music", correctAnswer: "Antonio Vivaldi" },
];

// ─── Helper Functions ─────────────────────────────────────────

async function initializeGame(redis: any, postId: string) {
  const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
  const gameState = {
    currentQuestion: randomQuestion,
    phase: 'submission',
    phaseEndsAt: Date.now() + (12 * 60 * 60 * 1000),
    submissions: [],
  };
  await redis.hSet(`game:${postId}`, { state: JSON.stringify(gameState) });
  return gameState;
}

async function rotatePhase(redis: any, postId: string, gameState: any): Promise<any> {
  const now = Date.now();

  if (gameState.phase === 'submission' && now >= gameState.phaseEndsAt) {
    gameState.phase = 'voting';
    gameState.phaseEndsAt = now + (12 * 60 * 60 * 1000);
    gameState.submissions = [...gameState.submissions].sort(() => Math.random() - 0.5);
  } else if (gameState.phase === 'voting' && now >= gameState.phaseEndsAt) {
    gameState.phase = 'results';
    if (gameState.submissions.length > 0) {
      const winner = gameState.submissions.reduce((prev: any, current: any) =>
        prev.votes > current.votes ? prev : current
      );
      for (const submission of gameState.submissions) {
        const isWin = submission.id === winner.id;
        await updatePlayerStats(redis, submission.odId, submission.odname, submission.votes, isWin);
      }
    }
  } else if (gameState.phase === 'results') {
    return await initializeGame(redis, postId);
  }

  await redis.hSet(`game:${postId}`, { state: JSON.stringify(gameState) });
  return gameState;
}

async function updatePlayerStats(redis: any, userId: string, username: string, votesReceived: number, isWin: boolean) {
  const existingStats = await redis.hGetAll(`player:${userId}`);
  const stats = {
    odId: userId,
    odname: username,
    totalSubmissions: String(parseInt(existingStats?.totalSubmissions || '0') + 1),
    totalVotesReceived: String(parseInt(existingStats?.totalVotesReceived || '0') + votesReceived),
    wins: String(parseInt(existingStats?.wins || '0') + (isWin ? 1 : 0)),
    currentStreak: String(isWin ? parseInt(existingStats?.currentStreak || '0') + 1 : 0),
    longestStreak: String(Math.max(
      parseInt(existingStats?.longestStreak || '0'),
      isWin ? parseInt(existingStats?.currentStreak || '0') + 1 : 0
    )),
    lastPlayedDate: new Date().toISOString().split('T')[0],
  };
  await redis.hSet(`player:${userId}`, stats);
  await redis.zAdd('leaderboard:alltime', { member: username, score: parseInt(stats.wins) });
}

// ─── API Routes ───────────────────────────────────────────────

// GET /api/game - Get current game state
app.get('/api/game', async (_req, res) => {
  try {
    const { postId } = context;
    if (!postId) {
      return res.status(400).json({ error: 'postId required' });
    }

    let gameState = await redis.hGet(`game:${postId}`, 'state');
    let parsedState = gameState ? JSON.parse(gameState) : null;

    if (!parsedState) {
      parsedState = await initializeGame(redis, postId);
    } else {
      const now = Date.now();
      if (now >= parsedState.phaseEndsAt) {
        parsedState = await rotatePhase(redis, postId, parsedState);
      }
    }

    const username = await reddit.getCurrentUsername();
    res.json({
      ...parsedState,
      username: username || 'anonymous',
      currentTime: Date.now(),
    });
  } catch (error) {
    console.error('Error fetching game state:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/submit - Submit an answer
app.post('/api/submit', async (req, res) => {
  try {
    const { postId } = context;
    if (!postId) {
      return res.status(400).json({ error: 'postId required' });
    }

    const { answer } = req.body;

    if (!answer || typeof answer !== 'string') {
      return res.status(400).json({ error: 'Answer is required' });
    }
    if (answer.length > 280) {
      return res.status(400).json({ error: 'Answer must be 280 characters or less' });
    }

    let gameState = await redis.hGet(`game:${postId}`, 'state');
    let parsedState = gameState ? JSON.parse(gameState) : null;

    if (!parsedState || parsedState.phase !== 'submission') {
      return res.status(400).json({ error: 'Submission phase is closed' });
    }

    const username = await reddit.getCurrentUsername();
    const currentUser = await reddit.getCurrentUser();
    const userId = currentUser?.id;

    if (!username || !userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const existingSubmission = parsedState.submissions.find((s: any) => s.odId === userId);
    if (existingSubmission) {
      return res.status(400).json({ error: 'You have already submitted an answer' });
    }

    const submission = {
      id: `${userId}-${Date.now()}`,
      odId: userId,
      odname: username,
      answer: answer.trim(),
      timestamp: Date.now(),
      votes: 0,
      voterIds: [],
    };

    parsedState.submissions.push(submission);
    await redis.hSet(`game:${postId}`, { state: JSON.stringify(parsedState) });

    res.json({ success: true, data: submission });
  } catch (error) {
    console.error('Error submitting answer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/vote - Vote for an answer
app.post('/api/vote', async (req, res) => {
  try {
    const { postId } = context;
    if (!postId) {
      return res.status(400).json({ error: 'postId required' });
    }

    const { submissionId } = req.body;

    if (!submissionId) {
      return res.status(400).json({ error: 'submissionId is required' });
    }

    let gameState = await redis.hGet(`game:${postId}`, 'state');
    let parsedState = gameState ? JSON.parse(gameState) : null;

    if (!parsedState || parsedState.phase !== 'voting') {
      return res.status(400).json({ error: 'Voting phase is not active' });
    }

    const currentUser = await reddit.getCurrentUser();
    const userId = currentUser?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const submission = parsedState.submissions.find((s: any) => s.id === submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    if (submission.odId === userId) {
      return res.status(400).json({ error: 'Cannot vote for your own submission' });
    }

    const playerVotes = parsedState.submissions.filter((s: any) => s.voterIds.includes(userId));
    if (playerVotes.length >= 3) {
      return res.status(400).json({ error: 'You have already used all 3 votes' });
    }

    if (submission.voterIds.includes(userId)) {
      return res.status(400).json({ error: 'You have already voted for this answer' });
    }

    submission.votes++;
    submission.voterIds.push(userId);
    await redis.hSet(`game:${postId}`, { state: JSON.stringify(parsedState) });

    res.json({ success: true, data: { submissionId } });
  } catch (error) {
    console.error('Error voting:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/leaderboard - Get leaderboard
app.get('/api/leaderboard', async (_req, res) => {
  try {
    const leaderboard = await redis.zRange('leaderboard:alltime', 0, 9, {
      by: 'score',
      reverse: true,
    });
    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/player-stats - Get player stats
app.get('/api/player-stats', async (_req, res) => {
  try {
    const currentUser = await reddit.getCurrentUser();
    const userId = currentUser?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const stats = await redis.hGetAll(`player:${userId}`);
    res.json(stats || null);
  } catch (error) {
    console.error('Error fetching player stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create and start server
const port = getServerPort();
const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port);

export const handler = server;
