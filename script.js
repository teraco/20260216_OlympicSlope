// Entry point (DOMContentLoaded 後に初期化)
// 最低限のエラーハンドリングを画面に表示
window.addEventListener('error', function (e) {
  var note = document.getElementById('sort-note');
  if (note) { note.textContent = 'エラー: ' + e.message; note.style.color = '#ff6b6b'; }
});
window.addEventListener('unhandledrejection', function (e) {
  var note = document.getElementById('sort-note');
  var msg = (e && e.reason && (e.reason.message || String(e.reason))) || 'Unhandled rejection';
  if (note) { note.textContent = 'エラー: ' + msg; note.style.color = '#ff6b6b'; }
});

async function init() {
  const CSV_PATH = '2026SB6201ANQ_rankings_wide_horizontal.csv';
  const tableHead = document.getElementById('table-head');
  const tableBody = document.getElementById('table-body');
  const csvFallback = document.getElementById('csv-fallback');
  const csvFileInput = document.getElementById('csv-file');
  const subEl = document.querySelector('.site-header .sub');
  // 埋め込みCSVは window.__CSV_DATA__ に格納
  const select1 = document.getElementById('player-select-1');
  const select2 = document.getElementById('player-select-2');
  const chartArea = document.getElementById('chart-area');

  let rows = [];
  let headers = [];
  let sortState = { key: null, dir: 'desc' }; // default desc for scores
  let allPlayerNames = [];
  let selected1 = '';
  let selected2 = '';

  // 1) 埋め込みCSVがあれば最優先で使用
  const inlineCsv = (window.__CSV_DATA__ || '').trim();
  if (inlineCsv) {
    const parsed = parseCSV(inlineCsv);
    initFromParsed(parsed, '埋め込みCSV');
  } else {
    // 2) それ以外は従来通り fetch（HTTP サーバ経由の場合）
    try {
      const csvText = await fetch(CSV_PATH).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      });
      const parsed = parseCSV(csvText);
      initFromParsed(parsed, 'ファイル: ' + CSV_PATH);
    } catch (e) {
      console.warn('自動読み込みに失敗:', e);
      if (csvFallback) csvFallback.hidden = false;
      if (subEl) subEl.textContent = 'ローカルで開いている場合、CSVを選択して読み込んでください。';
      if (csvFileInput) {
        csvFileInput.addEventListener('change', async () => {
          const file = csvFileInput.files && csvFileInput.files[0];
          if (!file) return;
          const text = await file.text();
          const parsed = parseCSV(text);
          initFromParsed(parsed, 'ファイル: ' + file.name);
          csvFallback && (csvFallback.hidden = true);
        });
      }
      return;
    }
  }

  function initFromParsed(parsed, subText) {
    headers = parsed.headers;
    rows = parsed.rows;
    // プルダウン候補: S1~S6 Name 出現者を対象、表示順は Score(100%) の降順（同点は名前昇順）、ラベルは「順位 名」
    const sNameKeys = headers.filter(function(h){ return /^S[1-6] Name$/i.test(h); });
    var appearSet = new Set();
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      for (var j = 0; j < sNameKeys.length; j++) {
        var v = r[sNameKeys[j]];
        if (v) appearSet.add(v);
      }
    }
    // name -> { rank, score }
    var rankMap = {};
    var rankKey = 'Rank';
    var scoreKey = 'Score(100%)';
    var scoreNameKey = 'Score Name';
    for (var i2 = 0; i2 < rows.length; i2++) {
      var rr = rows[i2];
      var nm = rr[scoreNameKey];
      if (!nm) continue;
      var rk = parseInt(rr[rankKey], 10);
      var sc = parseFloat(String(rr[scoreKey]).replace(/[^0-9.+-]/g, ''));
      if (!isFinite(sc)) sc = -Infinity;
      rankMap[nm] = { rank: isFinite(rk) ? rk : undefined, score: sc };
    }
    var list = Array.from(appearSet).map(function(nm){
      var meta = rankMap[nm] || { rank: undefined, score: -Infinity };
      return { name: nm, score: meta.score, rank: meta.rank };
    });
    list.sort(function(a,b){
      if (a.score !== b.score) return b.score - a.score; // score desc
      if (a.rank != null && b.rank != null && a.rank !== b.rank) return a.rank - b.rank; // rank asc if both exist
      return String(a.name).localeCompare(String(b.name));
    });
    allPlayerNames = list.map(function(x){ return x.name; });
    function makeLabel(x){ return (x.rank != null ? (x.rank + ' ') : '') + x.name; }
    var optionsHtml = ['<option value="">(未選択)</option>']
      .concat(list.map(function(x){
        var label = makeLabel(x);
        return `<option value="${escapeHtml(x.name)}">${escapeHtml(label)}</option>`;
      }))
      .join('');
    if (select1) select1.innerHTML = optionsHtml;
    if (select2) select2.innerHTML = optionsHtml;

    // 初期表示で上位2名を自動選択してグラフを表示
    if (list.length > 0) {
      selected1 = list[0].name;
      if (select1) select1.value = selected1;
    }
    if (list.length > 1) {
      selected2 = list[1].name;
      if (select2) select2.value = selected2;
    }

    renderHead(headers);
    renderBody(rowsForCurrentView(), headers);
    renderChart();
    if (subEl && subText) subEl.textContent = subText;
  }

  // Sorting interactions
  tableHead.addEventListener('click', (e) => {
    const th = e.target.closest('th');
    if (!th || !th.dataset.key) return;
    const key = th.dataset.key;
    const numeric = th.dataset.numeric === '1';

    if (sortState.key === key) {
      sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
    } else {
      sortState.key = key;
      sortState.dir = numeric ? 'desc' : 'asc'; // default desc for numbers
    }
    applySort();
  });

  function applySort() {
    const key = sortState.key;
    if (!key) return;
    const numeric = isNumericColumn(key);
    const dir = sortState.dir === 'asc' ? 1 : -1;
    const sorted = [...rows].sort((a, b) => {
      let va = a[key];
      let vb = b[key];
      if (numeric) {
        va = toNumber(va);
        vb = toNumber(vb);
      } else {
        va = String(va || '');
        vb = String(vb || '');
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    renderBody(sorted, headers);
    // Update indicators
    Array.prototype.forEach.call(tableHead.querySelectorAll('th'), function(th) {
      var old = th.querySelector('.sort-indicator');
      if (old) old.remove();
    });
    const th = tableHead.querySelector(`th[data-key="${cssEscape(key)}"]`);
    if (th) {
      const span = document.createElement('span');
      span.className = 'sort-indicator';
      span.textContent = sortState.dir === 'asc' ? '▲' : '▼';
      th.appendChild(span);
    }
  }

  // セレクト変更でハイライト更新
  function wireSelects() {
    if (select1) select1.addEventListener('change', () => {
      selected1 = select1.value || '';
      renderBody(rowsForCurrentView(), headers);
      renderChart();
    });
    if (select2) select2.addEventListener('change', () => {
      selected2 = select2.value || '';
      renderBody(rowsForCurrentView(), headers);
      renderChart();
    });
  }
  wireSelects();

  function rowsForCurrentView() {
    if (!sortState.key) return rows;
    const key = sortState.key;
    const numeric = isNumericColumn(key);
    const dir = sortState.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      let va = a[key];
      let vb = b[key];
      if (numeric) {
        va = toNumber(va);
        vb = toNumber(vb);
      } else {
        va = String(va || '');
        vb = String(vb || '');
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }

  function renderHead(headers) {
    const numericCols = new Set(headers.filter(isNumericColumn));
    const ths = headers.map(h => {
      const sortable = numericCols.has(h) || /^Rank$/i.test(h);
      const colCls = columnClass(h);
      const cls = `${sortable ? 'sortable ' : ''}${colCls}`.trim();
      return `<th data-key="${escapeAttr(h)}" data-numeric="${numericCols.has(h) ? 1 : 0}" class="${cls}">${escapeHtml(h)}</th>`;
    }).join('');
    tableHead.innerHTML = `<tr>${ths}</tr>`;
  }

  function renderBody(data, headers) {
    const html = data.map(row => {
      const tds = headers.map(h => {
        const val = row[h] ?? '';
        const colCls = columnClass(h);
        if (/^S[1-6] Trick$/i.test(h)) {
          const tip = makeTrickTooltip(String(val));
          const hasTip = tip.length > 0;
          return `<td class="trick-cell ${colCls}">` +
                 `${escapeHtml(val)}` +
                 (hasTip ? ` <span class=\"hint\" tabindex=\"0\">?` +
                 `<span class=\"tooltip\">${tip}</span>` +
                 `</span>` : '') +
                 `</td>`;
        }
        if (/^S[1-6] Name$/i.test(h)) {
          const is1 = selected1 && val === selected1;
          const is2 = selected2 && val === selected2;
          if (is1 || is2) {
            const cls = `${is1 ? 'hl1' : ''} ${is2 ? 'hl2' : ''}`.trim();
            return `<td class="name-cell ${colCls}"><span class="${cls}">${escapeHtml(val)}</span></td>`;
          }
          return `<td class="name-cell ${colCls}">${escapeHtml(val)}</td>`;
        }
        return `<td class="${colCls}">${escapeHtml(val)}</td>`;
      }).join('');
      return `<tr>${tds}</tr>`;
    }).join('');
    tableBody.innerHTML = html;
  }

  // Helpers
  // ===== Chart rendering =====
  function sectionScoresForPlayer(name) {
    const res = [];
    if (!name) return res;
    for (let i = 1; i <= 6; i++) {
      const kName = `S${i} Name`;
      const kScore = `S${i} Score`;
      const kTrick = `S${i} Trick`;
      let best = { score: -Infinity, trick: '' };
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        if (row[kName] === name) {
          const sc = toNumber(row[kScore]);
          if (sc > best.score) best = { score: sc, trick: row[kTrick] || '' };
        }
      }
      if (!isFinite(best.score) || best.score < 0) best = { score: 0, trick: '' };
      res.push(best);
    }
    return res; // [{score, trick}] length 6
  }

  function renderChart() {
    if (!chartArea) return;
    const p1 = selected1;
    const p2 = selected2;
    if (!p1 && !p2) { chartArea.innerHTML = ''; return; }

    const secLabels = ['S1','S2','S3','S4','S5','S6'];
    const d1 = p1 ? sectionScoresForPlayer(p1) : null;
    const d2 = p2 ? sectionScoresForPlayer(p2) : null;
    const allScores = [];
    if (d1) allScores.push.apply(allScores, d1.map(x=>x.score));
    if (d2) allScores.push.apply(allScores, d2.map(x=>x.score));
    const maxY = Math.max(10, Math.ceil((Math.max.apply(null, allScores) || 0) / 1) * 1);

    const W = 520, H = 240; const m = {t:20,r:16,b:40,l:36};
    const innerW = W - m.l - m.r; const innerH = H - m.t - m.b;
    const groups = 6; const groupGap = 14;
    const series = (p1 && p2) ? 2 : 1; const barGap = 6;
    const groupWidth = (innerW - groupGap * (groups - 1)) / groups;
    const barWidth = series === 2 ? (groupWidth - barGap) / 2 : Math.min(groupWidth, 40);

    function xPos(i, sidx) {
      const gx = m.l + i * (groupWidth + groupGap);
      if (series === 1) return gx + (groupWidth - barWidth) / 2;
      return gx + (sidx === 0 ? 0 : (barWidth + barGap));
    }
    function yPos(v) {
      const ratio = Math.max(0, Math.min(1, v / maxY));
      return m.t + innerH - ratio * innerH;
    }
    function hVal(v) { const ratio = Math.max(0, Math.min(1, v / maxY)); return ratio * innerH; }

    let svg1 = `<div class=\"chart-wrap\"><svg viewBox=\"0 0 ${W} ${H}\" role=\"img\" aria-label=\"セクション別トリックの縦棒グラフ\">`;
    // y-axis grid
    const ticks = 5;
    for (let i=0;i<=ticks;i++) {
      const y = m.t + innerH - (innerH * i / ticks);
      const val = (maxY * i / ticks).toFixed(0);
      svg1 += `<g class=\"axis\"><line x1=\"${m.l}\" y1=\"${y}\" x2=\"${W-m.r}\" y2=\"${y}\" stroke-dasharray=\"2,4\"/>`+
             `<text x=\"${m.l-8}\" y=\"${y+4}\" text-anchor=\"end\">${val}</text></g>`;
    }
    // x labels
    for (let i=0;i<6;i++) {
      const x = m.l + i*(groupWidth+groupGap) + groupWidth/2;
      const y = H - m.b + 16;
      svg1 += `<g class=\"axis\"><text x=\"${x}\" y=\"${y}\" text-anchor=\"middle\">${secLabels[i]}</text></g>`;
    }
    // bars
    for (let i=0;i<6;i++) {
      if (d1) {
        const v = d1[i].score; const tip = makeTrickTooltip(d1[i].trick);
        const x = xPos(i,0); const y = yPos(v); const h = hVal(v);
        svg1 += `<g class=\"bar bar-series-1\"><rect x=\"${x}\" y=\"${y}\" width=\"${barWidth}\" height=\"${h}\">`+
               `<title>${escapeHtml(p1)} - ${secLabels[i]}: ${v}\\n${tip.replace(/<[^>]+>/g,' ')}</title>`+
               `</rect></g>`;
      }
      if (d2) {
        const v = d2[i].score; const tip = makeTrickTooltip(d2[i].trick);
        const x = xPos(i, (series===2?1:0)); const y = yPos(v); const h = hVal(v);
        svg1 += `<g class=\"bar bar-series-2\"><rect x=\"${x}\" y=\"${y}\" width=\"${barWidth}\" height=\"${h}\">`+
               `<title>${escapeHtml(p2)} - ${secLabels[i]}: ${v}\\n${tip.replace(/<[^>]+>/g,' ')}</title>`+
               `</rect></g>`;
      }
    }
    svg1 += `</svg></div>`;

    // 追加: Sections(60%) と Composition(40%) を同じサイズの1つのグラフで表示
    const meta1 = p1 ? totalsForPlayer(p1) : null;
    const meta2 = p2 ? totalsForPlayer(p2) : null;
    const svgRight = buildGroupedBars({
      labels: ['Sections','Composition'],
      data1: meta1 ? [meta1.sections, meta1.composition] : null,
      data2: meta2 ? [meta2.sections, meta2.composition] : null,
      maxY: 60,
      width: 520,
      height: 240,
      aria: 'Sections(60%) と Composition(40%) の比較グラフ',
      p1, p2
    });

    chartArea.innerHTML = `<div class=\"charts-row\">${svg1}${svgRight}</div>`;
  }

  function totalsForPlayer(name) {
    let sections = 0, composition = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r['Score Name'] === name) {
        sections = toNumber(r['Sections(60%)']);
        composition = toNumber(r['Composition(40%)']);
        break;
      }
    }
    return { sections, composition };
  }

  function buildGroupedBars(opts) {
    const { labels, data1, data2, maxY, width, height, aria, p1, p2 } = opts;
    const W = width, H = height; const m = {t:20,r:16,b:40,l:36};
    const innerW = W - m.l - m.r; const innerH = H - m.t - m.b;
    const groups = labels.length; const groupGap = 14;
    const series = (data1 && data2) ? 2 : 1; const barGap = 6;
    const groupWidth = (innerW - groupGap * (groups - 1)) / groups;
    const barWidth = series === 2 ? Math.max(6, (groupWidth - barGap) / 2) : Math.min(groupWidth, 40);
    function xPos(i, sidx) {
      const gx = m.l + i * (groupWidth + groupGap);
      if (series === 1) return gx + (groupWidth - barWidth) / 2;
      return gx + (sidx === 0 ? 0 : (barWidth + barGap));
    }
    function yPos(v) { const ratio = Math.max(0, Math.min(1, v / maxY)); return m.t + innerH - ratio * innerH; }
    function hVal(v) { const ratio = Math.max(0, Math.min(1, v / maxY)); return ratio * innerH; }
    let svg = `<div class=\"chart-wrap\"><svg viewBox=\"0 0 ${W} ${H}\" role=\"img\" aria-label=\"${aria}\">`;
    const ticks = 5;
    for (let i=0;i<=ticks;i++) {
      const y = m.t + innerH - (innerH * i / ticks);
      const val = (maxY * i / ticks).toFixed(0);
      svg += `<g class=\"axis\"><line x1=\"${m.l}\" y1=\"${y}\" x2=\"${W-m.r}\" y2=\"${y}\" stroke-dasharray=\"2,4\"/>`+
             `<text x=\"${m.l-8}\" y=\"${y+4}\" text-anchor=\"end\">${val}</text></g>`;
    }
    for (let i=0;i<labels.length;i++) {
      const x = m.l + i*(groupWidth+groupGap) + groupWidth/2;
      const y = H - m.b + 16;
      svg += `<g class=\"axis\"><text x=\"${x}\" y=\"${y}\" text-anchor=\"middle\">${labels[i]}</text></g>`;
    }
    for (let i=0;i<labels.length;i++) {
      if (data1) {
        const v = data1[i] || 0;
        const x = xPos(i,0); const y = yPos(v); const h = hVal(v);
        svg += `<g class=\"bar bar-series-1\"><rect x=\"${x}\" y=\"${y}\" width=\"${barWidth}\" height=\"${h}\">`+
               `<title>${p1 ? escapeHtml(p1) : ''} - ${labels[i]}: ${v}</title>`+
               `</rect></g>`;
      }
      if (data2) {
        const v = data2[i] || 0;
        const x = xPos(i, (series===2?1:0)); const y = yPos(v); const h = hVal(v);
        svg += `<g class=\"bar bar-series-2\"><rect x=\"${x}\" y=\"${y}\" width=\"${barWidth}\" height=\"${h}\">`+
               `<title>${p2 ? escapeHtml(p2) : ''} - ${labels[i]}: ${v}</title>`+
               `</rect></g>`;
      }
    }
    svg += `</svg></div>`;
    return svg;
  }
  function parseCSV(text) {
    // Normalize newlines and trim trailing $ at line ends
    const lines = text.replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim().length > 0);
    const clean = lines.map(l => l.replace(/\$$/, ''));
    const headers = clean[0].split(',').map(s => s.trim());
    const rows = clean.slice(1).map(line => {
      const cols = line.split(',');
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = (cols[i] ?? '').trim();
      });
      return obj;
    });
    return { headers, rows };
  }

  function isNumericColumn(h) {
    return /(Score\b|\(\d+%\)\b|^Rank$|S\d+ Score$)/.test(h);
  }

  function toNumber(v) {
    const n = parseFloat(String(v).replace(/[^0-9.+-]/g, ''));
    return isNaN(n) ? -Infinity : n;
  }

  function escapeHtml(s) {
    const str = String(s);
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return str.replace(/[&<>"']/g, (ch) => map[ch]);
  }
  function escapeAttr(s) { return escapeHtml(s); }
  function cssEscape(s) { return s.replace(/"/g, '\\"'); }
  function columnClass(h) {
    if (/^S2\b/i.test(h)) return 'col-s2';
    if (/^S4\b/i.test(h)) return 'col-s4';
    if (/^S6\b/i.test(h)) return 'col-s6';
    if (/^Composition/i.test(h)) return 'col-comp';
    return '';
  }

  function makeTrickTooltip(code) {
    if (!code) return '';
    const parts = tokenizeTrick(code);
    const words = parts.map(mapTokenToWord).filter(Boolean);
    const breakdown = escapeHtml(code.replace(/\+/g, ' + '));
    const main = escapeHtml(words.join('・'));
    if (!main) return breakdown;
    return `<strong>${main}</strong><br/><span class=\"breakdown\">${breakdown}</span>`;
  }
  function tokenizeTrick(code) {
    let raw = code.trim();
    raw = raw.replace(/\s+/g, '');
    const plusSplit = raw.split('+');
    const tokens = [];
    plusSplit.forEach(seg => {
      const t = seg.split('-').filter(Boolean);
      for (let i = 0; i < t.length; i++) {
        const cur = t[i];
        const next = t[i+1] || '';
        if (cur === '2' && next === 'on') { tokens.push('2-on'); i++; continue; }
        if (cur === 'to') { tokens.push('to-' + next); i++; continue; }
        tokens.push(cur);
      }
      tokens.push('+');
    });
    if (tokens[tokens.length-1] === '+') tokens.pop();
    return tokens;
  }
  function mapTokenToWord(t) {
    const map = {
      f: 'フロントサイド',
      b: 'バックサイド',
      Cab: 'キャブ（スイッチフロントサイド）',
      Gap: 'ギャップ',
      '55': '50-50',
      Bsl: 'ボードスライド',
      Lsl: 'リップスライド',
      Ns: 'ノーズスライド',
      Tsl: 'テールスライド',
      Bl: 'ブラントスライド',
      Pr: 'プレッツェル',
      UF: 'アンダーフリップ',
      'dC': 'ダブルコーク',
      d: 'ダブル',
      I: 'インディ',
      Mu: 'ミュート',
      Me: 'メロン',
      St: 'ステイルフィッシュ',
      Tg: 'テールグラブ',
      Fa: 'フェイキー',
      on: 'オン',
      '+': '＋'
    };
    if (/^to-/.test(t)) {
      const rest = t.slice(3);
      return '→ ' + (map[rest] || rest);
    }
    if (t === '2-on') return '270オン';
    if (/^\d+$/.test(t)) {
      const n = parseInt(t, 10);
      const spinMap = {1:180,3:360,5:540,7:720,9:900,10:1080,12:1260};
      if (spinMap[n]) return spinMap[n] + '°';
    }
    return map[t] || '';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { init(); });
} else {
  init();
}
