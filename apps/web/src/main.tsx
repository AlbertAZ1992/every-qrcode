import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/app";
import "@/styles.css";

const root = document.querySelector<HTMLDivElement>("#root");
if (!root) throw new Error("Every QR Code root element is missing.");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
