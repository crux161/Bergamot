import React, { useState, useEffect } from "react";
import { AppLayout } from "./layouts/AppLayout";
import { LoginScreen } from "./components/LoginScreen";
import * as API from "./services/api";

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(API.getToken());
  const [user, setUser] = useState<API.UserRead | null>(null);
  const [loading, setLoading] = useState(true);

  // If we already have a token, fetch the current user
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    API.getMe()
      .then((u) => setUser(u))
      .catch(() => {
        // Token is stale / invalid — clear it
        localStorage.removeItem("bergamot_token");
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleLoggedIn = (u: API.UserRead) => {
    setToken(API.getToken());
    setUser(u);
  };

  const handleLogout = () => {
    localStorage.removeItem("bergamot_token");
    setToken(null);
    setUser(null);
  };

  if (loading) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1E1F22",
          color: "#80848E",
          fontSize: 16,
        }}
      >
        Entering the Pantheon...
      </div>
    );
  }

  // Not authenticated — show login
  if (!token || !user) {
    return <LoginScreen onLoggedIn={handleLoggedIn} />;
  }

  // Authenticated — AppLayout is self-contained
  // (it manages servers, channels, messages, and mock-data fallback internally)
  return <AppLayout currentUser={user} onLogout={handleLogout} onUserUpdated={setUser} />;
};

export default App;
