# 몰입각 (구 FOCUS CLAY)

> **토스에 올리려면 → [docs/toss-launch-guide.md](docs/toss-launch-guide.md)** (단계별 따라 하기 가이드)

공부·집중·수면을 위한 사운드 미니앱 (앱인토스 WebView 대상).
"음악을 켜고 → 스마트폰을 덜 만지고 → 집중하고 → 기록된 집중시간이 쌓이는" 작은 공간.

```bash
npm install
npm run dev          # 개발 서버
npm test             # 단위 테스트 (세션 상태머신, 통계, 노이즈, 카피/라이선스 가드)
npm run test:audio   # Chromium OfflineAudioContext로 실제 오디오 그래프 검증
npm run test:e2e     # Playwright + 가짜 시계로 핵심 루프 E2E
npm run build        # dist/ + molip-gak.ait (앱인토스 번들)
npm run check:toss   # 앱인토스 제출 전 자동 점검 (✅/❌)
npm run store-assets # 콘솔용 아이콘·썸네일·스크린샷 → store-assets/
npm run build:site   # 웹사이트용(aura 다크 스킨 + 광고 자리): 앱 + 사운드 엔진(/engine/)
npm run dev:web      # 웹 스킨으로 개발 서버
npm run serve        # 위 빌드를 Node 서버로 제공 (http://localhost:8080)
npm run perf         # 화면별 메인 스레드 사용량
node scripts/build-preview.mjs [out.html] [web]  # 브라우저 미리보기용 단일 HTML (web = aura 스킨)
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

## 두 가지 스킨 (토스 / 웹)

같은 코드에서 빌드 때 `VITE_SKIN`으로 화면 분위기만 바꾼다(`src/app/skin.ts`, `:root.skin-*` 토큰).

| | 토스 미니앱 (`npm run build`) | 웹사이트 (`npm run build:site`) |
|---|---|---|
| 스킨 | `clay` — 밝은 웜톤, 얇은 테두리+부드러운 그림자, 정돈된 여백 | `aura` — 어두운 배경, 그라데이션 오브·빛 번짐, 그라데이션 버튼 |
| 장면 | 클레이 일러스트 | 모드별 색의 오브 애니메이션(`AuraArt`) |
| 광고 | 없음 | Google AdSense (홈·통계·라이브러리·결과 화면, **재생 화면에는 없음**) |
| 설정 파일 | `.env` | `.env` + `.env.web` (제목·설명·테마색도 여기서) |

Anima: Binaural Beats와의 기능 비교와 차용 결정은 [docs/anima-comparison.md](docs/anima-comparison.md).

### 추천 사운드 · 강도 · 스피커용 · 내 믹스

- **추천 사운드(레시피)** `src/sounds/recipes.ts`: 배경음 + 집중 사운드를 미리 묶은 11종(예: 카페 몰입 = 카페+핑크노이즈+12Hz). 한 탭으로 적용.
- **강도**: 집중 사운드만 따로 줄이고 키우는 슬라이더(배경음 아래로 깔 수 있게).
- **이어폰용 / 스피커용**: 이어폰용은 바이노럴 비트(좌우 다른 음), 스피커용은 아이소크로닉 톤(한 음을 규칙적으로 켜고 끔,
  `IsochronicTone.ts`). 연구 대부분은 바이노럴 비트 대상이며 아이소크로닉 톤 근거는 더 적다 — 앱은 효과를 주장하지 않는다.
- **내 믹스**: 믹서에서 지금 조합을 이름 붙여 저장(최대 12개), 라이브러리 "내 믹스"에서 다시 적용.

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
npm run build     # tsc + vite build → dist/, 이어서 ait build → molip-gak.ait (로컬 패킹)
npm run deploy    # ait deploy — 콘솔 API 키 필요 (ait token add 로 등록)
```

- 설정: `apps-in-toss.config.ts` (v3 형식) — `appName: 'molip-gak'`, `brand.primaryColor: '#E2683F'`, `permissions: []`, `navigationBar`(토스 표준 바·뒤로가기),
  `webBundleDir: 'dist'`, `webView.allowsInlineMediaPlayback: true`.
