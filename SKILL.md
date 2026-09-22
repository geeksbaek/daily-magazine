---
name: daily-magazine
description: 매일 KST 06시 — RSS 70여 개·Anthropic/Claude 사이트·Hacker News·Reddit·X 팔로잉 전체·Threads 를 결정론적 스크립트로 수집하고, 후보 중에서 큐레이션·번역해 GEEK/DAILY 매거진을 발행
---

매일 오전 6시 자동 실행 — GEEK/DAILY 매거진 발행 파이프라인.

## 역할 분담 (가장 중요한 원칙)

| 단계 | 담당 | 산출물 |
|---|---|---|
| 수집·정규화·중복 제거·후보 생성 | **스크립트** (`scripts/collect_all.sh`) | `candidates.json`, `candidates_brief.md` |
| 큐레이션(선정) + 한국어 번역/요약 | **LLM (이 세션)** | `draft.json` **만** 작성 |
| URL·날짜·작성자·metrics 결합, 검증, 발행 | **스크립트** (`assemble.py` → `validate.py` → `publish.py`) | `magazine.json`, git push |

- LLM은 **URL, 날짜, handle, 숫자를 절대 직접 쓰지 않는다.** draft.json에는 후보의 `id`와 한국어 텍스트만 넣는다.
- 후보에 없는 항목은 존재하지 않는 것이다. 기억이나 추측으로 기사·트윗을 만들지 않는다.
- 스크립트가 거부(exit ≠ 0)하면 draft.json을 고쳐서 다시 돌린다. 스크립트나 설정을 고쳐서 통과시키지 않는다.

## 실행 환경

- 모든 명령은 **Desktop Commander(`mcp__Desktop_Commander__start_process`)로 호스트에서** 실행한다. (git 자격증명·Playwright 브라우저 프로필은 호스트에만 있다.)
- 레포: `/Users/jongyeol/GitHub/daily-magazine` — 아래 명령은 모두 이 디렉터리에서 실행.
- 실행 디렉터리: `/tmp/daily-magazine/<YYYY-MM-DD>/` (수집 원본, 후보, draft, 결과가 모두 여기 남는다.)

## Step 1: 수집 (스크립트, 최대 25분)

```bash
cd /Users/jongyeol/GitHub/daily-magazine && bash scripts/collect_all.sh
```

- 끝나면 `---- summary` 아래에 소스별 상태(`complete/partial/failed`)와 후보 건수가 출력된다. 이 요약을 최종 리포트에 그대로 옮긴다.
- `X: not logged in` 이 뜨면 X 수집은 이번 호에서 제외한다(twitter_pulse 빈 배열). 로그인은 사람이 `python3 scripts/x_login.py` 로 한 번 해줘야 한다 — 리포트에 명시할 것.
- 한 소스가 실패해도 진행한다. 단, 후보 기사(articles)가 20건 미만이면 발행하지 않고 원인(collect.log)을 리포트한다.

## Step 2: 후보 읽고 선정

1. `/tmp/daily-magazine/<날짜>/candidates_brief.md` 를 읽는다 (카테고리별 한 줄 목록. `cluster=`는 같은 스토리 묶음, `seenStory=`는 최근 호에 실린 스토리와 유사, `NNh`는 24시간이 지난 기사).
2. 선정 후보의 상세는 `candidates.json`에서 해당 `id` 항목을 찾아 읽는다 (`content`/`description`, 트윗 `text`/`thread`/`quoted`, 레딧 `body`).

### 선정 규칙 (validate.py가 기계적으로 검사한다)

- 섹션별 건수: highlights 4–5 · ai_ml 4–6 · dev_tools 3–5 · big_tech 3–4 · quick_bites 4–6 · twitter_pulse 5–8 · reddit_pulse 3–5 · threads_pulse 0–2. 후보가 부족하면 적게 싣는다(억지로 채우지 않는다).
- **모든 항목은 배타적**: 같은 기사가 highlights와 섹션에, 또는 두 섹션에 동시에 들어갈 수 없다. highlights에 넣은 기사는 섹션에서 뺀다.
- **같은 스토리는 1건**: `cluster`가 같은 기사 중 1건만. 클러스터 표시가 없어도 내용이 같은 사건(예: 발표 원문 + 매체 보도)이면 1차 출처(T1) 1건만 싣는다.
- `seenStory=` 표시 기사는 새로운 사실이 있는 실질적 후속 보도일 때만 싣는다.
- 상한: 같은 publisher 3건, 같은 트윗 작성자 2건, 같은 서브레딧 2건.
- 우선순위: 24시간 이내(fresh) > T1(1차 출처) > 개발자·AI 실무 관련성 > 화제성(HN points, 트윗 engagement). 정치·사회 일반 기사는 기술 산업에 직접 영향이 있을 때만.
- highlights는 그날 가장 중요한 기사 4–5건(카테고리 불문). cover.mainHeadline은 highlights[0], cover.headlines는 highlights[1..3]를 요약한 것.
- quick_bites: Hacker News·Lobsters·GeekNews·한국 기술블로그 등 짧게 소개할 만한 것.
- 트윗: 리트윗(`RT by @…`)도 가능하지만 원작성자 기준으로 판단. 같은 내용의 트윗·기사는 하나만.

## Step 3: draft.json 작성

`/tmp/daily-magazine/<날짜>/draft.json` 에 아래 형식으로 저장한다. **허용된 필드 외에는 아무것도 넣지 않는다.**

