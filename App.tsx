import React, { useState, useEffect } from 'react';
import { AuthForm } from './components/AuthForm';
import { api } from './services/api';
import { TodoList } from './components/TodoList';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // Check for existing session via API (cookies)
    const checkSession = async () => {
      try {
        await api.getCurrentUser();
        setIsAuthenticated(true);
      } catch (error) {
        setIsAuthenticated(false);
      } finally {
        setInitializing(false);
      }
    };
    checkSession();

    // Subscribe to auth failures (e.g. token expired and refresh failed)
    const unsubscribe = api.onUnauthorized(() => {
      setIsAuthenticated(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout failed', error);
    } finally {
      setIsAuthenticated(false);
    }
  };

  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {!isAuthenticated ? (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
          <AuthForm onSuccess={handleLoginSuccess} />
          <p className="mt-8 text-xs text-slate-400">{`Powered by ${
            import.meta.env.VITE_API_NAME || 'Todo API'
          }`}</p>
        </div>
      ) : (
        <TodoList onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;
