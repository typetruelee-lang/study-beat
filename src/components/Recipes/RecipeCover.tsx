import './recipes.css';

/** Soft gradient "orb" cover for a soundscape (works in both skins, no image files). */
export function RecipeCover({ colors, badge, active, size = 148 }: { colors: [string, string]; badge?: string; active?: boolean; size?: number }) {
  const [a, b] = colors;
  return (
    <div className="recipe-cover" style={{ width: size, height: size }} aria-hidden="true">
      <div
        className="recipe-cover__orb"
        style={{
          background: `radial-gradient(circle at 30% 28%, ${a} 0%, transparent 58%), radial-gradient(circle at 75% 78%, ${a}aa 0%, transparent 50%), linear-gradient(160deg, ${b}, #0b0d18)`,
        }}
      />
      {badge && <span className="recipe-cover__badge">{badge}</span>}
      {active && <span className="recipe-cover__on">✓</span>}
    </div>
  );
}
