import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { useIngredients } from '../hooks/useIngredients';
import { ArrowLeft, Sparkles, ChevronRight, Check } from 'lucide-react';
import { isGuest } from '../utils/guestMode';
import GuestBlocked from '../components/GuestBlocked';
import { apiFetch } from '../utils/apiClient';
import { saveAiRecipes, type SavedAiRecipe } from '../store/aiRecipeStore';

// AI 추천 응답 항목 — POST /api/recipes/ai-recommendations 응답 (capstone-ai /api/recommend 프록시).
export interface AiRecipeResult {
  dish_name: string;
  additional_ingredients: string[];
  health_benefits: string;
  recipe_tip: string;
}

const CUISINE_STYLES = [
  { id: 'korean',    label: '한식',   emoji: '🍚' },
  { id: 'chinese',   label: '중식',   emoji: '🥢' },
  { id: 'japanese',  label: '일식',   emoji: '🍣' },
  { id: 'western',   label: '양식',   emoji: '🍝' },
  { id: 'southeast', label: '동남아식', emoji: '🍜' },
  { id: 'indian',    label: '인도식', emoji: '🍛' },
  { id: 'fusion',    label: '퓨전',   emoji: '✨' },
  { id: 'diet',      label: '다이어트', emoji: '🥗' },
  { id: 'soup',      label: '국/탕/찌개', emoji: '🍲' },
  { id: 'snack',     label: '간식/디저트', emoji: '🧁' },
];

