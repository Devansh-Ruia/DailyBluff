import { reddit } from '@devvit/web/server';

export const createPost = async (reddit: any, subredditName: string) => {
  return await reddit.submitPost({
    title: ' Wrong Answers Only - Daily Trivia Challenge',
    subredditName: subredditName,
    kind: 'self',
    text: 'Welcome to Wrong Answers Only! A daily trivia game where the goal is to submit the most creative *wrong* answers.\n\n **Daily Schedule:**\n• **12 hours:** Submit your creative wrong answers\n• **12 hours:** Vote for your favorite wrong answers\n• **Winner announced:** The most creative wrong answer wins!\n\n **Prizes:**\n• Daily winner glory\n• Streak bonuses for consecutive days\n• Leaderboard recognition\n\nThink you have what it takes to be creatively wrong? Play now!'
  });
};
