import { Devvit, useWebView } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
  redis: true,
});

Devvit.addCustomPostType({
  name: 'Wrong Answers Only',
  height: 'tall',
  render: (context) => {
    const { mount, postMessage } = useWebView({
      url: 'game.html',
      onMessage: async (msg, webView) => {
        const { type, data } = msg;
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
              
              webView.postMessage({
                type: 'GAME_STATE',
                data: {
                  ...parsedState,
                  username: username || 'anonymous',
                  currentTime: Date.now()
                }
              });
              return;
            }

            case 'SUBMIT_ANSWER': {
              const { answer } = data;
              
              if (!answer || typeof answer !== 'string') {
                webView.postMessage({ type: 'ERROR', error: 'Answer is required' });
                return;
              }

              if (answer.length > 280) {
                webView.postMessage({ type: 'ERROR', error: 'Answer must be 280 characters or less' });
                return;
              }

              let gameState = await redis.hGet(`game:${postId}`, 'state');
              let parsedState = JSON.parse(gameState!);
              
              if (!parsedState || parsedState.phase !== 'submission') {
                webView.postMessage({ type: 'ERROR', error: 'Submission phase is closed' });
                return;
              }

              const username = await reddit.getCurrentUsername();
              const currentUser = await reddit.getCurrentUser();
              const userId = currentUser?.id;
              
              if (!username || !userId) {
                webView.postMessage({ type: 'ERROR', error: 'User not authenticated' });
                return;
              }

              const existingSubmission = parsedState.submissions.find((s: any) => s.odId === userId);
              if (existingSubmission) {
                webView.postMessage({ type: 'ERROR', error: 'You have already submitted an answer' });
                return;
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
              
              webView.postMessage({ type: 'SUBMIT_SUCCESS', data: submission });
              return;
            }

            case 'VOTE': {
              const { submissionId } = data;
              
              if (!submissionId) {
                webView.postMessage({ type: 'ERROR', error: 'submissionId is required' });
                return;
              }

              let gameState = await redis.hGet(`game:${postId}`, 'state');
              let parsedState = JSON.parse(gameState!);
              
              if (!parsedState || parsedState.phase !== 'voting') {
                webView.postMessage({ type: 'ERROR', error: 'Voting phase is not active' });
                return;
              }

              const currentUser = await reddit.getCurrentUser();
              const userId = currentUser?.id;
              if (!userId) {
                webView.postMessage({ type: 'ERROR', error: 'User not authenticated' });
                return;
              }

              const submission = parsedState.submissions.find((s: any) => s.id === submissionId);
              
              if (!submission) {
                webView.postMessage({ type: 'ERROR', error: 'Submission not found' });
                return;
              }

              if (submission.odId === userId) {
                webView.postMessage({ type: 'ERROR', error: 'Cannot vote for your own submission' });
                return;
              }

              const playerVotes = parsedState.submissions.filter((s: any) => s.voterIds.includes(userId));
              if (playerVotes.length >= 3) {
                webView.postMessage({ type: 'ERROR', error: 'You have already used all 3 votes' });
                return;
              }

              if (submission.voterIds.includes(userId)) {
                webView.postMessage({ type: 'ERROR', error: 'You have already voted for this answer' });
                return;
              }

              submission.votes++;
              submission.voterIds.push(userId);
              await redis.hSet(`game:${postId}`, { state: JSON.stringify(parsedState) });
              
              webView.postMessage({ type: 'VOTE_SUCCESS', data: { submissionId } });
              return;
            }

            case 'GET_LEADERBOARD': {
              const leaderboard = await redis.zRange('leaderboard:alltime', 0, 9, { 
                by: 'score', 
                reverse: true 
              });
              
              webView.postMessage({ type: 'LEADERBOARD', data: leaderboard });
              return;
            }

            case 'GET_PLAYER_STATS': {
              const currentUser = await reddit.getCurrentUser();
              const userId = currentUser?.id;
              if (!userId) {
                webView.postMessage({ type: 'ERROR', error: 'User not authenticated' });
                return;
              }

              const stats = await redis.hGetAll(`player:${userId}`);
              
              webView.postMessage({ type: 'PLAYER_STATS', data: stats || null });
              return;
            }

            default:
              webView.postMessage({ type: 'ERROR', error: 'Unknown message type' });
              return;
          }
        } catch (error) {
          console.error('Error handling message:', error);
          webView.postMessage({ type: 'ERROR', error: 'Internal server error' });
        }
      }
    });

    return {
      text: '🎯 Wrong Answers Only - Daily Trivia Challenge\n\nClick Play Now to start the game!',
      action: mount
    };
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
        preview: {
          text: 'Loading Wrong Answers Only game...'
        },
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
      text: "What year did French Revolution begin?",
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
      text: "Who painted Mona Lisa?",
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
    }
  ];

  const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
  const gameState = {
    currentQuestion: randomQuestion,
    phase: 'submission',
    phaseEndsAt: Date.now() + (12 * 60 * 60 * 1000),
    submissions: []
  };

  await redis.hSet(`game:${postId}`, { state: JSON.stringify(gameState) });
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
    score: stats.wins.toString()
  });
}

export default Devvit;
