/* JTI homepage, Version B.
   Plain JavaScript, no libraries. Four parts, each on its own:
     1. Navigation    pins once the top of the hero has scrolled away
     2. Entrance      opens by itself, or on a click, then gets out of the way
     3. Run sheet     any entry opens the recorded instrument behind it
     4. Viewer        opens a sample document full size
   With JavaScript off the page still reads top to bottom: the entrance clears
   itself, entry 3 stays open beside the run sheet, and phones get the sheet. */
(function () {
  'use strict';

  var root = document.documentElement;
  var main = document.getElementById('discover');
  if (!main) return;

  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function one(sel, ctx) { return (ctx || main).querySelector(sel); }
  function all(sel, ctx) { return Array.prototype.slice.call((ctx || main).querySelectorAll(sel)); }

  /* While an overlay is up, the rest of the page is out of reach and does not scroll. */
  function setInert(on, keep) {
    Array.prototype.forEach.call(main.children, function (el) {
      if (el !== keep) el.inert = on;
    });
  }
  var locks = 0;
  function lock(on) {
    locks = Math.max(0, locks + (on ? 1 : -1));
    if (on && locks === 1) {
      var gap = window.innerWidth - root.clientWidth;   /* width of a classic scrollbar, if any */
      root.classList.add('is-locked');
      if (gap > 0) document.body.style.paddingRight = gap + 'px';
    } else if (locks === 0) {
      root.classList.remove('is-locked');
      document.body.style.paddingRight = '';
    }
  }

  /* 1. Navigation ---------------------------------------------------------- */
  (function () {
    var nav = one('.nav'), top = one('.hero__top');
    if (!nav || !top || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (entries) {
      var e = entries[entries.length - 1];
      nav.classList.toggle('is-stuck', !e.isIntersecting && e.boundingClientRect.height > 0);
    }).observe(top);
  })();

  /* A link into the page (#work, say) is honoured again once the fonts have arrived,
     because the text shifts a little when they do. */
  (function () {
    if (location.hash.length < 2 || !document.fonts || !document.fonts.ready) return;
    var moved = false;
    ['wheel', 'touchmove', 'keydown', 'pointerdown'].forEach(function (name) {
      window.addEventListener(name, function () { moved = true; }, { once: true, passive: true });
    });
    document.fonts.ready.then(function () {
      if (moved) return;
      var target = null;
      try { target = document.getElementById(decodeURIComponent(location.hash.slice(1))); } catch (err) { /* odd address */ }
      if (target && target !== main) target.scrollIntoView({ behavior: 'instant' });
    });
  })();

  /* 2. Entrance ------------------------------------------------------------ */
  (function () {
    var el = document.getElementById('entrance');
    if (!el) return;
    var auto = root.classList.contains('has-intro');
    var gate = root.classList.contains('has-gate');
    if (!auto && !gate) { el.remove(); return; }   /* skipped: the address pointed into the page */

    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      el.remove();
      root.classList.remove('has-intro', 'has-gate', 'is-opening', 'is-skipping', 'intro-wait');
      if (gate) {
        setInert(false);
        lock(false);
        main.focus({ preventScroll: true });
      }
    }
    el.addEventListener('animationend', function (e) {
      if (e.target === el && e.animationName === 'jti-intro-end') finish();
    });

    if (auto) {
      /* Start once the photograph has arrived. */
      var img = el.querySelector('img');
      var start = function () { root.classList.remove('intro-wait'); };
      if (!img || img.complete) start();
      else { img.addEventListener('load', start); img.addEventListener('error', start); }

      /* Any click, key or scroll takes the visitor straight in. */
      var events = ['pointerdown', 'keydown', 'wheel', 'touchmove'];
      var skip = function () {
        events.forEach(function (name) { window.removeEventListener(name, skip, true); });
        if (finished) return;
        root.classList.remove('intro-wait');
        root.classList.add('is-skipping');
        window.setTimeout(finish, 320);
      };
      events.forEach(function (name) { window.addEventListener(name, skip, { capture: true, passive: true }); });
      window.setTimeout(finish, 6000);   /* safety net if the animation never reports back */
    } else {
      var link = el.querySelector('.intro__lockup');
      lock(true);
      setInert(true, el);
      var open = function (e) {
        if (e) e.preventDefault();
        if (root.classList.contains('is-opening')) return;
        root.classList.add('is-opening');
        try { history.replaceState(null, '', '#discover'); } catch (err) { /* the address is cosmetic */ }
        window.setTimeout(finish, reduced ? 500 : 1400);   /* safety net behind animationend */
      };
      if (link) link.addEventListener('click', open);
    }
  })();

  /* 3. Run sheet ----------------------------------------------------------- */
  (function () {
    var proof = one('.proof');
    if (!proof) return;
    var grid = one('.proof__grid', proof);
    var table = one('.sheet__table', proof);
    var sheet = one('.proof__sheet .doc', proof);
    var source = one('.source', proof);
    if (!grid || !table || !sheet || !source) return;
    var rows = all('tbody tr[data-entry]', table);
    var cards = all('.source__card', source);
    if (!rows.length || !cards.length) return;

    var entry = one('.entry', proof);
    var hint = one('.proof__hint');
    var wide = window.matchMedia('(min-width: 1150px)');     /* sheet and card side by side */
    var phone = window.matchMedia('(max-width: 767px)');     /* one entry at a time */
    var current = (table.querySelector('tr.is-cited') || rows[0]).getAttribute('data-entry');

    function indexOfCurrent() {
      for (var i = 0; i < rows.length; i++) if (rows[i].getAttribute('data-entry') === current) return i;
      return 0;
    }

    /* Put the card beside its entry and run the hairline from one to the other. */
    function place() {
      if (!wide.matches) {
        source.style.removeProperty('--card-y');
        source.style.removeProperty('--link-top');
        return;
      }
      var tr = rows[indexOfCurrent()];
      var card = cards.filter(function (c) { return !c.hidden; })[0];
      var deed = card && card.querySelector('.deed');
      if (!deed) return;
      var gridBox = grid.getBoundingClientRect();
      var rowBox = tr.getBoundingClientRect();
      var rowMid = rowBox.top + rowBox.height / 2 - gridBox.top;
      var deedTop = deed.getBoundingClientRect().top - source.getBoundingClientRect().top;
      var deedHeight = deed.offsetHeight;
      /* The line meets the deed a little below its top edge, as it does for entry 3 in Version A. */
      var anchor = deedTop + Math.min(0.217 * source.offsetWidth, deedHeight * 0.4);
      /* The card may run a little past the foot of the sheet, never above its head. */
      var lowest = Math.max(0, sheet.offsetHeight - source.offsetHeight + 40);
      var y = Math.max(0, Math.min(rowMid - anchor, lowest));
      var line = rowMid - y;
      var last = deedTop + deedHeight - 14;
      if (line > last) { y += line - last; line = last; }   /* the line must land on the deed */
      source.style.setProperty('--card-y', y.toFixed(1) + 'px');
      source.style.setProperty('--link-top', line.toFixed(1) + 'px');
    }

    /* Phones: the same entry as a card of labelled fields. */
    function fillEntry() {
      if (!entry) return;
      var i = indexOfCurrent(), cells = rows[i].cells;
      var dates = cells[4].innerHTML.split(/<br\s*\/?>/i);
      var values = {
        instrument: cells[1].textContent, grantor: cells[2].textContent, grantee: cells[3].textContent,
        dated: dates[0] || '', recorded: dates[1] || '', ref: cells[5].textContent, remarks: cells[6].textContent
      };
      Object.keys(values).forEach(function (key) {
        var slot = entry.querySelector('[data-f="' + key + '"]');
        if (slot) slot.textContent = values[key].trim();
      });
      var count = entry.querySelector('.entry__count');
      if (count) count.textContent = 'Entry ' + cells[0].textContent.trim() + ' of ' + rows.length;
      var prev = entry.querySelector('[data-step="-1"]'), next = entry.querySelector('[data-step="1"]');
      if (prev) prev.disabled = i === 0;
      if (next) next.disabled = i === rows.length - 1;
    }

    function select(n, byVisitor) {
      current = String(n);
      rows.forEach(function (tr) {
        var on = tr.getAttribute('data-entry') === current;
        tr.classList.toggle('is-cited', on);
        var button = tr.querySelector('.cite');
        if (button) button.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      cards.forEach(function (c) { c.hidden = c.getAttribute('data-entry') !== current; });
      source.setAttribute('aria-label', 'The recorded instrument behind entry ' + current);
      proof.classList.toggle('is-moving', !!byVisitor);
      fillEntry();
      place();
      /* Stacked layout: the instrument sits below the sheet, so bring it into view. */
      if (byVisitor && !wide.matches && !phone.matches) {
        source.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
      }
    }

    /* Each book and page becomes a button; the whole row answers a click as well. */
    rows.forEach(function (tr) {
      var n = tr.getAttribute('data-entry');
      var cell = tr.cells[5];
      var ref = cell.textContent.trim();
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'cite';
      button.textContent = ref;
      button.setAttribute('aria-controls', 'instrument');
      button.setAttribute('aria-label', ref + '. Show the instrument behind entry ' + n);
      cell.textContent = '';
      cell.appendChild(button);
      tr.addEventListener('click', function () {
        if (window.getSelection && String(window.getSelection())) return;   /* the visitor is selecting text */
        select(n, true);
      });
    });

    if (entry) {
      all('[data-step]', entry).forEach(function (button) {
        button.addEventListener('click', function () {
          var i = indexOfCurrent() + Number(button.getAttribute('data-step'));
          if (i >= 0 && i < rows.length) select(rows[i].getAttribute('data-entry'), true);
        });
      });
    }

    proof.classList.add('is-live');
    if (hint) hint.hidden = false;
    select(current, false);

    /* Keep the card on its entry when the layout changes size. */
    var settle = function () { proof.classList.remove('is-moving'); place(); };
    if ('ResizeObserver' in window) {
      var watcher = new ResizeObserver(settle);
      watcher.observe(sheet);
      watcher.observe(source);
    } else {
      window.addEventListener('resize', settle);
    }
    window.addEventListener('load', settle);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);
  })();

  /* 4. Viewer --------------------------------------------------------------- */
  (function () {
    var viewer = one('.viewer');
    if (!viewer) return;
    var stage = one('.viewer__stage', viewer);
    var holder = one('.viewer__doc', viewer);
    var title = one('.viewer__title', viewer);
    var count = one('.viewer__count', viewer);
    var closeButton = one('.viewer__close', viewer);
    if (!stage || !holder || !title || !count || !closeButton) return;

    /* The documents, in the order they appear on the page. */
    var docs = [];
    var sheet = one('.proof .doc--sheet');
    if (sheet) docs.push({ el: sheet, title: 'Run sheet', kind: 'sheet' });
    all('.pages .fig').forEach(function (fig) {
      var doc = fig.querySelector('.doc'), name = fig.querySelector('.fig__name');
      if (doc) docs.push({ el: doc, title: name ? name.textContent.trim() : 'Document', kind: 'page' });
    });
    if (!docs.length) return;

    var index = 0, isOpen = false, opener = null;

    function show(i) {
      index = (i + docs.length) % docs.length;
      var doc = docs[index];
      var copy = doc.el.cloneNode(true);
      /* A clean copy: no highlight, no buttons, nothing that answers a click. */
      copy.classList.remove('doc--stack');
      all('.is-cited', copy).forEach(function (el) { el.classList.remove('is-cited'); });
      all('.cite', copy).forEach(function (button) { button.replaceWith(document.createTextNode(button.textContent)); });
      all('[id]', copy).forEach(function (el) { el.removeAttribute('id'); });
      holder.textContent = '';
      holder.appendChild(copy);
      viewer.setAttribute('data-kind', doc.kind);
      title.textContent = doc.title;
      count.textContent = (index + 1) + ' of ' + docs.length;
      stage.scrollTop = 0;
      stage.scrollLeft = 0;
    }

    function open(i, from) {
      if (isOpen) { show(i); return; }
      opener = from || document.activeElement;
      show(i);
      viewer.hidden = false;
      isOpen = true;
      lock(true);
      setInert(true, viewer);
      closeButton.focus({ preventScroll: true });
      /* The Back button closes the viewer instead of leaving the page. */
      try { history.pushState({ jtiViewer: true }, ''); } catch (err) { /* not essential */ }
    }

    function close(viaBack) {
      if (!isOpen) return;
      isOpen = false;
      viewer.hidden = true;
      holder.textContent = '';
      setInert(false);
      lock(false);
      if (opener && opener.focus) opener.focus({ preventScroll: true });
      opener = null;
      if (!viaBack && history.state && history.state.jtiViewer) history.back();
    }

    window.addEventListener('popstate', function () { close(true); });
    document.addEventListener('keydown', function (e) {
      if (!isOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowLeft') show(index - 1);
      else if (e.key === 'ArrowRight') show(index + 1);
    });
    closeButton.addEventListener('click', function () { close(); });
    stage.addEventListener('click', function (e) { if (e.target === stage) close(); });   /* a click beside the page */
    all('[data-step]', viewer).forEach(function (button) {
      button.addEventListener('click', function () { show(index + Number(button.getAttribute('data-step'))); });
    });

    /* Ways in: the "View full size" buttons, and the pages themselves. */
    all('[data-view]').forEach(function (button) {
      button.hidden = false;
      button.addEventListener('click', function (e) {
        e.stopPropagation();
        open(Number(button.getAttribute('data-view')), button);
      });
    });
    var pages = one('.pages');
    if (pages) {
      pages.classList.add('is-live');
      docs.forEach(function (doc, i) {
        if (doc.kind !== 'page') return;
        doc.el.addEventListener('click', function () {
          var fig = doc.el.closest('.fig');
          open(i, fig ? fig.querySelector('[data-view]') : null);
        });
      });
    }
  })();
})();
