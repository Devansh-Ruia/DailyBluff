import { Devvit } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
  redis: true,
});

Devvit.addCustomPostType({
  name: 'Wrong Answers Only',
  render: (context) => {
    return {
      text: '🎯 Wrong Answers Only - A daily trivia game where creativity wins!',
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
        subredditName: context.subredditName,
        kind: 'self',
        text: 'Welcome to Wrong Answers Only! A daily trivia game where the goal is to submit the most creative *wrong* answers.'
      });

      await initializeGame(context.redis, post.id);
      context.ui.showToast('Wrong Answers Only game created successfully!');
    } catch (error) {
      console.error('Error creating game post:', error);
      context.ui.showToast('Failed to create game post');
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

export default Devvit;
