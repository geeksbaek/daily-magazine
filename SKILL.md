---
name: daily-magazine
description: 매일 KST 06시에 RSS 25개 + 트윗 20개 + Reddit RSS 8개 + 디시 특이점갤을 수집하여 GEEK/DAILY 매거진을 생성하고 GitHub Pages에 배포
---

매일 오전 6시 자동 실행 — GEEK/DAILY 매거진 생성 파이프라인.
RSS 27개 피드 + X 트윗 20개 계정 + Reddit 8개 서브레딧 + 디시인사이드 특이점이 온다 갤러리를 수집하고, 매거진 데이터(magazine.json)를 생성하여 GitHub Pages에 배포해줘.

## 전체 흐름
1. RSS 피드 27개 수집 (Python feedparser + jina.ai reader)
2. X 트윗 20개 계정 수집 (Chrome MCP)
3. Reddit 8개 서브레딧 수집 (Python feedparser — Reddit RSS 피드)
4. 디시인사이드 특이점이 온다 갤러리 수집 (Chrome MCP)
5. 수집된 데이터를 분석하여 magazine.json 생성
6. GitHub 레포에 push → Pages 자동 배포

## Step 1: RSS 피드 수집

Desktop Commander(mcp__Desktop_Commander__)로 Python 스크립트를 실행해서 RSS 피드를 수집해줘.

피드 목록 (daily-feed의 feeds.csv에서 가져옴):
/Users/jongyeol/GitHub/daily-feed/backend/feeds.csv

수집 방법:
1. start_process로 Python REPL 시작 (python3 -i)
2. feedparser로 각 피드 파싱, 24시간 이내 기사만 필터링
3. 각 기사의 실제 URL을 https://r.jina.ai/{url} 로 변환해서 마크다운 본문을 가져오기 (jina.ai reader는 무료 URL-to-markdown 서비스)
4. 결과를 JSON으로 저장

feedparser가 없으면: pip install feedparser --break-system-packages

## Step 2: X 트윗 수집

Chrome MCP(mcp__Claude_in_Chrome__)로 20개 계정의 최근 24시간 트윗을 수집해줘.

계정 목록:
- 개인: karpathy, sama, gdb, kevinweil, markchen90, miramurati, DarioAmodei, DanielaAmodei, jackclarkSF, ch402, AmandaAskell, alexalbert__, trq212, bcherny, felixrieseberg
- 공식: OpenAI, OpenAIDevs, ChatGPTapp, AnthropicAI, claudeai

수집 방법:
1. tabs_context_mcp로 탭 확보
2. 각 계정에 대해 navigate → wait 3초 → javascript_tool로 파싱:
```javascript
const articles = document.querySelectorAll('article[data-testid="tweet"]');
const now = Date.now();
const oneDayAgo = now - 24*60*60*1000;
const results = [];
articles.forEach(a => {
  const t = a.querySelector('[data-testid="tweetText"]');
  const time = a.querySelector('time');
  const nameEl = a.querySelector('[data-testid="User-Name"]');
  const text = t ? t.innerText : '';
  const dt = time ? time.getAttribute('datetime') : '';
  const ts = dt ? new Date(dt).getTime() : 0;
  const link = a.querySelector('a[href*="/status/"]');
  const href = link ? 'https://x.com' + link.getAttribute('href') : '';
  const linkHandle = href ? href.split('/')[3] : '';
  const displayName = nameEl ? nameEl.innerText.split('\n')[0] : '';
  if (text && ts > oneDayAgo) results.push({text, datetime: dt, link: href, actualHandle: linkHandle, displayName});
});
JSON.stringify(results);
```

**중요: 리트윗인 경우 링크의 handle과 프로필의 handle이 다를 수 있음. 트윗 URL에서 추출한 actualHandle을 author/handle로 사용할 것. 프로필 페이지의 handle로 덮어쓰지 말 것.**

## Step 3: Reddit 수집

**⚠️ Reddit은 Chrome MCP가 아닌 Python feedparser + Reddit RSS 피드로 수집할 것!**
Reddit 웹/JSON API는 403 차단되지만, `.rss` 엔드포인트는 feedparser로 정상 접근 가능.

서브레딧 목록:
- r/MachineLearning — AI/ML 연구
- r/LocalLLaMA — 로컬 LLM 실행·파인튜닝
- r/artificial — AI 일반
- r/OpenAI — OpenAI 소식
- r/ClaudeAI — Anthropic/Claude
- r/programming — 프로그래밍 일반
- r/singularity — 기술 특이점·미래
- r/ExperiencedDevs — 시니어 개발자 토론

