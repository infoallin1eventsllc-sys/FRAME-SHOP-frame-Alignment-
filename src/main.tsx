import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {LegalPage, legalPathFor} from './components/LegalPage.tsx';
import './index.css';

// The policy pages are plain links (/privacy, /terms, ...). The server answers
// every unknown path with index.html, so the choice is made here.
const legal = legalPathFor(window.location.pathname);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {legal ? <LegalPage path={legal} /> : <App />}
  </StrictMode>,
);
