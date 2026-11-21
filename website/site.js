// Silo site: the nav pill, scroll reveal, the hero passport cycling through
// the twelve seasons (palettes from the app's src/data/seasons.ts), and the
// swipe deck playing itself. Everything holds still for reduced motion.
(function () {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Nav: full width over the hero, a glass pill once the page scrolls.
  var nav = document.querySelector("nav.top");
  if (nav) {
    var onScroll = function () {
      nav.classList.toggle("scrolled", window.scrollY > 24);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // Scroll reveal.
  var reveals = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) {
      el.classList.add("in");
    });
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    reveals.forEach(function (el) {
      io.observe(el);
    });
  }

  // Runs a callback on an interval only while the element is on screen and the tab is visible.
  function whileVisible(el, ms, fn) {
    var shown = false;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        shown = entries[0].isIntersecting;
      }).observe(el);
    } else shown = true;
    setInterval(function () {
      if (shown && !document.hidden) fn();
    }, ms);
  }

  // ===== The passport =====
  var SEASONS = [{"name":"Light Spring","sig":"#F4A483","best":["#F4A483","#FFD58A","#A8D8B9","#8FC9E8","#F7B2C4","#FFE9A8","#B6E3A8","#F9C8A0"],"t":[0.5,-1.0,0.3]},{"name":"True Spring","sig":"#F2793B","best":["#F2793B","#FFC93C","#3CB371","#2BB5C6","#FF6F61","#9ACD32","#F4B400","#E35D8C"],"t":[1.0,-0.3,0.5]},{"name":"Bright Spring","sig":"#FF4F7B","best":["#FF4F7B","#00B3A6","#FFB000","#3A7BFF","#FF6A3D","#7ED957","#C13FD0","#00C2FF"],"t":[0.5,0.0,1.0]},{"name":"Light Summer","sig":"#9DB4E0","best":["#9DB4E0","#F2B5D4","#B8D8D8","#C9B6E4","#A7C7E7","#E8A9B8","#B5D3C1","#D7C4E8"],"t":[-0.5,-1.0,-0.3]},{"name":"True Summer","sig":"#5B7DB1","best":["#5B7DB1","#C2577B","#6CA6A3","#8E7CC3","#4F86C6","#B0547A","#7FA7C9","#9A5B8F"],"t":[-1.0,-0.3,-0.5]},{"name":"Soft Summer","sig":"#8A9BA8","best":["#8A9BA8","#B48A9A","#7E9C8F","#9A8FB0","#6E8AA0","#C49A9A","#8FA89B","#A38FA3"],"t":[-0.5,0.0,-1.0]},{"name":"Soft Autumn","sig":"#B07D62","best":["#B07D62","#9CAF88","#C9A66B","#7E8C6A","#C48E7A","#8DA399","#D4B483","#A5806A"],"t":[0.5,0.0,-1.0]},{"name":"True Autumn","sig":"#B5541C","best":["#B5541C","#D4A017","#6B8E23","#8B5A2B","#C0662D","#2E8B57","#CC7722","#7B3F00"],"t":[1.0,0.3,-0.5]},{"name":"Deep Autumn","sig":"#7A2E2E","best":["#7A2E2E","#2F4F2F","#B8860B","#5C3A21","#8B3A1A","#1F5F5B","#A0522D","#4B3621"],"t":[0.5,1.0,-0.3]},{"name":"Deep Winter","sig":"#5B1A3A","best":["#5B1A3A","#0B6E4F","#1C2E6E","#8B0A50","#004D61","#4B0082","#B0003A","#2F4F4F"],"t":[-0.5,1.0,0.3]},{"name":"True Winter","sig":"#1F3FAF","best":["#1F3FAF","#C8102E","#00843D","#7A1FA2","#0072CE","#D1006F","#008C95","#2A2A72"],"t":[-1.0,0.3,0.5]},{"name":"Bright Winter","sig":"#E6007E","best":["#E6007E","#00A3E0","#00B140","#6A0DAD","#FF1E1E","#0047FF","#00CED1","#FFD700"],"t":[-0.5,0.0,1.0]}];

  function mix(a, b, t) {
    var x = parseInt(a.slice(1), 16),
      y = parseInt(b.slice(1), 16);
    var c = [16, 8, 0].map(function (s) {
      var u = (x >> s) & 255,
        v = (y >> s) & 255;
      return Math.round(u + (v - u) * t);
    });
    return "rgb(" + c.join(",") + ")";
  }
  // The app's labels: past 0.2 either way picks a side.
  function pick(v, neg, mid, pos) {
    return v < -0.2 ? neg : v > 0.2 ? pos : mid;
  }
  function mrz(name) {
    var top = "P<SILOSILO<MEMBER<<" + name.toUpperCase().replace(/ /g, "<");
    while (top.length < 36) top += "<";
    var bottom = "S30P08M50<H168<PEAR";
    while (bottom.length < 36) bottom += "<";
    return (top + "\n" + bottom).replace(/</g, "&lt;").replace("\n", "<br />");
  }

  var pp = document.getElementById("passport");
  if (pp) {
    var dots = pp.querySelectorAll(".pp-dots i");
    var knobs = pp.querySelectorAll(".knob");
    var fields = {};
    pp.querySelectorAll("[data-f]").forEach(function (el) {
      fields[el.getAttribute("data-f")] = el;
    });
    var current = 6; // Soft Autumn

    var show = function (i, animate) {
      var s = SEASONS[i];
      pp.style.setProperty("--c1", mix(s.sig, "#ffffff", 0.62));
      pp.style.setProperty("--c2", mix(s.best[1], "#ffffff", 0.68));
      pp.style.setProperty("--c3", mix(s.best[2], "#ffffff", 0.74));
      pp.style.setProperty("--tint", s.sig);
      dots.forEach(function (d, k) {
        d.style.setProperty("--sw", s.best[k]);
      });
      knobs.forEach(function (k, n) {
        k.style.setProperty("--at", (s.t[n] + 1) * 50 + "%");
        k.style.setProperty("--sw", s.best[n * 2]);
      });
      var text = {
        name: s.name,
        undertone: pick(s.t[0], "Cool", "Neutral", "Warm"),
        contrast: pick(s.t[2], "Soft", "Medium", "Bright"),
        mrz: null,
      };
      Object.keys(fields).forEach(function (key) {
        var el = fields[key];
        var set = function () {
          if (key === "mrz") el.innerHTML = mrz(s.name);
          else el.textContent = text[key];
        };
        if (!animate) return set();
        el.classList.add("out");
        setTimeout(function () {
          set();
          el.classList.remove("out");
        }, 350);
      });
    };
    var rows = document.querySelectorAll(".season");
    var mark = function (i) {
      rows.forEach(function (r, k) {
        r.classList.toggle("on", k === i);
      });
    };
    show(current, false);
    mark(current);
    // Colors fade between seasons, but not in from the stylesheet defaults.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        pp.classList.add("ready");
      });
    });

    if (!reduce) {
      whileVisible(pp, 4200, function () {
        if (pp.classList.contains("tracking")) return;
        current = (current + 1) % SEASONS.length;
        show(current, true);
        mark(current);
      });

      // Tilt toward the pointer, and slide the foil with it.
      var stage = pp.parentElement;
      var fine = window.matchMedia("(pointer: fine)").matches;
      if (fine) {
        stage.addEventListener("pointermove", function (e) {
          var r = pp.getBoundingClientRect();
          var dx = Math.max(-1, Math.min(1, (e.clientX - r.left) / r.width * 2 - 1));
          var dy = Math.max(-1, Math.min(1, (e.clientY - r.top) / r.height * 2 - 1));
          pp.classList.add("tracking");
          pp.style.setProperty("--ry", dx * 10 + "deg");
          pp.style.setProperty("--rx", -dy * 8 + "deg");
          pp.style.setProperty("--gx", 50 + dx * 32 + "%");
        });
        stage.addEventListener("pointerleave", function () {
          pp.classList.remove("tracking");
          pp.style.setProperty("--ry", "0deg");
          pp.style.setProperty("--rx", "0deg");
        });
      }
      // At rest the foil drifts on its own.
      var t0 = performance.now();
      var drift = function (now) {
        if (!pp.classList.contains("tracking")) {
          var p = Math.sin((now - t0) / 2600);
          pp.style.setProperty("--gx", 50 + p * 30 + "%");
          pp.style.setProperty("--holo-angle", 120 + p * 40 + "deg");
        }
        requestAnimationFrame(drift);
      };
      requestAnimationFrame(drift);
    }
  }

  // ===== The swipe deck plays itself =====
  var deck = document.getElementById("deck");
  var count = document.getElementById("deck-count");
  if (deck && !reduce) {
    var n = 1;
    whileVisible(deck, 2600, function () {
      var cards = Array.prototype.slice.call(deck.children);
      var top = cards.filter(function (c) {
        return c.getAttribute("data-pos") === "0";
      })[0];
      if (!top) return;
      top.classList.add("go-" + top.getAttribute("data-go"));
      setTimeout(function () {
        cards.forEach(function (c) {
          var p = +c.getAttribute("data-pos");
          if (c === top) {
            c.classList.add("snap");
            c.classList.remove("go-left", "go-right");
            c.setAttribute("data-pos", "2");
          } else c.setAttribute("data-pos", String(p - 1));
        });
        void top.offsetWidth;
        top.classList.remove("snap");
        n = n % 17 + 1;
        if (count) count.textContent = n + " / 17";
      }, 650);
    });
  }
})();
