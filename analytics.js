/* ============================================================
   Event layer — GCW / SignlLabs
   ------------------------------------------------------------
   The Google tag in <head> gives page views, scrolls to 90%,
   outbound clicks, site search, video and file downloads through
   Enhanced Measurement. This file adds the events that matter to
   the business and that Google cannot infer: who asked to be
   contacted, who wanted the whitepaper, which case studies get
   read, how far down people actually get, what they clicked to
   reach us, and how long they stayed.

   Every send is wrapped: if the tag is blocked by an ad blocker
   or still loading, nothing here throws and the page carries on.
   ============================================================ */
(function () {
  'use strict';

  var DL = (window.dataLayer = window.dataLayer || []);

  function send(name, params) {
    var p = params || {};
    try {
      p.page_path = location.pathname;
      p.page_title = document.title;
      if (typeof window.gtag === 'function') {
        window.gtag('event', name, p);
      } else {
        // the tag has not landed yet — queue it, gtag drains dataLayer
        DL.push(['event', name, p]);
      }
    } catch (e) { /* analytics must never break the page */ }
  }
  window.gcwTrack = send;   // so page-specific code can fire events too

  /* ---------- what kind of page is this ---------- */
  var path = location.pathname.replace(/\/$/, '') || '/';
  var seg = path.split('/').filter(Boolean);
  var kind = 'page';
  if (path === '/' || /^\/index/.test(path)) kind = 'home';
  else if (seg[0] === 'case-studies') kind = 'case_study';
  else if (seg[0] === 'post') kind = 'insight';
  else if (/whitepaper/.test(path)) kind = 'whitepaper';
  else if (/news/.test(path)) kind = 'newsroom';
  else if (/our-work/.test(path)) kind = 'work_index';
  else if (/what-we-do/.test(path)) kind = 'capabilities';
  else if (/who-we-are/.test(path)) kind = 'about';
  else if (/contact/.test(path)) kind = 'contact';
  else if (/insights/.test(path)) kind = 'insights_index';
  var slug = seg.length > 1 ? seg[seg.length - 1].replace(/\.html$/, '') : '';

  /* a named view event per content type, so the reports read in
     business language rather than as a list of URLs */
  if (kind === 'case_study') send('case_study_view', { case_study: slug });
  else if (kind === 'insight') send('insight_view', { insight: slug });
  else if (kind === 'whitepaper') send('whitepaper_view', {});
  send('content_view', { content_type: kind, content_id: slug || kind });

  /* ---------- clicks worth naming ---------- */
  var host = location.hostname.replace(/^www\./, '');

  function labelOf(el) {
    return (el.getAttribute('aria-label') ||
            (el.textContent || '').trim().replace(/\s+/g, ' ')).slice(0, 90);
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a, button');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var label = labelOf(a);

    // phone and email are the highest-intent clicks on the site
    if (/^tel:/i.test(href)) {
      return send('phone_click', { link_url: href.replace(/^tel:/i, '') });
    }
    if (/^mailto:/i.test(href)) {
      return send('email_click', { link_url: href.replace(/^mailto:/i, '').split('?')[0] });
    }

    // the calls to action
    if (/book a call|let's talk|lets talk|get in touch|start a conversation|contact us/i.test(label)) {
      return send('cta_click', { cta: 'book_call', cta_text: label, link_url: href });
    }
    if (/free ai score|ai score|get scored|score my brand/i.test(label)) {
      return send('cta_click', { cta: 'ai_score', cta_text: label, link_url: href });
    }
    if (/get the guide|download|whitepaper|field guide/i.test(label)) {
      return send('cta_click', { cta: 'whitepaper', cta_text: label, link_url: href });
    }

    // a click through to a case study, from wherever it sat
    if (/^\/case-studies\//.test(href)) {
      return send('case_study_click', {
        case_study: href.split('/').pop().replace(/\.html$/, ''),
        link_text: label,
        source_block: a.closest('.bar') ? 'bar_of_public_opinion'
                    : a.closest('.cap-row__proof') ? 'capability_proof'
                    : a.closest('.feature') ? 'featured'
                    : a.closest('.grid-3') ? 'work_grid' : 'other'
      });
    }

    // the two sites pointing at each other
    if (/signllabs\.ai/.test(href) && host !== 'signllabs.ai') {
      return send('cross_site_click', { destination: 'signllabs', link_text: label });
    }
    if (/gcw\.agency/.test(href) && host !== 'gcw.agency') {
      return send('cross_site_click', { destination: 'gcw', link_text: label });
    }

    // anything leaving the site, with the destination named
    if (/^https?:\/\//i.test(href)) {
      var dest = '';
      try { dest = new URL(href).hostname.replace(/^www\./, ''); } catch (x) { dest = href; }
      if (dest && dest !== host) {
        return send('outbound_click', { link_domain: dest, link_url: href, link_text: label });
      }
    }

    // navigation and footer, so we learn what people look for
    if (a.closest('.site-header, nav')) {
      return send('nav_click', { link_text: label, link_url: href });
    }
    if (a.closest('.site-footer, footer')) {
      return send('footer_click', { link_text: label, link_url: href });
    }
  }, true);

  /* ---------- forms: the ones that turn into business ---------- */
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || f.tagName !== 'FORM') return;
    var which = f.hasAttribute('data-contact-form') ? 'contact'
              : f.hasAttribute('data-signup') ? 'guide_signup'
              : f.id === 'wpform' || f.closest('#wpm') ? 'whitepaper_gate'
              : 'form';
    send('generate_lead', { form: which, form_id: f.id || which });
    if (which === 'whitepaper_gate') send('whitepaper_request', {});
  }, true);

  /* ---------- how far down people actually get ---------- */
  (function () {
    var hit = {}, marks = [25, 50, 75, 100];
    function check() {
      var h = document.documentElement;
      var max = (h.scrollHeight - window.innerHeight);
      var pct = max > 0 ? Math.round((window.scrollY / max) * 100) : 100;
      for (var i = 0; i < marks.length; i++) {
        var m = marks[i];
        if (pct >= m && !hit[m]) {
          hit[m] = 1;
          send('scroll_depth', { percent_scrolled: m, content_type: kind });
        }
      }
    }
    var t;
    window.addEventListener('scroll', function () {
      clearTimeout(t); t = setTimeout(check, 180);
    }, { passive: true });
    check();
  })();

  /* ---------- how long they stayed ---------- */
  (function () {
    var start = Date.now(), pings = [30, 60, 180, 600], done = {};
    pings.forEach(function (s) {
      setTimeout(function () {
        if (document.visibilityState === 'visible' && !done[s]) {
          done[s] = 1;
          send('engaged_time', { seconds: s, content_type: kind });
        }
      }, s * 1000);
    });
    window.addEventListener('pagehide', function () {
      var secs = Math.round((Date.now() - start) / 1000);
      try {
        if (typeof window.gtag === 'function') {
          window.gtag('event', 'page_exit',
            { seconds_on_page: secs, content_type: kind,
              transport_type: 'beacon' });
        }
      } catch (e) {}
    });
  })();

  /* ---------- the interactions we built this year ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target;

    // an image opened full size in the lightbox
    if (t.tagName === 'IMG' && t.classList.contains('is-zoom')) {
      send('lightbox_open', {
        image: (t.getAttribute('src') || '').split('/').pop().split('?')[0],
        content_type: kind, content_id: slug || kind
      });
    }

    // an industry or capability filter
    var chip = t.closest && t.closest('.chip, .fchip');
    if (chip) {
      send('filter_use', {
        filter: chip.getAttribute('data-filter') || labelOf(chip),
        content_type: kind
      });
    }
  }, true);

  // FAQ and other accordions
  document.querySelectorAll('details').forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (!d.open) return;
      var q = d.querySelector('summary');
      send('accordion_open', {
        question: q ? (q.textContent || '').trim().slice(0, 120) : '',
        content_type: kind
      });
    });
  });

  // video
  document.querySelectorAll('video').forEach(function (v) {
    var started = false;
    v.addEventListener('play', function () {
      if (started) return;
      started = true;
      send('video_start', {
        video_title: (v.getAttribute('poster') || v.currentSrc || '')
          .split('/').pop().split('?')[0],
        content_type: kind
      });
    });
    v.addEventListener('ended', function () {
      send('video_complete', { content_type: kind });
    });
  });
})();
