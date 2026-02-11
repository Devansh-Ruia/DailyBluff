import { Devvit, useWebView } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
  redis: true,
});

Devvit.addCustomPostType({
  name: 'Wrong Answers Only',
  height: 'tall',
  render: () => {
    const { mount } = useWebView({
      url: 'game.html',
      onMessage: () => {},
    });

    return (
      <vstack height="100%" width="100%" alignment="center middle" onPress={mount}>
        <text size="xxlarge" weight="bold">🎯 Wrong Answers Only</text>
        <text size="medium">Tap to play!</text>
      </vstack>
    );
  },
});

Devvit.addMenuItem({
  label: 'Create Wrong Answers Only Game',
  location: 'subreddit',
  onPress: async (_event, context) => {
    const post = await context.reddit.submitPost({
      title: '🎯 Wrong Answers Only - Daily Trivia Challenge',
      subredditName: context.subredditName!,
      kind: 'custom',
      customPostType: 'Wrong Answers Only',
      preview: (
        <vstack padding="medium">
          <text size="large" weight="bold">🎯 Wrong Answers Only</text>
          <text>Loading game...</text>
        </vstack>
      ),
    });
    context.ui.showToast('Game created!');
    context.ui.navigateTo(post);
  },
});

export default Devvit;