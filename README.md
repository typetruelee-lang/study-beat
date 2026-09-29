# FOCUS CLAY

공부·집중·수면을 위한 사운드 미니앱 (앱인토스 WebView 대상).
"음악을 켜고 → 스마트폰을 덜 만지고 → 집중하고 → 기록된 집중시간이 쌓이는" 작은 공간.

```bash
npm install
npm run dev          # 개발 서버
npm test             # 단위 테스트 (세션 상태머신, 통계, 노이즈, 카피/라이선스 가드)
npm run test:audio   # Chromium OfflineAudioContext로 실제 오디오 그래프 검증
npm run test:e2e     # Playwright + 가짜 시계로 핵심 루프 E2E
npm run build        # dist/ + focus-clay.ait (앱인토스 번들)
npm run perf         # 화면별 메인 스레드 사용량
node scripts/build-preview.mjs  # 브라우저 미리보기용 단일 HTML
```

## 진행 상황

| Phase | 내용 | 상태 |
|---|---|---|
| 1 | 전체 UI/UX (Home·Focus·Sleep·Relax·Library·Mixer·Binaural·Timer·Result·Stats·Settings) | ✅ |
| 2 | Binaural Beat 엔진 (L/R 분리, fade, ramp) | ✅ |
| 3 | Ambient / Noise / Mixer (절차적 합성 25종 + 파일 교체 구조) | ✅ |
| 4 | 타이머 (카운트다운·카운트업·목표, 시·분·초, 루틴, 수면 페이드 종료) | ✅ |
| 5 | 집중시간 기록 (이탈 감지, 오늘/주/월/전체, 7일 그래프, 목표, 나무) | ✅ |
| 5b | 자동 주파수 변화, 나의 루틴, 종료 방식 5종 | ✅ |
| 6 | 애니메이션·렌더링 최적화 (측정 스크립트 포함) | ✅ (실기기 측정은 남음) |
| 7 | 앱인토스 SDK 연동 (config, Storage·화면 켜짐·햅틱 어댑터, `.ait` 빌드) | ✅ (실기기·검수는 사용자 작업) |

## 구조

```
src/
  app/          store(useSyncExternalStore) · actions(스토어⇄오디오⇄저장소 조율) · hooks · App/라우팅
  audio/        AudioPort 인터페이스 · WebAudioEngine · binaural/ · noise/ · ambient/(합성 레시피, 파일 로더)
  features/     session/sessionMachine(순수 상태머신) · autoFrequency · routines
  storage/      KeyValueStore(비동기) · settings · sessions · routines · stats(순수 함수)
  platform/     visibility(이탈 감지) · wakeLock · haptics · toss(SDK 지연 로드) — 토스 안에서는 SDK 사용
  sounds/       {nature,cafe,sleep,noise,meditation}/index.json + catalog
  components/   화면별 폴더 + common/ + scenes/(클레이 SVG)
```

- **UI는 오디오 노드를 직접 만지지 않는다.** `startBinauralBeat / stopBinauralBeat / setBeatFrequency /
  setCarrierFrequency / setBusVolume / playTrack / fadeIn / fadeOut / scheduleFadeOut …` (`src/audio/types.ts`).
- 오디오 그래프: `binaural·ambient·noise 버스 → master → fader → sleepFader → compressor → analyser`.
  모든 변화는 ramp, 모든 시작은 무음에서 fade-in. 수면 종료 페이드는 **오디오 시계에 예약**되어 화면이 꺼져 JS 타이머가
  느려져도 20초 동안 부드럽게 줄어든다.
- **기록된 집중시간** = Focus 세션에서 `running` 상태로 흐른 시간만 (`focusedSeconds`, 명세의 actualStudySeconds).
  일시정지·앱 이탈·휴식 단계·수면·명상 시간은 포함하지 않는다. 공부를 증명하는 값이 아니라 세션 기록이다.
  WebView가 세션 도중 종료돼도 15초마다 저장한 스냅샷으로 복구한다.

## 사운드 설계 근거 (팩트체크)

