/*
 * Jazzmin 3.0.2 ships Bootstrap 5 but its change-form templates still emit
 * Bootstrap 4 markup (data-toggle="pill" + jQuery .tab('show')), so clicking a
 * change-form tab only updated the URL hash and never switched panes. This
 * wires up the tab + collapsible behaviour with plain JS, independent of the
 * (mismatched) Bootstrap version.
 */
(function () {
    'use strict';

    function contentRoot() {
        return document.getElementById('content-main') || document;
    }

    // --- horizontal / vertical tabs (#jazzy-tabs) ---
    function showTab(nav, targetSel) {
        nav.querySelectorAll('.nav-link').forEach(function (a) {
            var on = a.getAttribute('href') === targetSel;
            a.classList.toggle('active', on);
            a.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        contentRoot().querySelectorAll('.tab-pane').forEach(function (p) {
            var on = ('#' + p.id) === targetSel;
            p.classList.toggle('active', on);
            p.classList.toggle('show', on);
        });
    }

    function initTabs() {
        var nav = document.getElementById('jazzy-tabs');
        if (!nav) return false;
        nav.addEventListener('click', function (e) {
            var link = e.target.closest('a[href^="#"]');
            if (!link || !nav.contains(link)) return;
            e.preventDefault();
            var target = link.getAttribute('href');
            showTab(nav, target);
            if (history.pushState) history.pushState(null, '', target);
        });
        if (location.hash && nav.querySelector('a[href="' + location.hash + '"]')) {
            showTab(nav, location.hash);
        }
        return true;
    }

    // --- collapsible fieldsets (#jazzy-collapsible) ---
    function initCollapsible() {
        var root = document.getElementById('jazzy-collapsible');
        if (!root) return false;
        root.querySelectorAll('[data-toggle="collapse"]').forEach(function (head) {
            head.style.cursor = 'pointer';
            head.addEventListener('click', function (e) {
                e.preventDefault();
                var sel = head.getAttribute('href') || head.getAttribute('data-target');
                if (!sel) return;
                var body = root.querySelector(sel);
                if (body) body.classList.toggle('show');
            });
        });
        return true;
    }

    function init() {
        initTabs();
        initCollapsible();
    }

    if (document.readyState !== 'loading') init();
    else document.addEventListener('DOMContentLoaded', init);
})();
