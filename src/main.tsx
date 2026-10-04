import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import logo from '../Predictive Care Dashboard Logo.png';

// Dynamically set the favicon
const link = document.createElement('link');
link.rel = 'icon';
link.type = 'image/png';
link.href = logo;
document.head.appendChild(link);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
