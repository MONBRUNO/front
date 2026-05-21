import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { Eye, EyeOff, ChevronLeft, Check } from 'lucide-react';
import { API_BASE_URL } from '../utils/apiClient';

export default function SignUp() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // 이메일 인증번호 흐름: 코드 발송 → 입력 → 검증 → 가입 가능
  const [verification, setVerification] = useState<{
    sending: boolean;     // "인증번호 받기" 요청 중
    sentTo: string | null; // 코드를 보낸 이메일 (이걸로 잠금 — 이메일 바꾸면 다시 요청해야 함)
    code: string;          // 사용자가 입력 중인 6자리
    verifying: boolean;    // "확인" 요청 중
    verifiedEmail: string | null; // 검증 성공한 이메일 — 가입 시 이게 formData.email과 같아야 통과
    error: string | null;
  }>({ sending: false, sentTo: null, code: '', verifying: false, verifiedEmail: null, error: null });
  const [formData, setFormData] = useState({
    name: '',
    gender: '',
    height: '',
    weight: '',
    birthYear: '',
    birthMonth: '',
    birthDay: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    activityLevel: '',
    dietGoal: '',
    allergies: '',
  });

  // 에러 상태
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLDivElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // 유효성 검사
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = '이름을 입력해주세요';
    }
    if (!formData.gender) {
      newErrors.gender = '성별을 선택해주세요';
    }
    if (!formData.birthYear || !formData.birthMonth || !formData.birthDay) {
      newErrors.birthDate = '생년월일을 모두 선택해주세요';
    }
    if (!formData.height || parseFloat(formData.height) <= 0) {
      newErrors.height = '올바른 키를 입력해주세요';
    }
    if (!formData.weight || parseFloat(formData.weight) <= 0) {
      newErrors.weight = '올바른 몸무게를 입력해주세요';
    }
    if (!formData.activityLevel) {
      newErrors.activityLevel = '활동량을 선택해주세요';
    }
    if (!formData.dietGoal) {
      newErrors.dietGoal = '식단 목표를 선택해주세요';
    }
    if (!formData.email || !formData.email.includes('@')) {
      newErrors.email = '올바른 이메일을 입력해주세요';
    } else if (verification.verifiedEmail !== formData.email.trim()) {
      newErrors.email = '이메일 인증을 완료해주세요';
    }
    if (!formData.username) {
      newErrors.username = '아이디를 입력해주세요';
    } else if (formData.username.length < 6) {
      newErrors.username = '아이디는 6자 이상이어야 합니다';
    } else if (!/^[a-zA-Z0-9]+$/.test(formData.username)) {
      newErrors.username = '아이디는 영문과 숫자만 사용할 수 있습니다';
    } else if (!/[a-zA-Z]/.test(formData.username)) {
      newErrors.username = '아이디에 영문을 포함해야 합니다';
    } else if (!/\d/.test(formData.username)) {
      newErrors.username = '아이디에 숫자를 포함해야 합니다';
    }
    if (!formData.password) {
      newErrors.password = '비밀번호를 입력해주세요';
    } else if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(formData.password)) {
      newErrors.password = '비밀번호에 한글은 사용할 수 없습니다';
    } else if (formData.password.length < 8) {
      newErrors.password = '비밀번호는 8자 이상이어야 합니다';
    } else if (!/[a-z]/.test(formData.password)) {
      newErrors.password = '비밀번호에 영어 소문자를 포함해야 합니다';
    } else if (!/\d/.test(formData.password)) {
      newErrors.password = '비밀번호에 숫자를 포함해야 합니다';
    } else if (!/[^a-zA-Z0-9]/.test(formData.password)) {
      newErrors.password = '비밀번호에 특수문자를 포함해야 합니다';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = '비밀번호가 일치하지 않습니다';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);

      // 첫 번째 에러 필드로 스크롤 & 포커스
      const firstErrorField = Object.keys(newErrors)[0];
      const focusFieldName = firstErrorField === 'birthDate' ? 'birthYear' : firstErrorField;
      const element = document.querySelector(`[name="${focusFieldName}"]`) as HTMLElement;
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.focus();
      }
      return;
    }

    try {
      // 생년월일 조합
      const birthDate = `${formData.birthYear}-${formData.birthMonth.padStart(2, '0')}-${formData.birthDay.padStart(2, '0')}`;

      // 회원가입 API 요청
      const response = await fetch(`${API_BASE_URL}/user/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          email: formData.email,
          name: formData.name,
          gender: formData.gender,
          birthDate: birthDate,
          height: parseFloat(formData.height),
          weight: parseFloat(formData.weight),
          activityLevel: formData.activityLevel,
          dietGoal: formData.dietGoal,
          allergies: formData.allergies,
        }),
      });

      // 백엔드는 성공/실패/검증오류 모두 ApiResponse JSON({success, message}) 형식으로 응답.
      // - 200 + success:true   → 가입 성공
      // - 200 + success:false  → 비즈니스 에러(중복 아이디/이메일 등)
      // - 400 + success:false  → @Valid 검증 실패 (GlobalExceptionHandler가 ApiResponse로 변환)
      // 따라서 status 무관하게 body의 success/message로 분기.
      let data: { success?: boolean; message?: string } = {};
      try {
        data = await response.json();
      } catch {
        setErrors({ submit: '서버 응답을 해석할 수 없습니다.' });
        return;
      }

      if (data.success) {
        alert('회원가입이 완료되었습니다!');
        // 로그인 화면에서 username을 자동으로 채우도록 state로 전달
        navigate('/login', { state: { username: formData.username } });
        return;
      }

      // success === false: 메시지를 해당 필드 인라인 에러로 매핑
      const message: string = data.message ?? '회원가입에 실패했습니다.';
      const fieldErrors: Record<string, string> = {};
      if (message.includes('아이디')) {
        fieldErrors.username = message;
      } else if (message.includes('이메일')) {
        fieldErrors.email = message;
      } else if (message.includes('비밀번호')) {
        fieldErrors.password = message;
      } else if (message.includes('성별')) {
        fieldErrors.gender = message;
      } else if (message.includes('생년월일') || message.includes('나이')) {
        fieldErrors.birthDate = message;
      } else if (message.includes('키')) {
        fieldErrors.height = message;
      } else if (message.includes('몸무게')) {
        fieldErrors.weight = message;
      } else if (message.includes('이름')) {
        fieldErrors.name = message;
      } else if (message.includes('활동량')) {
        fieldErrors.activityLevel = message;
      } else if (message.includes('식단')) {
        fieldErrors.dietGoal = message;
      } else {
        fieldErrors.submit = message;
      }
      setErrors(fieldErrors);

      // 첫 번째 필드로 스크롤 & 포커스
      const firstField = Object.keys(fieldErrors)[0];
      if (firstField !== 'submit') {
        const focusFieldName = firstField === 'birthDate' ? 'birthYear' : firstField;
        const element = document.querySelector(`[name="${focusFieldName}"]`) as HTMLElement;
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.focus();
        }
      }
    } catch (error) {
      console.error('회원가입 오류:', error);
      setErrors({ submit: '회원가입 중 오류가 발생했습니다. 서버 연결을 확인해주세요.' });
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    // 입력 시 해당 필드 에러 제거
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
    // 이메일을 바꾸면 기존 인증 상태 무효화 — 새 이메일은 다시 인증해야 함.
    if (name === 'email' && verification.verifiedEmail && verification.verifiedEmail !== value.trim()) {
      setVerification({ sending: false, sentTo: null, code: '', verifying: false, verifiedEmail: null, error: null });
    }
  };

  const handleSendCode = async () => {
    const email = formData.email.trim();
    if (!email || !email.includes('@')) {
      setVerification(v => ({ ...v, error: '올바른 이메일을 입력해주세요.' }));
      return;
    }
    setVerification(v => ({ ...v, sending: true, error: null }));
    try {
      const res = await fetch(`${API_BASE_URL}/user/email/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setVerification({ sending: false, sentTo: email, code: '', verifying: false, verifiedEmail: null, error: null });
      } else {
        setVerification(v => ({ ...v, sending: false, error: data.message ?? '발송에 실패했습니다.' }));
      }
    } catch {
      setVerification(v => ({ ...v, sending: false, error: '서버 연결에 실패했습니다.' }));
    }
  };

  const handleVerifyCode = async () => {
    if (!verification.sentTo) return;
    setVerification(v => ({ ...v, verifying: true, error: null }));
    try {
      const res = await fetch(`${API_BASE_URL}/user/email/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: verification.sentTo, code: verification.code.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setVerification(v => ({ ...v, verifying: false, verifiedEmail: verification.sentTo, error: null }));
      } else {
        setVerification(v => ({ ...v, verifying: false, error: data.message ?? '인증에 실패했습니다.' }));
      }
    } catch {
      setVerification(v => ({ ...v, verifying: false, error: '서버 연결에 실패했습니다.' }));
    }
  };

  // 년도 옵션 (현재년~100년 전)
  const years = Array.from({ length: 101 }, (_, i) => new Date().getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-background flex justify-center">
      <div className="w-full max-w-md bg-background text-foreground min-h-screen shadow-xl">
        {/* 헤더 */}
        <div className="sticky top-0 bg-background border-b border-border px-4 py-4 flex items-center z-10">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-secondary rounded-lg transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="ml-2 text-xl" style={{ fontWeight: 700 }}>
            회원가입
          </h1>
        </div>

        <div ref={formRef} className="px-6 py-8 pb-12">
          {/* 환영 메시지 */}
          <div className="mb-8">
            <h2 className="text-2xl mb-2" style={{ fontWeight: 700 }}>
              건강한 식습관의 시작
            </h2>
            <p className="text-muted-foreground">
              당신만을 위한 맞춤 식재료 관리와<br />
              건강한 식단을 추천해드립니다
            </p>
          </div>

          {/* 전체 에러 메시지 */}
          {errors.submit && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border-2 border-red-200 dark:border-red-800/50 rounded-xl text-red-700 dark:text-red-300 text-sm">
              {errors.submit}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 기본 정보 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">기본 정보</h3>

              {/* 이름 */}
              <div>
                <label className="block text-sm text-muted-foreground mb-2">이름</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="홍길동"
                  className={`w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none transition-all ${
                    errors.name ? 'border-2 border-red-500' : 'focus:ring-2 focus:ring-accent'
                  }`}
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>

              {/* 성별 */}
              <div>
                <label className="block text-sm text-muted-foreground mb-2">성별</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, gender: '남' });
                      setErrors({ ...errors, gender: '' });
                    }}
                    className={`py-3 rounded-xl font-semibold transition-all ${
                      formData.gender === '남'
                        ? 'bg-foreground text-background'
                        : errors.gender
                        ? 'border-2 border-red-500 bg-card border border-border text-muted-foreground'
                        : 'bg-card border border-border text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    남성
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, gender: '여' });
                      setErrors({ ...errors, gender: '' });
                    }}
                    className={`py-3 rounded-xl font-semibold transition-all ${
                      formData.gender === '여'
                        ? 'bg-foreground text-background'
                        : errors.gender
                        ? 'border-2 border-red-500 bg-card border border-border text-muted-foreground'
                        : 'bg-card border border-border text-muted-foreground hover:bg-secondary'
                    }`}
                  >
                    여성
                  </button>
                </div>
                {errors.gender && <p className="mt-1 text-sm text-red-600">{errors.gender}</p>}
              </div>

              {/* 생년월일 */}
              <div>
                <label className="block text-sm text-muted-foreground mb-2">생년월일</label>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    name="birthYear"
                    value={formData.birthYear}
                    onChange={handleChange}
                    className={`px-3 py-3 bg-card border border-border rounded-xl focus:outline-none transition-all ${
                      errors.birthDate ? 'border-2 border-red-500' : 'focus:ring-2 focus:ring-accent'
                    }`}
                  >
                    <option value="">년</option>
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                  <select
                    name="birthMonth"
                    value={formData.birthMonth}
                    onChange={handleChange}
                    className={`px-3 py-3 bg-card border border-border rounded-xl focus:outline-none transition-all ${
                      errors.birthDate ? 'border-2 border-red-500' : 'focus:ring-2 focus:ring-accent'
                    }`}
                  >
                    <option value="">월</option>
                    {months.map((month) => (
                      <option key={month} value={month}>
                        {month}
                      </option>
                    ))}
                  </select>
                  <select
                    name="birthDay"
                    value={formData.birthDay}
                    onChange={handleChange}
                    className={`px-3 py-3 bg-card border border-border rounded-xl focus:outline-none transition-all ${
                      errors.birthDate ? 'border-2 border-red-500' : 'focus:ring-2 focus:ring-accent'
                    }`}
                  >
                    <option value="">일</option>
                    {days.map((day) => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>
                {errors.birthDate && <p className="mt-1 text-sm text-red-600">{errors.birthDate}</p>}
              </div>

              {/* 키/몸무게 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">키 (cm)</label>
                  <input
                    type="number"
                    name="height"
                    value={formData.height}
                    onChange={handleChange}
                    placeholder="170"
                    className={`w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none transition-all ${
                      errors.height ? 'border-2 border-red-500' : 'focus:ring-2 focus:ring-accent'
                    }`}
                  />
                  {errors.height && <p className="mt-1 text-sm text-red-600">{errors.height}</p>}
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">몸무게 (kg)</label>
                  <input
                    type="number"
                    name="weight"
                    value={formData.weight}
                    onChange={handleChange}
                    placeholder="65"
                    className={`w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none transition-all ${
                      errors.weight ? 'border-2 border-red-500' : 'focus:ring-2 focus:ring-accent'
                    }`}
                  />
                  {errors.weight && <p className="mt-1 text-sm text-red-600">{errors.weight}</p>}
                </div>
              </div>
            </div>

            {/* 건강 정보 */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h3 className="text-lg font-semibold">건강 정보</h3>

              {/* 활동량 */}
              <div>
                <label className="block text-sm text-muted-foreground mb-2">활동량</label>
                <select
                  name="activityLevel"
                  value={formData.activityLevel}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none transition-all ${
                    errors.activityLevel ? 'border-2 border-red-500' : 'focus:ring-2 focus:ring-accent'
                  }`}
                >
                  <option value="">선택해주세요</option>
                  <option value="거의 움직임 없음">거의 활동 안함 (주로 앉아있음)</option>
                  <option value="가벼운 활동">가벼운 활동 (주 1-3회 운동)</option>
                  <option value="보통 활동">보통 활동 (주 3-5회 운동)</option>
                  <option value="많은 활동">활발한 활동 (주 6-7회 운동)</option>
                  <option value="매우 많은 활동">매우 활발 (하루 2회 이상 운동)</option>
                </select>
                {errors.activityLevel && <p className="mt-1 text-sm text-red-600">{errors.activityLevel}</p>}
              </div>

              {/* 식단 목표 */}
              <div>
                <label className="block text-sm text-muted-foreground mb-2">식단 목표</label>
                <select
                  name="dietGoal"
                  value={formData.dietGoal}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none transition-all ${
                    errors.dietGoal ? 'border-2 border-red-500' : 'focus:ring-2 focus:ring-accent'
                  }`}
                >
                  <option value="">선택해주세요</option>
                  <option value="체중 감량">체중 감량</option>
                  <option value="체중 유지">체중 유지</option>
                  <option value="근육량 증가">근육량 증가</option>
                  <option value="건강 관리">건강 관리</option>
                </select>
                {errors.dietGoal && <p className="mt-1 text-sm text-red-600">{errors.dietGoal}</p>}
              </div>

              {/* 알레르기 */}
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  알레르기 / 제한 식품 (선택사항)
                </label>
                <textarea
                  name="allergies"
                  value={formData.allergies}
                  onChange={handleChange}
                  placeholder="예: 땅콩, 해산물, 유제품"
                  rows={3}
                  className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent transition-all resize-none"
                />
              </div>
            </div>

            {/* 계정 정보 */}
            <div className="space-y-4 pt-4 border-t border-border">
              <h3 className="text-lg font-semibold">계정 정보</h3>

              {/* 이메일 + 인증번호 */}
              <div>
                <label className="block text-sm text-muted-foreground mb-2">이메일</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="example@email.com"
                    disabled={verification.verifiedEmail === formData.email.trim() && !!verification.verifiedEmail}
                    className={`flex-1 px-4 py-3 bg-card border border-border rounded-xl focus:outline-none transition-all disabled:opacity-60 ${
                      errors.email ? 'border-2 border-red-500' : 'focus:ring-2 focus:ring-accent'
                    }`}
                  />
                  {verification.verifiedEmail === formData.email.trim() && verification.verifiedEmail ? (
                    <span className="px-4 py-3 bg-green-50 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-xl text-sm font-semibold flex items-center gap-1">
                      <Check className="w-4 h-4" /> 인증완료
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendCode}
                      disabled={verification.sending}
                      className="px-4 py-3 bg-foreground text-background rounded-xl text-sm font-semibold whitespace-nowrap disabled:opacity-50"
                    >
                      {verification.sending ? '전송 중...' : verification.sentTo ? '재발송' : '인증번호 받기'}
                    </button>
                  )}
                </div>
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}

                {/* 코드 입력 — 발송 직후 노출, 검증 완료되면 숨김 */}
                {verification.sentTo && verification.verifiedEmail !== verification.sentTo && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={verification.code}
                      onChange={(e) => setVerification(v => ({ ...v, code: e.target.value.replace(/\D/g, '') }))}
                      placeholder="6자리 인증번호"
                      className="flex-1 px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent tracking-widest"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyCode}
                      disabled={verification.verifying || verification.code.length !== 6}
                      className="px-4 py-3 bg-accent text-black rounded-xl text-sm font-semibold disabled:opacity-50"
                    >
                      {verification.verifying ? '확인 중...' : '확인'}
                    </button>
                  </div>
                )}
                {verification.error && <p className="mt-1 text-sm text-red-600">{verification.error}</p>}
                {verification.sentTo && !verification.verifiedEmail && !verification.error && (
                  <p className="mt-1 text-xs text-muted-foreground">{verification.sentTo}로 보낸 6자리 코드를 입력해주세요 (10분 유효).</p>
                )}
              </div>

              {/* 아이디 */}
              <div>
                <label className="block text-sm text-muted-foreground mb-2">아이디</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="영문, 숫자 조합 6자 이상"
                  className={`w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none transition-all ${
                    errors.username ? 'border-2 border-red-500' : 'focus:ring-2 focus:ring-accent'
                  }`}
                />
                {errors.username && <p className="mt-1 text-sm text-red-600">{errors.username}</p>}
              </div>

              {/* 비밀번호 */}
              <div>
                <label className="block text-sm text-muted-foreground mb-2">비밀번호</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="영문, 숫자, 특수문자 조합 8자 이상"
                    className={`w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none transition-all pr-12 ${
                      errors.password ? 'border-2 border-red-500' : 'focus:ring-2 focus:ring-accent'
                    }`}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
              </div>

              {/* 비밀번호 확인 */}
              <div>
                <label className="block text-sm text-muted-foreground mb-2">비밀번호 확인</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="비밀번호를 다시 입력해주세요"
                    className={`w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none transition-all pr-12 ${
                      errors.confirmPassword ? 'border-2 border-red-500' : 'focus:ring-2 focus:ring-accent'
                    }`}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>}
              </div>
            </div>

            {/* 가입하기 버튼 */}
            <button
              type="submit"
              className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-colors mt-8"
            >
              가입하기
            </button>
          </form>

          {/* 로그인 링크 */}
          <div className="mt-6 text-center">
            <span className="text-muted-foreground">이미 계정이 있으신가요? </span>
            <Link to="/login" className="font-semibold hover:underline">
              로그인
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
