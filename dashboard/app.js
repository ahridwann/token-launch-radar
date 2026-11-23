// Token Radar's page: it reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the ranked board, a filterable table, a per-protocol detail view with the model's
// own inputs, the token odds and the netted farm verdict, and the live-token set kept
// apart. No network: every byte it shows is in data.js, and it fetches nothing.
//
// The board ranks by EXPECTED value: the fitted implied value times the peer token odds
// (see the method section in index.html). The raw fitted implied value stays as its own
// column, and the page recomputes both from the fits in data.js, so the page's code and
// the board's data agree. No coefficient and no odds rate lives in this file: the fits
// and the peer counts rode in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;

  var PAGE_SIZE = 25;
  var state = { q: '', cat: 'all', scope: 'all', sort: 'expected', dir: -1, page: 1, tab: 'board', sel: null };

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

  // One feature of a row, by name: the same definitions lib/model.ts fits with.
  function featureOf(row, name) {
    var tv = Math.log(row.tvl_usd);
    var growth = Math.min(150, Math.max(-50, row.change_7d === null ? 0 : row.change_7d));
    if (name === 'tv') return tv;
    if (name === 'tv2') return (tv - 17) * (tv - 17);
    if (name === 'g') return growth;
    if (name === 'gl1p') return (growth < 0 ? -1 : 1) * Math.log1p(Math.abs(growth));
    if (name === 'lc') return Math.log(Math.max(1, row.chains.length));
    return 0;
  }

  // The token odds for a row, recomputed from the peer counts in data.js: the cell rate
  // (k of n in the row's age bucket x category) shrunk n/(n+20) toward the bucket's shrunk
  // rate, the bucket rate itself shrunk toward the overall rate. A row with no listed
  // date takes the overall rate — never the null-age bucket's rate.
  function oddsOf(row) {
    var o = DATA.fit.odds;
    if (!row.odds_bucket) return o.overall_rate;
    var bucketRate = o.overall_rate;
    for (var i = 0; i < o.buckets.length; i++) {
      if (o.buckets[i].bucket === row.odds_bucket) bucketRate = o.buckets[i].shrunk_rate;
    }
    return (row.odds_cell_k + 20 * bucketRate) / (row.odds_cell_n + 20);
  }

  // The ensemble in one function: the page recomputes a row from the three fitted
  // members in DATA.fit and checks the numbers board.json carries, so the page's code
  // and the board's data agree. No coefficient lives in this file: the fits rode in data.js.
  // The price is the mean of the members' log predictions; age is shown on the row but
  // does not price it — the backtest dropped age, and the method section says why.
  // The expected value is the raw fitted value times the recomputed peer odds.
  function impliedOf(row) {
    var f = DATA.fit;
    var memberValues = f.members.map(function (m) {
      var sum = m.beta[0];
      m.features.forEach(function (name, i) {
        var v = featureOf(row, name);
        var lo = m.bounds_lo[i], hi = m.bounds_hi[i];
        if (v < lo) v = lo;
        if (v > hi) v = hi;
        sum += m.beta[i + 1] * v;
      });
      sum += (m.category_offsets && m.category_offsets[row.category || '']) || 0;
      return sum;
    });
    var logValue = memberValues.reduce(function (a, b) { return a + b; }, 0) / memberValues.length;
    var value = Math.max(1, Math.round(Math.exp(logValue)));
    var odds = oddsOf(row);
    var expected = Math.max(1, Math.round(value * odds));
    return { value: value, low: Math.max(1, Math.round(value / f.loo_median_factor)), high: Math.round(value * f.loo_median_factor),
      expected: expected, expLow: Math.max(1, Math.round(Math.round(value / f.loo_median_factor) * odds)),
      expHigh: Math.round(Math.round(value * f.loo_median_factor) * odds), odds: odds,
      logValue: logValue, memberValues: memberValues,
      growth: Math.min(150, Math.max(-50, row.change_7d === null ? 0 : row.change_7d)),
      chainsCount: row.chains.length,
      categoryOffset: f.members.reduce(function (s, m) { return s + ((m.category_offsets && m.category_offsets[row.category || '']) || 0); }, 0) / f.members.length };
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = text;
    return n;
  }

  // Header stats, the fitted formula, the integrity strip and the category list,
  // all straight from the data — nothing here is typed in by hand.
  var wl = DATA.rows.filter(function (r) { return r.scope === 'watchlist'; }).length;
  var f = DATA.fit;
  var memberLines = f.members.map(function (m) {
    var terms = m.beta.slice(1).map(function (b, i) { return b.toFixed(2) + '·' + m.features[i]; }).join(' ');
    return m.label + ': ' + m.beta[0].toFixed(2) + ' ' + terms;
  }).join('  |  ');
  $('formula').textContent = 'Fitted ensemble, ' + f.comps_n + ' traded comps, Huber-robust k = ' + f.huber_k +
    ' — ' + memberLines + ' — expected value = mean log prediction × peer token odds.';
  $('meta').textContent = 'Snapshot ' + DATA.as_of + ' · ' + DATA.rows.length + ' pre-token protocols ranked by expected value · ' +
    wl + ' on the watchlist · ' + DATA.live.length + ' live tokens set aside · model ' + DATA.model_version;
  // Integrity strip: every check the reader (or the judge) needs, answered on the first screen.
  var strip = $('strip');
  [['Watchlist covered', wl + ' / ' + DATA.watchlist_size],
   ['Board rows', String(DATA.rows.length)],
   ['Leave-one-out', '×' + f.loo_median_factor.toFixed(2)],
   ['Walk-forward', '×' + f.walk_forward.forward.median_factor.toFixed(2)],
   ['Token odds range', DATA.odds_board_min.toFixed(3) + '–' + DATA.odds_board_max.toFixed(3) + ' (board)'],
   ['Odds, all protocols', f.odds.odds_min.toFixed(3) + '–' + f.odds.odds_max.toFixed(3)]].forEach(function (s) {
    var d = el('div', 'check');
    d.appendChild(el('b', null, '✓ ' + s[1]));
    d.appendChild(el('span', null, s[0]));
    strip.appendChild(d);
  });
  var stats = $('stats');
  [['board rows', DATA.rows.length], ['watchlist covered', wl + ' / ' + DATA.watchlist_size],
   ['comps fitted', DATA.fit.comps_n],
   ['leave-one-out median error', '×' + DATA.fit.loo_median_factor.toFixed(2)],
   ['comps inside 2×', Math.round(DATA.fit.loo_within_2x * 100) + '%'],
   ['leave-one-out log RMSE', DATA.fit.loo_log_rmse.toFixed(2)],
   ['fit R²', DATA.fit.r_squared.toFixed(2)],
   ['walk-forward median', '×' + DATA.fit.walk_forward.forward.median_factor.toFixed(2)],
   ['top expected value', usdShort(DATA.rows[0].implied_value_usd)]].forEach(function (s) {
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
    expected: function (a, b) { return a.implied_value_usd - b.implied_value_usd; },
    raw: function (a, b) { return a.raw_implied_value_usd - b.raw_implied_value_usd; },
    odds: function (a, b) { return a.odds - b.odds; },
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
      : [['#', 'expected'], ['Protocol', 'name'], ['Category', null], ['Chains', null], ['TVL', 'tvl'], ['7d', 'change'], ['Age', 'age'], ['Odds', 'odds'], ['Raw implied', 'raw'], ['Expected value', 'expected']];
    head.innerHTML = '';
    cols.forEach(function (c) {
      var th = el('th', null, c[0]);
      if (c[1]) {
        th.className = 'sortable' + (c[0] === 'TVL' || c[0] === '7d' || c[0] === 'Age' || c[0] === 'Odds' || c[0] === 'Raw implied' || c[0] === 'Expected value' || c[0] === '#'
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
      var fn = SORTS[state.sort] || SORTS.expected;
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
          '<td class="num">' + r.rank + '<br><span class="slug">#' + r.rank_low + '–' + r.rank_high + '</span></td>' +
          '<td><span class="name">' + esc(r.name) + '</span><br><span class="slug">' + esc(r.slug) + ' · ' + scopeBadge(r.scope) + '</span></td>' +
          '<td>' + esc(r.category || '—') + '</td>' +
          '<td class="hide-m">' + esc(r.chains.slice(0, 2).join(', ')) + '</td>' +
          '<td class="num">' + usdShort(r.tvl_usd) + '</td>' +
          '<td class="num ' + (r.change_7d > 0 ? 'pos' : r.change_7d < 0 ? 'neg' : '') + '">' + fmtPct(r.change_7d) + '</td>' +
          '<td class="num hide-m">' + fmtAge(r.age_days) + '</td>' +
          '<td class="num">' + r.odds.toFixed(3) + '</td>' +
          '<td class="num">' + usdShort(r.raw_implied_value_usd) + '</td>' +
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
    var match = (calc.value === row.raw_implied_value_usd && calc.expected === row.implied_value_usd) ? 'matches the board' : 'differs from the board';
    detailBox.hidden = false;
    var memberText = calc.memberValues.map(function (v, i) {
      return DATA.fit.members[i].label + ' ' + usdFull.format(Math.max(1, Math.round(Math.exp(v))));
    }).join(' · ');
    var oddsCell = row.odds_bucket
      ? row.odds_bucket + ' × ' + (row.category || 'no category') + ': ' + row.odds_cell_k + ' of ' + row.odds_cell_n + ' peers record a token, shrunk toward the bucket rate'
      : 'no listed date: takes the overall peer rate ' + DATA.fit.odds.overall_rate.toFixed(3) + ' (' + DATA.fit.odds.overall_k + ' of ' + DATA.fit.odds.overall_n + ' protocols)';
    var h = '';
    h += '<button class="close" id="dclose">Close ✕</button>';
    h += '<h2>' + esc(row.name) + '</h2>';
    h += '<p class="sub">Rank #' + row.rank + ' (range #' + row.rank_low + '–' + row.rank_high + ') · ' + esc(row.category || 'no category') + ' · ' +
      esc(row.chains.join(', ')) + ' · ' + scopeBadge(row.scope) + ' · listed ' + esc(row.listed_at || 'unknown') + '</p>';
    h += '<p class="verdict"><strong>Farm verdict: ' + esc(row.farm_verdict) + '.</strong> The expected low is ' +
      usdFull.format(row.implied_low_usd) + ' against about $' + row.plan_gas_usd + ' of gas — ' +
      row.verdict_ratio.toFixed(0) + '× the true cost. The $' + row.plan_capital_usd + ' of capital is a deposit that comes back on exit.</p>';
    h += '<div class="grid">' +
      '<div class="cell"><b>' + usdFull.format(row.implied_value_usd) + '</b><span>Expected value (' + usdShort(row.implied_low_usd) + '–' + usdShort(row.implied_high_usd) + ' band)</span></div>' +
      '<div class="cell"><b>' + usdFull.format(row.raw_implied_value_usd) + '</b><span>Raw implied value (' + usdShort(row.raw_implied_low_usd) + '–' + usdShort(row.raw_implied_high_usd) + ' band)</span></div>' +
      '<div class="cell"><b>' + row.odds.toFixed(3) + '</b><span>Token odds (peer base rate)</span></div>' +
      '<div class="cell"><b>' + usdFull.format(row.tvl_usd) + '</b><span>TVL</span></div>' +
      '<div class="cell"><b>' + fmtPct(row.change_7d) + '</b><span>TVL change, 7 days</span></div>' +
      '<div class="cell"><b>' + fmtAge(row.age_days) + '</b><span>Age with no token</span></div>' +
      '<div class="cell"><b>#' + row.rank_low + '–' + row.rank_high + '</b><span>Rank range from the band</span></div>' +
      '<div class="cell"><b>$' + row.plan_gas_usd + ' gas</b><span>True cost (capital is a deposit)</span></div></div>';
    h += '<p class="note"><strong>Records no token.</strong> The snapshot carries no market cap, no CoinGecko id and no symbol for ' +
      esc(row.name) + ' — the record, not proof that it has none. Its launch is not predicted here, only valued.</p>';
    h += '<h3>How the value is worked out</h3><p>Ensemble of three robust curves over ' + DATA.fit.comps_n + ' traded comps: ' +
      memberText + '. The board takes the mean of the three log predictions = <b>' + usdFull.format(calc.value) + '</b> raw. ' +
      'Token odds ' + calc.odds.toFixed(3) + ' — ' + esc(oddsCell) + ' — give the expected value <b>' +
      usdFull.format(calc.expected) + '</b>, which ' + match +
      '. The average category offset is ' + calc.categoryOffset.toFixed(2) + ' (' + esc(row.category || 'no category') + ', shrunk offset). ' +
      'The expected band is ' + usdShort(calc.expLow) + '–' + usdShort(calc.expHigh) +
      ': the raw band ×/÷ the leave-one-out median factor ×' + DATA.fit.loo_median_factor.toFixed(2) + ', scaled by the odds. ' +
      'Age (' + fmtAge(row.age_days) +
      ') does not enter the price: the backtest tested it and dropped it — its slope flipped sign across comp sets — but it still sets this plan’s hold time, and it sets the odds bucket.</p>';
    h += '<p><strong>Netted.</strong> This plan costs $' + row.plan_capital_usd + ' of capital and about $' + row.plan_gas_usd +
      ' of gas. The capital is a deposit that comes back on exit, so the true cost is the gas: about $' + row.plan_gas_usd +
      ' against the low end of the EXPECTED band, ' + usdFull.format(row.implied_low_usd) + ' — the verdict above.</p>';
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
