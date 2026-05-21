import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { API_BASE_URL } from '../utils/apiClient';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('유효하지 않은 링크입니다.');
      return;
    }
    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/user/password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.success) {
        setDone(true);
      } else {
        setError(data?.message ?? '비밀번호 재설정에 실패했습니다.');
      }
    } catch {
      setError('서버 연결에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex justify-center items-center px-4">
        <div className="w-full max-w-md bg-background text-foreground rounded-2xl shadow-xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl mb-2" style={{ fontWeight: 700 }}>잘못된 링크</h1>
          <p className="text-sm text-muted-foreground mb-6">토큰이 없거나 유효하지 않습니다.</p>
          <Link to="/forgot-password" className="block w-full bg-foreground text-background rounded-xl py-3"
                style={{ fontWeight: 600 }}>
            비밀번호 찾기 다시 요청
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex justify-center items-center px-4">
      <div className="w-full max-w-md bg-background text-foreground rounded-2xl shadow-xl p-8">
        {!done ? (
          <>
            <h1 className="text-2xl mb-2" style={{ fontWeight: 700 }}>새 비밀번호 설정</h1>
            <p className="text-sm text-muted-foreground mb-6">
              사용할 새 비밀번호를 입력해주세요. 8자 이상, 영문 소문자·숫자·특수문자 포함.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="새 비밀번호"
                  autoFocus
                  className="w-full px-4 py-3 bg-card border border-border rounded-xl border border-border focus:outline-none focus:border-black pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              <input
                type={showPw ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="비밀번호 확인"
                className="w-full px-4 py-3 bg-card border border-border rounded-xl border border-border focus:outline-none focus:border-black"
              />

              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 bg-foreground text-background rounded-xl py-3 disabled:opacity-60"
                style={{ fontWeight: 600 }}
              >
                {submitting ? '변경 중...' : '비밀번호 변경'}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <div className="w-14 h-14 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
            <h1 className="text-xl mb-2" style={{ fontWeight: 700 }}>비밀번호가 변경되었습니다</h1>
            <p className="text-sm text-muted-foreground mb-6">새 비밀번호로 로그인해주세요.</p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-foreground text-background rounded-xl py-3"
              style={{ fontWeight: 600 }}
            >
              로그인하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