수집 방법:
Desktop Commander(mcp__Desktop_Commander__)로 Python 스크립트를 실행:

```python
import feedparser
import json
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime

KST = timezone(timedelta(hours=9))
NOW = datetime.now(timezone.utc)
ONE_DAY_AGO = NOW - timedelta(hours=24)

subs = ['MachineLearning', 'LocalLLaMA', 'artificial', 'OpenAI', 'ClaudeAI', 'programming', 'singularity', 'ExperiencedDevs']

all_posts = []
for sub in subs:
    url = f'https://www.reddit.com/r/{sub}/hot.rss'
    d = feedparser.parse(url)
    for entry in d.entries:
        pub_dt = None
        if hasattr(entry, 'updated_parsed') and entry.updated_parsed:
            pub_dt = datetime(*entry.updated_parsed[:6], tzinfo=timezone.utc)
        if not pub_dt:
            continue
        if pub_dt < ONE_DAY_AGO:
            continue
        title = entry.get('title', '').strip()
        link = entry.get('link', '')
        # Self-Promotion, Weekly 등 고정글 제외
        if any(kw in title.lower() for kw in ['self-promotion', 'weekly', 'monthly', 'daily thread', 'megathread']):
            continue
        if title:
            all_posts.append({
                'title': title,
                'link': link,
                'score': 0,
                'subreddit': sub,
                'publishedAt': pub_dt.astimezone(KST).isoformat(),
            })

# 서브레딧별 상위 3개 선택 (hot 정렬 순서 유지)
selected = []
for sub in subs:
    sub_posts = [p for p in all_posts if p['subreddit'] == sub]
    selected.extend(sub_posts[:3])

with open('/tmp/reddit_results.json', 'w', encoding='utf-8') as f:
    json.dump(selected, f, ensure_ascii=False, indent=2)
```

**참고: Reddit RSS에서는 score(추천수) 정보가 제공되지 않음. hot 정렬 상위 순서로 가져오므로 score는 0으로 저장.**

각 게시물(RedditPost) 형식으로 저장:
```json
{
  "title": "게시물 제목 (원문 영어 그대로)",
  "datetime": "ISO datetime",
  "link": "https://www.reddit.com/r/.../comments/...",
  "score": 0,
  "subreddit": "MachineLearning"
}
```

결과를 /tmp/reddit_results.json 에 저장.

## Step 4: 디시인사이드 특이점이 온다 갤러리 수집

Chrome MCP로 디시인사이드 특이점이 온다 갤러리의 인기글을 수집해줘.

URL: `https://gall.dcinside.com/board/lists/?id=singularity&sort_type=N&exception_mode=recommend`
(추천 20개 이상 글만 노출하는 인기글 필터)

navigate 후 3초 대기, javascript_tool로 파싱:
```javascript
const now = Date.now();
const oneDayAgo = now - 24*60*60*1000;
const results = [];
document.querySelectorAll('tr.ub-content').forEach(row => {
  const titleEl = row.querySelector('.gall_tit a:not(.reply_num)');
  const title = titleEl ? titleEl.innerText.trim() : '';
  const link = titleEl ? titleEl.href : '';
  const dateEl = row.querySelector('.gall_date');
  const dateStr = dateEl ? dateEl.getAttribute('title') || dateEl.innerText.trim() : '';
  // 추천수
  const recommendEl = row.querySelector('.gall_recommend');
  const recommend = parseInt(recommendEl ? recommendEl.innerText.trim() : '0') || 0;
  // 조회수
  const viewEl = row.querySelector('.gall_count');
  const views = parseInt(viewEl ? viewEl.innerText.trim().replace(/,/g, '') : '0') || 0;
  // 날짜 파싱: "2026.03.28 14:30:00" 형식
  let ts = 0;
  if (dateStr) {
    const d = new Date(dateStr.replace(/\./g, '-').replace(' ', 'T'));
    ts = d.getTime();
    if (isNaN(ts)) {
      // "HH:MM" 형식이면 오늘 날짜
      const today = new Date().toISOString().slice(0, 10);
      const d2 = new Date(today + 'T' + dateStr + ':00+09:00');
      ts = d2.getTime();
    }
  }
  if (title && recommend >= 5) results.push({title, link, recommend, views, datetime: new Date(ts).toISOString()});
});
JSON.stringify(results.slice(0, 20));
```

