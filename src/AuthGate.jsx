import React, { useEffect, useState } from "react";
import AccountAccess from "./AccountAccess.jsx";
import { subscribeAuth } from "./auth.js";

export default function AuthGate({ children }) {
  const [auth, setAuth] = useState({
    ready: false,
    session: null,
    recovery: false,
  });
  useEffect(() => subscribeAuth(setAuth), []);

  if (!auth.ready || !auth.session || auth.recovery) {
    return <AccountAccess fullPage />;
  }

  return <React.Fragment key={auth.session.user.id}>{children}</React.Fragment>;
}
