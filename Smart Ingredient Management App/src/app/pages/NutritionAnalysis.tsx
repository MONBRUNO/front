import { useRef, useState } from 'react';
import { useIngredients } from '../hooks/useIngredients';
import { Link } from 'react-router';
import { ChevronLeft, Sparkles, TrendingUp, AlertCircle, Search, Camera } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { isGuest } from '../utils/guestMode';
import GuestBlocked from '../components/GuestBlocked';
import { apiFetch, apiUpload } from '../utils/apiClient';

// AI 서버(/api/nutrition/analyze) 응답 항목 — 100g 기준.
// 백엔드는 capstone-ai의 응답을 snake_case 그대로 전달함.
interface AiNutritionItem {
  food_name: string;
  cat?: string;
  cal: number;
  carbohydrate: number;
  protein: number;
  fat: number;
  is_corrected?: string;
}

// /api/recipes/ai-for-food 응답 항목 — /fdmake 프록시 (단일 식재료 기반 추천).
interface AiRecipeRecommend {
  dish_name: string;
  additional_ingredients: string[];
  health_benefits: string;
  recipe_tip: string;
}

// AI 영양 검색/추천 섹션 노출 플래그.
// AI 서버 응답이 평균 1-2분 걸림 (공공데이터 3페이지 + Gemini 2회 + SDK retry).
// 일반 사용자도 보이지만 "시간 걸린다" 안내로 커버. 발표/시연용으로도 그대로 동작.
const AI_NUTRITION_ENABLED = true;

// 식재료별 영양 정보 데이터베이스 (100g 기준)
const nutritionDatabase: Record<string, {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sodium?: number;
  vitamins?: string[];
}> = {
  // 채소
  '당근': { calories: 41, protein: 0.9, carbs: 9.6, fat: 0.2, fiber: 2.8, vitamins: ['비타민A', '비타민K'] },
  '양파': { calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiber: 1.7, vitamins: ['비타민C'] },
  '토마토': { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, vitamins: ['비타민C', '리코펜'] },
  '배추': { calories: 13, protein: 1.2, carbs: 2.2, fat: 0.2, fiber: 1.2, vitamins: ['비타민K', '비타민C'] },
  '브로콜리': { calories: 34, protein: 2.8, carbs: 6.6, fat: 0.4, fiber: 2.6, vitamins: ['비타민C', '비타민K'] },
  '시금치': { calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2, vitamins: ['비타민A', '철분'] },

  // 육류
  '돼지고기': { calories: 242, protein: 27.3, carbs: 0, fat: 14.0, sodium: 62 },
  '소고기': { calories: 250, protein: 26.1, carbs: 0, fat: 15.4, sodium: 72 },
  '닭고기': { calories: 165, protein: 31.0, carbs: 0, fat: 3.6, sodium: 82 },
  '닭가슴살': { calories: 165, protein: 31.0, carbs: 0, fat: 3.6, sodium: 74 },

  // 해산물
  '고등어': { calories: 205, protein: 18.6, carbs: 0, fat: 13.9, vitamins: ['오메가-3', '비타민D'] },
  '연어': { calories: 208, protein: 20.4, carbs: 0, fat: 13.4, vitamins: ['오메가-3', '비타민D'] },
  '새우': { calories: 99, protein: 20.9, carbs: 0.9, fat: 1.7, sodium: 148 },

  // 유제품
  '우유': { calories: 61, protein: 3.2, carbs: 4.8, fat: 3.3, sodium: 44, vitamins: ['칼슘', '비타민D'] },
  '요구르트': { calories: 59, protein: 3.5, carbs: 4.7, fat: 3.3, vitamins: ['칼슘', '프로바이오틱스'] },
  '치즈': { calories: 402, protein: 25.0, carbs: 1.3, fat: 33.1, sodium: 621, vitamins: ['칼슘'] },

  // 과일
  '사과': { calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2, fiber: 2.4, vitamins: ['비타민C'] },
  '바나나': { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, vitamins: ['칼륨', '비타민B6'] },
  '딸기': { calories: 32, protein: 0.7, carbs: 7.7, fat: 0.3, fiber: 2.0, vitamins: ['비타민C'] },

  // 곡물
  '쌀': { calories: 130, protein: 2.7, carbs: 28.2, fat: 0.3, fiber: 0.4 },
  '현미': { calories: 111, protein: 2.6, carbs: 23.5, fat: 0.9, fiber: 1.8, vitamins: ['비타민B'] },
  '귀리': { calories: 389, protein: 16.9, carbs: 66.3, fat: 6.9, fiber: 10.6, vitamins: ['식이섬유'] },
  '식빵': { calories: 265, protein: 8.7, carbs: 49.4, fat: 3.2, sodium: 491 },

  // 기본값
  'default': { calories: 150, protein: 5, carbs: 20, fat: 3, fiber: 2 }
};

