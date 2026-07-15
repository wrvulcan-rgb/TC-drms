#!/usr/bin/env python3
"""Build a derived-feature corpus from Tzu Chi Global Community articles.

The script fetches public article pages, analyzes them in memory, and writes only
metadata and derived stylistic features. It intentionally does not persist full
article bodies.
"""

from __future__ import annotations

import argparse
import collections
import concurrent.futures
import dataclasses
import datetime as dt
import hashlib
import json
import random
import re
import sys
import time
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

import requests
from bs4 import BeautifulSoup

ROOT = "https://tcopen.tzuchi-org.tw/community/?Itemid=370&id=145&option=com_content&view=category"
USER_AGENT = (
    "TC-DRMS-Manuscript-Research/1.0 "
    "(+https://github.com/wrvulcan-rgb/TC-drms; public metadata research)"
)

TERM_GROUPS: dict[str, tuple[str, ...]] = {
    "relief": (
        "勘災", "訪視", "造冊", "發放", "急難救助", "災後關懷", "安置", "修繕",
        "永久屋", "以工代賑", "受惠戶", "關懷戶", "膚慰", "馳援", "重建",
    ),
    "medical": (
        "人醫會", "義診", "往診", "前篩", "醫療團隊", "拔除病苦", "良能",
        "求醫", "病患", "醫護", "守護健康", "守護生命",
    ),
    "volunteer_ops": (
        "合心", "和氣", "互愛", "協力", "合和互協", "功能組", "出班", "承擔",
        "補位", "香積", "法親", "窗口", "動線", "報到", "場勘",
    ),
    "humanities": (
        "人文真善美", "圖文影", "大藏經", "為時代作見證", "留史", "歷史紀錄",
        "人品典範", "傳揚美善", "攝影者", "報導",
    ),
    "dharma": (
        "竹筒歲月", "靜思法脈", "慈濟宗門", "經藏演繹", "入經藏", "法喜",
        "願心", "願力", "願行", "禮佛足", "接花香", "祝吉祥", "精進", "法髓",
    ),
    "values": (
        "感恩", "尊重", "愛", "善念", "共善", "結緣", "圓滿", "安身", "安心",
        "希望", "溫暖", "陪伴", "守護", "傳承", "初心", "惜福", "造福",
    ),
}

CONTENT_HINTS = (
    "慈善", "醫療", "教育", "環保", "志工", "災", "義診", "訪視", "發放", "修繕",
    "人物", "生命", "浴佛", "歲末", "祈福", "經藏", "精進", "培訓", "社區", "校園",
)

FOOTER_MARKERS = (
    "精舍之美暨靜思語", "人間菩薩大招生", "一般捐款項目如下", "Copyright ©",
)


@dataclasses.dataclass(frozen=True)
class Candidate:
    url: str
    category: str
    stratum: str
    source_page: int


class Fetcher:
    def __init__(self, timeout: int = 35, retries: int = 4) -> None:
        self.timeout = timeout
        self.retries = retries
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "zh-TW,zh;q=0.9"})

    def get(self, url: str) -> str:
        error: Exception | None = None
        for attempt in range(self.retries):
            try:
                response = self.session.get(url, timeout=self.timeout)
                response.raise_for_status()
                response.encoding = response.apparent_encoding or response.encoding or "utf-8"
                time.sleep(0.12)
                return response.text
            except (requests.RequestException, UnicodeError) as exc:
                error = exc
                time.sleep(0.7 * (attempt + 1))
        raise RuntimeError(f"fetch failed after {self.retries} attempts: {url}: {error}")


def canonicalize(url: str) -> str:
    parts = urlsplit(url)
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k != "limitstart"]
    query.sort()
    return urlunsplit((parts.scheme or "https", parts.netloc, parts.path, urlencode(query), ""))


def with_limitstart(url: str, value: int) -> str:
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    if value:
        query["limitstart"] = str(value)
    else:
        query.pop("limitstart", None)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), ""))


def query_value(url: str, key: str) -> str:
    return dict(parse_qsl(urlsplit(url).query, keep_blank_values=True)).get(key, "")


