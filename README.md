# FOCUS CLAY

공부·집중·수면을 위한 사운드 미니앱 (앱인토스 WebView 대상).
"음악을 켜고 → 스마트폰을 덜 만지고 → 집중하고 → 기록된 집중시간이 쌓이는" 작은 공간.

```bash
npm install
npm run dev          # 개발 서버
npm test             # 단위 테스트 (세션 상태머신, 통계, 노이즈, 카피/라이선스 가드)
npm run test:audio   # Chromium OfflineAudioContext로 실제 오디오 그래프 검증
npm run test:e2e     # Playwright + 가짜 시계로 핵심 루프 E2E
npm run build        # dist/ (상대 경로 번들, WebView용)
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
| 6 | 애니메이션 성능 프로파일링 (실기기) | 다음 |
| 7 | 앱인토스 SDK 연동·검수 | 다음 |

## 구조

```
src/
  app/          store(useSyncExternalStore) · actions(스토어⇄오디오⇄저장소 조율) · hooks · App/라우팅
  audio/        AudioPort 인터페이스 · WebAudioEngine · binaural/ · noise/ · ambient/(합성 레시피, 파일 로더)
  features/     session/sessionMachine(순수 상태머신) · autoFrequency · routines
  storage/      KeyValueStore(비동기) · settings · sessions · routines · stats(순수 함수)
  platform/     visibility(이탈 감지) · wakeLock · haptics  ← Phase 7에서 SDK 구현으로 교체
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

## 사운드와 라이선스

현재 모든 소리는 기기에서 실시간 생성하는 자체 제작 사운드다(`license: Original (procedural)`).
녹음 음원을 추가할 때는 `public/sounds/<category>/`에 파일을 두고 metadata를 `"source": "file"`로 바꾸며,
`license.commercialUse`, `attributionRequired`, `attribution`을 반드시 채운다(누락 시 테스트 실패).
합성으로 어색한 소리(카페 대화, 새소리, 기차)는 라이선스가 확인된 녹음으로 교체하는 것을 권장한다.
`src/sounds/README.md` 참고.

## 앱인토스 플랫폼 확인 결과

이 개발 환경에서는 개발자센터 문서 사이트 접근이 네트워크 정책으로 막혀 있어, 공식 npm 패키지
`@apps-in-toss/web-framework@3.6.0`의 타입 정의를 직접 확인했다. **Phase 7 전에 공식 문서로 재확인이 필요하다.**

| 필요 기능 | SDK에 존재 | 현재 구현 (웹 표준) | Phase 7 교체 |
|---|---|---|---|
| 로컬 저장 | `Storage.getItem/setItem/removeItem` | localStorage (`LocalStorageKV`) | `AitStorageKV` |
| 화면 켜짐 유지 | `Screen.setAwakeMode({ enabled })` | Screen Wake Lock API | 그대로 교체 |
| 햅틱 | `generateHapticFeedback({ type })` | `navigator.vibrate` | 그대로 교체 |
| 뒤로가기/홈 | `graniteEvent.addEventListener('backEvent'/'homeEvent')` | 브라우저 history | 집중 중 뒤로가기 확인 |
| 앱 이탈 감지 | (전용 API 없음) | `document.visibilitychange` | 실기기에서 동작 확인 |
| **다른 앱 차단 / 기기 잠금** | **없음** | 구현하지 않음 | — (네이티브 앱에서 검토) |
| **백그라운드 오디오 보장** | **없음** | 보장한다고 표기하지 않음 | — |

- TDS(`@toss/tds-mobile`, `@toss/tds-mobile-ait` 2.5.1)는 React ≤18을 요구 → React 18로 고정했다.
- 설정: `defineConfig`의 `webView.mediaPlaybackRequiresUserAction`, `allowsInlineMediaPlayback` 확인 필요.
- iOS는 무음 스위치가 켜져 있으면 Web Audio가 들리지 않을 수 있다(실기기 확인 필요).

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
- Phase 7: SDK 설치, `granite.config.ts`, 어댑터 교체, 내비게이션 바 설정, 샌드박스 테스트, 검수 체크리스트.
