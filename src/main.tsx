import './index.css';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(<App />);
