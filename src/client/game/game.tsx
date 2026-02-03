import '../index.css';

import { createRoot } from 'react-dom/client';
import { WrongAnswersOnlyApp } from './WrongAnswersOnlyApp';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<WrongAnswersOnlyApp />);
}
