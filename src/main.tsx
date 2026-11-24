import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { getMeta } from './lib/db';
import { startBadge } from './lib/badge';
import { applyTheme, type Theme } from './screens/Settings';
import './styles.css';

getMeta<Theme>('theme').then((t) => applyTheme(t ?? 'system'));
registerSW({ immediate: true });
startBadge();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
