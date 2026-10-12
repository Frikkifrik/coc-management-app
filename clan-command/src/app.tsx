import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import ClashApp from './clash/ClashApp';
import { AuthProvider, SignInScreen } from './clash/auth';

/**
 * The dark mobile app is the whole product now. The previous bright workspace
 * (sidebar, dashboard, roster tables, rewards, settings) has been retired; its
 * git history is at commit 4227041 if any screen needs to be revived.
 *
 * Sessions still matter: live Supercell lookups go through a session-gated
 * server route, so `/login` exists to raise one. Everything works without it,
 * on the local dataset.
 */
function SignInRoute() {
  const navigate = useNavigate();
  return <SignInScreen onDone={() => navigate('/', { replace: true })} />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<SignInRoute />} />
          {/* Old entry points keep resolving to the same app. */}
          <Route path="/clash" element={<Navigate to="/" replace />} />
          <Route path="/app/*" element={<Navigate to="/" replace />} />
          <Route path="/recruitment" element={<Navigate to="/" replace />} />
          <Route path="*" element={<ClashApp />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