export default function AiRecommend() {
  const { ingredients } = useIngredients();
  const navigate = useNavigate();

  const ingredientNames = useMemo(() => ingredients.map((i) => i.name), [ingredients]);

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // 결과는 저장된 형태(id 포함)로 보관 — 상세 페이지가 즐겨찾기 토글하려면 id 필요.
  const [results, setResults] = useState<SavedAiRecipe[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (isGuest()) return <GuestBlocked feature="AI 레시피 추천" />;

  const toggleIngredient = (name: string) => {
    setSelectedIngredients((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  const toggleStyle = (id: string) => {
    setSelectedStyles((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);
    setResults(null);
    try {
      const styleLabels = selectedStyles.map((id) => CUISINE_STYLES.find((s) => s.id === id)?.label ?? id);
      const res = await apiFetch('/api/recipes/ai-recommendations', {
        method: 'POST',
        body: JSON.stringify({ ingredients: selectedIngredients, styles: styleLabels }),
      });
      if (!res.ok) {
        setError(
          res.status === 503 ? 'AI 서버에 연결할 수 없습니다.'
          : res.status === 429 ? '요청이 너무 많아요. 잠시 후 다시 시도해주세요.'
          : `추천 실패 (${res.status})`
        );
        return;
      }
      const data = (await res.json()) as AiRecipeResult[];
      // localStorage에 저장 → 메인 Recipes 페이지에서도 노출. saveAiRecipes는 prepend 후 전체 반환.
      const allSaved = saveAiRecipes(data ?? []);
      // 이번 호출로 새로 저장된 N개만 결과 화면에 보여줌 (앞 N개)
      setResults(allSaved.slice(0, (data ?? []).length));
    } catch {
      setError('서버 연결 실패');
    } finally {
      setIsLoading(false);
    }
  };

  const openDetail = (rec: SavedAiRecipe) => {
    navigate('/ai-recipe-detail', { state: { recipeId: rec.id } });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 헤더 */}
      <div className="px-5 pt-6 pb-4 flex items-center gap-3">
        <Link to="/recipes" className="p-1">
          <ArrowLeft className="w-6 h-6" />
        </Link>
        <div className="flex items-center gap-2 flex-1">
          <Sparkles className="w-5 h-5" style={{ color: '#7A9600' }} />
          <h1 className="text-xl" style={{ fontWeight: 700 }}>AI 레시피 추천</h1>
        </div>
      </div>

      {/* 스텝 인디케이터 */}
      {!results && !error && (
        <div className="px-5 pb-4">
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-2 flex-1">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
                style={{
                  backgroundColor: step >= 1 ? 'var(--accent)' : '#F3F4F6',
                  fontWeight: 700,
                  color: step >= 1 ? '#1A3300' : '#9CA3AF',
                }}
              >
                {step > 1 ? <Check className="w-4 h-4" style={{ color: '#1A3300' }} /> : '1'}
              </div>
              <div>
                <p className="text-xs leading-tight" style={{
                  fontWeight: step === 1 ? 700 : 500,
                  color: step >= 1 ? 'var(--foreground)' : '#9CA3AF',
                }}>식재료 선택</p>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {step >= 2 && selectedIngredients.length > 0
                    ? `${selectedIngredients.length}개 선택됨`
                    : '사용할 재료 고르기'}
                </p>
              </div>
            </div>
            <div className="w-8 h-0.5 rounded-full" style={{ backgroundColor: step >= 2 ? 'var(--accent)' : '#E5E7EB' }} />
            <div className="flex items-center gap-2 flex-1 justify-end">
              <div>
                <p className="text-xs leading-tight text-right" style={{
                  fontWeight: step === 2 ? 700 : 500,
                  color: step >= 2 ? 'var(--foreground)' : '#9CA3AF',
                }}>스타일 선택</p>
                <p className="text-[10px] text-muted-foreground leading-tight text-right">요리 스타일 고르기</p>
              </div>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
                style={{
                  backgroundColor: step >= 2 ? 'var(--accent)' : '#F3F4F6',
                  fontWeight: 700,
                  color: step >= 2 ? '#1A3300' : '#9CA3AF',
                }}
              >
                2
              </div>
            </div>
          </div>
          <div className="mt-3 h-1 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ backgroundColor: 'var(--accent)', width: step === 1 ? '25%' : '75%' }}
            />
          </div>
        </div>
      )}

      {/* 로딩 */}
      {isLoading && (
        <div className="px-5 py-16 text-center">
          <div className="inline-block w-12 h-12 border-4 border-secondary border-t-accent rounded-full animate-spin mb-4" />
          <p className="text-base font-semibold mb-2">AI가 분석 중입니다... (최대 3분)</p>
          <p className="text-xs text-muted-foreground">
            공공데이터 + Gemini를 거쳐 추천을 만들어요.
          </p>
        </div>
      )}

      {/* 에러 */}
      {error && !isLoading && (
        <div className="px-5 py-12 text-center">
          <p className="text-base font-semibold text-red-600 dark:text-red-400 mb-3">{error}</p>
          <button
            onClick={() => { setError(null); setStep(2); }}
            className="px-6 py-3 rounded-xl bg-secondary text-sm"
            style={{ fontWeight: 600 }}
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 결과 리스트 */}
      {results && !isLoading && !error && (
        <div className="px-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5" style={{ color: '#7A9600' }} />
            <h2 className="text-base font-bold">AI 추천 결과</h2>
          </div>
          {results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">추천 결과가 없습니다. 다시 시도해주세요.</p>
          ) : (
            <div className="space-y-3">
              {results.map((rec, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => openDetail(rec)}
                  className="w-full bg-card border border-border rounded-xl p-4 text-left hover:border-border-strong hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-base flex-1">{rec.dish_name}</h4>
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  </div>
                  {rec.additional_ingredients && rec.additional_ingredients.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      <span className="font-semibold">추가 재료: </span>
                      {rec.additional_ingredients.map((t) => t.split(/[:\(（]/)[0].trim()).join(', ')}
                    </p>
                  )}
                  {rec.health_benefits && (
                    <p className="text-sm leading-relaxed mt-2 line-clamp-2">{rec.health_benefits}</p>
                  )}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => { setResults(null); setStep(1); setSelectedIngredients([]); setSelectedStyles([]); }}
            className="mt-5 w-full py-3 rounded-xl text-sm bg-secondary"
            style={{ fontWeight: 600 }}
          >
            새로 추천 받기
          </button>
        </div>
      )}

      {/* Step 1 — 식재료 선택 */}
      {!results && !isLoading && !error && step === 1 && (
        <>
          <div className="px-5 pb-2">
            <p className="text-sm" style={{ fontWeight: 600 }}>사용할 식재료를 선택하세요</p>
            <p className="text-xs text-muted-foreground mt-0.5">중복 선택 가능 · {selectedIngredients.length}개 선택됨</p>
          </div>
          <div className="px-5 pb-4">
            {ingredientNames.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                등록된 식재료가 없습니다.<br />식재료를 먼저 추가해주세요.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {ingredientNames.map((name) => {
                  const isSelected = selectedIngredients.includes(name);
                  return (
                    <button
                      key={name}
                      onClick={() => toggleIngredient(name)}
                      className="relative py-3 px-2 rounded-xl border-2 text-sm transition-all active:scale-95"
                      style={{
                        borderColor: isSelected ? 'var(--accent)' : '#E5E7EB',
                        backgroundColor: isSelected ? '#CDFF0015' : '#F9FAFB',
                        fontWeight: isSelected ? 700 : 500,
                        color: isSelected ? '#3D5A00' : '#374151',
                      }}
                    >
                      {isSelected && (
                        <span className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
                          <Check className="w-2.5 h-2.5" style={{ color: '#3D5A00' }} />
                        </span>
                      )}
                      {name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {/* 다음 버튼 — sticky로 스크롤해도 BottomNav 바로 위에 항상 노출 */}
          <div className="sticky bottom-16 z-10 bg-background border-t border-border px-5 py-3">
            <button
              onClick={() => setStep(2)}
              disabled={selectedIngredients.length === 0}
              className="w-full py-4 rounded-xl text-sm flex items-center justify-center gap-2"
              style={{
                backgroundColor: selectedIngredients.length > 0 ? 'var(--accent)' : '#F3F4F6',
                color: selectedIngredients.length > 0 ? '#000' : '#9CA3AF',
                fontWeight: 600,
              }}
            >
              다음 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}

      {/* Step 2 — 스타일 선택 */}
      {!results && !isLoading && !error && step === 2 && (
        <>
          {/* 선택한 재료 미리보기 */}
          {selectedIngredients.length > 0 && (
            <div className="px-5 pb-2">
              <p className="text-xs text-muted-foreground mb-1.5">선택한 재료 ({selectedIngredients.length}개)</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedIngredients.map((name) => (
                  <span key={name} className="inline-block px-2 py-1 rounded-md text-xs bg-card border border-border" style={{ fontWeight: 600 }}>
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="px-5 pt-2 pb-2">
            <p className="text-sm" style={{ fontWeight: 600 }}>원하는 요리 스타일을 선택하세요</p>
            <p className="text-xs text-muted-foreground mt-0.5">중복 선택 가능 · 선택 없으면 전체 스타일 추천</p>
          </div>
          <div className="px-5 pb-4">
            <div className="grid grid-cols-2 gap-2">
              {CUISINE_STYLES.map(({ id, label, emoji }) => {
                const isSelected = selectedStyles.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => toggleStyle(id)}
                    className="flex items-center gap-2 py-3 px-3 rounded-xl border-2 text-sm transition-all active:scale-95"
                    style={{
                      borderColor: isSelected ? 'var(--accent)' : '#E5E7EB',
                      backgroundColor: isSelected ? '#CDFF0015' : '#F9FAFB',
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? '#3D5A00' : '#374151',
                    }}
                  >
                    <span className="text-lg">{emoji}</span>
                    <span className="flex-1 text-left">{label}</span>
                    {isSelected && <Check className="w-4 h-4" style={{ color: '#7A9600' }} />}
                  </button>
                );
              })}
            </div>
          </div>
          {/* 액션 영역 — sticky로 스크롤해도 BottomNav 바로 위에 항상 노출 */}
          <div className="sticky bottom-16 z-10 bg-background border-t border-border px-5 py-3 space-y-2">
            <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
              ⏱️ AI 분석은 <strong>1~3분</strong> 정도 걸려요. 잠시만 기다려주세요.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setStep(1)}
                className="py-4 px-5 rounded-xl text-sm bg-secondary text-muted-foreground hover:opacity-80"
                style={{ fontWeight: 600 }}
              >
                이전
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 py-4 rounded-xl text-sm flex items-center justify-center gap-2"
                style={{ backgroundColor: 'var(--accent)', fontWeight: 700, color: '#000' }}
              >
                <Sparkles className="w-4 h-4" /> AI 추천 받기
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
