---
name: daily-magazine
description: 매일 KST 06시에 RSS 25개 + 트윗 20개 + Reddit RSS 8개를 수집하여 GEEK/DAILY 매거진을 생성하고 GitHub Pages에 배포
---

매일 오전 6시 자동 실행 — GEEK/DAILY 매거진 생성 파이프라인.
RSS 피드 + X 트윗 20개 계정 + Reddit 8개 서브레딧을 수집하고, 매거진 데이터(magazine.json)를 생성하여 GitHub Pages에 배포해줘.

## ⚠️ 한국어 번역 필수 규칙 (모든 텍스트에 적용)

**수집된 모든 텍스트는 반드시 한국어로 번역/작성해야 한다.**
- RSS 기사 title, excerpt, body → 한국어 번역
- 트윗 content → 한국어 번역 (원문 영어 그대로 저장 금지)
- Reddit title → 한국어 번역 (originalTitle에 원문 보존)
- Reddit summary → 한국어로 맥락 설명
- 트윗 context → 한국어로 맥락 설명
- 커버 headline, excerpt → 한국어
- 영어/한국어 섞어 쓰지 말 것 — 모두 한국어로 통일

## 전체 흐름
1. RSS 피드 수집 (Python feedparser + jina.ai reader)
2. X 트윗 20개 계정 수집 (Claude in Chrome MCP)
3. Reddit 8개 서브레딧 수집 (Python feedparser — Reddit RSS 피드)
4. 수집된 데이터를 분석하여 magazine.json 생성
5. GitHub 레포에 push → Pages 자동 배포

## ⚠️ 경로 관련 중요 사항

이 스킬은 **Desktop Commander MCP**를 통해 실행된다.

| 작업 | 사용할 경로 |
|---|---|
| Python 스크립트 실행 | `mcp__Desktop_Commander__start_process` 사용 |
| 파일 읽기/쓰기 | `/Users/jongyeol/GitHub/daily-magazine/...` 직접 접근 |
| 임시 데이터 파일 | `/tmp/rss_results.json`, `/tmp/twitter_results.json`, `/tmp/reddit_results.json` |
| feeds.csv | `/Users/jongyeol/GitHub/daily-feed/backend/feeds.csv` |

**Desktop Commander로 Python 스크립트를 파일로 저장 후 실행하는 방식 사용.**

## Step 1: RSS 피드 수집

`mcp__Desktop_Commander__start_process`로 Python 스크립트를 실행:

피드 목록은 `/Users/jongyeol/GitHub/daily-feed/backend/feeds.csv`에서 읽어오기.
(컬럼: Title, RSS URL, Website, Category)

```python
import csv, feedparser, json, re, time
from datetime import datetime, timezone, timedelta
from urllib.request import urlopen, Request

KST = timezone(timedelta(hours=9))
NOW = datetime.now(timezone.utc)
THREE_DAYS_AGO = NOW - timedelta(hours=72)  # 주말 대비 72시간 윈도우

def strip_html(text):
    if not text: return ''
    t = re.sub(r'<[^>]+>', '', text)
    for old, new in [('&amp;','&'),('&lt;','<'),('&gt;','>'),('&nbsp;',' ')]:
        t = t.replace(old, new)
    return re.sub(r'\s+', ' ', t).strip()

def parse_dt(entry):
    for attr in ['published_parsed', 'updated_parsed']:
        val = getattr(entry, attr, None)
        if val:
            try: return datetime(*val[:6], tzinfo=timezone.utc)
            except: pass
    return None

def fetch_jina(url, timeout=12):
    try:
        req = Request(f'https://r.jina.ai/{url}', headers={'User-Agent': 'Mozilla/5.0', 'Accept': 'text/plain'})
        with urlopen(req, timeout=timeout) as resp:
            return strip_html(resp.read().decode('utf-8', errors='replace'))[:2500]
    except: return ''

feeds = list(csv.DictReader(open('/Users/jongyeol/GitHub/daily-feed/backend/feeds.csv')))
all_articles = []

for feed_info in feeds:
    url = feed_info['RSS URL'].strip()
    source = feed_info['Title'].strip()
    category = feed_info['Category'].strip()
    try:
        d = feedparser.parse(url)
        for entry in d.entries[:15]:
            pub_dt = parse_dt(entry)
            if not pub_dt or pub_dt < THREE_DAYS_AGO: continue
            title = strip_html(entry.get('title', ''))
            link = entry.get('link', '')
            desc = strip_html(entry.get('summary', '') or entry.get('description', ''))
            if not title or not link: continue
            all_articles.append({
                'title': title, 'url': link, 'source': source,
                'category': category,
                'publishedAt': pub_dt.astimezone(KST).isoformat(),
                'description': desc[:600]
            })
    except Exception as e:
        print(f"✗ {source}: {e}")

# jina.ai로 주요 기사 본문 수집 (상위 15개)
priority_sources = ['OpenAI News', 'DeepMind', 'Google DeepMind', 'Hugging Face - Blog',
                    'LangChain Blog', 'Gemini', 'AI & Machine Learning', 'GitHub Blog',
                    'Cloudflare Blog', 'NVIDIA Blog', 'Apple Newsroom', 'Microsoft AI Blogs']

priority = [a for a in all_articles if a['source'] in priority_sources][:15]
for i, art in enumerate(priority):
    content = fetch_jina(art['url'])
    art['full_content'] = content if content else art['description']
    time.sleep(0.3)

for art in all_articles:
    if 'full_content' not in art:
        art['full_content'] = art['description']

with open('/tmp/rss_results.json', 'w', encoding='utf-8') as f:
    json.dump(all_articles, f, ensure_ascii=False, indent=2)
print(f"Saved {len(all_articles)} articles")
```

