/// <reference types="vite/client" />
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {LegalPage, legalPathFor} from './components/LegalPage.tsx';
import {NotFoundPage} from './components/NotFoundPage.tsx';
import {isKnownPage} from './data/routes';
import './index.css';
import {installDemo} from './demo/install';

// Preview builds only (`vite build --mode demo`). In every other build this is
// the constant `false`, so the demo code is dropped from the bundle entirely.
if (import.meta.env.MODE === 'demo') installDemo();

// The policy pages are plain links (/privacy, /terms, ...). The server answers
// every unknown path with index.html, so the choice is made here.
const legal = legalPathFor(window.location.pathname);
// The demo preview is hosted at an address of its own, which is never "/".
const known = import.meta.env.MODE === 'demo' || isKnownPage(window.location.pathname);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {legal ? <LegalPage path={legal} /> : known ? <App /> : <NotFoundPage />}
  </StrictMode>,
);
