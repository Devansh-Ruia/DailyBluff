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
        <text size="xxlarge" weight="bold">Loading game...</text>
      </vstack>
    );
  },
});

export default Devvit;