- 토스 앱 안인지 판별: 호스트가 넣어주는 `window.ReactNativeWebView` 유무 (`src/platform/toss.ts`).
  SDK는 토스 안에서만 동적으로 불러온다(별도 청크, 브라우저에서는 다운로드하지 않음).

| 기능 | 토스 앱 안 (SDK) | 브라우저 | 파일 |
|---|---|---|---|
| 기록·설정 저장 | `Storage.getItem/setItem/removeItem` | localStorage | `storage/AitStorageKV.ts` |
| 화면 켜짐 유지 (모드별) | `Screen.setAwakeMode({ enabled })` | Screen Wake Lock API | `platform/wakeLock.ts`, `actions.applyAwake` |
| 햅틱 | `generateHapticFeedback({ type: 'tickWeak' / 'success' })` | `navigator.vibrate` | `platform/haptics.ts` |
| 앱 이탈 감지 | `visibilitychange` (전용 SDK API 없음) | 동일 | `platform/visibility.ts` |
| 뒤로가기 | 네이티브 뒤로 → WebView 기록 → 해시 라우터 이전 화면 | 동일 | (가로채지 않음) |
| 다른 앱 차단·기기 잠금 | **SDK에 없음 → 구현하지 않음** (집중 이탈 감지로 대체) | — | |
| 백그라운드 재생 보장 | **SDK에 없음** → 지금 믹스를 30초 이음매 없는 **스테레오 WAV**로 미리 렌더해 보통 `<audio loop>`로 대기(음소거), 화면이 꺼지면 그쪽으로 넘김. Media Session으로 잠금화면 정보 | 동일 | `audio/backgroundTrack.ts`, `AudioEngine.applyRoute` |
| 기기 밝기 조절 · 화면 끄기 | **SDK·웹 모두 API 없음** → 앱 화면 밝기(검은 레이어 15–100%), 화면 켜짐 유지 끄기(기기 자동 꺼짐 허용), **검은 화면 모드**(앱은 켜진 채 화면만 까맣게, 두 번 탭/길게 눌러 해제, 자동 진입 1/5/10분) | 동일 | `components/Screen/*` |

- 화면이 꺼지거나 다른 앱으로 가면(웹에서는 둘을 구분할 수 없음) **집중 기록은 멈추고 소리는 계속**된다. 화면을 끈 채 기록까지
  이어가려면 검은 화면 모드를 쓴다(앱이 앞에 있어 재생·기록 모두 유지, OLED는 검은 화소 전력이 거의 0).
- 화면이 실제로 꺼진 뒤에도 소리가 계속 나는지는 토스 앱(WebView)의 백그라운드 정책에 달려 있어 **실기기 확인이 필요**하다.
  설정의 "화면 꺼져도 재생(실험적)"을 끄면 기존처럼 Web Audio 직접 출력으로 돌아간다.
- **TDS**(`@toss/tds-mobile` + `@toss/tds-mobile-ait`): 비게임 WebView 검수 필수. 토스판(clay)에서만 `TDSMobileAITProvider`로 감싸고
  버튼(`ClayButton`)·스위치(`ToggleRow`)·바텀시트(`Sheet`)를 TDS로 그린다(`src/components/common/*`에서 스킨별 분기). 웹판(aura)에는 TDS가 번들되지 않는다.
- **검수 기준 반영**: 라이트 모드(토스판 수면 화면도 밝은 라벤더), 토스 안에서는 자체 ‹ 숨김(`ScreenHeader`), 홈에서 뒤로 → `closeView()`
  (`platform/tossNavigation.ts`), 핀치 줌 금지(viewport·`touch-action`), 경로형 딥링크 `/focus`·`/sleep`·`/relax` → 해시 라우트(`platform/deeplink.ts`).
- iOS는 무음 스위치가 켜져 있으면 Web Audio가 들리지 않을 수 있다.

