import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { play, toggleTrack } from '../../app/actions';
import { useAppState } from '../../app/store';
import { soundsByCategory } from '../../sounds/catalog';
import { CATEGORY_LABELS, type SoundCategory } from '../../sounds/types';
import { ClayButton } from '../common/ClayButton';
import { ChipGroup } from '../common/Chip';
import { SoundThumb } from '../scenes/SoundThumb';
import { FavoriteList } from '../Recipes/FavoriteList';
import { RecipeRow } from '../Recipes/RecipeRow';
import { AdSlot } from '../Ads/AdSlot';
import './library.css';

const MODE_LABEL = { focus: '집중', sleep: '수면', relax: '휴식' } as const;
type Tab = SoundCategory | 'all';

export function SoundLibrary() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('all');
  const tracks = useAppState((s) => s.player.tracks);
  const mode = useAppState((s) => s.player.mode);
  const playing = useAppState((s) => s.player.playing);
  const session = useAppState((s) => s.session);
  const active = new Set(tracks.map((t) => t.id));

  const onTap = (id: string) => {
    toggleTrack(id);
    if (!playing && !session) void play(); // tapping a sound previews it right away
  };

  return (
    <div className="screen stack">
      <header style={{ paddingTop: 8 }} className="stack-s">
        <h1 className="h1">사운드</h1>
        <p className="muted small">탭해서 {MODE_LABEL[mode]} 믹스에 넣거나 빼요. 최대 4개까지 섞을 수 있어요.</p>
      </header>
      <section className="stack-s" aria-label="내 믹스">
        <h2 className="h2">내 믹스</h2>
        <FavoriteList />
      </section>
      <section className="stack-s" aria-label="추천 사운드">
        <h2 className="h2">추천 · 집중</h2>
        <RecipeRow mode="focus" go label="추천 집중 사운드" />
        <h2 className="h2">추천 · 수면 · 휴식</h2>
        <RecipeRow mode="sleep" go label="추천 수면 사운드" />
        <RecipeRow mode="relax" go label="추천 휴식 사운드" />
      </section>
      <h2 className="h2">모든 소리</h2>
      <ChipGroup<Tab>
        label="카테고리"
        scroll
        value={tab}
        onChange={setTab}
        options={[
          { value: 'all', label: '전체' },
          { value: 'nature', label: CATEGORY_LABELS.nature },
          { value: 'cafe', label: '도시·공간' },
          { value: 'sleep', label: CATEGORY_LABELS.sleep },
          { value: 'noise', label: CATEGORY_LABELS.noise },
          { value: 'meditation', label: CATEGORY_LABELS.meditation },
        ]}
      />
      <div className="sound-grid">
        {soundsByCategory(tab).map((s) => (
          <button key={s.id} type="button" className="sound-tile" aria-pressed={active.has(s.id)} onClick={() => onTap(s.id)}>
            <SoundThumb thumb={s.thumb} id={`th-${s.id}`} />
            <span className="stack-s" style={{ gap: 2 }}>
              <span className="sound-tile__name">{s.name}</span>
              <span className="sound-tile__meta">{CATEGORY_LABELS[s.category]}</span>
            </span>
            {active.has(s.id) && <span className="sound-tile__check" aria-hidden="true">✓</span>}
          </button>
        ))}
      </div>
      <ClayButton block onClick={() => navigate('/mixer')}>🎚 볼륨 조절하기</ClayButton>
      <AdSlot place="library" />
    </div>
  );
}
