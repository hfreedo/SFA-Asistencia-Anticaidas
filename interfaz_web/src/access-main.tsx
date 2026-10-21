import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AccessApp } from "./AccessApp";
import "@fontsource/geist/400.css";
import "@fontsource/geist/600.css";
import "@fontsource/geist/700.css";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/fraunces/full-italic.css";

createRoot(document.getElementById("root")!).render(
  window.top === window.self ? <StrictMode><AccessApp /></StrictMode> :
    <p>Abre SFA Asistencia directamente en una pestaña del navegador.</p>,
);
