(function () {
  var content = document.getElementById('content');
  var toolbar = document.getElementById('toolbar');
  var input = document.getElementById('search');
  var count = document.getElementById('count');
  var categories = document.getElementById('categories');
  var stats = document.getElementById('stats');
  var empty = document.getElementById('empty');
  var emptyQuery = document.getElementById('empty-query');
  var clear = document.getElementById('clear');
  var toTop = document.getElementById('to-top');
  if (!content || !toolbar || !input) return;

  function each(list, fn) { Array.prototype.forEach.call(list, fn); }
  function make(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }

  // The hero replaces the README's title, intro and static navigation list.
  var firstSection = content.querySelector('h2');
  while (content.firstElementChild && content.firstElementChild !== firstSection) {
    content.removeChild(content.firstElementChild);
  }

  // Turn a rendered "[name](url) - description" list item into a card.
  function toEntry(li) {
    var link = li.querySelector('a');
    if (!link) return { el: li, text: li.textContent.toLowerCase() };

    var name = link.textContent;
    var desc = li.textContent.replace(name, '').replace(/^\s*-+\s*/, '').trim();
    var url = new URL(link.href);
    var path = url.pathname.split('/').filter(Boolean);
    var source = url.hostname === 'github.com' && path.length >= 2
      ? path[0] + '/' + path[1]
      : url.hostname.replace(/^www\./, '');

    li.textContent = '';
    li.className = 'entry';
    link.className = 'name';
    var descEl = make('p', 'desc', desc);
    li.appendChild(link);
    li.appendChild(descEl);
    li.appendChild(make('span', 'source', source));

    return {
      el: li,
      name: link,
      nameText: name,
      desc: descEl,
      descText: desc,
      text: (name + ' ' + desc + ' ' + source).toLowerCase()
    };
  }

  // Group the content into blocks: one per heading, holding its own entries.
  var blocks = [];
  var current = null;
  each(content.children, function (el) {
    if (/^H[23]$/.test(el.tagName)) {
      current = { heading: el, title: el.textContent, level: Number(el.tagName[1]), items: [] };
      blocks.push(current);
    } else if (current && el.tagName === 'UL') {
      el.className = 'entries';
      each(el.children, function (li) { current.items.push(toEntry(li)); });
    }
  });

  var sections = [];
  blocks.forEach(function (b) {
    if (b.level === 2) {
      b.subsections = [];
      sections.push(b);
    } else if (sections.length) {
      sections[sections.length - 1].subsections.push(b);
    }

    b.badge = make('span', 'badge');
    b.heading.appendChild(b.badge);
    var anchor = make('a', 'anchor', '#');
    anchor.href = '#' + b.heading.id;
    anchor.setAttribute('aria-label', 'Link to ' + b.title);
    b.heading.appendChild(anchor);
  });

  var total = blocks.reduce(function (n, b) { return n + b.items.length; }, 0);
  if (stats) stats.textContent = total + ' entries · ' + sections.length + ' categories';
  input.placeholder = 'Search ' + total + ' scripts, libraries and tools…';

  sections.forEach(function (s) {
    s.chip = make('a', null, s.title);
    s.chip.href = '#' + s.heading.id;
    s.chipCount = make('span');
    s.chip.appendChild(s.chipCount);
    categories.appendChild(s.chip);
  });

  function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function highlight(el, text, pattern) {
    el.textContent = '';
    if (!pattern) { el.textContent = text; return; }
    // split() with a capturing group puts the matches at the odd indices.
    text.split(pattern).forEach(function (part, i) {
      if (part) el.appendChild(i % 2 ? make('mark', null, part) : document.createTextNode(part));
    });
  }

  function filter() {
    var query = input.value.trim();
    var terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    var pattern = terms.length ? new RegExp('(' + terms.map(escapeRegExp).join('|') + ')', 'gi') : null;
    var shown = 0;

    blocks.forEach(function (b) {
      b.visible = 0;
      b.items.forEach(function (item) {
        var match = terms.every(function (t) { return item.text.indexOf(t) !== -1; });
        item.el.hidden = !match;
        if (!match) return;
        b.visible++;
        if (item.name) {
          highlight(item.name, item.nameText, pattern);
          highlight(item.desc, item.descText, pattern);
        }
      });
      shown += b.visible;
    });

    // A section stays visible when its own entries match, or when any subsection does.
    sections.forEach(function (s) {
      var n = s.subsections.reduce(function (sum, sub) {
        sub.heading.hidden = sub.visible === 0;
        sub.badge.textContent = sub.visible;
        return sum + sub.visible;
      }, s.visible);
      s.heading.hidden = n === 0;
      s.badge.textContent = n;
      s.chipCount.textContent = n;
      s.chip.classList.toggle('dim', n === 0);
    });

    count.textContent = terms.length ? shown + ' of ' + total : '';
    emptyQuery.textContent = query;
    empty.hidden = shown > 0;

    var url = new URL(window.location.href);
    if (query) url.searchParams.set('q', query); else url.searchParams.delete('q');
    history.replaceState(null, '', url);
  }

  // Keep the results in view when searching from further down the page.
  function revealResults() {
    var top = content.getBoundingClientRect().top + window.scrollY - toolbar.offsetHeight;
    if (window.scrollY > top) window.scrollTo({ top: top, behavior: 'instant' });
  }

  // Highlight the chip of the section currently being read.
  var active = null;
  function spy() {
    var bar = toolbar.getBoundingClientRect();
    var line = bar.bottom + (window.innerHeight - bar.bottom) * 0.25;
    var reading = null;
    // Only once the toolbar is pinned; at the top of the page nothing is being read yet.
    if (bar.top <= 0) {
      sections.forEach(function (s) {
        if (!s.heading.hidden && s.heading.getBoundingClientRect().top <= line) reading = s;
      });
    }
    if (reading === active) return;
    if (active) active.chip.classList.remove('active');
    active = reading;
    if (!active) return;
    active.chip.classList.add('active');
    categories.scrollTo({
      left: active.chip.offsetLeft - (categories.clientWidth - active.chip.offsetWidth) / 2,
      behavior: 'smooth'
    });
  }

  function fadeChips() {
    var max = categories.scrollWidth - categories.clientWidth;
    categories.classList.toggle('fade-start', categories.scrollLeft > 4);
    categories.classList.toggle('fade-end', categories.scrollLeft < max - 4);
  }

  function onScroll() {
    toolbar.classList.toggle('stuck', toolbar.getBoundingClientRect().top <= 0);
    if (toTop) toTop.hidden = window.scrollY < 800;
    spy();
  }

  function syncOffset() {
    document.documentElement.style.scrollPaddingTop = toolbar.offsetHeight + 16 + 'px';
    fadeChips();
  }

  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; onScroll(); });
  }, { passive: true });
  window.addEventListener('resize', syncOffset);

  categories.addEventListener('scroll', fadeChips, { passive: true });
  categories.addEventListener('wheel', function (e) {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX) || categories.scrollWidth <= categories.clientWidth) return;
    e.preventDefault();
    categories.scrollLeft += e.deltaY;
  }, { passive: false });

  input.addEventListener('input', function () { filter(); revealResults(); spy(); });
  clear.addEventListener('click', function () { input.value = ''; filter(); input.focus(); });
  if (toTop) toTop.addEventListener('click', function () { window.scrollTo({ top: 0 }); });

  document.addEventListener('keydown', function (e) {
    var typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
    if (e.key === '/' && !typing) {
      e.preventDefault();
      input.focus();
      input.select();
    } else if (e.key === 'Escape' && document.activeElement === input) {
      input.value = '';
      filter();
      input.blur();
    }
  });

  input.value = new URLSearchParams(window.location.search).get('q') || '';
  toolbar.hidden = false;
  filter();
  syncOffset();
  onScroll();
})();