## Step 2: X 트윗 수집

**Chrome MCP(mcp__Claude_in_Chrome__)** 로 20개 계정의 최근 48시간 트윗을 수집 (주말 대비 48h).

계정 목록:
- 개인: karpathy, sama, gdb, kevinweil, markchen90, miramurati, DarioAmodei, DanielaAmodei, jackclarkSF, ch402, AmandaAskell, alexalbert__, trq212, bcherny, felixrieseberg
- 공식: OpenAI, OpenAIDevs, ChatGPTapp, AnthropicAI, claudeai

### 수집 절차

1. `tabs_context_mcp(createIfEmpty: true)` 호출 → tabId 확보
2. 각 계정에 대해: `navigate` → 3초 대기 → `javascript_tool`로 파싱

```javascript
const articles = document.querySelectorAll('article[data-testid="tweet"]');
const now = Date.now();
const twoDaysAgo = now - 48*60*60*1000;
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
  if (text && ts > twoDaysAgo) results.push({text, datetime: dt, link: href, actualHandle: linkHandle, displayName});
});
JSON.stringify(results);
```

**중요: 리트윗인 경우 URL에서 추출한 actualHandle을 handle로 사용. 프로필 handle로 덮어쓰지 말 것.**

3. 수집된 트윗을 `/tmp/twitter_results.json`에 저장

## Step 3: Reddit 수집

**⚠️ Python feedparser로만 수집 (Chrome MCP 사용 금지)**

서브레딧 목록:
- r/MachineLearning, r/LocalLLaMA, r/artificial, r/OpenAI, r/ClaudeAI, r/programming, r/singularity, r/ExperiencedDevs

```python
import feedparser, json
from datetime import datetime, timezone, timedelta

KST = timezone(timedelta(hours=9))
NOW = datetime.now(timezone.utc)
ONE_DAY_AGO = NOW - timedelta(hours=24)

subs = ['MachineLearning', 'LocalLLaMA', 'artificial', 'OpenAI', 'ClaudeAI', 'programming', 'singularity', 'ExperiencedDevs']
all_posts = []

for sub in subs:
    d = feedparser.parse(f'https://www.reddit.com/r/{sub}/hot.rss')
    for entry in d.entries:
        pub_dt = None
        if hasattr(entry, 'updated_parsed') and entry.updated_parsed:
            pub_dt = datetime(*entry.updated_parsed[:6], tzinfo=timezone.utc)
        if not pub_dt or pub_dt < ONE_DAY_AGO: continue
        title = entry.get('title', '').strip()
        link = entry.get('link', '')
        if any(kw in title.lower() for kw in ['self-promotion','weekly','monthly','daily thread','megathread']): continue
        if title:
            all_posts.append({'title': title, 'link': link, 'score': 0,
                             'subreddit': sub, 'publishedAt': pub_dt.astimezone(KST).isoformat()})

selected = []
for sub in subs:
    selected.extend([p for p in all_posts if p['subreddit'] == sub][:3])

with open('/tmp/reddit_results.json', 'w', encoding='utf-8') as f:
    json.dump(selected, f, ensure_ascii=False, indent=2)
print(f"Saved {len(selected)} posts")
```