export default function NutritionAnalysis() {
  const { ingredients } = useIngredients();
  const [selectedIngredient, setSelectedIngredient] = useState<string | null>(null);

  // ── AI 영양 검색 (capstone-ai /analyze 프록시) ──
  const [searchText, setSearchText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResults, setAiResults] = useState<AiNutritionItem[] | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiFileInputRef = useRef<HTMLInputElement>(null);

  // 카드별 추천 상태 — 인덱스 키. /fdmake 응답을 인라인으로 펼침.
  const [recommendingIdx, setRecommendingIdx] = useState<number | null>(null);
  const [recommendations, setRecommendations] = useState<Record<number, AiRecipeRecommend[]>>({});
  const [recommendError, setRecommendError] = useState<Record<number, string>>({});

  const runAnalyze = async (formData: FormData) => {
    setAnalyzing(true);
    setAiError(null);
    setAiResults(null);
    // 새 검색 시 기존 추천도 초기화 (인덱스 기준이라 stale 매칭 방지)
    setRecommendations({});
    setRecommendError({});
    try {
      const res = await apiUpload('/api/nutrition/analyze', formData);
      if (!res.ok) {
        // 503 = AI 서버 다운, 429 = rate limit
        if (res.status === 503) setAiError('AI 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
        else if (res.status === 429) setAiError('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
        else setAiError(`분석 실패 (${res.status})`);
        return;
      }
      const data = await res.json();
      setAiResults((data?.data as AiNutritionItem[]) ?? []);
    } catch {
      setAiError('서버 연결 실패');
    } finally {
      setAnalyzing(false);
    }
  };

  // /fdmake 호출 — 단일 식재료 + 영양정보 → 요리 3개 추천
  const handleRecommend = async (idx: number, item: AiNutritionItem) => {
    if (recommendingIdx !== null) return;
    setRecommendingIdx(idx);
    setRecommendError((prev) => { const next = { ...prev }; delete next[idx]; return next; });
    try {
      const res = await apiFetch('/api/recipes/ai-for-food', {
        method: 'POST',
        body: JSON.stringify({
          food_name: item.food_name,
          cat: item.cat ?? '',
          nutrition_data: {
            cal: item.cal,
            carbohydrate: item.carbohydrate,
            protein: item.protein,
            fat: item.fat,
          },
        }),
      });
      if (!res.ok) {
        const msg = res.status === 503 ? 'AI 서버에 연결할 수 없습니다.'
          : res.status === 429 ? '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
          : `추천 실패 (${res.status})`;
        setRecommendError((prev) => ({ ...prev, [idx]: msg }));
        return;
      }
      const data = (await res.json()) as AiRecipeRecommend[];
      setRecommendations((prev) => ({ ...prev, [idx]: data ?? [] }));
    } catch {
      setRecommendError((prev) => ({ ...prev, [idx]: '서버 연결 실패' }));
    } finally {
      setRecommendingIdx(null);
    }
  };

  const handleAnalyzeText = () => {
    const q = searchText.trim();
    if (!q || analyzing) return;
    const fd = new FormData();
    fd.append('text', q);
    runAnalyze(fd);
  };

  const handleAnalyzeImage = (file: File) => {
    if (analyzing) return;
    const fd = new FormData();
    fd.append('file', file);
    runAnalyze(fd);
  };

  // 전체 영양 통계 — nutritionDatabase가 100g 기준. 식재료 수량 단위가 개/팩/g 등
  // 제각각이라 g 환산이 불가능 → 100g 기준 표준값을 그대로 합산 (식재료 페이지와 동일 정책)
  const totalNutrition = ingredients.reduce((acc, ing) => {
    const nutrition = nutritionDatabase[ing.name] || nutritionDatabase['default'];
    return {
      calories: acc.calories + nutrition.calories,
      protein: acc.protein + nutrition.protein,
      carbs: acc.carbs + nutrition.carbs,
      fat: acc.fat + nutrition.fat,
    };
  }, { calories: 0, protein: 0, carbs: 0, fat: 0 });

  // 사용자 프로필 불러오기 — sessionStorage(세션 로그인) / localStorage(로그인 유지) 양쪽 다 봄
  const userProfile = JSON.parse(
    sessionStorage.getItem('userProfile') ?? localStorage.getItem('userProfile') ?? '{}',
  );
  const allergies = userProfile.allergies?.toLowerCase().split(',').map((a: string) => a.trim()) || [];

  // 영양소 비율 데이터
  const macroData = [
    { name: '단백질', value: totalNutrition.protein, color: '#FF6B6B' },
    { name: '탄수화물', value: totalNutrition.carbs, color: '#4ECDC4' },
    { name: '지방', value: totalNutrition.fat, color: '#FFD93D' },
  ];

  // 식재료별 칼로리 비교 (상위 8개) — 100g 기준 값 그대로 사용
  const ingredientCalories = ingredients
    .map(ing => {
      const nutrition = nutritionDatabase[ing.name] || nutritionDatabase['default'];
      return {
        name: ing.name,
        calories: nutrition.calories,
        protein: nutrition.protein,
        carbs: nutrition.carbs,
        fat: nutrition.fat,
      };
    })
    .sort((a, b) => b.calories - a.calories)
    .slice(0, 8);

  if (isGuest()) return <GuestBlocked feature="영양 분석" />;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* 헤더 */}
      <div className="sticky top-0 bg-background border-b border-border px-4 py-4 flex items-center z-10">
        <Link to="/my-custom" className="p-2 -ml-2 hover:bg-secondary rounded-lg transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </Link>
        <h1 className="ml-2 text-xl" style={{ fontWeight: 700 }}>
          영양 분석
        </h1>
      </div>

      {ingredients.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">등록된 식재료가 없습니다</p>
          <Link
            to="/add-ingredient"
            className="inline-block mt-4 px-6 py-3 bg-accent hover:bg-accent-deep rounded-xl font-semibold transition-colors"
          >
            식재료 추가하기
          </Link>
        </div>
      ) : (
        <>
          {/* 전체 영양 요약 */}
          <div className="px-5 py-5">
            <div className="bg-primary text-primary-foreground rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5" />
                <h2 className="font-semibold">전체 식재료 영양 정보</h2>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-xl p-3 text-center" style={{ backgroundColor: 'color-mix(in srgb, var(--primary-foreground) 8%, transparent)' }}>
                  <p className="text-xs opacity-60 mb-1">칼로리</p>
                  <p className="text-lg font-bold">{Math.round(totalNutrition.calories)}</p>
                  <p className="text-xs opacity-60">kcal</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ backgroundColor: 'color-mix(in srgb, var(--primary-foreground) 8%, transparent)' }}>
                  <p className="text-xs opacity-60 mb-1">단백질</p>
                  <p className="text-lg font-bold">{Math.round(totalNutrition.protein)}</p>
                  <p className="text-xs opacity-60">g</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ backgroundColor: 'color-mix(in srgb, var(--primary-foreground) 8%, transparent)' }}>
                  <p className="text-xs opacity-60 mb-1">탄수화물</p>
                  <p className="text-lg font-bold">{Math.round(totalNutrition.carbs)}</p>
                  <p className="text-xs opacity-60">g</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ backgroundColor: 'color-mix(in srgb, var(--primary-foreground) 8%, transparent)' }}>
                  <p className="text-xs opacity-60 mb-1">지방</p>
                  <p className="text-lg font-bold">{Math.round(totalNutrition.fat)}</p>
                  <p className="text-xs opacity-60">g</p>
                </div>
              </div>
            </div>
          </div>

          {/* 영양소 비율 차트 */}
          <div className="px-5 pb-5">
            <h3 className="font-semibold mb-3">영양소 구성 비율</h3>
            <div className="bg-card border border-border rounded-2xl p-5">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={macroData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {macroData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-4">
                {macroData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 식재료별 칼로리 비교 */}
          <div className="px-5 pb-5">
            <h3 className="font-semibold mb-3">
              식재료별 칼로리 <span className="text-xs font-normal text-muted-foreground">(100g 기준)</span>
            </h3>
            <div className="bg-card border border-border rounded-2xl p-5">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={ingredientCalories} margin={{ top: 4, right: 8, left: -8, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  {/* 긴 식재료 이름이 x축에서 잘리지 않도록 회전 + 말줄임 (전체 이름은 툴팁에 표시) */}
                  <XAxis
                    dataKey="name"
                    interval={0}
                    height={64}
                    tick={(props: any) => {
                      const v = String(props.payload?.value ?? '');
                      const label = v.length > 7 ? v.slice(0, 7) + '…' : v;
                      return (
                        <text
                          x={props.x}
                          y={props.y}
                          dy={4}
                          textAnchor="end"
                          fontSize={11}
                          fill="var(--muted-foreground)"
                          transform={`rotate(-40, ${props.x}, ${props.y})`}
                        >
                          {label}
                        </text>
                      );
                    }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="calories" name="칼로리" fill="var(--accent)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 식재료별 상세 영양 정보 */}
          <div className="px-5 pb-5">
            <h3 className="font-semibold mb-3">식재료별 영양 성분</h3>
            <div className="space-y-2">
              {ingredients.map((ing) => {
                const nutrition = nutritionDatabase[ing.name] || nutritionDatabase['default'];
                const isAllergic = allergies.some((allergy: string) =>
                  ing.name.toLowerCase().includes(allergy)
                );

                return (
                  <div
                    key={ing.id}
                    className={`rounded-xl p-4 border-2 ${
                      isAllergic
                        ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800/50'
                        : 'bg-background border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-lg">{ing.name}</h4>
                          {isAllergic && (
                            <span className="flex items-center gap-1 px-2 py-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-lg text-xs font-semibold">
                              <AlertCircle className="w-3 h-3" />
                              알레르기 주의
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          100g 기준 · 보유 {ing.quantity}{ing.unit}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div className="bg-card border border-border rounded-lg p-2 text-center">
                        <p className="text-xs text-muted-foreground">칼로리</p>
                        <p className="font-bold text-sm mt-1">
                          {Math.round(nutrition.calories)}
                        </p>
                        <p className="text-xs text-muted-foreground">kcal</p>
                      </div>
                      <div className="bg-card border border-border rounded-lg p-2 text-center">
                        <p className="text-xs text-muted-foreground">단백질</p>
                        <p className="font-bold text-sm mt-1">
                          {Math.round(nutrition.protein)}
                        </p>
                        <p className="text-xs text-muted-foreground">g</p>
                      </div>
                      <div className="bg-card border border-border rounded-lg p-2 text-center">
                        <p className="text-xs text-muted-foreground">탄수화물</p>
                        <p className="font-bold text-sm mt-1">
                          {Math.round(nutrition.carbs)}
                        </p>
                        <p className="text-xs text-muted-foreground">g</p>
                      </div>
                      <div className="bg-card border border-border rounded-lg p-2 text-center">
                        <p className="text-xs text-muted-foreground">지방</p>
                        <p className="font-bold text-sm mt-1">
                          {Math.round(nutrition.fat)}
                        </p>
                        <p className="text-xs text-muted-foreground">g</p>
                      </div>
                    </div>

                    {/* 추가 영양 정보 */}
                    {(nutrition.fiber || nutrition.sodium || nutrition.vitamins) && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <div className="flex flex-wrap gap-2">
                          {nutrition.fiber && (
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded-lg text-xs">
                              식이섬유 {Math.round(nutrition.fiber)}g
                            </span>
                          )}
                          {nutrition.sodium && (
                            <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 rounded-lg text-xs">
                              나트륨 {Math.round(nutrition.sodium)}mg
                            </span>
                          )}
                          {nutrition.vitamins?.map((vitamin) => (
                            <span
                              key={vitamin}
                              className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg text-xs"
                            >
                              {vitamin}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 건강 팁 */}
          <div className="px-5 pb-5">
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                <h3 className="font-semibold">영양 균형 팁</h3>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>• 단백질은 체중 1kg당 0.8~1.2g 섭취를 권장합니다</p>
                <p>• 탄수화물은 전체 칼로리의 50~60% 비율이 적정합니다</p>
                <p>• 건강한 지방(불포화지방산)도 적절히 섭취해야 합니다</p>
                <p>• 나트륨은 하루 2,000mg 이하로 제한하는 것이 좋습니다</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* AI 영양 검색 — capstone-ai /analyze 프록시. 빈 상태든 아니든 노출.
          ⚠️ TEMP DISABLED (2026-05-20): AI 서버가 Gemini 무료 한도(20/day) 초과 + 8번 retry로 1분 hang.
          담당자가 Tier 1 billing 등록 + retry 끊으면 AI_NUTRITION_ENABLED = true 로 복귀. */}
      {AI_NUTRITION_ENABLED && (
      <div className="px-5 pb-8">
        <h3 className="font-semibold mb-3">다른 음식 영양 검색</h3>
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <p className="text-xs text-muted-foreground">
            음식 이름이나 사진으로 영양 정보를 검색해보세요 (AI 분석, 100g 기준)
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            ⏱️ AI 분석은 정확도를 위해 공공데이터 + Gemini를 거쳐서 <strong>1~3분 정도 소요</strong>됩니다. 잠시만 기다려주세요.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAnalyzeText(); }}
              placeholder="예: 김치찌개, 닭가슴살"
              disabled={analyzing}
              className="flex-1 px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent text-sm"
            />
            <button
              type="button"
              onClick={handleAnalyzeText}
              disabled={analyzing || !searchText.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-1"
            >
              <Search className="w-4 h-4" /> 검색
            </button>
          </div>
          <button
            type="button"
            onClick={() => aiFileInputRef.current?.click()}
            disabled={analyzing}
            className="w-full flex items-center justify-center gap-2 py-2 bg-secondary text-foreground rounded-lg text-sm font-semibold hover:bg-secondary/80 transition-colors disabled:opacity-50"
          >
            <Camera className="w-4 h-4" />
            사진으로 분석
          </button>
          <input
            ref={aiFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleAnalyzeImage(file);
              e.target.value = '';
            }}
          />
          {analyzing && (
            <p className="text-xs text-muted-foreground text-center">AI가 분석 중입니다... (최대 3분)</p>
          )}
          {aiError && (
            <p className="text-xs text-red-500 dark:text-red-400">{aiError}</p>
          )}
          {aiResults && aiResults.length === 0 && (
            <p className="text-xs text-muted-foreground text-center">분석 결과가 없습니다</p>
          )}
          {aiResults && aiResults.length > 0 && (
            <div className="space-y-2 pt-1">
              {aiResults.map((item, i) => (
                <div key={i} className="bg-background border border-border rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-sm">{item.food_name}</h4>
                    {item.cat && (
                      <span className="text-xs text-muted-foreground">({item.cat})</span>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div className="text-center">
                      <p className="text-muted-foreground">kcal</p>
                      <p className="font-bold">{Math.round(item.cal)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground">단백질</p>
                      <p className="font-bold">{Math.round(item.protein)}g</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground">탄수</p>
                      <p className="font-bold">{Math.round(item.carbohydrate)}g</p>
                    </div>
                    <div className="text-center">
                      <p className="text-muted-foreground">지방</p>
                      <p className="font-bold">{Math.round(item.fat)}g</p>
                    </div>
                  </div>
                  {/* /fdmake — 이 재료로 요리 추천 */}
                  <button
                    type="button"
                    onClick={() => handleRecommend(i, item)}
                    disabled={recommendingIdx !== null}
                    className="w-full mt-3 py-2 bg-secondary text-foreground rounded-lg text-xs font-semibold hover:bg-secondary/80 transition-colors disabled:opacity-50"
                  >
                    {recommendingIdx === i ? '추천 받는 중...' : '이 재료로 요리 추천'}
                  </button>
                  {recommendError[i] && (
                    <p className="text-xs text-red-500 dark:text-red-400 mt-2">{recommendError[i]}</p>
                  )}
                  {recommendations[i] && recommendations[i].length === 0 && (
                    <p className="text-xs text-muted-foreground mt-2">추천 결과가 없습니다</p>
                  )}
                  {recommendations[i] && recommendations[i].length > 0 && (
                    <div className="mt-3 space-y-2">
                      {recommendations[i].map((rec, j) => (
                        <div key={j} className="bg-card border border-border rounded-lg p-3">
                          <h5 className="font-semibold text-sm mb-1">{rec.dish_name}</h5>
                          {rec.additional_ingredients && rec.additional_ingredients.length > 0 && (
                            <p className="text-xs text-muted-foreground mb-1">
                              <span className="font-medium">추가 재료: </span>
                              {rec.additional_ingredients.join(', ')}
                            </p>
                          )}
                          {rec.health_benefits && (
                            <p className="text-xs leading-relaxed mb-1">{rec.health_benefits}</p>
                          )}
                          {rec.recipe_tip && (
                            <p className="text-xs text-muted-foreground italic">💡 {rec.recipe_tip}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