def normalize_space(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def discover_categories(html: str) -> list[tuple[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    seen: set[str] = set()
    categories: list[tuple[str, str]] = []
    for anchor in soup.find_all("a", href=True):
        href = urljoin(ROOT, anchor["href"])
        if query_value(href, "view") != "category" or not query_value(href, "id"):
            continue
        name = normalize_space(anchor.get_text(" ", strip=True))
        if not name or name in {"全球新聞、活動", "全球", "臺灣", "亞洲", "美洲", "大洋洲", "非洲", "歐洲"}:
            continue
        key = canonicalize(href)
        if key in seen:
            continue
        seen.add(key)
        categories.append((name, href))
    return categories


def parse_total_pages(html: str) -> int:
    text = BeautifulSoup(html, "html.parser").get_text(" ", strip=True)
    match = re.search(r"第\s*\d+\s*頁\s*[,，]\s*共\s*([\d,]+)\s*頁", text)
    return int(match.group(1).replace(",", "")) if match else 1


def parse_category_articles(html: str, category: str, stratum: str, page: int) -> list[Candidate]:
    soup = BeautifulSoup(html, "html.parser")
    results: list[Candidate] = []
    seen: set[str] = set()
    for anchor in soup.find_all("a", href=True):
        href = urljoin(ROOT, anchor["href"])
        if query_value(href, "view") != "article" or not query_value(href, "id"):
            continue
        title = normalize_space(anchor.get_text(" ", strip=True))
        if not title or title in {"< 前一個", "下一個 >"}:
            continue
        key = canonicalize(href)
        if key in seen:
            continue
        seen.add(key)
        results.append(Candidate(url=href, category=category, stratum=stratum, source_page=page))
    return results


def choose_pages(total_pages: int) -> list[tuple[int, str]]:
    points = [
        (0.00, "recent"),
        (0.12, "newer"),
        (0.32, "mid-new"),
        (0.58, "mid-old"),
        (0.82, "older"),
        (1.00, "oldest"),
    ]
    selected: list[tuple[int, str]] = []
    seen: set[int] = set()
    for ratio, label in points:
        page = max(0, round((total_pages - 1) * ratio))
        if page in seen:
            continue
        seen.add(page)
        selected.append((page, label))
    return selected


def extract_title(soup: BeautifulSoup) -> str:
    selectors = ["h2.contentheading", ".contentheading", "article h1", "article h2", ".item-page h2", "h1", "h2"]
    for selector in selectors:
        node = soup.select_one(selector)
        if not node:
            continue
        title = normalize_space(node.get_text(" ", strip=True))
        if title and title not in {"全球社區網", "精舍之美暨靜思語", "人間菩薩大招生"}:
            return title
    return ""


def extract_article_text(soup: BeautifulSoup, title: str) -> str:
    for tag in soup(["script", "style", "noscript", "nav", "form"]):
        tag.decompose()
    text = soup.get_text("\n", strip=True)
    if title and title in text:
        text = text[text.find(title) + len(title) :]
    metadata = re.search(r"20\d{2}[/-]\d{1,2}[/-]\d{1,2}\s*\|?\s*◎", text)
    if metadata:
        text = text[metadata.start() :]
    cut_positions = [text.find(marker) for marker in FOOTER_MARKERS if text.find(marker) >= 0]
    if cut_positions:
        text = text[: min(cut_positions)]
    lines = [normalize_space(line) for line in text.splitlines()]
    lines = [line for line in lines if line and line not in {"E-mail", "列印", "Tweet", "< 前一個", "下一個 >"}]
    return "\n".join(lines)


def parse_metadata(text: str) -> tuple[str, str, str]:
    patterns = [
        r"(20\d{2}/\d{1,2}/\d{1,2})\s*\|\s*◎\s*(.+?)／(.+?)報導",
        r"(20\d{2}-\d{1,2}-\d{1,2})\s*\|\s*◎\s*(.+?)／(.+?)報導",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(1).replace("-", "/"), normalize_space(match.group(2)), normalize_space(match.group(3))
    return "", "", ""


def remove_metadata_and_noise(text: str) -> str:
    text = re.sub(r"20\d{2}[/-]\d{1,2}[/-]\d{1,2}\s*\|\s*◎\s*.+?報導", "", text, count=1)
    text = re.sub(r"\[攝影者：[^\]]+\]", "", text)
    text = re.sub(r"圖[左右一二三四五六七八九十]+\s*[：:]", "", text)
    return text.strip()


def classify_headline(title: str) -> str:
    if any(word in title for word in ("重啟", "翻轉", "走出", "重見", "重新", "迎接新", "由苦")):
        return "transformation"
    if any(word in title for word in ("風雨", "火災", "地震", "洪水", "災", "祝融", "受創", "重創")):
        return "crisis-response"
    if any(word in title for word in ("義診", "發放", "修繕", "培訓", "演繹", "驗收", "捐贈", "關懷")):
        return "action-impact"
    if "「" in title or "」" in title:
        return "quoted-image"
    if len(title.split()) >= 2 or "　" in title:
        return "two-part"
    if any(word in title for word in ("生命", "人生", "菩薩道", "初心", "故事")):
        return "person-journey"
    return "direct-theme"


def classify_lead(body: str) -> str:
    lead = normalize_space(body[:260])
    if re.search(r"20\d{2}年\d{1,2}月\d{1,2}日", lead) and any(word in lead for word in ("位於", "前往", "舉辦", "在")):
        return "fact-first"
    if "「" in lead and "」" in lead:
        return "quote-first"
    if lead.endswith("？") or "為什麼" in lead[:80]:
        return "question-first"
    if any(word in lead for word in ("清晨", "晨曦", "夜幕", "風雨", "陽光", "笑容", "腳步", "聲音", "香氣")):
        return "scene-first"
    return "context-first"


def infer_content_type(title: str, body: str) -> str:
    sample = title + " " + body[:600]
    rules = [
        ("disaster-relief", ("勘災", "發放", "水災", "地震", "火災", "土石流", "永久屋", "重建", "修繕")),
        ("medical", ("義診", "人醫會", "病患", "醫療", "手術", "篩檢", "往診")),
        ("charity-care", ("訪視", "關懷戶", "急難救助", "居家關懷", "扶困")),
        ("dharma-ceremony", ("浴佛", "歲末祝福", "祈福", "經藏", "法會", "精進", "薰法")),
        ("education-youth", ("校園", "學生", "營隊", "親子", "教育", "青年", "兒童")),
        ("environment", ("環保", "回收", "淨灘", "蔬食", "惜福")),
        ("person-profile", ("生命故事", "人生", "菩薩道", "志工身影", "人物")),
        ("volunteer-training", ("志工培訓", "功能組", "演繹", "驗收", "共修", "真善美")),
    ]
    for label, keywords in rules:
        if any(keyword in sample for keyword in keywords):
            return label
    return "community-activity"


def analyze_article(candidate: Candidate, html: str) -> dict[str, Any] | None:
    soup = BeautifulSoup(html, "html.parser")
    title = extract_title(soup)
    raw_text = extract_article_text(soup, title)
    date, author, report_region = parse_metadata(raw_text)
    body = remove_metadata_and_noise(raw_text)
    paragraphs = [p for p in body.splitlines() if len(normalize_space(p)) >= 18]
    char_count = len(re.sub(r"\s+", "", body))
    if not title or not date or not author or char_count < 320 or len(paragraphs) < 2:
        return None

    headings = [normalize_space(line) for line in body.splitlines() if line.strip().startswith("◎")]
    term_counts: dict[str, int] = {}
    term_group_counts: dict[str, int] = {}
    for group, terms in TERM_GROUPS.items():
        group_total = 0
        for term in terms:
            count = body.count(term)
            if count:
                term_counts[term] = count
                group_total += count
        term_group_counts[group] = group_total

    year = int(date[:4])
    body_hash = hashlib.sha256(body.encode("utf-8")).hexdigest()
    return {
        "article_id": query_value(candidate.url, "id").split(":", 1)[0],
        "url": canonicalize(candidate.url),
        "title": title,
        "date": date,
        "year": year,
        "author": author,
        "report_region": report_region,
        "source_category": candidate.category,
        "sampling_stratum": candidate.stratum,
        "source_page": candidate.source_page,
        "grade": "A" if char_count >= 700 and len(paragraphs) >= 5 else "B",
        "char_count": char_count,
        "paragraph_count": len(paragraphs),
        "subheading_count": len(headings),
        "subheadings": headings[:12],
        "quote_count": min(body.count("「"), body.count("」")),
        "number_expression_count": len(re.findall(r"(?:\d+[\d,]*|[一二三四五六七八九十百千萬億]+)(?:位|人|戶|次|年|月|日|歲|公里|公尺|份|所|間)", body)),
        "headline_pattern": classify_headline(title),
        "lead_type": classify_lead(body),
        "content_type": infer_content_type(title, body),
        "term_group_counts": term_group_counts,
        "term_counts": term_counts,
        "body_sha256": body_hash,
    }


def round_robin_candidates(groups: dict[tuple[str, str], list[Candidate]], limit: int) -> list[Candidate]:
    queues = {key: collections.deque(values) for key, values in sorted(groups.items()) if values}
    ordered: list[Candidate] = []
    while queues and len(ordered) < limit:
        for key in list(queues):
            queue = queues[key]
            if queue:
                ordered.append(queue.popleft())
            if not queue:
                del queues[key]
            if len(ordered) >= limit:
                break
    return ordered


def summarize(records: list[dict[str, Any]], target: int) -> dict[str, Any]:
    def counter(field: str) -> dict[str, int]:
        return dict(collections.Counter(str(record[field]) for record in records).most_common())

    terms: collections.Counter[str] = collections.Counter()
    groups: collections.Counter[str] = collections.Counter()
    authors: collections.Counter[str] = collections.Counter()
    for record in records:
        terms.update(record["term_counts"])
        groups.update(record["term_group_counts"])
        authors[record["author"]] += 1

    char_counts = sorted(record["char_count"] for record in records)
    return {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "target": target,
        "valid_articles": len(records),
        "unique_urls": len({record["url"] for record in records}),
        "unique_body_hashes": len({record["body_sha256"] for record in records}),
        "grade_counts": counter("grade"),
        "year_counts": counter("year"),
        "category_counts": counter("source_category"),
        "region_counts": counter("report_region"),
        "content_type_counts": counter("content_type"),
        "headline_pattern_counts": counter("headline_pattern"),
        "lead_type_counts": counter("lead_type"),
        "term_group_counts": dict(groups.most_common()),
        "top_terms": dict(terms.most_common(100)),
        "top_authors": dict(authors.most_common(30)),
        "char_count": {
            "min": char_counts[0],
            "median": char_counts[len(char_counts) // 2],
            "max": char_counts[-1],
            "mean": round(sum(char_counts) / len(char_counts), 1),
        },
    }


def write_outputs(output_dir: Path, records: list[dict[str, Any]], stats: dict[str, Any]) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = output_dir / "corpus-manifest.jsonl"
    with manifest_path.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")

    (output_dir / "corpus-stats.json").write_text(
        json.dumps(stats, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )

    top_terms = "\n".join(f"- `{term}`: {count}" for term, count in list(stats["top_terms"].items())[:40])
    types = "\n".join(f"- {name}: {count}" for name, count in stats["content_type_counts"].items())
    years = "\n".join(f"- {year}: {count}" for year, count in sorted(stats["year_counts"].items(), reverse=True))
    report = f"""# 慈濟公開文稿語料分析報告

- 產生時間：{stats['generated_at']}
- 有效文章：**{stats['valid_articles']}**
- 唯一 URL：{stats['unique_urls']}
- 唯一正文雜湊：{stats['unique_body_hashes']}
- A 級完整正文：{stats['grade_counts'].get('A', 0)}
- B 級可分析正文：{stats['grade_counts'].get('B', 0)}
- 正文字數中位數：{stats['char_count']['median']}

> 本目錄不保存官方文章全文；只保存公開來源索引、正文雜湊與衍生特徵。

## 文稿類型覆蓋

{types}

## 年代覆蓋

{years}

## 高頻慈濟語彙（前 40）

{top_terms}

## 生成系統使用限制

1. 術語頻率只能用來選詞，不能替代現場事實。
2. 人名、日期、地點、數字、引言必須來自志工輸入或已核准資料。
3. 不得推測受助者心理、宗教信仰、病況或家庭關係。
4. 不得把語料中的直接引言移植到新稿。
5. 生成後必須經事實、稱謂、隱私、尊嚴與重複詞檢查。
"""
    (output_dir / "training-report.md").write_text(report, encoding="utf-8")


def build_candidates(fetcher: Fetcher, max_categories: int) -> tuple[list[Candidate], dict[str, Any]]:
    root_html = fetcher.get(ROOT)
    categories = discover_categories(root_html)
    if not categories:
        raise RuntimeError("no categories discovered from root page")

    # Keep broad geographic coverage while avoiding duplicate aggregate categories.
    categories = categories[:max_categories]
    category_info: dict[str, Any] = {}
    page_jobs: list[tuple[str, str, int, str]] = []

    for name, url in categories:
        try:
            first_html = fetcher.get(url)
        except RuntimeError as exc:
            print(f"WARN category unavailable: {name}: {exc}", file=sys.stderr)
            continue
        total_pages = parse_total_pages(first_html)
        pages = choose_pages(total_pages)
        category_info[name] = {"url": canonicalize(url), "total_pages": total_pages, "sampled_pages": pages}
        for page, stratum in pages:
            page_jobs.append((name, url, page, stratum))

    groups: dict[tuple[str, str], list[Candidate]] = collections.defaultdict(list)

    def fetch_page(job: tuple[str, str, int, str]) -> tuple[tuple[str, str], list[Candidate]]:
        name, url, page, stratum = job
        html = fetcher.get(with_limitstart(url, page * 10))
        return (name, stratum), parse_category_articles(html, name, stratum, page)

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        future_map = {pool.submit(fetch_page, job): job for job in page_jobs}
        for future in concurrent.futures.as_completed(future_map):
            job = future_map[future]
            try:
                key, found = future.result()
                groups[key].extend(found)
            except Exception as exc:  # noqa: BLE001 - batch crawler should continue
                print(f"WARN page unavailable: {job}: {exc}", file=sys.stderr)

    dedup: dict[str, Candidate] = {}
    for group, candidates in groups.items():
        unique_group: list[Candidate] = []
        for candidate in candidates:
            key = canonicalize(candidate.url)
            if key in dedup:
                continue
            dedup[key] = candidate
            unique_group.append(candidate)
        groups[group] = unique_group

    ordered = round_robin_candidates(groups, limit=len(dedup))
    return ordered, category_info


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", type=int, default=500)
    parser.add_argument("--output-dir", type=Path, default=Path("manuscript/knowledge/generated"))
    parser.add_argument("--max-categories", type=int, default=48)
    parser.add_argument("--candidate-multiplier", type=float, default=2.4)
    args = parser.parse_args()

    if args.target < 1 or args.max_categories < 1:
        parser.error("target and max-categories must be positive")

    fetcher = Fetcher()
    candidates, category_info = build_candidates(fetcher, args.max_categories)
    wanted_candidates = min(len(candidates), max(args.target, round(args.target * args.candidate_multiplier)))
    candidates = candidates[:wanted_candidates]
    print(f"discovered candidates={len(candidates)} categories={len(category_info)} target={args.target}")

    records: list[dict[str, Any]] = []
    errors = 0

    def fetch_and_analyze(candidate: Candidate) -> dict[str, Any] | None:
        html = fetcher.get(candidate.url)
        return analyze_article(candidate, html)

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        future_map = {pool.submit(fetch_and_analyze, candidate): candidate for candidate in candidates}
        for future in concurrent.futures.as_completed(future_map):
            candidate = future_map[future]
            try:
                record = future.result()
                if record:
                    records.append(record)
            except Exception as exc:  # noqa: BLE001 - failures are counted and reported
                errors += 1
                print(f"WARN article unavailable: {candidate.url}: {exc}", file=sys.stderr)

    # Deterministic order and strict dedup by URL and body hash.
    records.sort(key=lambda item: (item["date"], item["article_id"], item["url"]), reverse=True)
    unique_records: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    seen_hashes: set[str] = set()
    for record in records:
        if record["url"] in seen_urls or record["body_sha256"] in seen_hashes:
            continue
        seen_urls.add(record["url"])
        seen_hashes.add(record["body_sha256"])
        unique_records.append(record)
        if len(unique_records) == args.target:
            break

    if len(unique_records) < args.target:
        print(
            f"ERROR valid unique articles={len(unique_records)} below target={args.target}; "
            f"fetch errors={errors}; candidates={len(candidates)}",
            file=sys.stderr,
        )
        return 2

    stats = summarize(unique_records, args.target)
    stats["discovered_categories"] = category_info
    stats["fetch_errors"] = errors
    stats["candidate_count"] = len(candidates)
    write_outputs(args.output_dir, unique_records, stats)
    print(json.dumps({"status": "ok", "valid_articles": len(unique_records), "output": str(args.output_dir)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
