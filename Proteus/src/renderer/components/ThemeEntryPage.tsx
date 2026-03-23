import React, { useEffect, useState } from "react";
import { Button, Toast, Typography } from "@douyinfe/semi-ui";
import * as api from "../services/api";
import { routerStore } from "../stores/routerStore";
import { initializeThemeRuntime, refreshThemeCatalog, selectTheme, setBaseTheme } from "../theme/runtime";

const { Title, Text } = Typography;

export const ThemeEntryPage: React.FC<{ theme: string | null }> = ({ theme }) => {
  const [preview, setPreview] = useState<api.AuthEntryPreviewRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const signedIn = Boolean(api.getToken());

  useEffect(() => {
    setLoading(true);
    api.getAuthEntryPreview("theme", { theme })
      .then(setPreview)
      .catch(() => setPreview(null))
      .finally(() => setLoading(false));
  }, [theme]);

  const title = preview?.title || "Themed Entry";
  const description = preview?.description || "A custom Bergamot theme link brought you here. Continue to sign in and finish setup.";

  const handleApply = async () => {
    setApplying(true);
    try {
      const normalized = (theme || "").trim().toLowerCase();
      if (normalized === "light") {
        await setBaseTheme("light");
      } else if (normalized === "dark" || normalized === "amoled") {
        await setBaseTheme("dark");
      }

      await initializeThemeRuntime();
      const available = await refreshThemeCatalog();
      if (normalized && normalized !== "light" && normalized !== "dark") {
        const matchedTheme = available.find((entry) => entry.toLowerCase() === normalized || entry.toLowerCase().includes(normalized));
        if (matchedTheme) {
          await selectTheme(matchedTheme);
        }
      }

      Toast.success({ content: "Theme applied", duration: 1.5 });
      if (signedIn) {
        routerStore.openDmHome();
      } else {
        routerStore.beginLoginFlow({ kind: "themeEntry", theme });
      }
    } catch (err: any) {
      Toast.error({ content: err.message || "Failed to apply theme", duration: 2 });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-card__header">
          <Title heading={3} className="login-card__title">{title}</Title>
          <Text className="login-card__subtitle">{description}</Text>
        </div>
        <div style={{ textAlign: "center", padding: "16px 0", display: "grid", gap: 12 }}>
          {loading ? (
            <Text>Loading theme entry details...</Text>
          ) : (
            <Text>{theme ? `Theme context: ${theme}` : "No theme token was supplied with this entry link."}</Text>
          )}
          <Button
            theme="solid"
            className="login-card__submit"
            loading={applying}
            onClick={() => { void handleApply(); }}
          >
            {signedIn ? "Apply Theme" : "Apply and Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
};
