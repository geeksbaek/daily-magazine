# GEEK/DAILY 수집·발행 파이프라인

매일 06:00 KST, Claude 데스크톱 스케줄 작업이 [`SKILL.md`](../SKILL.md)를 실행한다.
수집·검증·발행은 전부 `scripts/`의 결정론적 스크립트가 하고, LLM은 **선정 + 한국어 번역**만 한다.

```
collect_all.sh ─┬─ collect_rss.py      config/feeds.csv (70+ 피드, tier/publisher)  → rss.json
                ├─ collect_sites.py    RSS 없는 사이트(Anthropic news/research/engineering, claude.com/blog)
                │                      sitemap.xml 로 후보 → 페이지의 실제 게시일 추출     → sites.json
                ├─ collect_hn.py       HN Algolia API, 48h·≥100pt                    → hn.json
                ├─ collect_reddit.py   /r/<sub>/top/.rss?t=day (JSON API는 차단됨)    → reddit.json
                ├─ collect_x.py        Playwright: 팔로잉 전체 → Following 타임라인   → x.json, x_following.json
                └─ collect_threads.py  Playwright: 공개 프로필                       → threads.json
                     └─ build_candidates.py  창·중복·클러스터·히스토리·상한 적용     → candidates.json / candidates_brief.md
LLM ── draft.json (id + 한국어 텍스트만)
assemble.py  후보에서 URL/날짜/작성자/metrics 결합                              → magazine.json
validate.py  배타성·클러스터·과거 14호·상한·한국어·날짜 검사 (exit≠0 → 발행 불가)
publish.py   재검증 → public/data/<date>/ + index.json → commit/push → Pages 서빙 확인
```

## 결정론을 위한 규칙

- **as_of**: `collect_all.sh`가 시작 시각을 `DM_AS_OF`/`<run_dir>/as_of.txt`에 고정한다. 모든 창(72h 수집, 48h 발행, 24h fresh)이 이 시각 기준.
- **run_dir**: `/tmp/daily-magazine/<KST 날짜>/`. 원본 응답(`x_raw/`, `threads_raw/`), jina 본문, 후보, draft, 결과가 모두 남아 같은 원본에서 같은 candidates가 재생성된다.
- **원자적 저장**: 모든 JSON은 tmp → rename. 타임아웃으로 반쪽짜리 파일이 남지 않는다.
- **id**: 플랫폼 id 우선(`tw_<tweet id>`, `rd_<post id>`, `hn_<item id>`, `th_<code>`), 기사는 `rss_<sha1(dedupe_key)[:10]>`.
- **dedupe_key**: 발행 URL은 원본 그대로. 중복 판정에만 쓰는 보수적 정규화(https, host 소문자, www 제거, utm/fbclid 등 제거, trailing slash 제거, reddit 슬러그 제거).
- **정렬/동점**: 모든 목록은 (기준값, id/url) 튜플로 정렬해 동점 순서가 고정된다.

## 중복 방지 (4겹)

1. `build_candidates.py`: 같은 dedupe_key 1건, 과거 14호 URL 제외, 제목 유사도로 `seenStory` 표시.
2. 같은 스토리 클러스터링: 링크 URL 일치 → 제목 토큰(어간 처리) Jaccard ≥ 0.5 또는 공유 토큰 ≥ 3 & 짧은 제목의 60% 이상. 대표는 tier가 낮은(1차) 출처.
3. LLM 규칙: highlights와 섹션 배타, 클러스터당 1건, 의미상 같은 사건 1건.
4. `validate.py`: highlights + 모든 섹션에서 URL/id/클러스터 중복 → 오류. 과거 14호 URL 재사용 → 오류. publisher 3 / 트윗 작성자 2 / 서브레딧 2 초과 → 오류. CI(`--ci`)에서도 최신 호를 다시 검사한다.

## X 수집 상세 (`collect_x.py`)

- 전용 Chromium 프로필(`~/.daily-magazine/x-profile`)에 **한 번** `python3 scripts/x_login.py`로 로그인한다. 이후 headless로 재사용. 로그인 계정이 `config/sources.json → x.user`와 다르면 중단(exit 2).
- 팔로잉 목록: `x.com/<user>/following`을 스크롤하며 `Following` GraphQL 응답을 가로채 user id + handle 수집. `friends_count`와 비교해 `complete/partial` 기록 → `x_following.json`.
- 트윗: `x.com/home`의 **Following** 탭(팔로잉 계정의 최신순 피드)을 스크롤하며 `HomeLatestTimeline` 응답을 가로채 48h 창까지 수집. promoted 제외, 팔로우하지 않는 계정 제외, 비공개 계정 제외.
- 정책(`config/sources.json`): 리트윗 포함(원작성자 기준, `retweetedBy` 기록), 타인에 대한 답글 제외, 자기 답글은 루트 트윗의 `thread`로 병합.
- 폴백: GraphQL 응답이 0건이면 DOM 파싱, 타임라인이 5건 미만이면 계정별 방문(`--mode accounts`).
- 스키마 변화 대비: `__typename == "Tweet"/"User"`를 재귀 탐색하고, `legacy`/`core` 두 위치의 이름 필드를 모두 지원.

## 소스 추가/제거

- RSS: `config/feeds.csv`에 한 줄 추가 (`Tier` 1=발표 주체의 1차 출처, 2=정평 있는 매체/필자, 3=커뮤니티·집계. `Publisher`는 상한 계산 단위).
  추가 전 `python3 -c "import feedparser; print(len(feedparser.parse(URL).entries))"` 로 살아있는지 확인.
- RSS가 없는 사이트: `config/sources.json → sites` (sitemap URL + include 정규식 + category/tier). sitemap `lastmod`는 재발행 때 갱신되므로 창 사전 필터로만 쓰고, 게시일은 페이지 본문의 첫 날짜(JSON-LD/og meta 우선)에서 읽는다.
- Reddit/HN/X/Threads: `config/sources.json`.

## 수동 실행

```bash
bash scripts/setup.sh            # 최초 1회: feedparser, playwright, chromium
python3 scripts/x_login.py       # 최초 1회: X 로그인
bash scripts/collect_all.sh      # 수집 + 후보
#   … draft.json 작성 …
python3 scripts/assemble.py && python3 scripts/validate.py
python3 scripts/publish.py       # --dry-run: 파일만 쓰고 git 생략, --no-push: 커밋만
```

특정 날짜를 다시 만들려면 `DM_AS_OF=2026-09-22T06:00:00+09:00 DM_RUN_DIR=/tmp/daily-magazine/2026-09-22 bash scripts/collect_all.sh`.
