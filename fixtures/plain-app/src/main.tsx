// What an app without Tailwind does, as in the README.
import '@integr8-media/ui/fonts.css';
import '@integr8-media/ui/styles.css';
import '@integr8-media/window-manager/styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
