// frontend/src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { Auth0Provider } from "@auth0/auth0-react";
import ApiAuthBridge from "./ApiAuthBridge";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./queryClient";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: `${window.location.origin}/auth/callback`,
        audience: import.meta.env.VITE_AUTH0_AUDIENCE,
        scope: "openid profile email",
      }}
      cacheLocation="localstorage"
      useRefreshTokens={true}
      // ✅ IMPORTANT: don't navigate here — let the callback route do it using React Router
      onRedirectCallback={(appState) => {
        try {
          const returnTo = (appState as any)?.returnTo;
          if (typeof returnTo === "string" && returnTo) {
            sessionStorage.setItem("aisthetic:returnTo", returnTo);
          }
        } catch {
          // ignore
        }
      }}
    >
      <QueryClientProvider client={queryClient}>
        <ApiAuthBridge />
        <App />
      </QueryClientProvider>
    </Auth0Provider>
  </StrictMode>
);
