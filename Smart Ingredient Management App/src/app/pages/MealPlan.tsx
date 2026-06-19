import { useState, useMemo, useEffect } from 'react';
import { apiFetch } from '../utils/apiClient';
import { useIngredients } from '../hooks/useIngredients';
import { useRecipes } from '../hooks/useRecipes';
import { matchRecipesWithIngredients } from '../utils/recipeMatch';
import { Link } from 'react-router';
import { ArrowLeft, Calendar, ChevronRight, Sparkles } from 'lucide-react';
import { isGuest } from '../utils/guestMode';
import GuestBlocked from '../components/GuestBlocked';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

const daysOfWeek = ['월', '화', '수', '목', '금', '토', '일'];

interface MealPlanItem {
  day: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

export default function MealPlan() {
  const { ingredients } = useIngredients();
  const { recipes, loading } = useRecipes();
  const [selectedDays, setSelectedDays] = useState(7);

  const matches = useMemo(
    () => matchRecipesWithIngredients(recipes, ingredients),
    [recipes, ingredients]
  );

  // AI 식단 — 백엔드 Gemini가 끼니 적합성·다양성을 고려해 7일치로 생성. 실패 시 규칙 기반 폴백.
  const [aiPlan, setAiPlan] = useState<
    { breakfast: string; lunch: string; dinner: string }[] | null
  >(null);
  const recipeNamesKey = recipes.map((r) => r.name).join('|');
  useEffect(() => {
    if (recipes.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/api/recipes/meal-plan', {
          method: 'POST',
          body: JSON.stringify({
            recipes: recipes.map((r) => r.name),
            ingredients: ingredients.map((i) => i.name),
            days: 7,
          }),
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.plan) && data.plan.length > 0) {
          setAiPlan(data.plan);
        }
      } catch {
        // 실패 — mealPlan이 규칙 기반으로 폴백
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeNamesKey]);

  // 이름 → 레시피 (영양 합산용)
  const recipeByName = useMemo(() => {
    const map: Record<string, typeof recipes[number]> = {};
    for (const r of recipes) map[r.name] = r;
    return map;
  }, [recipes]);

  // 식단 생성 — AI 식단 우선, 없으면(로딩 중·실패 시) 규칙 기반 순환으로 폴백.
  const mealPlan = useMemo<MealPlanItem[]>(() => {
    if (recipes.length === 0) return [];

    const buildItem = (i: number, b: string, l: string, d: string): MealPlanItem => {
      const cal = (n: string) => recipeByName[n]?.nutrition.calories ?? 0;
      const pro = (n: string) => recipeByName[n]?.nutrition.protein ?? 0;
      const car = (n: string) => recipeByName[n]?.nutrition.carbs ?? 0;
      const fat = (n: string) => recipeByName[n]?.nutrition.fat ?? 0;
      return {
        day: daysOfWeek[i % 7],
        breakfast: b, lunch: l, dinner: d,
        totalCalories: cal(b) + cal(l) + cal(d),
        totalProtein: pro(b) + pro(l) + pro(d),
        totalCarbs: car(b) + car(l) + car(d),
        totalFat: fat(b) + fat(l) + fat(d),
      };
    };

    // AI 식단이 있으면 우선 사용
    if (aiPlan && aiPlan.length > 0) {
      return aiPlan
        .slice(0, selectedDays)
        .map((p, i) => buildItem(i, p.breakfast, p.lunch, p.dinner));
    }

    // 폴백: 규칙 기반 순환 (끼니별 후보 풀에서 요일마다 순환 선택)
    const sorted = [...matches].sort((a, b) => b.matchRate - a.matchRate);
    const allRecipes = sorted.map((m) => m.recipe);
    const inCats = (cats: string[]) =>
      sorted.filter((m) => cats.includes(m.recipe.category)).map((m) => m.recipe);
    let breakfastPool = inCats(['간식', '음료']);
    if (breakfastPool.length < 2) breakfastPool = allRecipes;
    let mealPool = inCats(['밥/면', '반찬', '기타', '샐러드']);
    if (mealPool.length < 4) mealPool = allRecipes;

    const plan: MealPlanItem[] = [];
    for (let i = 0; i < selectedDays; i++) {
      plan.push(buildItem(
        i,
        breakfastPool[i % breakfastPool.length].name,
        mealPool[(i * 2) % mealPool.length].name,
        mealPool[(i * 2 + 1) % mealPool.length].name,
      ));
    }
    return plan;
  }, [aiPlan, matches, recipes, selectedDays, recipeByName]);

