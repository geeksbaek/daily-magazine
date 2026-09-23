# GEEK/DAILY

매일 아침 자동 발행되는 개발자·AI 뉴스 매거진. https://geeksbaek.github.io/daily-magazine/

- 프런트엔드: React + Vite + Tailwind (정적 사이트, GitHub Pages)
- 데이터: `public/data/<date>/magazine.json`, 목차 `public/data/index.json`
- 파이프라인: [`docs/PIPELINE.md`](docs/PIPELINE.md) — 수집·중복 제거·검증·발행은 `scripts/`의 스크립트가, 선정·번역은 스케줄된 Claude 작업([`SKILL.md`](SKILL.md))이 담당

```bash
npm install && npm run dev      # 사이트
bash scripts/setup.sh           # 파이프라인 의존성 (feedparser, playwright)
bash scripts/collect_all.sh     # 오늘 후보 수집
```

## 디자인

상단 네비게이션의 디자인 버튼으로 다섯 가지 디자인(대판 신문·스위스·읽기 모드·콘솔·터미널)을 고를 수 있다. 선택은 브라우저에 저장되고 `?design=<id>`로 지정할 수도 있다.

- 디자인 하나 = `src/designs/<id>/meta.json` + `style.css`. 폴더를 추가하면 자동 등록된다(`src/designs/registry.ts`).
- `style.css`의 모든 규칙은 `[data-design="<id>"]` 아래로 한정한다. 공통 구조는 컴포넌트의 `data-part` 속성으로 겨냥한다.
- 폰트는 `meta.json`의 `fonts`에 적으면 해당 디자인이 선택됐을 때만 불러온다.
- 기본값은 `order`가 가장 낮은 디자인이다. 새 디자인을 넣으면 `index.html`의 초기 로딩 스크립트 목록(`ok` 배열)에도 id를 추가한다.