```json
{
  "cover": {"mainHeadline": "…", "mainExcerpt": "…(2–3문장)", "headlines": ["…", "…", "…"]},
  "highlights": [{"id": "rss_xxxxxxxxxx", "title": "…", "excerpt": "…", "body": "…"}],
  "sections": {
    "ai_ml":      [{"id": "…", "title": "…", "excerpt": "…", "body": "…"}],
    "dev_tools":  [{"id": "…", "title": "…", "excerpt": "…", "body": "…"}],
    "big_tech":   [{"id": "…", "title": "…", "excerpt": "…", "body": "…"}],
    "quick_bites":[{"id": "…", "title": "…", "excerpt": "…"}],
    "twitter_pulse": [{"id": "tw_…", "content": "…", "context": "…", "thread": ["…"], "quotedContent": "…"}],
    "reddit_pulse":  [{"id": "rd_…", "title": "…", "summary": "…"}],
    "threads_pulse": [{"id": "th_…", "content": "…", "context": "…"}]
  }
}
```

### 번역·작성 규칙

- **모든 텍스트는 한국어.** 제목·요약·본문·트윗 content·context·레딧 title·summary 전부. 영어 원문 그대로 저장 금지 (고유명사·제품명은 원문 유지 가능).
- `title`: 한국어 헤드라인 (원문 직역이 아니라 핵심이 드러나는 제목).
- `excerpt`: 2–3문장 요약(훅). 여기서 한 말은 body에서 반복하지 않는다.
- `body`: **원문을 읽지 않아도 내용을 온전히 이해할 수 있는 장문 요약.** 후보의 `contentSource`가 `jina`/`direct`/`feed`(본문 확보)인 highlights·ai_ml·dev_tools·big_tech 기사에는 **필수**, quick_bites와 `contentSource: description`(요약문만 있음)인 기사에는 **생략**(넣으면 assemble이 거부).
  - 분량: 600–1200자, 3–5문단. 문단은 빈 줄(`\n\n`)로 구분.
  - 구성: ① 무슨 일이 있었나(구체 수치·이름·날짜) ② 어떻게 동작하나/무엇이 바뀌나(기술·제품 세부) ③ 배경과 맥락(왜 지금, 경쟁·선행 사례) ④ 의미와 한계(독자에게 주는 시사점, 원문이 밝힌 제약·미공개 사항).
  - excerpt의 문장을 그대로 또는 살짝 바꿔 반복하면 안 된다. validate.py가 excerpt와의 중복률·길이 비율을 검사해 거부한다.
  - 후보 `content`에 있는 사실만 쓴다. 본문에 없는 수치·인용을 만들지 않는다.
- 트윗 `content`: 원문 번역. 후보에 `thread`가 있으면 **같은 개수**로 각 항목을 번역해 `thread`에 넣는다(필수). 후보에 `quoted`가 있으면 `quotedContent`에 인용 트윗 번역(필수). 후보의 `linkedArticleIds`에 있는 기사를 함께 실으면 검증에서 거부된다(같은 사건 중복).
- `context`/`summary`: 배경을 모르는 독자를 위한 2–3문장 맥락 설명 (작성자가 누구인지, 왜 주목할 만한지).
- HTML 태그, 마크다운, 이모지 남발 금지.

## Step 4: 조립 + 검증 (통과할 때까지, 최대 3회)

```bash
cd /Users/jongyeol/GitHub/daily-magazine && python3 scripts/assemble.py && python3 scripts/validate.py
```

- `assemble.py`가 draft의 id로 후보를 찾아 URL·날짜·작성자·metrics를 결합해 `magazine.json`을 만든다. 모르는 id, 허용되지 않은 필드가 있으면 거부한다.
- `validate.py`는 배타성(중복 URL/id/클러스터), 과거 14호 재사용, 건수 상한, 한국어, 날짜 범위를 검사한다. `❌`가 있으면 해당 항목을 draft.json에서 고치고(교체 또는 삭제) 다시 실행. `⚠️`(최소 건수 미달 등)는 후보가 부족한 경우이므로 그대로 진행 가능.
- 3회 안에 통과하지 못하면 발행하지 않고 오류 목록을 리포트한다.

## Step 5: 발행 (호스트에서)

```bash
cd /Users/jongyeol/GitHub/daily-magazine && python3 scripts/publish.py
```

- 검증을 다시 실행한 뒤 `public/data/<날짜>/magazine.json` 저장, `index.json` 갱신(맨 앞 insert), commit, push, `HEAD == origin/main` 확인, GitHub Pages에 새 호가 실제로 서빙될 때까지(최대 6분) 대기한다.
- 출력에 `PUSH_OK` 와 `DEPLOY_OK` 가 모두 있어야 완료다. `DEPLOY_PENDING`이면 push는 됐고 배포만 지연 중 — 리포트에 그렇게 적는다.

## Step 6: 리포트

다음을 간결하게 남긴다: 호수·날짜, Step 1 요약(소스별 상태·건수), 섹션별 최종 건수, 제외된 소스와 이유(X 미로그인 등), 검증에서 고친 내용, PUSH/DEPLOY 상태.

## 금지 사항

- draft.json 외의 파일(scripts/, config/, public/data/, 이 프롬프트)을 수정하지 않는다.
- 샌드박스 bash로 git을 실행하지 않는다 (호스트 Desktop Commander만).
- 후보에 없는 항목, 후보와 다른 URL/날짜/handle을 만들지 않는다.
- community_pulse 섹션을 만들지 않는다.
- 이 프롬프트를 수정하지 말 것.
