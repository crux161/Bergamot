import React, { useState } from "react";
import { LoginScreen } from "./components/LoginScreen";
import { AppLayout } from "./layouts/AppLayout";
import type { UserRead } from "./services/api";

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserRead | null>(null);

  if (!currentUser) {
    return <LoginScreen onLoggedIn={setCurrentUser} />;
  }

  return <AppLayout currentUser={currentUser} />;
};
