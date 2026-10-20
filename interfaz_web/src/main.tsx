import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SfaDashboardApp, ToastHost } from "./SfaDashboard";
import { PhoneLocationSender } from "./LocationTools";
import "./index.css";
import "@fontsource/geist/400.css";
import "@fontsource/geist/500.css";
import "@fontsource/geist/600.css";
import "@fontsource/geist/700.css";
import "@fontsource/geist-mono/400.css";
import "@fontsource/geist-mono/500.css";
import "@fontsource/geist-mono/600.css";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/fraunces/full-italic.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {window.location.pathname === "/compartir-ubicacion" ? <PhoneLocationSender /> : <SfaDashboardApp />}
    <ToastHost />
  </StrictMode>,
);