  const weeklyTotal = mealPlan.reduce(
    (acc, day) => ({
      calories: acc.calories + day.totalCalories,
      protein: acc.protein + day.totalProtein,
      carbs: acc.carbs + day.totalCarbs,
      fat: acc.fat + day.totalFat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  // 영양소 그래프 데이터
  const nutritionChartData = mealPlan.map((day) => ({
    day: day.day,
    칼로리: Math.round(day.totalCalories / 10), // 스케일 조정
    단백질: Math.round(day.totalProtein),
    탄수화물: Math.round(day.totalCarbs),
    지방: Math.round(day.totalFat),
  }));

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">식단 데이터를 불러오는 중...</p>
      </div>
    );
  }

  if (isGuest()) return <GuestBlocked feature="식단 계획" />;

  return (
    <div className="min-h-screen bg-background pb-4">
      {/* 헤더 */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <Link to="/" className="p-1">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl" style={{ fontWeight: 700 }}>
            식단 추천
          </h1>
        </div>
        <p className="text-sm text-muted-foreground ml-10">
          보유 식재료 기반 균형잡힌 식단
        </p>
      </div>

      {/* 기간 선택 */}
      <div className="px-5 pb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedDays(1)}
            className={`px-4 py-2 rounded-lg text-sm ${
              selectedDays === 1 ? 'text-primary-foreground' : 'bg-secondary text-muted-foreground'
            }`}
            style={{
              backgroundColor: selectedDays === 1 ? 'var(--primary)' : undefined,
              fontWeight: selectedDays === 1 ? 600 : 500,
            }}
          >
            오늘
          </button>
          <button
            onClick={() => setSelectedDays(3)}
            className={`px-4 py-2 rounded-lg text-sm ${
              selectedDays === 3 ? 'text-primary-foreground' : 'bg-secondary text-muted-foreground'
            }`}
            style={{
              backgroundColor: selectedDays === 3 ? 'var(--primary)' : undefined,
              fontWeight: selectedDays === 3 ? 600 : 500,
            }}
          >
            3일
          </button>
          <button
            onClick={() => setSelectedDays(7)}
            className={`px-4 py-2 rounded-lg text-sm ${
              selectedDays === 7 ? 'text-primary-foreground' : 'bg-secondary text-muted-foreground'
            }`}
            style={{
              backgroundColor: selectedDays === 7 ? 'var(--primary)' : undefined,
              fontWeight: selectedDays === 7 ? 600 : 500,
            }}
          >
            일주일
          </button>
        </div>
      </div>

      {/* 영양 요약 */}
      <div className="px-5 pb-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-lime-700" />
            <h3 className="text-sm" style={{ fontWeight: 600 }}>
              {selectedDays === 1 ? '오늘' : `${selectedDays}일간`} 영양 요약
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">총 칼로리</p>
              <p className="text-xl" style={{ fontWeight: 700 }}>
                {weeklyTotal.calories.toLocaleString()}
                <span className="text-sm text-muted-foreground ml-1">kcal</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                평균 {Math.round(weeklyTotal.calories / selectedDays)}kcal/일
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">총 단백질</p>
              <p className="text-xl" style={{ fontWeight: 700 }}>
                {Math.round(weeklyTotal.protein)}
                <span className="text-sm text-muted-foreground ml-1">g</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                평균 {Math.round(weeklyTotal.protein / selectedDays)}g/일
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 영양소 추이 그래프 */}
      {selectedDays >= 3 && (
        <div className="px-5 pb-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm mb-4" style={{ fontWeight: 600 }}>
              일별 영양소 추이
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={nutritionChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="day" 
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  stroke="#9ca3af"
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="칼로리" 
                  stroke="var(--accent)"
                  strokeWidth={3}
                  dot={{ fill: 'var(--accent)', r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="단백질" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  dot={{ fill: '#8b5cf6', r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              * 칼로리는 10분의 1로 표시됩니다
            </p>
          </div>
        </div>
      )}

      {/* 영양소 균형 그래프 */}
      <div className="px-5 pb-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm mb-4" style={{ fontWeight: 600 }}>
            영양소 균형
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={nutritionChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="day" 
                tick={{ fontSize: 12 }}
                stroke="#9ca3af"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke="#9ca3af"
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend 
                wrapperStyle={{ fontSize: '12px' }}
              />
              <Bar dataKey="단백질" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="탄수화물" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="지방" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 식단표 */}
      <div className="px-5">
        <h2 className="text-lg mb-3" style={{ fontWeight: 600 }}>
          식단표
        </h2>
        <div className="space-y-3">
          {mealPlan.map((day, index) => (
            <div key={index} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-base" style={{ fontWeight: 600 }}>
                    {day.day}요일
                  </h3>
                </div>
                <div className="text-xs text-muted-foreground">
                  {day.totalCalories}kcal
                </div>
              </div>

              <div className="space-y-2">
                <MealRow label="아침" meal={day.breakfast} recipeId={recipeByName[day.breakfast]?.id} />
                <MealRow label="점심" meal={day.lunch} recipeId={recipeByName[day.lunch]?.id} />
                <MealRow label="저녁" meal={day.dinner} recipeId={recipeByName[day.dinner]?.id} />
              </div>

              <div className="mt-3 pt-3 border-t border-border">
                <div className="text-xs text-muted-foreground">
                  단백질 {Math.round(day.totalProtein)}g
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 안내 메시지 */}
      {ingredients.length === 0 && (
        <div className="mx-5 mt-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-xl p-4 border border-yellow-100 dark:border-yellow-800/50">
          <p className="text-sm" style={{ fontWeight: 600 }}>
            더 정확한 식단 추천을 위해
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            보유 식재료를 등록하면 맞춤 식단을 추천해드려요
          </p>
        </div>
      )}
    </div>
  );
}

function MealRow({ label, meal, recipeId }: { label: string; meal: string; recipeId?: string }) {
  const content = (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground w-12">{label}</span>
      <span className="text-sm flex-1" style={{ fontWeight: 500 }}>
        {meal}
      </span>
      {recipeId && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
    </div>
  );
  if (recipeId) {
    return (
      <Link to={`/recipe/${recipeId}`} className="block hover:bg-accent/30 -mx-1 px-1 rounded">
        {content}
      </Link>
    );
  }
  return content;
}