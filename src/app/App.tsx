import { useEffect, useState } from 'react';
import { HashRouter, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Home } from '../components/Home/Home';
import { FocusSetup } from '../components/Focus/FocusSetup';
import { FocusReady } from '../components/Focus/FocusReady';
import { FocusSession } from '../components/Focus/FocusSession';
import { FocusResult } from '../components/Focus/FocusResult';
import { Sleep } from '../components/Sleep/Sleep';
import { Relax } from '../components/Relax/Relax';
import { SoundLibrary } from '../components/SoundLibrary/SoundLibrary';
import { Mixer } from '../components/Mixer/Mixer';
import { BinauralSettings } from '../components/Binaural/BinauralSettings';
import { TimerSettings } from '../components/Timer/TimerSettings';
import { Statistics } from '../components/Statistics/Statistics';
import { Settings } from '../components/Settings/Settings';
import { Licenses } from '../components/Settings/Licenses';
import { AudioDiagnostics } from '../components/Settings/AudioDiagnostics';
import { NowPlaying } from '../components/AudioPlayer/NowPlaying';
import { MiniPlayer } from '../components/AudioPlayer/MiniPlayer';
import { TabBar } from '../components/AudioPlayer/TabBar';
import { AwaySheet } from '../components/Session/AwaySheet';
import { DimOverlay } from '../components/Screen/DimOverlay';
import { ScreenCurtain, useAutoCurtain } from '../components/Screen/ScreenCurtain';
import { Splash } from './Splash';
import { initApp } from './actions';
import { IS_WEB_SKIN } from './skin';
import { useAppState } from './store';

// Hash routes in the WebView; in-memory routes for the web preview build (VITE_ROUTER=memory),
// where the host page owns the URL.
const Router = import.meta.env.VITE_ROUTER === 'memory' ? MemoryRouter : HashRouter;

const TAB_ROUTES = ['/', '/library', '/stats', '/settings'];
const NO_MINI = ['/focus/session', '/focus/ready', '/focus/result', '/now'];

function Shell() {
  const { pathname } = useLocation();
  const mode = useAppState((s) => s.player.mode);
  const sessionMode = useAppState((s) => s.session?.mode);
  const dark = pathname.startsWith('/sleep') || (pathname === '/now' && mode === 'sleep') || (pathname === '/mixer' && sessionMode === 'sleep');
  const showTabs = TAB_ROUTES.includes(pathname);
  const reduceMotion = useAppState((s) => s.settings.reduceMotion);
  useAutoCurtain();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  useEffect(() => {
    if (IS_WEB_SKIN) return; // the web skin is dark everywhere
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#eef0fa' : '#f5f2ee');
    document.body.style.background = dark ? '#eef0fa' : '';
  }, [dark]);

  return (
    <div className={`app-root ${dark ? 'theme-sleep' : ''}`} data-reduce-motion={reduceMotion}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/focus" element={<FocusSetup />} />
        <Route path="/focus/ready" element={<FocusReady />} />
        <Route path="/focus/session" element={<FocusSession />} />
        <Route path="/focus/result" element={<FocusResult />} />
        <Route path="/sleep" element={<Sleep />} />
        <Route path="/relax" element={<Relax />} />
        <Route path="/library" element={<SoundLibrary />} />
        <Route path="/mixer" element={<Mixer />} />
        <Route path="/binaural" element={<BinauralSettings />} />
        <Route path="/timer" element={<TimerSettings />} />
        <Route path="/stats" element={<Statistics />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/licenses" element={<Licenses />} />
        <Route path="/settings/audio" element={<AudioDiagnostics />} />
        <Route path="/now" element={<NowPlaying />} />
        <Route path="*" element={<Home />} />
      </Routes>
      {!NO_MINI.includes(pathname) && <MiniPlayer aboveTabs={showTabs} />}
      {showTabs && <TabBar />}
      <AwaySheet />
      <DimOverlay />
      <ScreenCurtain />
    </div>
  );
}

export function App() {
  const ready = useAppState((s) => s.ready);
  const [minDelay, setMinDelay] = useState(true);
  useEffect(() => {
    void initApp();
    const t = setTimeout(() => setMinDelay(false), 500);
    return () => clearTimeout(t);
  }, []);
  if (!ready || minDelay) return <Splash />;
  return (
    <Router>
      <Shell />
    </Router>
  );
}
