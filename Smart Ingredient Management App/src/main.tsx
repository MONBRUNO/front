
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./app/App.tsx";
import "./styles/index.css";

import { themeModeStore } from './app/utils/themeMode';

// MSW 모킹 비활성화 — 백엔드 연동된 상태이고 msw 패키지도 설치되어 있지 않음.
// 다시 켜려면 `npm install -D msw` 후 dev 환경에서 ./mocks/browser를 동적 import.

// Sentry — VITE_SENTRY_DSN 환경변수가 있을 때만 활성화. prod 빌드에서만 동작.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn && import.meta.env.PROD) {
  Sentry.init({
    dsn: sentryDsn,
    environment: 'prod',
    tracesSampleRate: 0,
  });
}

// 테마 모드 초기화 — <html>에 dark 클래스를 즉시 부여 + prefers-color-scheme listen.
themeModeStore.init();

createRoot(document.getElementById("root")!).render(<App />);
