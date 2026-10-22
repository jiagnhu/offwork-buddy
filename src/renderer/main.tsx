import React from "react";
import { createRoot } from "react-dom/client";
import "../shared/bridge";
import App from "./App";
if (["#companion", "#desktop-card"].includes(location.hash))
  document.documentElement.classList.add("companion-window");
createRoot(document.getElementById("root")!).render(<App />);
