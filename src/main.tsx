import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import InstallGate from './components/InstallGate';
import { AuthProvider } from './auth/AuthProvider';
import { registerServiceWorker } from './lib/registerServiceWorker';
import './styles/base.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');
createRoot(root).render(
  <StrictMode>
    <InstallGate>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </InstallGate>
  </StrictMode>,
);

// Make the app installable + offline-capable (no-op in dev; see the module).
registerServiceWorker();