## Step 4: magazine.json 생성

수집된 RSS 기사, 트윗, Reddit 게시물을 분석해서 다음 JSON 구조로 생성:

```json
{
  "date": "YYYY-MM-DD",
  "issueNumber": N,
  "cover": {
    "mainHeadline": "가장 중요한 뉴스 한국어 헤드라인",
    "mainExcerpt": "메인 기사 요약 (2-3문장, 한국어)",
    "headlines": ["서브 헤드라인 1 (한국어)", "서브 헤드라인 2", "서브 헤드라인 3"]
  },
  "highlights": [상위 4-5개 주요 기사],
  "sections": {
    "ai_ml": [AI/ML 관련 기사들],
    "dev_tools": [개발 도구 관련 기사들],
    "big_tech": [빅테크 관련 기사들],
    "twitter_pulse": [트윗들],
    "reddit_pulse": [Reddit 게시물들],
    "quick_bites": [짧은 뉴스들]
  }
}
```

**community_pulse 섹션은 없음 — sections에 포함하지 말 것.**

### 각 기사(Article) 형식

```json
{
  "id": "rss_001",
  "title": "한국어로 번역된 제목",
  "excerpt": "한국어 요약 (2-3문장, jina.ai 본문 기반)",
  "url": "원문 URL",
  "source": "출처명",
  "category": "ai_ml|dev_tools|big_tech|quick_bites",
  "publishedAt": "ISO datetime (KST)",
  "readTime": 5,
  "imageGradient": 0
}
```

**⚠️ readTime은 반드시 숫자(number). "3min" 같은 문자열 금지.**
**⚠️ title, excerpt 모두 반드시 한국어. 영어 제목 그대로 저장 금지.**

### 각 트윗(Tweet) 형식

```json
{
  "id": "tweet_001",
  "author": "실제 작성자 이름 (영문 가능)",
  "handle": "actualHandle (URL에서 추출)",
  "content": "반드시 한국어로 번역된 트윗 내용",
  "context": "이 트윗의 맥락 설명 (한국어, 2-3문장). 작성자가 누구인지, 왜 주목할 만한지 설명.",
  "url": "https://x.com/handle/status/ID",
  "publishedAt": "ISO datetime",
  "metrics": {"likes": 0, "retweets": 0, "replies": 0}
}
```

**⚠️ content는 반드시 한국어 번역본. 영어 원문 그대로 저장 금지.**
**⚠️ context는 필수 필드. 트윗만으로 맥락을 모르는 독자가 이해할 수 있도록 작성.**

### 각 Reddit 게시물(RedditPost) 형식

```json
{
  "id": "reddit_001",
  "title": "한국어로 번역된 제목",
  "originalTitle": "원문 영어 제목 그대로",
  "summary": "이 게시물의 맥락 설명 (한국어, 2-3문장). 왜 화제인지, 어떤 배경이 있는지.",
  "url": "https://www.reddit.com/r/.../comments/...",
  "subreddit": "MachineLearning",
  "score": 0,
  "publishedAt": "ISO datetime (KST)"
}
```

**⚠️ title은 반드시 한국어 번역. originalTitle에 영어 원문 보존.**
**⚠️ summary는 필수 필드. 한국어로 맥락 설명.**

### issueNumber 계산

```python
from datetime import datetime, timedelta, timezone
import json

KST = timezone(timedelta(hours=9))
today_str = datetime.now(KST).strftime('%Y-%m-%d')
idx_path = '/Users/jongyeol/GitHub/daily-magazine/public/data/index.json'
idx = json.load(open(idx_path, encoding='utf-8'))
same_date = next((x for x in idx['issues'] if x['date'] == today_str), None)
issue_number = same_date['issueNumber'] if same_date else len(idx['issues']) + 1
```

## Step 5: GitHub에 push

1. magazine.json을 `/Users/jongyeol/GitHub/daily-magazine/public/data/{날짜}/magazine.json`에 저장
2. index.json 업데이트 (날짜 기준 upsert, 최신이 맨 앞)
3. Desktop Commander로 git 명령 실행:

```bash
cd /Users/jongyeol/GitHub/daily-magazine && git add public/data/ && git commit -m "Add magazine issue #{N} - {날짜}" && git push origin main
```

## Step 5.5: magazine.json 구조 검증 (필수)

push 전에 반드시 실행:

