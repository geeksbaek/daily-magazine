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
