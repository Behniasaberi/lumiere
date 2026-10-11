import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource-variable/vazirmatn";
import "@fontsource/alexandria/latin-300.css";
import "@fontsource/alexandria/latin-600.css";
import "./styles/global.css";
import "./styles/tailwind.css";
import App from "./App";
import { StoreProvider } from "./store/Store";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <App />
      </StoreProvider>
    </BrowserRouter>
  </StrictMode>,
);