**24시간 필터**: 파싱 후 datetime이 24시간 이내인 것만 유지.
결과를 /tmp/dcinside_results.json 에 저장.

## Step 5: magazine.json 생성

수집된 RSS 기사, 트윗, Reddit 게시물, 디시인사이드 게시물을 분석해서 다음 JSON 구조로 생성:

```json
{
  "date": "YYYY-MM-DD",
  "issueNumber": N,
  "cover": {
    "mainHeadline": "가장 중요한 뉴스 한국어 헤드라인",
    "mainExcerpt": "메인 기사 요약 (2-3문장)",
    "headlines": ["서브 헤드라인 1", "서브 헤드라인 2", "서브 헤드라인 3"]
  },
  "highlights": [상위 4-5개 주요 기사],
  "sections": {
    "ai_ml": [AI/ML 관련 기사들],
    "dev_tools": [개발 도구 관련 기사들],
    "big_tech": [빅테크 관련 기사들],
    "twitter_pulse": [트윗들],
    "reddit_pulse": [Reddit 게시물들],
    "community_pulse": [디시인사이드 게시물들],
    "quick_bites": [짧은 뉴스들]
  }
}
```

각 기사(Article) 형식:
```json
{
  "id": "유니크 ID",
  "title": "한국어 제목",
  "excerpt": "한국어 요약 (2-3문장, jina.ai로 가져온 본문 기반)",
  "body": "상세 본문 요약 (5-10문장). 원문 링크에 들어가지 않고도 기사 내용을 완전히 이해할 수 있도록 핵심 정보, 기술적 세부사항, 영향 분석을 포함해야 함. jina.ai로 가져온 본문을 꼼꼼히 읽고 작성할 것.",
  "url": "원문 URL",
  "source": "출처명",
  "category": "ai|dev_tools|big_tech|quick_bites",
  "publishedAt": "ISO datetime",
  "readTime": 5,
  "imageGradient": 0-7
}
```

**⚠️ readTime은 반드시 숫자(number)로 저장할 것! "3min" 같은 문자열 금지.**
**⚠️ body는 반드시 5문장 이상 작성. 배경 맥락, 기술 세부사항, 업계 영향까지 포함. excerpt만으로는 부족한 깊이를 body로 보완.**

각 트윗(Tweet) 형식:
```json
{
  "id": "트윗 ID",
  "author": "실제 트윗 작성자 이름",
  "handle": "실제 트윗 작성자 handle (URL에서 추출)",
  "content": "한국어 번역된 트윗 내용",
  "context": "트윗 맥락 설명 (2-4문장). 이 사람이 누구인지, 왜 이 트윗이 중요한지, 어떤 배경 지식이 필요한지 설명.",
  "url": "https://x.com/handle/status/ID",
  "publishedAt": "ISO datetime (KST)",
  "metrics": {"likes": 0, "retweets": 0, "replies": 0}
}
```

**⚠️ context 필드는 필수. 트윗만 읽으면 맥락을 모르는 독자가 이해 가능하도록 작성.**

각 Reddit 게시물(RedditPost) 형식:
```json
{
  "id": "유니크 ID",
  "title": "한국어 번역 제목",
  "originalTitle": "원문 영어 제목",
  "summary": "게시물 맥락 설명 (2-3문장). 왜 이 게시물이 화제인지, 어떤 배경이 있는지 설명.",
  "url": "https://www.reddit.com/r/.../comments/...",
  "subreddit": "MachineLearning",
  "score": 1234,
  "publishedAt": "ISO datetime"
}
```

각 디시인사이드 게시물(DcPost) 형식:
```json
{
  "id": "유니크 ID",
  "title": "게시물 제목 (원문 그대로)",
  "url": "https://gall.dcinside.com/...",
  "recommend": 42,
  "views": 1234,
  "publishedAt": "ISO datetime (KST)"
}
```

### issueNumber 계산 방법 (중요!)

```python
idx = json.load(open('/Users/jongyeol/GitHub/daily-magazine/public/data/index.json', encoding='utf-8'))
today_str = datetime.now(KST).strftime('%Y-%m-%d')

same_date_entry = next((x for x in idx['issues'] if x['date'] == today_str), None)
if same_date_entry:
    issue_number = same_date_entry['issueNumber']
else:
    issue_number = len(idx['issues']) + 1
```

