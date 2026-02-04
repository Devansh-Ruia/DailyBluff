import { Devvit } from '@devvit/public-api';

// Configure Devvit with required APIs
Devvit.configure({
  redditAPI: true,
  redis: true,
});

// Add a custom post type for the game
Devvit.addCustomPostType({
  name: 'Wrong Answers Only',
  render: (context) => {
    return (
      <vstack height="100%" width="100%" alignment="center middle" gap="large">
        <text size="xlarge" weight="bold">🎯 Wrong Answers Only</text>
        <text>A daily trivia game where creativity wins!</text>
        <button 
          appearance="primary"
          onPress={async () => {
            // Initialize game if not already done
            await initializeGame(context.redis, context.postId);
          }}
        >
          Start Game
        </button>
      </vstack>
    );
  },
});

// Add menu item to create new game posts
Devvit.addMenuItem({
  label: 'Create Wrong Answers Only Game',
  location: 'subreddit',
  onPress: async (event, context) => {
    try {
      const post = await context.reddit.submitPost({
        title: '🎯 Wrong Answers Only - Daily Trivia Challenge',
        subredditName: context.subredditName,
        kind: 'self',
        text: `Welcome to Wrong Answers Only! 

A daily trivia game where the goal is to submit the most creative *wrong* answers.

📅 **How to Play:**
1. **Submission Phase (12 hours):** Submit your most creative wrong answer to today's trivia question
2. **Voting Phase (12 hours):** Vote for your favorite wrong answers (max 3 votes)
3. **Results:** The most entertaining wrong answer wins!

🏆 **Features:**
• Daily trivia questions across multiple categories
• Leaderboard with player statistics and streaks
• Shareable results
• Anti-gaming measures to ensure fair play

Think you have what it takes to be creatively wrong? Click "Play Game" to get started!`
      });

      // Initialize game state in Redis for this post
      await initializeGame(context.redis, post.id);

      context.ui.showToast('Wrong Answers Only game created successfully!');
    } catch (error) {
      console.error('Error creating game post:', error);
      context.ui.showToast('Failed to create game post');
    }
  },
});

// Initialize game state when a new post is created
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
    }
  ];

  const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
  const gameState = {
    currentQuestion: randomQuestion,
    phase: 'submission',
    phaseEndsAt: Date.now() + (12 * 60 * 60 * 1000), // 12 hours from now
    submissions: []
  };

  await redis.hSet(`game:${postId}`, {
    state: JSON.stringify(gameState)
  });
}

export default Devvit;
