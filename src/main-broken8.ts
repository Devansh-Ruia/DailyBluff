import { Devvit } from '@devvit/public-api';

/** @jsxImportSource @devvit/public-api */

Devvit.configure({
  redditAPI: true,
  redis: true,
});

Devvit.addCustomPostType({
  name: 'Wrong Answers Only',
  height: 'tall',
  render: (context) => {
    // Set up message handler for webview communication
    context.useWebView({
      id: 'game-webview',
      url: 'game.html',
      onMessage: async (msg) => {
        const { type, data } = msg as any;
        const { postId, redis, reddit } = context;

        try {
          switch (type) {
            case 'GET_GAME_STATE': {
              let gameState = await redis.hGet(`game:${postId}`, 'state');
              let parsedState = gameState ? JSON.parse(gameState) : null;
              
              if (!parsedState) {
                await initializeGame(redis, postId);
                gameState = await redis.hGet(`game:${postId}`, 'state');
                parsedState = JSON.parse(gameState!);
              } else {
                const now = Date.now();
                if (now >= parsedState.phaseEndsAt) {
                  parsedState = await rotatePhase(redis, postId, parsedState);
                }
              }

              const username = await reddit.getCurrentUsername();
              
              return {
                type: 'GAME_STATE',
                data: {
                  ...parsedState,
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

              if (answer.length > 280) {
                return { type: 'ERROR', error: 'Answer must be 280 characters or less' };
              }

              let gameState = await redis.hGet(`game:${postId}`, 'state');
              let parsedState = gameState ? JSON.parse(gameState) : null;
              
              if (!parsedState || parsedState.phase !== 'submission') {
                return { type: 'ERROR', error: 'Submission phase is closed' };
              }

              const username = await reddit.getCurrentUsername();
              const currentUser = await reddit.getCurrentUser();
              const userId = currentUser?.id;
              
              if (!username || !userId) {
                return { type: 'ERROR', error: 'User not authenticated' };
              }

              const existingSubmission = parsedState.submissions.find((s: any) => s.odId === userId);
              if (existingSubmission) {
                return { type: 'ERROR', error: 'You have already submitted an answer' };
              }

              const submission = {
                id: `${userId}-${Date.now()}`,
                odId: userId,
                odname: username,
                answer: answer.trim(),
                timestamp: Date.now(),
                votes: 0,
                voterIds: []
              };

              parsedState.submissions.push(submission);
              await redis.hSet(`game:${postId}`, { state: JSON.stringify(parsedState) });
              
              return { type: 'SUBMIT_SUCCESS', data: submission };
            }

            case 'VOTE': {
              const { submissionId } = data;
              
              if (!submissionId) {
                return { type: 'ERROR', error: 'submissionId is required' };
              }

              let gameState = await redis.hGet(`game:${postId}`, 'state');
              let parsedState = gameState ? JSON.parse(gameState) : null;
              
              if (!parsedState || parsedState.phase !== 'voting') {
                return { type: 'ERROR', error: 'Voting phase is not active' };
              }

              const currentUser = await reddit.getCurrentUser();
              const userId = currentUser?.id;
              if (!userId) {
                return { type: 'ERROR', error: 'User not authenticated' };
              }

              const submission = parsedState.submissions.find((s: any) => s.id === submissionId);
              if (!submission || submission.odId === userId) {
                return { type: 'ERROR', error: 'Cannot vote for this submission' };
              }

              const playerVotes = parsedState.submissions.filter((s: any) => s.voterIds.includes(userId));
              if (playerVotes.length >= 3) {
                return { type: 'ERROR', error: 'You have already used all 3 votes' };
              }

              if (submission.voterIds.includes(userId)) {
                return { type: 'ERROR', error: 'You have already voted for this answer' };
              }

              submission.votes++;
              submission.voterIds.push(userId);
              
              await redis.hSet(`game:${postId}`, { state: JSON.stringify(parsedState) });
              
              return { type: 'VOTE_SUCCESS', data: { submissionId } };
            }

            case 'GET_LEADERBOARD': {
              const leaderboard = await redis.zRange('leaderboard:alltime', 0, 9, { 
                by: 'score', 
                reverse: true 
              });
              
              return { type: 'LEADERBOARD', data: leaderboard };
            }

            case 'GET_PLAYER_STATS': {
              const currentUser = await reddit.getCurrentUser();
              const userId = currentUser?.id;
              if (!userId) {
                return { type: 'ERROR', error: 'User not authenticated' };
              }

              const stats = await redis.hGetAll(`player:${userId}`);
              
              return { type: 'PLAYER_STATS', data: stats || null };
            }

            default:
              return { type: 'ERROR', error: 'Unknown message type' };
          }
        } catch (error) {
          console.error('Error handling message:', error);
          return { type: 'ERROR', error: 'Internal server error' };
        }
      }
    });

    // Return webview using blocks root element
    return (
      <blocks height="tall">
        <webview id="game-webview" url="game.html" />
      </blocks>
    );
  },
});

Devvit.addMenuItem({
  label: 'Create Wrong Answers Only Game',
  location: 'subreddit',
  onPress: async (event, context) => {
    try {
      const post = await context.reddit.submitPost({
        title: '🎯 Wrong Answers Only - Daily Trivia Challenge',
        subredditName: context.subredditName ?? '',
        preview: (
          <blocks>
            <vstack padding="medium" alignment="center middle">
              <text size="large">Loading game...</text>
            </vstack>
          </blocks>
        ),
      });

      await initializeGame(context.redis, post.id);
      context.ui.showToast('Wrong Answers Only game created successfully!');
    } catch (error) {
      console.error('Error creating game post:', error);
      context.ui.showToast(`Failed: ${error}`);
    }
  },
});

async function initializeGame(redis: any, postId: string) {
  const questions = [
    {
      id: "q001",
      text: "What year did the French Revolution begin?",
      category: "History",
      correctAnswer: "1789"
    },
    {
      id: "q002", 
      text: "What is the chemical symbol for gold?",
      category: "Science",
      correctAnswer: "Au"
    },
    {
      id: "q003",
      text: "Who painted the Mona Lisa?",
      category: "Art",
      correctAnswer: "Leonardo da Vinci"
    },
    {
      id: "q004",
      text: "What is the capital of Australia?",
      category: "Geography",
      correctAnswer: "Canberra"
    },
    {
      id: "q005",
      text: "How many planets are in our solar system?",
      category: "Science",
      correctAnswer: "8"
    },
    {
      id: "q006",
      text: "Who wrote Romeo and Juliet?",
      category: "Literature",
      correctAnswer: "William Shakespeare"
    },
    {
      id: "q007",
      text: "What is the largest ocean on Earth?",
      category: "Geography",
      correctAnswer: "Pacific Ocean"
    },
    {
      id: "q008",
      text: "In which year did World War II end?",
      category: "History",
      correctAnswer: "1945"
    },
    {
      id: "q009",
      text: "What is the speed of light?",
      category: "Science",
      correctAnswer: "299,792,458 meters per second"
    },
    {
      id: "q010",
      text: "Who composed the Four Seasons?",
      category: "Music",
      correctAnswer: "Antonio Vivaldi"
    }
  ];

  const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
  const gameState = {
    currentQuestion: randomQuestion,
    phase: 'submission',
    phaseEndsAt: Date.now() + (12 * 60 * 60 * 1000),
    submissions: []
  };

  await redis.hSet(`game:${postId}`, {
    state: JSON.stringify(gameState)
  });
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
    await initializeGame(redis, postId);
    const newState = await redis.hGet(`game:${postId}`, 'state');
    return JSON.parse(newState!);
  }

  await redis.hSet(`game:${postId}`, { state: JSON.stringify(gameState) });
  return gameState;
}

async function updatePlayerStats(redis: any, userId: string, username: string, votesReceived: number, isWin: boolean) {
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
  
  await redis.zAdd('leaderboard:alltime', {
    member: username,
    score: stats.wins
  });
}

export default Devvit;
