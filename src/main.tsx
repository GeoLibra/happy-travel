import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { Analytics } from '@vercel/analytics/react';
import './index.css';
import { I18nProvider } from './i18n';

// Suppress canvas 2d readback warning from external libraries (like AMap)
const originalGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (
  contextId: string,
  options?: any
) {
  if (contextId === '2d') {
    options = { ...options, willReadFrequently: true } as any;
  }
  return originalGetContext.call(this, contextId, options) as any;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <Analytics />
      <App />
    </I18nProvider>
  </StrictMode>
);
