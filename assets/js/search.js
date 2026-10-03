(function () {
  var content = document.getElementById('content');
  var toolbar = document.getElementById('toolbar');
  var input = document.getElementById('search');
  var count = document.getElementById('count');
  var categories = document.getElementById('categories');
  var empty = document.getElementById('empty');
  if (!content || !toolbar || !input) return;

  // Group the rendered README into blocks: one per heading, holding its own list items.
  var blocks = [];
  var current = null;
  Array.prototype.forEach.call(content.children, function (el) {
    if (/^H[23]$/.test(el.tagName)) {
      current = { heading: el, level: Number(el.tagName[1]), items: [] };
      blocks.push(current);
    } else if (current && el.tagName === 'UL') {
      Array.prototype.forEach.call(el.children, function (li) {
        current.items.push({ el: li, text: li.textContent.toLowerCase() });
      });
    }
  });

  var total = blocks.reduce(function (n, b) { return n + b.items.length; }, 0);

  // Replace the README's static "Navigation:" list with category chips.
  Array.prototype.forEach.call(content.querySelectorAll('p'), function (p) {
    if (/^\s*Navigation:/.test(p.textContent)) {
      var list = p.nextElementSibling;
      p.hidden = true;
      if (list && list.tagName === 'UL') list.hidden = true;
    }
  });
  blocks.filter(function (b) { return b.level === 2; }).forEach(function (b) {
    var a = document.createElement('a');
    a.href = '#' + b.heading.id;
    a.textContent = b.heading.textContent;
    categories.appendChild(a);
  });

  function setVisible(el, visible) { el.hidden = !visible; }

  function filter() {
    var terms = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    var shown = 0;

    blocks.forEach(function (b) {
      b.visible = 0;
      b.items.forEach(function (item) {
        var match = terms.every(function (t) { return item.text.indexOf(t) !== -1; });
        setVisible(item.el, match);
        if (match) b.visible++;
      });
      shown += b.visible;
    });

    // A heading stays visible when its own items match, or when any sub-section does.
    blocks.forEach(function (b, i) {
      var visible = b.visible;
      if (b.level === 2) {
        for (var j = i + 1; j < blocks.length && blocks[j].level === 3; j++) visible += blocks[j].visible;
      }
      setVisible(b.heading, terms.length === 0 || visible > 0);
    });

    count.textContent = terms.length ? shown + ' of ' + total : total + ' entries';
    empty.hidden = shown > 0 || terms.length === 0;

    var url = new URL(window.location.href);
    if (input.value) url.searchParams.set('q', input.value); else url.searchParams.delete('q');
    history.replaceState(null, '', url);
  }

  input.addEventListener('input', filter);
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
})();
