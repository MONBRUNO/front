import { useEffect, useMemo, useState } from 'react';
import { useIngredients } from '../hooks/useIngredients';
import { useRecipes } from '../hooks/useRecipes';
import { matchRecipesWithIngredients, getDifficultyLabel } from '../utils/recipeMatch';
import { Link, useNavigate } from 'react-router';
import { ChefHat, Clock, Users, ArrowLeft, Sparkles, Heart, ChevronRight, ChevronLeft, X, Search } from 'lucide-react';
import { isGuest } from '../utils/guestMode';
import GuestBlocked from '../components/GuestBlocked';
import {
  getAllAiRecipes,
  removeAiRecipe,
  type SavedAiRecipe,
} from '../store/aiRecipeStore';

// 메인 Recipes 페이지.
// AI 추천은 모달이 아니라 별도 페이지(/ai-recommend)로 이동 — 결과 카드 클릭 시 /ai-recipe-detail로
// 기존 RecipeDetail과 동일한 layout의 상세 페이지 진입.
export default function Recipes() {
  const { ingredients } = useIngredients();
  const { recipes, loading, toggleFavorite } = useRecipes();
  const [filterMode, setFilterMode] = useState<'all' | 'makeable' | 'favorites'>('all');
  const navigate = useNavigate();

  // localStorage에 저장된 AI 추천 결과들 — 메인 페이지에서도 노출.
  // 페이지 mount 시 한 번 읽고 삭제 액션 시 갱신.
  const [aiRecipes, setAiRecipes] = useState<SavedAiRecipe[]>([]);
  useEffect(() => {
    setAiRecipes(getAllAiRecipes());
  }, []);

  const handleRemoveAi = (id: string) => {
    if (!confirm('이 AI 추천을 삭제할까요?')) return;
    removeAiRecipe(id);
    setAiRecipes(getAllAiRecipes());
  };

  const matches = useMemo(
    () => matchRecipesWithIngredients(recipes, ingredients),
    [recipes, ingredients]
  );

  const filteredMatches = filterMode === 'makeable'
    ? matches.filter((m) => m.hasIngredients.length > 0)
    : filterMode === 'favorites'
    ? matches.filter((m) => m.recipe.favorite)
    : matches;

  const makeableCount = matches.filter((m) => m.hasIngredients.length > 0).length;

  // 검색 + 페이지네이션 — 레시피가 많아 한 화면에 다 보기 어려우므로 8개씩 끊어서 보여준다.
  const PAGE_SIZE = 8;
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  // 탭 전환·검색어 변경 시 1페이지로 리셋
  useEffect(() => { setPage(1); }, [filterMode, query]);

  const searched = query.trim()
    ? filteredMatches.filter((m) =>
        m.recipe.name.toLowerCase().includes(query.trim().toLowerCase()))
    : filteredMatches;
  const totalPages = Math.max(1, Math.ceil(searched.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = searched.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const goToPage = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isGuest()) return <GuestBlocked feature="맞춤 레시피" />;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">레시피를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-4">
      {/* 헤더 */}
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <Link to="/" className="p-1">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl" style={{ fontWeight: 700 }}>
            레시피 추천
          </h1>
        </div>
        <p className="text-sm text-muted-foreground ml-10">
          보유 식재료로 만들 수 있는 요리 {makeableCount}개
        </p>
      </div>

      {/* 필터 + AI 추천 버튼 — 2×2 그리드로 균등 배치 */}
      <div className="px-5 pb-4">
        <div className="grid grid-cols-2 gap-2">
          <FilterButton active={filterMode === 'all'} onClick={() => setFilterMode('all')}>
            전체 레시피
          </FilterButton>
          <FilterButton active={filterMode === 'makeable'} onClick={() => setFilterMode('makeable')}>
            만들 수 있는 요리
          </FilterButton>
          <FilterButton active={filterMode === 'favorites'} onClick={() => setFilterMode('favorites')}>
            <Heart className="w-3.5 h-3.5 inline -mt-0.5 mr-0.5" fill={filterMode === 'favorites' ? 'currentColor' : 'none'} />
            즐겨찾기
          </FilterButton>

          {/* AI 추천 — 새 페이지로 이동 */}
          <button
            onClick={() => navigate('/ai-recommend')}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-deep) 100%)',
              fontWeight: 700,
              color: '#1A3300',
              boxShadow: '0 2px 8px rgba(205,255,0,0.4)',
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI 추천
          </button>
        </div>
      </div>

      {/* 레시피 이름 검색 */}
      <div className="px-5 pb-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="레시피 이름 검색"
            className="w-full pl-9 pr-9 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-label="검색어 지우기"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* AI 추천 레시피 — localStorage에 저장된 것들 (한 번 받으면 안 사라짐) */}
      {aiRecipes.length > 0 && (
        <div className="px-5 pb-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4" style={{ color: '#7A9600' }} />
            <h2 className="text-sm font-bold">AI 추천 레시피 ({aiRecipes.length})</h2>
          </div>
          <div className="space-y-2">
            {aiRecipes.map((rec) => (
              <div
                key={rec.id}
                className="bg-card border border-border rounded-xl p-3 flex items-center gap-2 hover:bg-secondary transition-colors"
              >
                <button
                  type="button"
                  onClick={() => navigate('/ai-recipe-detail', { state: { recipeId: rec.id } })}
                  className="flex-1 text-left flex items-center gap-2"
                >
                  <span
                    className="flex-shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
                    style={{ backgroundColor: 'var(--accent)', color: '#1A3300', fontWeight: 700 }}
                  >
                    <Sparkles className="w-2.5 h-2.5" />
                    AI
                  </span>
                  <span className="flex-1 text-sm" style={{ fontWeight: 600 }}>
                    {rec.dish_name}
                  </span>
                  {rec.favorite && (
                    <Heart className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" />
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveAi(rec.id)}
                  className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                  aria-label="삭제"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 재료 부족 안내 */}
      {ingredients.length === 0 && (
        <div className="mx-5 mb-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-xl p-4 border border-yellow-100 dark:border-yellow-800/50">
          <p className="text-sm" style={{ fontWeight: 600 }}>등록된 식재료가 없습니다</p>
          <p className="text-xs text-muted-foreground mt-1">식재료를 등록하면 맞춤 레시피를 추천해드려요</p>
        </div>
      )}

      {/* 레시피 목록 */}
      <div className="px-5">
        {searched.length === 0 ? (
          <div className="text-center py-12">
            <ChefHat className="w-12 h-12 text-muted-foreground opacity-50 mx-auto mb-3" />
            <p className="text-muted-foreground">
              {query.trim()
                ? '검색 결과가 없습니다'
                : filterMode === 'makeable' ? '현재 만들 수 있는 요리가 없습니다' : '레시피가 없습니다'}
            </p>
            {filterMode === 'makeable' && !query.trim() && (
              <p className="text-xs text-muted-foreground mt-1">
                식재료를 추가하면 더 많은 레시피를 만들 수 있어요
              </p>
            )}
          </div>
        ) : (
          <>
          <div className="space-y-3">
            {pageItems.map((match) => (
              <Link key={match.recipe.id} to={`/recipe/${match.recipe.id}`}>
                <div className="bg-card border border-border rounded-xl p-4 hover:bg-secondary transition-colors">
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base" style={{ fontWeight: 600 }}>
                          {match.recipe.name}
                        </h3>
                        <span
                          className="px-2 py-0.5 rounded text-xs"
                          style={{
                            backgroundColor:
                              match.matchRate >= 100 ? '#CDFF0020'
                              : match.matchRate >= 50 ? '#FFD60A20'
                              : '#FF3B3020',
                            color:
                              match.matchRate >= 100 ? '#7A9600'
                              : match.matchRate >= 50 ? '#B38C00'
                              : '#D4183D',
                            fontWeight: 600,
                          }}
                        >
                          {match.matchRate}% 매칭
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{match.recipe.category}</p>
                    </div>
                    {/* 하트 — Link 안이라 click 시 stopPropagation + preventDefault */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void toggleFavorite(match.recipe.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-white"
                      aria-label="즐겨찾기"
                    >
                      <Heart
                        className={`w-5 h-5 ${match.recipe.favorite ? 'text-red-500' : 'text-muted-foreground opacity-50'}`}
                        fill={match.recipe.favorite ? 'currentColor' : 'none'}
                      />
                    </button>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{match.recipe.cookingTime}분</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      <span>{match.recipe.servings}인분</span>
                    </div>
                    <span>{getDifficultyLabel(match.recipe.difficulty)}</span>
                  </div>

                  <div className="space-y-1.5">
                    {match.hasIngredients.length > 0 && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-green-600 flex-shrink-0" style={{ fontWeight: 600 }}>
                          보유:
                        </span>
                        <span className="text-xs text-muted-foreground flex-1">
                          {match.hasIngredients.join(', ')}
                        </span>
                      </div>
                    )}
                    {match.missingIngredients.length > 0 && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-red-600 flex-shrink-0" style={{ fontWeight: 600 }}>
                          부족:
                        </span>
                        <span className="text-xs text-muted-foreground flex-1">
                          {match.missingIngredients.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{match.recipe.nutrition.calories}kcal</span>
                      <span>단백질 {match.recipe.nutrition.protein}g</span>
                      <span>탄수화물 {match.recipe.nutrition.carbs}g</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-5 flex-wrap">
              <button
                type="button"
                disabled={safePage === 1}
                onClick={() => goToPage(safePage - 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-border disabled:opacity-30"
                aria-label="이전 페이지"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => goToPage(p)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-sm border"
                  style={{
                    backgroundColor: p === safePage ? 'var(--accent)' : undefined,
                    color: p === safePage ? '#1A3300' : undefined,
                    fontWeight: p === safePage ? 700 : 500,
                    borderColor: p === safePage ? 'var(--accent)' : 'var(--border)',
                  }}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                disabled={safePage === totalPages}
                onClick={() => goToPage(safePage + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-border disabled:opacity-30"
                aria-label="다음 페이지"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-4 py-2 rounded-lg text-sm ${
        active ? 'text-black' : 'bg-secondary text-muted-foreground'
      }`}
      style={{
        backgroundColor: active ? 'var(--accent)' : undefined,
        fontWeight: active ? 600 : 500,
      }}
    >
      {children}
    </button>
  );
}
