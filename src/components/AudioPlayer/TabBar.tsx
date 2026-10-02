import { NavLink } from 'react-router-dom';
import './player.css';

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const ICONS = {
  home: <svg viewBox="0 0 24 24" {...P}><path d="M3.5 11 12 4l8.5 7" /><path d="M6 9.8V20h4.5v-5h3v5H18V9.8" /></svg>,
  sound: <svg viewBox="0 0 24 24" {...P}><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3.5" y="13.5" width="4" height="6.5" rx="1.6" /><rect x="16.5" y="13.5" width="4" height="6.5" rx="1.6" /></svg>,
  stats: <svg viewBox="0 0 24 24" {...P}><path d="M5 20V11M12 20V5M19 20v-6" /></svg>,
  settings: <svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2 1.2M17.8 15.3l2 1.2M4.2 16.5l2-1.2M17.8 8.7l2-1.2" /></svg>,
};

const TABS = [
  { to: '/', icon: ICONS.home, label: '홈' },
  { to: '/library', icon: ICONS.sound, label: '사운드' },
  { to: '/stats', icon: ICONS.stats, label: '기록' },
  { to: '/settings', icon: ICONS.settings, label: '설정' },
];

export function TabBar() {
  return (
    <nav className="tabbar" aria-label="주요 메뉴">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end className={({ isActive }) => (isActive ? 'active' : '')}>
          <span className="tabbar__icon" aria-hidden="true">{t.icon}</span>
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
