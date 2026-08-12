import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.jsx'
import { EntitlementProvider } from './context/EntitlementContext.jsx'
import { ToastProvider } from './components/Toast.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { GoogleOAuthProvider } from '@react-oauth/google'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

const tree = (
  <EntitlementProvider>
    <ToastProvider>
      <App />
    </ToastProvider>
  </EntitlementProvider>
)

// Outermost so a render error anywhere shows a message instead of unmounting
// the root and leaving a blank white page.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      {googleClientId ? <GoogleOAuthProvider clientId={googleClientId}>{tree}</GoogleOAuthProvider> : tree}
    </ErrorBoundary>
  </StrictMode>,
)
