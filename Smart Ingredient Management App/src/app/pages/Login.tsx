import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import { Eye, EyeOff } from 'lucide-react';
import { API_BASE_URL, saveAuth } from '../utils/apiClient';
import { setGuest, clearGuest } from '../utils/guestMode';
import { promptAndMigrate } from '../utils/ingredientMigration';
import kakaoSymbol from '../../assets/kakao_symbol.png';
import logoFull from '../../assets/logo_full.png';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  // 회원가입 직후 진입 시 SignUp에서 넘긴 username을 자동으로 채워준다.
  const initialUsername = (location.state as { username?: string } | null)?.username ?? '';
  const [formData, setFormData] = useState({
    username: initialUsername,
    password: '',
  });

  // ──────────────────────────────────────────────────────────────
  // [MSW 모킹 중] 이 handleSubmit 함수는 MSW가 가로채서 가짜 응답을 줍니다.
  // 실제 fetch 코드(`${API_BASE_URL}/user/login`)는 그대로지만,
  // MSW가 중간에서 가상 계정(id: d23 / pwd: d3d3)을 확인하고 응답합니다.
  //
  // TODO: 백엔드 연동 완료 후 → 이 함수 내부 로직은 변경 불필요.
  //       MSW를 제거(src/mocks/ 삭제 + main.tsx 정리)하면 실제 백엔드로 요청이 전달됩니다.
  // ──────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // 이 fetch 요청은 MSW(개발 중) 또는 실제 백엔드(연동 후) 중 하나가 처리합니다.
      const response = await fetch(`${API_BASE_URL}/user/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // 백엔드 LoginResponse: { success, message, token, refreshToken }
        // success=false여도 HTTP 200으로 오므로 별도 분기
        if (data.success === false) {
          alert(`로그인 실패: ${data.message || '아이디 또는 비밀번호를 확인해주세요.'}`);
          return;
        }

        // rememberMe=true → localStorage (영구), false → sessionStorage (세션 종료 시 로그아웃)
        saveAuth(
          { token: data.token, refreshToken: data.refreshToken, user: data.user },
          rememberMe,
        );

        // 게스트 모드에서 진입한 경우 → 플래그 해제 + 로컬 식재료 마이그레이션 안내
        clearGuest();
        await promptAndMigrate();

        navigate('/');
      } else {
        const error = await response.text();
        alert(`로그인 실패: ${error}`);
      }
    } catch (error) {
      console.error('로그인 오류:', error);
      alert('로그인 중 오류가 발생했습니다.');
    }
  };

  // ──────────────────────────────────────────────────────────────
  // [MSW 모킹 중] 소셜 로그인은 MSW로 모킹이 불가능합니다.
  // (외부 OAuth 서버 리다이렉트이기 때문)
  // 개발 중에는 소셜 로그인 버튼을 클릭하지 마세요 → 오류 페이지로 이동합니다.
  //
  // TODO: 백엔드 서버가 실행 중일 때 소셜 로그인이 정상 동작합니다.
  //       소셜 로그인 핸들러 자체는 수정 불필요 — 변경 없이 그대로 사용.
  // ──────────────────────────────────────────────────────────────
  const handleSocialLogin = (provider: 'kakao' | 'naver' | 'google') => {
    // 백엔드 OAuth 인증 엔드포인트로 이동
    // 백엔드에서 인증 처리 → JWT 발급 → /oauth/callback으로 redirect
    window.location.href = `${API_BASE_URL}/oauth2/authorization/${provider}`;
  };

  const handleStartAsGuest = () => {
    setGuest();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background flex justify-center items-center">
      <div className="w-full max-w-md bg-background text-foreground min-h-screen shadow-xl flex flex-col">
        <div className="flex-1 flex flex-col justify-center px-6 py-6">
          {/* 로고 영역 — 배경 투명 PNG */}
          <div className="mb-2 flex justify-center">
            <img src={logoFull} alt="Naengbuhae" className="w-full h-auto" />
          </div>

        {/* 로그인 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="아이디"
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              className="w-full px-4 py-4 bg-card border-2 border-border-strong rounded-xl focus:outline-none focus:ring-2 focus:ring-accent transition-all"
            />
          </div>

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="비밀번호"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className="w-full px-4 py-4 bg-card border-2 border-border-strong rounded-xl focus:outline-none focus:ring-2 focus:ring-accent transition-all pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-between px-1">
            {/* 로그인 상태 유지 체크박스 — 체크 시 브라우저 종료해도 로그인 유지 (localStorage 사용) */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 accent-black cursor-pointer"
              />
              <span className="text-sm text-muted-foreground">로그인 상태 유지</span>
            </label>
            <Link to="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
              비밀번호 잊으셨나요?
            </Link>
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-colors"
          >
            로그인
          </button>
        </form>

        {/* 비로그인 진입 — 회원가입만 있는 줄 알고 이탈하지 않도록 로그인 버튼 바로 아래에 배치 */}
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={handleStartAsGuest}
            className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            로그인 없이 둘러보기
          </button>
        </div>

        {/* 구분선 */}
        <div className="flex items-center gap-4 my-5">
          <div className="flex-1 h-px bg-border"></div>
          <span className="text-sm text-muted-foreground">간편 로그인</span>
          <div className="flex-1 h-px bg-border"></div>
        </div>

        {/* 소셜 로그인 */}
        <div className="space-y-3">
          <button
            onClick={() => handleSocialLogin('naver')}
            className="w-full py-4 bg-[#03C75A] text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-[#02b351] transition-colors"
          >
            <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
              <span className="text-[#03C75A] text-sm" style={{ fontWeight: 700 }}>N</span>
            </div>
            네이버로 시작하기
          </button>

          <button
            onClick={() => handleSocialLogin('kakao')}
            className="w-full py-4 bg-[#FEE500] text-black rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-[#fdd835] transition-colors"
          >
            <img src={kakaoSymbol} alt="" className="w-6 h-6" />
            카카오로 시작하기
          </button>

          <button
            onClick={() => handleSocialLogin('google')}
            className="w-full py-4 bg-card border-2 border-border text-foreground rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-secondary transition-colors"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            구글로 시작하기
          </button>
        </div>

        {/* 회원가입 링크 */}
        <div className="mt-5 text-center">
          <span className="text-muted-foreground">아직 회원이 아니신가요? </span>
          <Link
            to="/signup"
            className="font-semibold hover:underline"
            style={{ color: 'var(--accent)', textShadow: '0 0 1px rgba(0,0,0,0.3)' }}
          >
            회원가입
          </Link>
        </div>
        </div>
      </div>
    </div>
  );
}
