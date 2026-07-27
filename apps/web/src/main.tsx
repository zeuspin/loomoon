import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "./app-shell";
import { ThemeProvider } from "./theme";
import "@loomoon/design-tokens/tokens.css";
import "@loomoon/ui/styles.css";
import "@loomoon/agent-ui/styles.css";
import "./tailwind.css";
import "./styles.css";
import "./login.css";
import "./region.css";
import "./history.css";
import "./enhancements.css";
import "./projects.css";
import "./app-shell.css";
import "./home-page.css";
import "./library-pages.css";
import "./flat.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Root element was not found");
}

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  </StrictMode>
);
