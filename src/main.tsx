import './polyfill-guard';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { InitiativeFeedbackProvider } from './context/InitiativeFeedbackContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <InitiativeFeedbackProvider>
      <App />
    </InitiativeFeedbackProvider>
  </StrictMode>,
);
