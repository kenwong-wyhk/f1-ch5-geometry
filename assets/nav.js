/* ============================================================
   Shared navigation + pager for Ch.5 Introduction to Geometry
   Builds the top bar, the mobile panel and the prev/next pager
   so that every page stays in sync from a single source.
   ============================================================ */
(function () {
  "use strict";

  var PAGES = [
    { file: "01-points-lines.html", no: "5.1A", title: "Points, Lines & Surfaces", zh: "點、線與面", group: "Basic Concepts" },
    { file: "02-angles.html", no: "5.1B", title: "Angles", zh: "角", group: "Basic Concepts" },
    { file: "03-parallel-perpendicular.html", no: "5.1C", title: "Parallel & Perpendicular Lines", zh: "平行線與垂直線", group: "Basic Concepts" },
    { file: "04-triangles.html", no: "5.2B", title: "Triangles", zh: "三角形", group: "Plane Figures" },
    { file: "05-polygons.html", no: "5.2C", title: "Polygons", zh: "多邊形", group: "Plane Figures" },
    { file: "06-circles.html", no: "5.2A", title: "Circles", zh: "圓", group: "Plane Figures" },
    { file: "07-solids.html", no: "5.4", title: "3-D Figures", zh: "立體圖形", group: "3-D Figures" },
    { file: "08-constructions.html", no: "5.3", title: "Basic Constructions", zh: "基本作圖", group: "Construction" },
    { file: "09-mistakes.html", no: "Rev", title: "Common Mistakes", zh: "常見錯誤", group: "Revision" },
    { file: "10-glossary.html", no: "Rev", title: "Terminology", zh: "術語表", group: "Revision" },
    { file: "11-quiz.html", no: "Rev", title: "Self-check Quiz", zh: "自我測驗", group: "Revision" },
    { file: "12-slice-game.html", no: "5.4", title: "Slice Lab", zh: "截面切割遊戲", group: "3-D Figures" },
    { file: "13-prism-unfolding.html", no: "5.4", title: "Unfolding a Prism", zh: "稜柱展開圖", group: "3-D Figures" },
    { file: "14-prism-stacking.html", no: "5.4", title: "Stacking a Prism", zh: "橫截面堆疊", group: "3-D Figures" },
    /* `hidden: true` keeps a page out of the menu, the mobile panel and the
       pager. It sits last and carries no number, so the numbered pages above
       stay 1…14 and their badges match their file names. The shrine is
       reached only by the easter egg on the home page. */
    { file: "malevolent-shrine.html", no: "5.4", title: "Malevolent Shrine", zh: "伏魔御廚子", group: "3-D Figures", hidden: true }
  ];

  var GROUPS = [
    { label: "5.1 Basic Concepts", key: "Basic Concepts", zh: "基本概念" },
    { label: "5.2 Plane Figures", key: "Plane Figures", zh: "平面圖形" },
    { label: "5.4 3-D Figures", key: "3-D Figures", zh: "立體圖形" },
    { label: "5.3 Construction", key: "Construction", zh: "作圖" },
    { label: "Revision", key: "Revision", zh: "溫習" }
  ];

  function current() {
    var p = location.pathname.split("/").pop() || "index.html";
    return p;
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function buildNav() {
    var here = current();
    var isHome = here === "index.html" || here === "";
    var links = '<a href="index.html"' + (isHome ? ' class="active"' : "") + ">Home</a>";

    GROUPS.forEach(function (g) {
      var items = PAGES.filter(function (p) { return p.group === g.key && !p.hidden; });
      if (!items.length) return;
      var activeInGroup = items.some(function (p) { return p.file === here; });
      var drop = items.map(function (p) {
        return '<a href="' + p.file + '"' + (p.file === here ? ' class="active"' : "") + ">" +
          '<span class="num">' + (PAGES.indexOf(p) + 1) + "</span>" +
          "<span>" + esc(p.title) + '<span class="zh">' + esc(p.zh) + "</span></span></a>";
      }).join("");

      links += '<div class="nav-group' + (activeInGroup ? " open-mark" : "") + '">' +
        '<button type="button" aria-expanded="false">' + esc(g.label) +
        '<span class="chev">▾</span></button>' +
        '<div class="nav-drop">' + drop + "</div></div>";
    });

    var mobile = '<div class="mp-head">Start here</div><a href="index.html"><span class="num">★</span>Home · 目錄</a>';
    GROUPS.forEach(function (g) {
      var items = PAGES.filter(function (p) { return p.group === g.key && !p.hidden; });
      if (!items.length) return;
      mobile += '<div class="mp-head">' + esc(g.label) + " · " + esc(g.zh) + "</div>";
      items.forEach(function (p) {
        mobile += '<a href="' + p.file + '"><span class="num">' + (PAGES.indexOf(p) + 1) + "</span>" +
          "<span>" + esc(p.title) + '<span class="zh" style="display:block;font-size:12px;font-weight:500;color:#61748a">' + esc(p.zh) + "</span></span></a>";
      });
    });

    var host = document.getElementById("site-header");
    if (host) {
      host.className = "site-nav";
      host.innerHTML = '<div class="bar">' +
        '<a class="brand" href="index.html"><span class="mark">∠</span>' +
        '<span><small>HKDSE · Form 1</small><b>Ch.5 Introduction to Geometry</b></span></a>' +
        '<nav class="nav-links" aria-label="Chapter menu">' + links + "</nav>" +
        '<button class="menu-btn" type="button" aria-label="Open chapter menu" aria-expanded="false">☰</button>' +
        "</div>" +
        '<div class="mobile-panel" id="mobile-panel">' + mobile + "</div>";

      // dropdown behaviour (click to open, hover intent on desktop)
      var groups = host.querySelectorAll(".nav-group");
      groups.forEach(function (g) {
        var btn = g.querySelector("button");
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          var wasOpen = g.classList.contains("open");
          groups.forEach(function (o) { o.classList.remove("open"); o.querySelector("button").setAttribute("aria-expanded", "false"); });
          if (!wasOpen) { g.classList.add("open"); btn.setAttribute("aria-expanded", "true"); }
        });
        g.addEventListener("mouseenter", function () {
          groups.forEach(function (o) { o.classList.remove("open"); });
          g.classList.add("open"); btn.setAttribute("aria-expanded", "true");
        });
        g.addEventListener("mouseleave", function () {
          g.classList.remove("open"); btn.setAttribute("aria-expanded", "false");
        });
      });
      document.addEventListener("click", function () {
        groups.forEach(function (o) { o.classList.remove("open"); o.querySelector("button").setAttribute("aria-expanded", "false"); });
      });

      var mb = host.querySelector(".menu-btn");
      var panel = host.querySelector("#mobile-panel");
      mb.addEventListener("click", function () {
        var open = panel.classList.toggle("open");
        mb.setAttribute("aria-expanded", open ? "true" : "false");
        mb.textContent = open ? "✕" : "☰";
      });
    }

    // prev / next pager — hidden pages are skipped, so nothing links to them
    var pager = document.getElementById("pager");
    if (pager) {
      var chain = PAGES.filter(function (p) { return !p.hidden; });
      var idx = -1;
      for (var i = 0; i < chain.length; i++) if (chain[i].file === here) { idx = i; break; }
      var prev = idx > 0 ? chain[idx - 1] : null;
      var next = idx >= 0 && idx < chain.length - 1 ? chain[idx + 1] : null;
      var html = "";
      if (idx === -1) {
        // a hidden page has no neighbours in the chain: one way back, no more
        pager.classList.add("single");
        html = '<a class="prev" href="index.html"><span class="k">← Back to</span><span class="v">Chapter menu</span></a>';
      } else {
        html += prev
          ? '<a class="prev" href="' + prev.file + '"><span class="k">← Previous</span><span class="v">' + esc(prev.title) + "</span></a>"
          : '<a class="prev" href="index.html"><span class="k">← Back to</span><span class="v">Chapter menu</span></a>';
        html += next
          ? '<a class="next" href="' + next.file + '"><span class="k">Next →</span><span class="v">' + esc(next.title) + "</span></a>"
          : '<a class="next" href="index.html"><span class="k">Back to</span><span class="v">Chapter menu</span></a>';
      }
      pager.innerHTML = html;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", buildNav);
  else buildNav();
})();