```python
import json, re
mag = json.load(open(f'/Users/jongyeol/GitHub/daily-magazine/public/data/{today_str}/magazine.json', encoding='utf-8'))
errors = []

# sections 구조 검증
for key in ['ai_ml', 'dev_tools', 'big_tech', 'quick_bites', 'twitter_pulse', 'reddit_pulse']:
    val = mag['sections'].get(key)
    if val is not None and not isinstance(val, list):
        errors.append(f"sections.{key}가 list가 아님")

# readTime 숫자 확인
for key in ['ai_ml', 'dev_tools', 'big_tech', 'quick_bites']:
    for i, a in enumerate(mag['sections'].get(key, [])):
        if not isinstance(a.get('readTime'), (int, float)):
            errors.append(f"{key}[{i}].readTime 숫자 아님: {a.get('readTime')!r}")

# 한국어 확인 (title에 영어만 있으면 경고)
for key in ['ai_ml', 'dev_tools', 'big_tech', 'quick_bites']:
    for i, a in enumerate(mag['sections'].get(key, [])[:5]):
        title = a.get('title', '')
        if title and not any('\uac00' <= c <= '\ud7a3' for c in title):
            errors.append(f"{key}[{i}].title 한국어 없음: {title[:50]}")

# 트윗 content 한국어 확인
for i, t in enumerate(mag['sections'].get('twitter_pulse', [])[:5]):
    content = t.get('content', '')
    if content and not any('\uac00' <= c <= '\ud7a3' for c in content):
        errors.append(f"twitter_pulse[{i}].content 한국어 번역 안됨: {content[:50]}")

# Reddit title 한국어 확인
for i, r in enumerate(mag['sections'].get('reddit_pulse', [])[:5]):
    title = r.get('title', '')
    if title and not any('\uac00' <= c <= '\ud7a3' for c in title):
        errors.append(f"reddit_pulse[{i}].title 한국어 번역 안됨: {title[:50]}")

# 트윗 URL 검증
import re
for i, t in enumerate(mag['sections'].get('twitter_pulse', [])):
    m = re.search(r'/status/(\d+)', t.get('url', ''))
    if not m:
        errors.append(f"twitter_pulse[{i}].url status ID 없음: {t.get('url')}")
    elif t['url'].endswith('0000000000'):
        errors.append(f"twitter_pulse[{i}].url 라운드 넘버 의심: {t['url']}")

# Reddit URL 검증
for i, r in enumerate(mag['sections'].get('reddit_pulse', [])):
    if '/comments/' not in r.get('url', ''):
        errors.append(f"reddit_pulse[{i}].url 형식 오류: {r.get('url')}")

# community_pulse 없어야 함
if 'community_pulse' in mag.get('sections', {}):
    errors.append("community_pulse 섹션이 존재함 — 제거할 것")

if errors:
    print("❌ 오류:")
    for e in errors: print(f"  - {e}")
else:
    print("✅ 검증 통과")
    print(f"   ai_ml:{len(mag['sections']['ai_ml'])}, dev_tools:{len(mag['sections']['dev_tools'])}, "
          f"tweets:{len(mag['sections']['twitter_pulse'])}, reddit:{len(mag['sections']['reddit_pulse'])}, "
          f"quick_bites:{len(mag['sections']['quick_bites'])}")
```

## 주의사항
- Chrome이 열려 있고 Claude in Chrome 확장이 연결된 상태에서만 트윗 수집 가능
- 트윗 수집 불가 시 twitter_pulse는 빈 배열로 처리하고 나머지 진행
- Reddit은 Chrome 없어도 feedparser로 수집 가능
- jina.ai rate limit 걸리면 잠시 대기 후 재시도
- 모든 시간은 KST 기준
- 24시간 이내 기사가 없으면 72시간으로 확장 (주말 대비)
- HTML 태그가 excerpt/content에 절대 포함되지 않도록 strip_html() 처리 필수
- **community_pulse 섹션은 생성하지 말 것**

## ⚠️ 최종 체크리스트
- [ ] readTime 모두 숫자(number)
- [ ] 모든 기사 title, excerpt 한국어
- [ ] 모든 트윗 content 한국어 번역
- [ ] 모든 Reddit title 한국어 번역 (originalTitle에 영어 보존)
- [ ] 트윗 URL이 실제 파싱한 href (임의 생성 금지)
- [ ] 트윗 handle이 URL에서 추출한 actualHandle
- [ ] Reddit URL이 /r/{sub}/comments/ 형식
- [ ] community_pulse 섹션 없음
- [ ] excerpt에 HTML 태그 없음
