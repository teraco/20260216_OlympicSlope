// Entry point
(async function () {
  const CSV_PATH = '2026SB6201ANQ_rankings_wide_horizontal.csv';
  const tableHead = document.getElementById('table-head');
  const tableBody = document.getElementById('table-body');
  const playerInput = document.getElementById('player-input');
  const playerList = document.getElementById('player-list');
  const addBtn = document.getElementById('add-highlight');
  const clearBtn = document.getElementById('clear-highlights');
  const colorInput = document.getElementById('color-input');
  const selectedWrap = document.getElementById('selected-highlights');

  let rows = [];
  let headers = [];
  let sortState = { key: null, dir: 'desc' }; // default desc for scores
  const highlights = new Map(); // name -> color

  try {
    const csvText = await fetch(CSV_PATH).then(r => r.text());
    const parsed = parseCSV(csvText);
    headers = parsed.headers;
    rows = parsed.rows;
  } catch (e) {
    console.error('CSV 読み込みエラー:', e);
    tableBody.innerHTML = '<tr><td>CSVの読み込みに失敗しました。</td></tr>';
    return;
  }

  // Prepare UI: datalist of unique player names
  const nameKeys = headers.filter(h => /\bName\b/.test(h));
  const uniqueNames = Array.from(new Set(
    rows.flatMap(r => nameKeys.map(k => r[k]).filter(Boolean))
  )).sort((a, b) => a.localeCompare(b, 'ja'));
  playerList.innerHTML = uniqueNames.map(n => `<option value="${escapeHtml(n)}"></option>`).join('');

  // Build table head
  renderHead(headers, nameKeys);

  // Initial render
  renderBody(rows, headers, nameKeys, highlights);

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
    renderBody(sorted, headers, nameKeys, highlights);
    // Update indicators
    for (const th of tableHead.querySelectorAll('th')) {
      th.querySelector('.sort-indicator')?.remove();
    }
    const th = tableHead.querySelector(`th[data-key="${cssEscape(key)}"]`);
    if (th) {
      const span = document.createElement('span');
      span.className = 'sort-indicator';
      span.textContent = sortState.dir === 'asc' ? '▲' : '▼';
      th.appendChild(span);
    }
  }

  // Highlight interactions
  addBtn.addEventListener('click', () => {
    const name = (playerInput.value || '').trim();
    if (!name) return;
    if (!uniqueNames.includes(name)) {
      alert('候補から選手名を選んでください。');
      return;
    }
    if (!highlights.has(name) && highlights.size >= 3) {
      alert('ハイライトは最大3人までです。');
      return;
    }
    highlights.set(name, colorInput.value);
    playerInput.value = '';
    updateHighlightTags();
    renderBody(rowsForCurrentView(), headers, nameKeys, highlights);
  });

  clearBtn.addEventListener('click', () => {
    highlights.clear();
    updateHighlightTags();
    renderBody(rowsForCurrentView(), headers, nameKeys, highlights);
  });

  function updateHighlightTags() {
    selectedWrap.innerHTML = '';
    for (const [name, color] of highlights.entries()) {
      const el = document.createElement('div');
      el.className = 'tag';
      el.innerHTML = `
        <span>${escapeHtml(name)}</span>
        <input type="color" value="${escapeHtml(color)}" aria-label="${escapeHtml(name)} の色" />
        <button type="button" class="ghost">削除</button>
      `;
      const picker = el.querySelector('input[type="color"]');
      picker.addEventListener('input', () => {
        highlights.set(name, picker.value);
        renderBody(rowsForCurrentView(), headers, nameKeys, highlights);
      });
      el.querySelector('button')!.addEventListener('click', () => {
        highlights.delete(name);
        updateHighlightTags();
        renderBody(rowsForCurrentView(), headers, nameKeys, highlights);
      });
      selectedWrap.appendChild(el);
    }
    addBtn.disabled = highlights.size >= 3;
  }

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

  function renderHead(headers, nameKeys) {
    const numericCols = new Set(headers.filter(isNumericColumn));
    const ths = headers.map(h => {
      const sortable = numericCols.has(h) || /^Rank$/i.test(h);
      return `<th data-key="${escapeAttr(h)}" data-numeric="${numericCols.has(h) ? 1 : 0}" class="${sortable ? 'sortable' : ''}">${escapeHtml(h)}</th>`;
    }).join('');
    tableHead.innerHTML = `<tr>${ths}</tr>`;
  }

  function renderBody(data, headers, nameKeys, highlights) {
    const nameSet = new Set(highlights.keys());
    const html = data.map(row => {
      const tds = headers.map(h => {
        const val = row[h] ?? '';
        if (nameKeys.includes(h) && val) {
          const color = highlights.get(val);
          if (color) {
            return `<td class="name-cell"><span class="hl" style="background:${escapeAttr(color)}">${escapeHtml(val)}</span></td>`;
          }
          return `<td class="name-cell">${escapeHtml(val)}</td>`;
        }
        return `<td>${escapeHtml(val)}</td>`;
      }).join('');
      return `<tr>${tds}</tr>`;
    }).join('');
    tableBody.innerHTML = html;
  }

  // Helpers
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
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
  function escapeAttr(s) { return escapeHtml(s); }
  function cssEscape(s) { return s.replace(/"/g, '\\"'); }
})();