### 화면 꺼짐 재생: MediaStream을 쓰지 않는 이유

예전에는 화면이 꺼지면 실시간 믹스를 `MediaStream` → 숨은 `<audio>`로 보냈다. 안드로이드에서 이 경로는 **통화용 오디오**로 처리될 수 있어,
블루투스 이어폰이 음악용(A2DP 스테레오)에서 통화용(HFP, 모노·잡음 제거)으로 바뀌었다 → 좌우 400/410Hz가 한 채널에서 합쳐져
**1초에 10번 뚝뚝 끊기는 소리**가 되고, 잡음 제거가 일정한 순음을 지워 **비트만 사라졌다**(배경음은 남음). 실기기 보고와 일치.

지금은 같은 엔진으로 믹스를 오프라인 렌더(30초, 정수 초라 모든 정수 Hz 톤의 위상이 이음매에서 맞물림, 배경음은 1.5초 등전력 크로스페이드)해
**16비트 스테레오 WAV** 파일로 보통 `<audio loop>`에 넣는다(`src/audio/backgroundTrack.ts`). 첫 탭에서 음소거로 재생을 시작해 두고,
화면이 꺼지면 음소거 해제 + 실시간 출력 페이드아웃, 돌아오면 반대. 믹스가 바뀌면 1초 뒤 다시 렌더한다.
- 수면 타이머의 마지막 20초 페이드는 화면이 꺼져 있으면 요소 볼륨을 1초 간격으로 줄인다. 자동 주파수 변화는 화면이 꺼진 동안 단계가 바뀌지 않는다.
- 재생 중 2초마다 엔진 상태를 확인해 비트·배경음이 빠졌으면 복구(`watchAudio`), 정지/일시정지는 재생 세대 번호로 경쟁을 막는다, 재생 중엔 소리 미리 만들기를 멈춘다.
- **설정 → 소리 진단**: 출력 경로, 배경 음원 상태, 최근 이벤트(화면 꺼짐/켜짐, 경로 전환, 요소 pause·stalled, 자동 복구). 기기 테스트 후 캡처용.
- 점검: `npm run test:audio`(모든 모드 기본 믹스 + 추천 11개의 루프 파일: 귀별 스테레오, 비트 세기 ±1dB, 이음매, WAV 디코딩 / 시작 20초 비트 세기),
  `npm run test:e2e`(25분 집중을 화면 꺼짐 15분 포함해 끝까지, 정지 직후 재시작, 감시 복구), `npm run test:soak`(실시간·CPU 4배 감속에서 오디오 지연·긴 작업).

### 출시 절차

**[docs/toss-launch-guide.md](docs/toss-launch-guide.md)** — 콘솔 가입부터 출시까지 단계별 체크리스트(실기기 점검표 포함).
콘솔에 붙여 넣을 문구와 이미지는 [store-assets/](store-assets/console-text.md). 녹음 음원을 추가하면 각 파일의 상업적 이용 라이선스를 metadata에 입력.

## 웹사이트로 서버에 올리기

토스 밖에서도 일반 브라우저로 쓸 수 있다(토스 SDK는 토스 앱 안에서만 불러오고, 밖에서는 localStorage·Wake Lock 등 웹 기능으로 동작).

```bash
npm run build:site     # dist/ = 앱(/) + 사운드 엔진·데모(/engine/)
npm run serve          # http://localhost:8080  (PORT, HOST 환경변수로 변경)
npm run test:server    # 서버·앱·엔진 데모 자동 점검
docker build -t focus-clay . && docker run -p 8080:8080 focus-clay
```

- `server/index.mjs`: 의존성 없는 Node 서버(node:http). 올바른 MIME, gzip, 해시 붙은 `assets/*`는 1년 캐시, HTML은 매번 재검증,
  `dist/` 밖 경로 차단, `nosniff` 헤더. HTTPS는 앞단(Nginx, 클라우드 로드밸런서 등)에서 처리하는 것을 권장.
