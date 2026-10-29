# 나의 웹툰

React + Vite로 만든 개인 웹툰 뷰어입니다. GitHub Pages 주소는 https://radiodown.github.io/webtoom/ 입니다.

## 읽기

첫 화면에 전체 회차 목록이 표시됩니다. 읽고 싶은 카드를 누르면 이미지가 순서대로 이어집니다.

- **1화 · 클로드**: 5장 — https://radiodown.github.io/webtoom/?episode=01
- **2화 · 프라이데이**: 5장 — https://radiodown.github.io/webtoom/?episode=02
- **3화 · 컨텍스트 0%**: 9장 — https://radiodown.github.io/webtoom/?episode=03

읽는 화면 위쪽의 회차 버튼, 아래쪽의 이전·다음 화, 헤더의 회차 목록으로 이동할 수 있습니다. 브라우저 뒤로 가기도 지원합니다. 기본 이미지 간격은 **12px**, 너비는 **800px**이며 모바일에서는 화면 폭에 맞춥니다. 보기 설정, 밝은 테마, 회차별 이어서 읽기를 지원합니다. 설정과 위치는 브라우저에 저장됩니다.

## 개발 및 검사

Node.js 24와 npm을 사용합니다.

```powershell
npm ci
npm run dev
```

터미널에 표시된 `/webtoom/` 주소를 여세요. React 앱이므로 HTML 파일을 직접 더블 클릭하는 대신 개발 서버를 사용합니다.

```powershell
npm test
npm run build
npm run preview
```

테스트는 회차 검색과 정렬, 회차 이동, 직접 링크와 방문 기록, 설정 저장, 이미지 재시도, 이어서 읽기를 확인합니다. 브라우저 시각 검증은 별도로 수행해야 합니다.

## 새 회차 추가

1. 저장소 최상위에 `04-새 회차 부제`처럼 **회차 번호-부제** 폴더를 만듭니다.
2. PNG 이미지를 추가합니다. `1.png, 2.png, …, 10.png`는 숫자 순으로 정렬됩니다. 카카오톡 파일은 접미사 없는 파일부터 `_01`, `_02` 순으로 읽습니다.
3. 폴더를 커밋하고 `main`에 푸시합니다. 빌드 시 회차 목록, 이미지 경로, 원본 크기가 자동 생성됩니다. 별도 회차 설정 파일을 수정할 필요가 없습니다.

`scripts/generate-episodes.mjs`가 `src/episodes.generated.js`를 생성합니다. 생성 파일은 Git에 포함하지 않으며 개발·테스트·빌드 시작 전에 자동으로 갱신됩니다. 현재 지원하는 이미지 형식은 PNG입니다.

## GitHub Pages 배포

저장소 **Settings → Pages → Source**는 **GitHub Actions**를 사용합니다. `main`에 푸시하면 `.github/workflows/pages.yml`이 의존성 설치 → 테스트 → 빌드 → `dist` 배포를 실행합니다.

Vite가 코드, 스타일, 이미지에 내용 기반 해시 파일명을 붙입니다. 변경된 파일은 새 주소로 배포되어 이전 파일 캐시와 구분됩니다. GitHub Pages가 제공하는 HTML 캐시 정책은 별개입니다. 첫 전환 확인 시 `https://radiodown.github.io/webtoom/?v=2`처럼 새 쿼리로 접속할 수 있습니다.

저장소 이름을 바꾸면 `vite.config.js`의 `base: '/webtoom/'`도 맞춰 주세요. 이미지 원본 폴더는 보존하며 배포에는 빌드된 `dist`만 사용합니다.
