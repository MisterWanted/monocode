import React, { useLayoutEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initAppearance } from "./lib/appearance";
import { loadWindowTransfer } from "./lib/windowTransferBootstrap";
import "./index.css";

initAppearance();

function dismissBootSplash() {
  const splash = document.getElementById("boot-splash");
  if (!splash || splash.dataset.dismissed === "1") return;
  splash.dataset.dismissed = "1";
  splash.classList.add("boot-splash-out");
  window.setTimeout(() => splash.remove(), 140);
}

function BootGate({ children }: { children: React.ReactNode }) {
  useLayoutEffect(() => {
    dismissBootSplash();
  }, []);
  return children;
}

async function boot() {
  const windowTransfer = await loadWindowTransfer();
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <BootGate>
        <App windowTransfer={windowTransfer} />
      </BootGate>
    </React.StrictMode>,
  );
}

void boot();
