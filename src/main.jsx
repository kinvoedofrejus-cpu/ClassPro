// IMPORTANT : cet import doit rester en premier. Il installe window.storage
// avant que ClassPro ne soit monté et n'essaie de l'utiliser.
import "./storageAdapter.js";

import React from "react";
import ReactDOM from "react-dom/client";
import ClassPro from "./ClassPro.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ClassPro />
  </React.StrictMode>
);