- 정적 파일만 올려도 된다: `dist/` 폴더를 Nginx, S3·CloudFront, Vercel, Netlify, GitHub Pages 등 아무 곳에나 그대로 올리면 된다
  (해시 라우팅·상대 경로라 하위 경로에 두어도 동작).
- 소리는 브라우저 정책상 **사용자가 한 번 탭한 뒤**에만 나고, 집중 사운드는 헤드폰으로 들어야 한다.

### Google AdSense 붙이기 (웹판만)

1. AdSense 승인 후 `.env.web`에 `VITE_ADSENSE_CLIENT=ca-pub-…`와 자리별 광고 단위 ID(`VITE_ADSENSE_SLOT_HOME/STATS/LIBRARY/RESULT`)를 채운다.
   비어 있는 자리는 아무것도 그리지 않는다. 배치 확인용으로 `VITE_AD_PLACEHOLDER=1`이면 점선 자리 표시가 나온다.
2. `public/ads.txt`(폴더가 없으면 만든다)에 `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`를 넣는다(빌드 시 사이트 루트로 복사됨).
3. 광고 스크립트는 광고 자리가 처음 화면에 그려질 때 한 번만 불러온다(`src/components/Ads/AdSlot.tsx`). 토스판(`clay`)에서는 절대 렌더링되지 않는다.
4. 정책: 재생·집중·수면 화면에는 광고를 두지 않고, 모든 광고에 "광고" 표시를 단다. 개인정보처리방침·쿠키 동의(EEA 등)는 배포 전 사용자 작업.

## 사운드 엔진만 다른 웹페이지에서 쓰기

`npm run build:engine` → `dist/engine/focus-clay-engine.js`(약 33KB, gzip 11KB, 전역 `FocusClay`) ·
`focus-clay-engine.mjs`(ES 모듈) · `index.html`(데모). 앱과 **같은 엔진 코드**(`src/audio`)를 쓴다.

```html
<script src="/engine/focus-clay-engine.js"></script>
<script>
  const fc = FocusClay.create();
  fc.prewarm(['rain_01']); // 미리 생성해 두면 시작이 끊기지 않음
  startButton.onclick = () => fc.play({ beat: 10, sounds: [{ id: 'rain_01', volume: 0.55 }], volume: 0.6 });
</script>
```

| API | 설명 |
|---|---|
| `FocusClay.create()` | 플레이어 생성(페이지당 1개 권장) |
| `play({ beat, carrier, sounds, volume, binauralVolume, ambientVolume, noiseVolume, fadeIn })` | 재생 또는 재생 중 설정 변경. **탭/클릭 안에서** 호출 |
| `setBeat(hz, ramp)` · `setBinaural(hz \| null)` · `setCarrier(hz)` | 집중 사운드 주파수 변경(부드럽게 이동) · 켜기/끄기 · 기본 음 |
| `addSound(id, vol)` · `removeSound(id)` · `setSounds([...])` · `setSoundVolume(id, vol)` | 배경음·노이즈 |
| `setVolume(v)` · `setBusVolume('binaural'\|'ambient'\|'noise', v)` | 볼륨 |
| `sleepTimer(sec, fade=20)` · `cancelSleepTimer()` · `stop(fade)` | 타이머(오디오 시계에 예약된 페이드) · 정지 |
| `prewarm(ids)` · `state` · `analyser` · `destroy()` | 미리 생성 · 상태 · 파형용 AnalyserNode · 정리 |
| `FocusClay.sounds` · `FocusClay.presets` · `FocusClay.carriers` | 소리 25종(라이선스 포함) · 프리셋 9개(대역 포함) · 400/440/500Hz |

화면이 꺼지면 미리 렌더한 스테레오 음원 파일로 넘어가는 동작, 클릭 없는 램프, 음량 정규화가 모두 포함되어 있다.

## 경쟁 서비스 참고 메모

Anima: Binaural Beats 상세 비교는 [docs/anima-comparison.md](docs/anima-comparison.md). 아래는 그 외 서비스의 일반적으로 알려진 특징 요약이다.
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