| 항목 | 근거 | 앱의 설정 |
|---|---|---|
| 캐리어(왼쪽 귀) 음 높이 | 바이노럴 비트는 400–500Hz 캐리어에서 가장 잘 인지되고, 1000Hz 이하여야 함 (Licklider 1950; Perrott & Nelson 1969 — [eNeuro 2020 리뷰](https://www.eneuro.org/content/7/2/ENEURO.0232-19.2020)) | 400Hz 기본, 선택지 400/440/500Hz |
| 비트 주파수 상한 | 좌우 차이가 약 30Hz를 넘으면 맥놀이가 아니라 두 음으로 들림 (Perrott & Nelson 1969) | 40Hz(감마)는 "실험적"으로 표시하고 안내 |
| 노이즈·배경음과 혼합 | 메타분석(22개 연구)에서 백색/핑크 노이즈로 마스킹해도 효과 차이 없음 ([Garcia-Argibay 2019](https://link.springer.com/article/10.1007/s00426-018-1066-8)) | 혼합 허용. 단 저역 노이즈가 캐리어를 덮지 않도록 바이노럴 ON일 때 배경음·노이즈 버스에 캐리어 주파수 −6dB 피킹 컷(Q 1.4) |
| 효과에 대한 근거 | 뇌파 동조 연구 결과가 엇갈림(14편 중 5편 일치, 8편 반대 — [Ingendoh 2023, PLOS ONE](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0286023)) | 효과 주장 없음, "연구 결과는 엇갈려요" 안내 |
| 헤드폰 | 스피커로는 좌우 음이 공기 중에서 섞여 바이노럴이 성립하지 않음 | 준비 화면·설정에서 이어폰/헤드폰 안내 |
| 음량 | WHO 안전 청취: 80dB 기준 주 40시간, 기기 최대의 60% 이하 권장 ([WHO](https://www.who.int/news-room/questions-and-answers/item/deafness-and-hearing-loss-safe-listening)) | 기본 전체 볼륨 60%, 믹서에 안내, 수면 기본 믹스 음량 하향 |

### 주파수 대역 (IFCN 2020 권고: δ 0.1–<4 · θ 4–<8 · α 8–13 · β 14–30 · γ >30Hz, [Babiloni et al. 2020](https://pubmed.ncbi.nlm.nih.gov/31501011/))

| 프리셋 | 대역 | 용도 표기 |
|---|---|---|
| 2Hz | δ 델타 | 깊은 수면용 (수면 기본값) |
| 4Hz · 6Hz | θ 세타 | 잠들기 전 · 휴식·명상용 (휴식 기본값 6Hz) |
| 8Hz · 10Hz · 12Hz | α 알파 | 집중 준비 · 집중용(집중 기본값) · 집중 강화 |
| 14Hz · 18Hz | β 베타 | 작업용 · 업무 몰입 |
| 40Hz | γ 감마 | 실험적 (인지 한계 밖, 떨림처럼 들릴 수 있음) |

이전 버전은 4Hz를 "수면"으로 표기했지만 4Hz는 세타 하한이라 델타(2Hz) 프리셋을 새로 두고 표기를 바로잡았다.
대역 이름은 소리의 비트 주파수를 나타낼 뿐이며, 앱은 이것을 효과로 표현하지 않는다.

## 성능 (Phase 6)

`npm run build && npm run perf` — 헤드리스 Chromium(데스크톱 CPU), 390×844, 8초 측정. 휴대폰은 대략 4–6배 느리다고 보고 판단한다.

| 화면 | 메인 스레드 | 비고 |
|---|---|---|
| 홈 (장면 3개) | 1.9% | 화면에 30% 이상 보이는 장면만 움직임 |
| 집중 준비 / 수면 | 0.7% / 1.5% | |
| 기록 | 0.0% | 정적 |
| 집중 세션 (오디오 재생) | 4.8% → 4.4% | 파형 캔버스 15fps·캔버스 재할당 제거, 표시 초가 바뀔 때만 상태 반영 |
| "움직임 줄이기" 켬 | 0.0–1.6% | 남는 비용은 파형 그리기 |

- 애니메이션은 transform/opacity만 쓰고, 화면 밖·일시정지·"움직임 줄이기"·OS `prefers-reduced-motion`에서 멈춘다.
- 오디오는 별도 스레드에서 처리되고, 재생이 없으면 AudioContext를 suspend한다.
- 번들: JS 약 89KB(gzip), CSS 약 5KB(gzip). 소리 파일 없음(실시간 생성).
- 실기기(토스 WebView) 프로파일링은 아직 하지 않았다.

## 사운드와 라이선스

현재 모든 소리는 기기에서 실시간 생성하는 자체 제작 사운드다(`license: Original (procedural)`).
녹음 음원을 추가할 때는 `public/sounds/<category>/`에 파일을 두고 metadata를 `"source": "file"`로 바꾸며,
`license.commercialUse`, `attributionRequired`, `attribution`을 반드시 채운다(누락 시 테스트 실패).
합성으로 어색한 소리(카페 대화, 새소리, 기차)는 라이선스가 확인된 녹음으로 교체하는 것을 권장한다.
`src/sounds/README.md` 참고.

## 앱인토스 연동 (Phase 7)

이 환경에서는 개발자센터 문서 사이트가 네트워크 정책으로 막혀 있어, 공식 npm 패키지
`@apps-in-toss/web-framework@3.6.0`·`@apps-in-toss/cli@3.6.0`의 타입 정의와 CLI 내장 도움말을 기준으로 구현했다.
**아래 "문서로 재확인" 항목은 출시 전에 공식 문서로 꼭 확인해야 한다.**

```bash
npm run build     # tsc + vite build → dist/, 이어서 ait build → focus-clay.ait (로컬 패킹)
npm run deploy    # ait deploy — 콘솔 API 키 필요 (ait token add 로 등록)
```

- 설정: `apps-in-toss.config.ts` (v3 형식) — `appName: 'focus-clay'`, `brand.primaryColor: '#E9794F'`, `permissions: []`,
  `webBundleDir: 'dist'`, `webView.allowsInlineMediaPlayback: true`.
- 토스 앱 안인지 판별: 호스트가 넣어주는 `window.ReactNativeWebView` 유무 (`src/platform/toss.ts`).
  SDK는 토스 안에서만 동적으로 불러온다(별도 청크, 브라우저에서는 다운로드하지 않음).

| 기능 | 토스 앱 안 (SDK) | 브라우저 | 파일 |
|---|---|---|---|
| 기록·설정 저장 | `Storage.getItem/setItem/removeItem` | localStorage | `storage/AitStorageKV.ts` |
| 집중 중 화면 켜짐 | `Screen.setAwakeMode({ enabled })` | Screen Wake Lock API | `platform/wakeLock.ts` |
| 햅틱 | `generateHapticFeedback({ type: 'tickWeak' / 'success' })` | `navigator.vibrate` | `platform/haptics.ts` |
| 앱 이탈 감지 | `visibilitychange` (전용 SDK API 없음) | 동일 | `platform/visibility.ts` |
| 뒤로가기 | 네이티브 뒤로 → WebView 기록 → 해시 라우터 이전 화면 | 동일 | (가로채지 않음) |
| 다른 앱 차단·기기 잠금 | **SDK에 없음 → 구현하지 않음** (집중 이탈 감지로 대체) | — | |
| 백그라운드 재생 보장 | **SDK에 없음 → 보장한다고 표기하지 않음** | — | |

- TDS(`@toss/tds-mobile`)는 React ≤18을 요구하므로 React 18로 고정했다. 현재 UI는 자체 클레이 디자인이며 TDS는 적용하지 않았다.
- iOS는 무음 스위치가 켜져 있으면 Web Audio가 들리지 않을 수 있다.

### 출시 전 체크리스트 (사용자 작업)

1. 앱인토스 콘솔에 앱 등록 — 앱 이름이 `apps-in-toss.config.ts`의 `appName`(`focus-clay`)과 일치하는지 확인
2. `ait token add`로 API 키 등록 → `npm run deploy` → 샌드박스 앱에서 실기기 테스트
3. 실기기 확인 항목: 첫 탭에서 소리 시작·페이드인, 헤드폰 좌우 분리, 화면 꺼짐/앱 전환 시 재생·이탈 감지 동작,
   화면 켜짐 유지, 네이티브 뒤로가기 흐름(집중 세션에서 뒤로 → 세션 유지), 재실행 후 기록 유지, 햅틱
4. 문서로 재확인: 검수 가이드(TDS 사용 요구 여부, 내비게이션 바 규칙, 카피·의료 표현 규정), `backEvent` 구독 시 기본 뒤로가기 동작,
   `webView` 옵션 의미, 오디오/백그라운드 관련 제약
5. 녹음 음원을 쓸 경우 각 파일의 상업적 이용 가능 라이선스 확인 후 metadata 입력

## 경쟁 서비스 참고 메모

네트워크 제약으로 이번 세션에서는 웹 조사를 하지 못했고, 아래는 일반적으로 알려진 특징을 바탕으로 한 요약이다.
기능·화면은 참고만 했고 그래픽·캐릭터는 모두 새로 만들었다.

- **Brain.fm / Endel**: 모드(집중·휴식·수면) 선택 → 바로 재생. 과학 용어를 앞세움 → FOCUS CLAY는 "공부할 때 듣는 집중 사운드"로 쉽게 말하고 Hz는 보조 정보로.
- **Noisli / myNoise**: 여러 소리를 슬라이더로 섞는 믹서 → 믹서는 제공하되 첫 화면에는 숨기고 기본 믹스로 바로 시작.
- **BetterSleep / Calm / Headspace**: 수면 타이머 + 페이드 아웃, 어두운 수면 화면, 유료 콘텐츠 중심 → 수면 모드를 별도 분위기로.
- **Tide / 뽀모도로류**: 집중 타이머와 기록, 다른 앱 사용 억제 → 앱인토스에선 차단 대신 "집중 이탈 감지"로 정직하게.
- **Binaural Beat 앱류**: 주파수 목록이 첫 화면 → 주파수 개념 없이도 쓸 수 있게 프리셋 이름을 용도로 표기.
- 차별점: 클레이 세계관 + 목표/남은 시간이 홈에 바로 보이는 공부 루프 + 기록된 집중시간이 나무로 자라는 습관 시각화.

## UX 기준 자체 점검 (명세 29)

1. 3초 안에 무엇을 하는 앱인지 → 홈 상단 목표 카드 + "오늘 공부할까? / 잘 준비할까? / 잠깐 쉴까?" 카드 ✅
2. 첫 화면에서 바로 재생 → [25분 집중하기] → [집중 시작], 2탭 (E2E로 검증) ✅
3. 공부/수면 구분 → 수면은 어두운 전용 테마 ✅
4. 주파수를 몰라도 사용 → 기본 10Hz 자동, 이름은 "집중 사운드" ✅
5. 사운드 변경 → 모드 화면의 한 탭 칩, 라이브러리 탭 토글 ✅
6. 타이머 설정 → 25/50/90 칩 + 타이머 화면 ✅
7. 재생 상태 → 하단 미니 플레이어(소리·Hz·남은 시간·일시정지) ✅
8. 한 손 사용 → 주요 버튼 하단 고정, 터치 영역 ≥ 44–60px ✅
9. 작은 글씨 없이 핵심 기능 → 본문 17px, 핵심 숫자 64–76px ✅
10. 독립 서비스 느낌 → 자체 마스코트·클레이 장면 ✅ (사용자 테스트 필요)

## 알려진 한계 / 다음 단계

- 실기기(토스 앱) 테스트 전: 오디오 청취 품질, 화면 꺼짐 시 재생 지속, 이탈 감지 이벤트 동작.
- 절차적 소리는 첫 사용 시 100–250ms 생성 비용이 있다(이후 캐시). 페이드인으로 가려진다.
