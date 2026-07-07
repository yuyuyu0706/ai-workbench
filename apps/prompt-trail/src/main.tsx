import { mountPromptTrailApplication } from './app/bootstrap';
import './styles/tokens.css';
import './styles/globals.css';
import './styles/ui-primitives.css';
import './styles/welcome-page.css';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('PromptTrail root element #root was not found.');
}

mountPromptTrailApplication(rootElement);
