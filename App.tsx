import React, { useState, useEffect } from 'react';
import { AuthForm } from './components/AuthForm';
import { TodoList } from './components/TodoList';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // Check for existing token on mount
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
    }
    setInitializing(false);
  }, []);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
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
          <p className="mt-8 text-xs text-slate-400">
            Powered by Render Todo API
          </p>
        </div>
      ) : (
        <TodoList onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;