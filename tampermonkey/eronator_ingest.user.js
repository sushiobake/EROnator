// ==UserScript==
// @name         ERONATOR Ingest (DMM/FANZA Doujin)
// @namespace    eronator
// @version      0.1.0
// @description  Hotkey to scrape DMM/FANZA doujin detail page and POST to ERONATOR.
// @match        https://www.dmm.co.jp/dc/doujin/-/detail/=/cid=*/*
// @match        https://www.dmm.co.jp/dc/doujin/-/detail/=/cid=*/*?*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// ==/UserScript==

(() => {
  'use strict';

  // Fixed values (do not change)
  const BASE_URL = 'http://localhost:3000';
  const INGEST_TOKEN = 'ERONATOR_INGEST_TOKEN_2026_0121__CHANGE_LATER_OK';
  const RAW_TEXT_MAX = 30000;

  // Ctrl+Shift+I often collides with Chrome DevTools.
  // Use Ctrl+Shift+L by default.
  const HOTKEY = {
    ctrl: true,
    shift: true,
    alt: false,
    key: 'L',
  };

  let inFlight = false;

  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const og = (p) =>
    (document.querySelector(`meta[property="${p}"]`)?.content ||
      document.querySelector(`meta[name="${p}"]`)?.content ||
      '');

  const getCid = (href) => {
    return (
      (href.match(/\/cid=([^\/?&#]+)\//) || href.match(/[?&]cid=([^&]+)/))?.[1] || null
    );
  };

  const getDdByLabel = (label) => {
    const target = norm(label);
    for (const dt of document.querySelectorAll('dt')) {
      if (norm(dt.textContent) === target) {
        const dd = dt.nextElementSibling;
        if (dd && dd.tagName.toLowerCase() === 'dd') return dd;
      }
    }
    return null;
  };

  const uniq = (arr) => Array.from(new Set(arr));

  const extract = () => {
    const href = location.href;
    const cid = getCid(href);
    const productUrl = cid
      ? `https://www.dmm.co.jp/dc/doujin/-/detail/=/cid=${cid}/`
      : href.split('#')[0];

    const title = norm(og('og:title') || document.title);
    const thumbnailUrl = norm(og('og:image')) || null;

    const authorEl =
      getDdByLabel('作者') ||
      getDdByLabel('サークル') ||
      getDdByLabel('著者') ||
      getDdByLabel('作家');
    const authorName = authorEl ? norm(authorEl.textContent) : null;

    const genreEl = getDdByLabel('ジャンル') || getDdByLabel('タグ');
    let officialTags = [];
    if (genreEl) {
      officialTags = [...genreEl.querySelectorAll('a,button,span')]
        .map((e) => norm(e.textContent))
        .filter((t) => t && t.length <= 30);
    }
    officialTags = uniq(officialTags).filter(
      (t) => !['オプション', '新作', 'セール品'].includes(t)
    );

    // rawText: concatenate dt/dd texts + try to include description-like blocks if present
    const rawParts = [];

    // dt/dd
    const dts = [...document.querySelectorAll('dt')];
    for (const dt of dts) {
      const dd = dt.nextElementSibling;
      if (!dd || dd.tagName.toLowerCase() !== 'dd') continue;
      const k = norm(dt.textContent);
      const v = norm(dd.textContent);
      if (!k || !v) continue;
      rawParts.push(`${k}: ${v}`);
    }

    // description heuristics (safe best-effort)
    const descSelectors = [
      '[itemprop="description"]',
      '#detail',
      '.summary',
      '.mg-b20',
      '.dcd-productDetail__text',
    ];
    for (const sel of descSelectors) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const t = norm(el.textContent);
      if (t && t.length >= 20) rawParts.push(t);
    }

    let rawText = rawParts.join('\n');
    if (rawText.length > RAW_TEXT_MAX) rawText = rawText.slice(0, RAW_TEXT_MAX);

    const payload = {
      productUrl,
      title,
      authorName,
      thumbnailUrl,
      officialTags,
      sourcePayload: {
        rawText,
        scrapedAt: new Date().toISOString(),
        pageUrl: href.split('#')[0],
        cid,
      },
    };

    return payload;
  };

  const post = (payload) => {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'POST',
        url: `${BASE_URL}/api/ingest/work`,
        headers: {
          'Content-Type': 'application/json',
          'X-Ingest-Token': INGEST_TOKEN,
        },
        data: JSON.stringify(payload),
        timeout: 30000,
        onload: (res) => {
          const status = res.status;
          if (status >= 200 && status < 300) {
            try {
              const json = JSON.parse(res.responseText || '{}');
              return resolve(json);
            } catch (e) {
              return reject(new Error('Invalid JSON response'));
            }
          }
          return reject(
            new Error(`HTTP ${status}: ${String(res.responseText || '').slice(0, 300)}`)
          );
        },
        ontimeout: () => reject(new Error('Timeout')),
        onerror: () => reject(new Error('Network error')),
      });
    });
  };

  const onHotkey = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      const payload = extract();
      if (!payload.productUrl || !payload.title || !payload.sourcePayload?.rawText) {
        alert('失敗: 必須項目が取得できませんでした');
        return;
      }

      const res = await post(payload);
      if (res && res.ok) {
        alert(`成功: workId=${res.workId} / created=${res.created}`);
      } else {
        alert(`失敗: ${JSON.stringify(res)}`);
      }
    } catch (e) {
      alert(`失敗: ${e?.message || e}`);
    } finally {
      inFlight = false;
    }
  };

  document.addEventListener('keydown', (ev) => {
    // Avoid triggering while typing in inputs
    const tag = (ev.target && ev.target.tagName) ? ev.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || ev.isComposing) return;

    const hit =
      (!!HOTKEY.ctrl === ev.ctrlKey) &&
      (!!HOTKEY.shift === ev.shiftKey) &&
      (!!HOTKEY.alt === ev.altKey) &&
      norm(ev.key).toUpperCase() === HOTKEY.key;

    if (!hit) return;
    ev.preventDefault();
    onHotkey();
  });
})();
