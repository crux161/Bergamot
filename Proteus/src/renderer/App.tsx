import React, { useState, useEffect } from "react";
import { AppLayout } from "./layouts/AppLayout";
import { LoginScreen } from "./components/LoginScreen";
import { ForgotPasswordPage } from "./components/ForgotPasswordPage";
import { ResetPasswordPage } from "./components/ResetPasswordPage";
import { VerifyEmailPage } from "./components/VerifyEmailPage";
import { PendingAccountPage } from "./components/PendingAccountPage";
import { AuthorizeIpPage } from "./components/AuthorizeIpPage";
import { SsoCallbackPage } from "./components/SsoCallbackPage";
import { OAuthAuthorizePage } from "./components/OAuthAuthorizePage";
import { InviteAuthPage } from "./components/InviteAuthPage";
import { GiftAuthPage } from "./components/GiftAuthPage";
import { ThemeEntryPage } from "./components/ThemeEntryPage";
import * as API from "./services/api";
import { capabilityStore } from "./stores/capabilityStore";
import { useStoreSnapshot } from "./stores/createStore";
import { isAuthRoute, routerStore } from "./stores/routerStore";

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(API.getToken());
  const [user, setUser] = useState<API.UserRead | null>(null);
  const [loading, setLoading] = useState(true);
  const { route } = useStoreSnapshot(routerStore);

  useEffect(() => {
    API.getInstanceFeatures()
      .then((manifest) => {
        capabilityStore.applyServerFlags(manifest.capabilities);
      })
      .catch(() => {
        capabilityStore.reset();
      });

    API.getInstanceConfig()
      .then((config) => {
        document.title = config.product.name;
      })
      .catch(() => {
        document.title = "Bergamot";
      });
  }, []);

  // If we already have a token, fetch the current user
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    API.getMe()
      .then((u) => {
        API.rememberAuthenticatedAccount(u);
        setUser(u);
      })
      .catch(() => {
        // Token is stale / invalid — clear it
        API.forgetCurrentAccount();
        API.clearToken();
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleLoggedIn = (u: API.UserRead) => {
    API.rememberAuthenticatedAccount(u);
    setToken(API.getToken());
    setUser(u);
    const resumed = routerStore.resumePostAuthRoute();
    if (!resumed && isAuthRoute(route)) {
      routerStore.openDmHome();
    }
  };

  const handleLogout = () => {
    API.forgetCurrentAccount();
    routerStore.clearPostAuthRoute();
    API.clearToken();
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
          background: "var(--background-tertiary)",
          color: "var(--text-muted)",
          fontSize: 16,
        }}
      >
        Entering the Pantheon...
      </div>
    );
  }

  // Auth routes are accessible without a token
  if (isAuthRoute(route)) {
    switch (route.kind) {
      case "forgotPassword":
        return <ForgotPasswordPage />;
      case "resetPassword":
        return <ResetPasswordPage token={route.token} />;
      case "verifyEmail":
        return <VerifyEmailPage token={route.token} />;
      case "pendingAccount":
        return <PendingAccountPage email={route.email} />;
      case "authorizeIp":
        return <AuthorizeIpPage token={route.token} />;
      case "inviteAuth":
        return <InviteAuthPage token={route.token} />;
      case "giftAuth":
        return <GiftAuthPage token={route.token} />;
      case "themeEntry":
        return <ThemeEntryPage theme={route.theme} />;
      case "ssoCallback":
        return <SsoCallbackPage provider={route.provider} code={route.code} state={route.state} onLoggedIn={handleLoggedIn} />;
      case "oauthAuthorize":
        return (
          <OAuthAuthorizePage
            clientId={route.clientId}
            redirectUri={route.redirectUri}
            scope={route.scope}
            state={route.state}
          />
        );
    }
  }

  // Not authenticated — show login
  if (!token || !user) {
    return <LoginScreen onLoggedIn={handleLoggedIn} />;
  }

  // Authenticated — AppLayout is self-contained
  return <AppLayout currentUser={user} onLogout={handleLogout} onUserUpdated={setUser} />;
};

export default App;
