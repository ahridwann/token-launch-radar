// Token Radar's page: it reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the ranked board, a filterable table, a per-protocol detail view with the model's
// own inputs and the protocol's farm plan, and the live-token set kept apart. No network:
// every byte it shows is in data.js, and it fetches nothing.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;

  var PAGE_SIZE = 25;
  var state = { q: '', cat: 'all', scope: 'all', sort: 'implied', dir: -1, page: 1, tab: 'board', sel: null };

  // The hash deep-links a view: #/detail/<slug>, #/cat/<category>, #/q/<text>,
  // #/scope/<scope>, #/sort/<key>, #/tab/live. A screenshot opens its view this way.
  function readHash() {
    var h = window.location.hash || '';
    var parts = h.replace(/^#\/?/, '').split('/');
    for (var i = 0; i + 1 < parts.length; i += 2) {
      var key = parts[i];
      var val = '';
      try { val = decodeURIComponent(parts[i + 1]); } catch (e) { val = parts[i + 1]; }
      if (key === 'detail') state.sel = val;
      else if (key === 'cat') state.cat = val;
      else if (key === 'q') state.q = val;
      else if (key === 'scope') state.scope = val;
      else if (key === 'sort') state.sort = val;
      else if (key === 'tab') state.tab = val === 'live' ? 'live' : 'board';
    }
  }
  readHash();

  var $ = function (id) { return document.getElementById(id); };
  var app = $('rows'), head = $('headrow'), pager = $('pager'), detailBox = $('detail');

  var usdShort = function (n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  };
  var usdFull = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  var fmtPct = function (n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  };
  var fmtAge = function (d) {
    if (d === null || d === undefined) return 'unknown';
    if (d >= 365) return (d / 365).toFixed(1) + 'y';
    return d + 'd';
  };
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };

  // The model in one function: the page recomputes a row from the fitted curve in
  // DATA.fit and checks the number board.json carries, so the page's code and the
  // board's data agree. No coefficient lives in this file: the fit rode in data.js.
  function impliedOf(row) {
    var f = DATA.fit;
    var growth = Math.min(f.growth_max, Math.max(f.growth_min, Math.min(150, Math.max(-50, row.change_7d === null ? 0 : row.change_7d))));
    var ageYears = row.age_days === null ? 1 : row.age_days / 365.25;
    ageYears = Math.min(f.age_max_years, Math.max(f.age_min_years, ageYears));
    var growthEffect = f.growth_per_point * growth;
    var ageEffect = f.age_per_year * ageYears;
    var categoryOffset = (f.category_offsets && f.category_offsets[row.category || '']) || 0;
    var logValue = f.intercept + f.tvl_slope * Math.log(row.tvl_usd) + growthEffect + ageEffect + categoryOffset;
    var value = Math.max(1, Math.round(Math.exp(logValue)));
    return { value: value, low: Math.max(1, Math.round(value / f.loo_median_factor)), high: Math.round(value * f.loo_median_factor),
      growth: growth, growthEffect: growthEffect, ageYears: ageYears, ageEffect: ageEffect, categoryOffset: categoryOffset };
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  // Header stats and the category list, both straight from the data.
  var wl = DATA.rows.filter(function (r) { return r.scope === 'watchlist'; }).length;
  $('meta').textContent = 'Snapshot ' + DATA.as_of + ' · ' + DATA.rows.length + ' pre-token protocols ranked · ' +
    wl + ' on the watchlist · ' + DATA.live.length + ' live tokens set aside · model ' + DATA.model_version;
  var stats = $('stats');
  [['board rows', DATA.rows.length], ['watchlist covered', wl + ' / ' + DATA.watchlist_size],
   ['early finds', DATA.early_size], ['comps fitted', DATA.fit.comps_n],
   ['leave-one-out median error', '×' + DATA.fit.loo_median_factor.toFixed(2)],
   ['top implied value', usdShort(DATA.rows[0].implied_value_usd)]].forEach(function (s) {
    var d = el('div', 'stat');
    d.appendChild(el('b', null, String(s[1])));
    d.appendChild(el('span', null, s[0]));
    stats.appendChild(d);
  });
  var catSel = $('cat');
  var cats = {};
  DATA.rows.forEach(function (r) { if (r.category) cats[r.category] = 1; });
  Object.keys(cats).sort().forEach(function (c) {
    var o = el('option', null, c);
    o.value = c;
    catSel.appendChild(o);
  });
  $('source').textContent = 'Data: ' + DATA.source + '. Floor: ' + usdFull.format(DATA.floor_usd) + '.';

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.scope !== 'all' && r.scope !== state.scope) return false;
      if (state.cat !== 'all' && r.category !== state.cat) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  // Comparators run ascending; renderRows multiplies by state.dir, so dir -1 ranks
  // the largest first and a header click flips the order.
  var SORTS = {
    implied: function (a, b) { return a.implied_value_usd - b.implied_value_usd; },
    tvl: function (a, b) { return a.tvl_usd - b.tvl_usd; },
    change: function (a, b) { return (a.change_7d === null ? -1e9 : a.change_7d) - (b.change_7d === null ? -1e9 : b.change_7d); },
    age: function (a, b) { return (a.age_days === null ? -1 : a.age_days) - (b.age_days === null ? -1 : b.age_days); },
    name: function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; },
  };

  function scopeBadge(scope) {
    var label = scope === 'watchlist' ? 'Watchlist' : scope === 'above-floor' ? 'Above floor' : 'Early';
    return '<span class="badge ' + scope + '">' + label + '</span>';
  }

  function renderHead() {
    var cols = state.tab === 'live'
      ? [['Protocol', 'name'], ['Category', null], ['Chains', null], ['TVL', 'tvl'], ['7d', 'change'], ['Market cap', null]]
      : [['#', 'implied'], ['Protocol', 'name'], ['Category', null], ['Chains', null], ['TVL', 'tvl'], ['7d', 'change'], ['Age', 'age'], ['Implied value', 'implied']];
    head.innerHTML = '';
    cols.forEach(function (c) {
      var th = el('th', null, c[0]);
      if (c[1]) {
        th.className = 'sortable' + (c[0] === 'TVL' || c[0] === '7d' || c[0] === 'Age' || c[0] === 'Implied value' || c[0] === '#'
          ? ' num' : '');
        th.title = 'Sort by ' + c[0].toLowerCase();
        th.addEventListener('click', function () {
          var key = c[1];
          if (state.sort === key) state.dir = -state.dir;
          else { state.sort = key; state.dir = key === 'name' ? 1 : -1; }
          state.page = 1;
          render();
        });
      }
      head.appendChild(th);
    });
  }

  function renderRows() {
    app.innerHTML = '';
    var rows, total;
    if (state.tab === 'live') {
      rows = DATA.live.slice();
      total = rows.length;
    } else {
      rows = filtered();
      var fn = SORTS[state.sort] || SORTS.implied;
      rows.sort(function (a, b) { return state.dir * fn(a, b); });
      total = rows.length;
    }
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    var slice = rows.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
    $('empty').hidden = slice.length > 0;
    slice.forEach(function (r) {
      var tr = document.createElement('tr');
      if (state.tab === 'live') {
        tr.innerHTML =
          '<td><span class="name">' + esc(r.name) + '</span><br><span class="slug">' + esc(r.slug) + '</span></td>' +
          '<td>' + esc(r.category || '—') + '</td>' +
          '<td class="hide-m">' + esc(r.chains.slice(0, 2).join(', ')) + '</td>' +
          '<td class="num">' + usdShort(r.tvl_usd) + '</td>' +
          '<td class="num ' + (r.change_7d > 0 ? 'pos' : r.change_7d < 0 ? 'neg' : '') + '">' + fmtPct(r.change_7d) + '</td>' +
          '<td class="num"><span class="val">' + usdShort(r.mcap_usd) + '</span></td>';
        tr.addEventListener('click', function () { state.sel = r.slug; renderDetail(); });
      } else {
        tr.innerHTML =
          '<td class="num">' + r.rank + '</td>' +
          '<td><span class="name">' + esc(r.name) + '</span><br><span class="slug">' + esc(r.slug) + ' · ' + scopeBadge(r.scope) + '</span></td>' +
          '<td>' + esc(r.category || '—') + '</td>' +
          '<td class="hide-m">' + esc(r.chains.slice(0, 2).join(', ')) + '</td>' +
          '<td class="num">' + usdShort(r.tvl_usd) + '</td>' +
          '<td class="num ' + (r.change_7d > 0 ? 'pos' : r.change_7d < 0 ? 'neg' : '') + '">' + fmtPct(r.change_7d) + '</td>' +
          '<td class="num hide-m">' + fmtAge(r.age_days) + '</td>' +
          '<td class="num"><span class="val">' + usdShort(r.implied_value_usd) + '</span></td>';
        if (state.sel === r.slug) tr.className = 'sel';
        tr.addEventListener('click', function () { state.sel = r.slug; render(); });
      }
      app.appendChild(tr);
    });
    pager.innerHTML = '';
    if (total > PAGE_SIZE) {
      var prev = el('button', null, '← Prev');
      prev.disabled = state.page <= 1;
      prev.addEventListener('click', function () { state.page -= 1; render(); });
      var next = el('button', null, 'Next →');
      next.disabled = state.page >= pages;
      next.addEventListener('click', function () { state.page += 1; render(); });
      pager.appendChild(prev);
      pager.appendChild(el('span', 'pg', 'Page ' + state.page + ' of ' + pages + ' · ' + total + ' rows'));
      pager.appendChild(next);
    } else if (total > 0) {
      pager.appendChild(el('span', 'pg', total + ' rows'));
    }
  }

  function renderDetail() {
    var row = null;
    for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === state.sel) { row = DATA.rows[i]; break; }
    // A open detail is a focused view: the header shrinks to its title and the method
    // section steps aside, so the protocol fills the first screen. No scrolling is
    // ever done by script: the detail sits under the header at the top of the page.
    document.body.classList.toggle('detail-open', row !== null);
    if (!row) { detailBox.hidden = true; detailBox.innerHTML = ''; return; }
    var calc = impliedOf(row);
    var match = calc.value === row.implied_value_usd ? 'matches the board' : 'differs from the board';
    detailBox.hidden = false;
    var h = '';
    h += '<button class="close" id="dclose">Close ✕</button>';
    h += '<h2>' + esc(row.name) + '</h2>';
    h += '<p class="sub">Rank #' + row.rank + ' · ' + esc(row.category || 'no category') + ' · ' +
      esc(row.chains.join(', ')) + ' · ' + scopeBadge(row.scope) + ' · listed ' + esc(row.listed_at || 'unknown') + '</p>';
    h += '<div class="grid">' +
      '<div class="cell"><b>' + usdFull.format(row.implied_value_usd) + '</b><span>Implied value (' + usdShort(row.implied_low_usd) + '–' + usdShort(row.implied_high_usd) + ' band)</span></div>' +
      '<div class="cell"><b>' + usdFull.format(row.tvl_usd) + '</b><span>TVL</span></div>' +
      '<div class="cell"><b>' + fmtPct(row.change_7d) + '</b><span>TVL change, 7 days</span></div>' +
      '<div class="cell"><b>' + fmtAge(row.age_days) + '</b><span>Age with no token</span></div></div>';
    h += '<p class="note"><strong>Records no token.</strong> The snapshot carries no market cap, no CoinGecko id and no symbol for ' +
      esc(row.name) + ' — the record, not proof that it has none. Its launch is not predicted here, only valued.</p>';
    h += '<h3>How the value is worked out</h3><p>Fitted curve over ' + DATA.fit.comps_n + ' traded comps: ' +
      'log value = ' + DATA.fit.intercept.toFixed(2) + ' + ' + DATA.fit.tvl_slope.toFixed(2) + '·log TVL (' + usdShort(row.tvl_usd) + ')' +
      ' + ' + calc.growthEffect.toFixed(2) + ' growth (7d ' + fmtPct(calc.growth) + (row.change_7d !== null && row.change_7d !== calc.growth ? ', winsorized from ' + fmtPct(row.change_7d) : '') + ')' +
      ' + ' + calc.ageEffect.toFixed(2) + ' age (' + fmtAge(row.age_days) + ')' +
      ' + ' + calc.categoryOffset.toFixed(2) + ' category (' + esc(row.category || 'no category') + ', shrunk offset)' +
      ' = <b>' + usdFull.format(calc.value) + '</b>, which ' + match + '. The band is ' + usdShort(calc.low) + '–' + usdShort(calc.high) +
      ': the value ×/÷ the leave-one-out median factor ×' + DATA.fit.loo_median_factor.toFixed(2) + '.</p>';
    h += '<p><strong>Netted.</strong> This plan costs $' + row.plan_capital_usd + ' of capital and about $' + row.plan_gas_usd +
      ' of gas. The capital is a deposit that comes back on exit, so the true cost is the gas: about $' + row.plan_gas_usd +
      ' against the low end of the band, ' + usdFull.format(row.implied_low_usd) + '.</p>';
    h += '<h3>Seven steps to farm it</h3><ol>';
    row.farm_steps.forEach(function (s, i) {
      h += '<li><b>Step ' + (i + 1) + '.</b> ' + esc(s) + '</li>';
    });
    h += '</ol>';
    detailBox.innerHTML = h;
    $('dclose').addEventListener('click', function () { state.sel = null; render(); });
  }

  function renderTabs() {
    $('tab-board').className = 'tab' + (state.tab === 'board' ? ' on' : '');
    $('tab-live').className = 'tab' + (state.tab === 'live' ? ' on' : '');
    $('tab-board').setAttribute('aria-selected', state.tab === 'board' ? 'true' : 'false');
    $('tab-live').setAttribute('aria-selected', state.tab === 'live' ? 'true' : 'false');
  }

  function render() {
    renderTabs();
    renderHead();
    renderRows();
    renderDetail();
  }

  $('q').value = state.q;
  $('cat').value = state.cat;
  $('scope').value = state.scope;
  $('sort').value = state.sort;
  $('q').addEventListener('input', function (e) { state.q = e.target.value; state.page = 1; renderRows(); });
  $('cat').addEventListener('change', function (e) { state.cat = e.target.value; state.page = 1; render(); });
  $('scope').addEventListener('change', function (e) { state.scope = e.target.value; state.page = 1; render(); });
  $('sort').addEventListener('change', function (e) {
    state.sort = e.target.value;
    state.dir = state.sort === 'name' ? 1 : -1;
    state.page = 1;
    render();
  });
  $('tab-board').addEventListener('click', function () { state.tab = 'board'; state.page = 1; render(); });
  $('tab-live').addEventListener('click', function () { state.tab = 'live'; state.page = 1; render(); });

  render();
})();