핵심: 모든 텍스트는 한국어로 번역/작성. 실제 기사 본문을 읽고 요약해야 함. HTML 태그는 반드시 제거할 것.

## Step 6: GitHub에 push

1. 생성된 magazine.json을 /Users/jongyeol/GitHub/daily-magazine/public/data/{날짜}/magazine.json에 저장
2. index.json 업데이트 — **날짜 기준 upsert (덮어쓰기), 최신 이슈가 맨 앞에 오도록 유지**:

```python
idx = json.load(open(idx_path, encoding='utf-8'))
today_str = magazine['date']

new_entry = {
    "date": today_str,
    "issueNumber": magazine['issueNumber'],
    "mainHeadline": magazine['cover']['mainHeadline'],
    "headlines": magazine['cover']['headlines']
}

existing_idx = next((i for i, x in enumerate(idx['issues']) if x['date'] == today_str), None)
if existing_idx is not None:
    idx['issues'][existing_idx] = new_entry
else:
    idx['issues'].insert(0, new_entry)

json.dump(idx, open(idx_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
```

3. Desktop Commander로:
   ```
   cd /Users/jongyeol/GitHub/daily-magazine
   git add public/data/
   git commit -m "Add magazine issue #{N} - {날짜}"
   git push origin main
   ```
4. GitHub Actions가 자동으로 빌드+배포 (pages.yml)

## 주의사항
- Chrome이 열려있고 Claude in Chrome 확장이 연결된 상태에서만 트윗/디시 수집 가능
- Reddit은 Chrome이 없어도 feedparser로 수집 가능 (RSS 피드 사용)
- jina.ai reader (r.jina.ai)가 rate limit에 걸리면 잠시 대기 후 재시도
- 모든 시간은 KST 기준
- 기사 본문을 꼭 읽고 요약할 것 (RSS description만 읽지 말 것)
- 24시간 이내 기사/트윗/게시물이 없으면 해당 섹션을 비워두되, 최소한 cover와 highlights는 채울 것
- HTML 태그가 excerpt에 절대 포함되지 않도록 strip_html() 처리 필수

## ⚠️ 데이터 품질 체크리스트 (필수)
magazine.json 생성 후 반드시 확인:
- [ ] readTime이 모두 숫자(number)인지 확인
- [ ] 각 트윗의 author/handle이 url의 작성자와 일치하는지 확인
- [ ] 이미지 URL을 포함하지 않을 것 (그래디언트 플레이스홀더 사용)
- [ ] excerpt에 HTML 태그 없음 확인
- [ ] Reddit URL이 RSS에서 실제로 파싱한 링크인지 확인 (임의 생성 금지)
- [ ] 디시인사이드 URL이 실제로 파싱한 링크인지 확인

## ⚠️ URL 검증 체크리스트 (필수 — 재발 방지)
magazine.json의 모든 URL을 생성 후 반드시 검증:

### 트윗 URL 검증
- [ ] 모든 트윗 URL이 Chrome MCP에서 실제로 파싱한 href에서 온 것인지 확인. **절대로 URL을 임의 생성하지 말 것!**
- [ ] status ID가 Twitter Snowflake ID 형식인지 확인 (18-19자리 숫자, 라운드 넘버 아님)
- [ ] status ID가 0으로 끝나는 라운드 넘버(예: 2037590000000000000)이면 가짜이므로 제거
- [ ] Chrome에서 파싱하지 못한 트윗은 URL을 만들어내지 말고, 해당 항목 자체를 제외할 것

### Reddit URL 검증
- [ ] 모든 Reddit URL이 /r/{subreddit}/comments/ 형식인지 확인
- [ ] Reddit RSS(feedparser)에서 실제로 파싱한 링크인지 확인 (임의 생성 금지)
- [ ] 24시간 이내 게시물만 포함됐는지 확인

### 디시인사이드 URL 검증
- [ ] 모든 URL이 gall.dcinside.com 도메인인지 확인
- [ ] 실제로 파싱한 링크인지 확인

### 공통 규칙
- **Chrome MCP나 RSS(feedparser)에서 실제로 가져온 URL만 사용할 것**
- **수집하지 못한 데이터에 대해 URL을 만들어내지 말 것**
- **의심스러운 URL은 해당 항목을 제외하는 것이 가짜 URL을 넣는 것보다 나음**