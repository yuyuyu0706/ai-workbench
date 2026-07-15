import { mountPromptTrailApplication } from './app/bootstrap';
import './styles/tokens.css';
import './styles/globals.css';
import './styles/ui-primitives.css';
import './styles/app-shell.css';
import './styles/welcome-page.css';
import './styles/dashboard-page.css';

const rootElement = document.getElementById('root');

if (rootElement === null) {
  throw new Error('PromptTrail root element #root was not found.');
}

mountPromptTrailApplication(rootElement);
