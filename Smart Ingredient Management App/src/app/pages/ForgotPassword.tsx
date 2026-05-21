import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Mail, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../utils/apiClient';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('이메일을 입력해주세요.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // 인증 불필요 — 미로그인 상태에서 호출.
      const res = await fetch(`${API_BASE_URL}/user/password/forgot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      // 보안상 백엔드는 이메일 존재 여부와 무관하게 success=true 반환.
      // 사용자 입장에선 "메일 보냈으니 확인하세요" 메시지로 통일.
      if (data?.success === false) {
        setError(data.message ?? '요청 처리 실패');
      } else {
        setSent(true);
      }
    } catch {
      setError('서버 연결에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex justify-center items-center px-4">
      <div className="w-full max-w-md bg-background text-foreground rounded-2xl shadow-xl p-8">
        <button onClick={() => navigate(-1)} className="mb-4 -ml-2 p-2 text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>

        {!sent ? (
          <>
            <h1 className="text-2xl mb-2" style={{ fontWeight: 700 }}>
              비밀번호 찾기
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              가입할 때 사용한 이메일을 입력해주세요. 재설정 링크를 보내드릴게요.
            </p>

            <form onSubmit={handleSubmit}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                autoFocus
                className="w-full px-4 py-3 bg-card border border-border rounded-xl border border-border focus:outline-none focus:border-black mb-2"
              />
              {error && (
                <p className="text-sm text-red-500 mb-2">{error}</p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-4 bg-foreground text-background rounded-xl py-3 disabled:opacity-60"
                style={{ fontWeight: 600 }}
              >
                {submitting ? '전송 중...' : '재설정 링크 보내기'}
              </button>
            </form>

            <p className="text-sm text-muted-foreground text-center mt-6">
              <Link to="/login" className="underline" style={{ fontWeight: 600 }}>
                로그인으로 돌아가기
              </Link>
            </p>
          </>
        ) : (
          <div className="text-center">
            <div className="w-14 h-14 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
            <h1 className="text-xl mb-2" style={{ fontWeight: 700 }}>
              이메일을 확인해주세요
            </h1>
            <p className="text-sm text-muted-foreground mb-1">
              <span style={{ fontWeight: 600 }}>{email}</span>로
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              재설정 안내 메일을 보냈어요.
            </p>
            <div className="bg-card border border-border rounded-xl p-4 text-left mb-6">
              <p className="text-xs text-muted-foreground flex items-start gap-2">
                <Mail className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  메일이 안 오면 스팸함을 확인하거나 이메일 주소가 정확한지 확인해주세요.
                  링크는 30분 동안 유효합니다.
                </span>
              </p>
            </div>
            <Link
              to="/login"
              className="block w-full bg-foreground text-background text-center rounded-xl py-3"
              style={{ fontWeight: 600 }}
            >
              로그인으로 돌아가기
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
