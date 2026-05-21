// 모든 인증 필요한 API 호출은 이 wrapper를 통과시킨다.
// - Authorization 헤더 자동 부착
// - 401/403 응답 시 refresh token으로 access token 재발급 후 1회 재시도
// - 재발급 실패 시 auth 정리 + /login 이동
//
// === 저장소 정책 ===
// localStorage: "로그인 상태 유지" 체크 시 (브라우저/컴퓨터 종료해도 살아남음)
// sessionStorage: 미체크 시 (브라우저 닫으면 휘발)
//
// 읽기는 양쪽 모두 보고(localStorage 우선), 쓰기는 기존 토큰이 있던 쪽에 그대로 둠.
// 처음 저장은 saveAuth(persistent)로 한 번에 위치 결정.

import { isGuest } from './guestMode';

// 백엔드 base URL. Vercel 등 배포 시 VITE_API_BASE_URL 환경변수로 주입.
// 로컬 dev는 미설정 → localhost:8080 fallback.
export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

const AUTH_KEYS = ['authToken', 'refreshToken', 'isLoggedIn', 'userProfile'] as const;

// 토큰이 어느 storage에 있는지 — 로그인 상태 유지 여부 판단.
// localStorage에 authToken이 있으면 영구(remember-me), 아니면 세션 단위.
function isPersistent(): boolean {
  return localStorage.getItem('authToken') !== null;
}

// 양쪽 storage 모두에서 키를 찾는다. localStorage 우선 (영구 모드를 우선시).
function readAuth(key: string): string | null {
  return localStorage.getItem(key) ?? sessionStorage.getItem(key);
}

// 한쪽에만 두기 위해 반대쪽은 비우고 저장. 영구 ↔ 세션 전환 시 잔재 방지.
function writeAuth(key: string, value: string, persistent: boolean): void {
  if (persistent) {
    localStorage.setItem(key, value);
    sessionStorage.removeItem(key);
  } else {
    sessionStorage.setItem(key, value);
    localStorage.removeItem(key);
  }
}

// 로그인 직후 / OAuth 콜백 직후 사용. 4개 키를 한 번에 적절한 위치에 저장.
export function saveAuth(
  data: { token?: string; refreshToken?: string; user?: unknown },
  persistent: boolean,
): void {
  writeAuth('isLoggedIn', 'true', persistent);
  if (data.token) writeAuth('authToken', data.token, persistent);
  if (data.refreshToken) writeAuth('refreshToken', data.refreshToken, persistent);
  if (data.user) writeAuth('userProfile', JSON.stringify(data.user), persistent);
}

// 동시에 여러 요청이 401 받았을 때 refresh 호출이 중복되지 않도록 한 번만 실행하고 promise 공유
let inflightRefresh: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = readAuth('refreshToken');
  if (!refreshToken) return false;

  if (inflightRefresh) return inflightRefresh;

  // 기존 토큰이 있던 위치 그대로 새 토큰을 저장 (영구 모드는 영구로, 세션 모드는 세션으로)
  const persistent = isPersistent();

  inflightRefresh = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/user/token/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { token?: string; refreshToken?: string };
      if (!data.token || !data.refreshToken) return false;
      writeAuth('authToken', data.token, persistent);
      writeAuth('refreshToken', data.refreshToken, persistent);
      return true;
    } catch {
      return false;
    } finally {
      inflightRefresh = null;
    }
  })();
  return inflightRefresh;
}

// 로그아웃/탈퇴/refresh 실패 시 클라이언트 측 흔적 일괄 제거. 양쪽 storage 모두 정리.
export function clearAuth(): void {
  for (const key of AUTH_KEYS) {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  }
}

function buildHeaders(extra?: HeadersInit): HeadersInit {
  const token = readAuth('authToken');
  return {
    'Content-Type': 'application/json',
    ...extra,
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

  let res = await fetch(url, { ...options, headers: buildHeaders(options.headers) });

  // 인증 실패: refresh 시도 → 성공 시 1회 재시도, 실패 시 로그인 화면으로.
  // 게스트는 처음부터 토큰이 없으므로 401을 받아도 로그아웃 처리하지 않는다 (화면이 자체적으로 가드).
  if (res.status === 401 || res.status === 403) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await fetch(url, { ...options, headers: buildHeaders(options.headers) });
    } else if (!isGuest()) {
      clearAuth();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
  }
  return res;
}

// 파일 업로드용. Content-Type은 브라우저가 multipart boundary와 함께 자동 설정 — 직접 부착하면 안 됨.
// 401 시 refresh 후 1회 재시도까지만 처리하고, FormData 재구성은 호출자 책임.
export async function apiUpload(path: string, formData: FormData): Promise<Response> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

  const buildAuthOnlyHeaders = (): HeadersInit => {
    const token = readAuth('authToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  let res = await fetch(url, { method: 'POST', body: formData, headers: buildAuthOnlyHeaders() });

  if (res.status === 401 || res.status === 403) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await fetch(url, { method: 'POST', body: formData, headers: buildAuthOnlyHeaders() });
    } else if (!isGuest()) {
      clearAuth();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
  }
  return res;
}

// 서버에 refresh token 폐기 요청까지 보내는 로그아웃 헬퍼
export async function logoutOnServer(): Promise<void> {
  const refreshToken = readAuth('refreshToken');
  if (!refreshToken) return;
  try {
    await fetch(`${API_BASE_URL}/user/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // 네트워크 오류라도 클라이언트 측 토큰은 어차피 비우므로 무시
  }
}
