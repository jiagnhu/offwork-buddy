import React from "react";
import { createRoot } from "react-dom/client";
import "../shared/bridge";
import App from "./App";
import DesktopReply from "./pages/DesktopReply";
if (
  ["#companion", "#desktop-card", "#desktop-chat", "#desktop-reply"].includes(
    location.hash,
  )
)
  document.documentElement.classList.add("companion-window");
createRoot(document.getElementById("root")!).render(
  location.hash === "#desktop-reply" ? <DesktopReply /> : <App />,
);
