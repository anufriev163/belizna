/* Интерфейс: появление текста, меню, плавная прокрутка, переходы, вопросы, форма, квиз */
// На телефоне во время прокрутки шапка и размытие уезжают, а когда прокрутка остановилась, возвращаются
(function () {
  var root = document.documentElement, t = 0, y0 = window.scrollY;
  if (!matchMedia("(pointer: coarse)").matches) return;
  window.addEventListener("scroll", function () {
    if (Math.abs(window.scrollY - y0) < 3) return;
    y0 = window.scrollY;
    root.classList.add("scrolling");
    clearTimeout(t);
    t = setTimeout(function () { root.classList.remove("scrolling"); }, 180);
  }, { passive: true });
})();

// Раскладка экрана: те же условия, что в CSS
(function () {
  var side = matchMedia("(orientation: landscape) and (max-height: 520px)");
  var stack = matchMedia("(max-width: 699px) and (orientation: portrait), (max-width: 760px) and (min-height: 521px)");
  window.siteLayout = function () { return side.matches ? "side" : stack.matches ? "stack" : "wide"; };
})();

// Анимация текста: разделы получают класс .in, когда круг встал рядом с ними
(function () {
  var root = document.documentElement; root.classList.add("js");
  var GROUPS = ".mini, .list, .steps, .people, .row, .faq";
  var boxes = [].slice.call(document.querySelectorAll(".film .tx, .plain .l, .plain .r")).map(function (box) {
    var n = 0, sec = box.closest("section"), counters = [];
    function delay(el) { el.style.setProperty("--dl", (.03 + n++ * .025).toFixed(3) + "s"); }
    // Заголовок с номером лежит в .ttl: проявляем его части как обычные дети карточки
    var kids = [];
    [].slice.call(box.children).forEach(function (ch) { kids.push.apply(kids, ch.classList.contains("ttl") ? [].slice.call(ch.children) : [ch]); });
    kids.forEach(function (ch) {
      if (ch.tagName === "H2") {
        var words = ch.textContent.trim().split(/\s+/);
        ch.setAttribute("aria-label", ch.textContent.trim());
        ch.textContent = "";
        words.forEach(function (w, i) {
          var o = document.createElement("span"), t = document.createElement("span");
          o.className = "w"; o.setAttribute("aria-hidden", "true"); t.textContent = w; o.appendChild(t);
          delay(t); ch.appendChild(o);
          if (i < words.length - 1) ch.appendChild(document.createTextNode(" "));
        });
        return;
      }
      var parts = ch.matches(GROUPS) ? [].slice.call(ch.children) : [ch];
      parts.forEach(function (el) { el.classList.add("ri"); delay(el); });
    });
    // Цифры: плашки и цены; «3D» и подобное не трогаем
    [].slice.call(box.querySelectorAll(".mini b, .price")).forEach(function (el) {
      var node = el.firstChild, text = node.nodeValue;
      if (!/\d/.test(text) || /\d[A-Za-zА-Яа-я]/.test(text)) return;
      counters.push({ node: node, text: text });
    });
    box.classList.add("rev");
    return { box: box, sec: sec, film: sec.classList.contains("film"), counters: counters, on: false };
  });
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+$)/g, " "); }
  function count(c) {
    var nums = c.text.match(/\d[\d\s ]*\d|\d/g).map(function (x) { return x.replace(/\D/g, ""); }), t0 = performance.now(), id = ++c.id || (c.id = 1);
    // Пока цифры бегут, ширина цены держится по итоговому значению: иначе на узком экране кнопка рядом
    // сначала стоит справа, а когда число дорастёт, перескакивает на новую строку
    var host = c.node.parentNode;
    c.node.nodeValue = c.text; host.style.minWidth = ""; host.style.minWidth = host.getBoundingClientRect().width + "px";
    (function step(now) {
      if (c.id !== id) return;
      var t = Math.max(0, Math.min(1, (now - t0) / 550)), e = 1 - Math.pow(1 - t, 3), i = 0;
      c.node.nodeValue = t >= 1 ? c.text : c.text.replace(/\d[\d\s ]*\d|\d/g, function () { return fmt(Math.round(nums[i++] * e)); });
      if (t < 1) requestAnimationFrame(step); else host.style.minWidth = "";
    })(performance.now());
  }
  function check() {
    var H = window.innerHeight, L = window.siteLayout();
    boxes.forEach(function (b) {
      var r = b.sec.getBoundingClientRect(), on;
      if (L === "side" || (L === "stack" && !b.film)) on = b.on || (b.box.getBoundingClientRect().top < H * .95);
      else if (b.film) on = r.top <= H * .8 && r.bottom >= H * .3;
      else on = b.on || r.top < H * .9;   // обычные разделы проявляются один раз
      if (on === b.on) return;
      b.on = on; b.box.classList.toggle("in", on);
      if (on) b.counters.forEach(count);
    });
  }
  var queued = false;
  function queue() { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; check(); }); }
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", queue);
  check();
})();

// Общий кадр. Прокрутка считается первой, поэтому круг и шарики никогда не отстают от страницы
(function () {
  var q = window.siteLoop = [];
  (function run(now) {
    requestAnimationFrame(run);
    for (var i = 0; i < q.length; i++) q[i](now);
  })(performance.now());
})();

// Меню телефона
(function () {
  var root = document.documentElement, btn = document.querySelector(".burger"), menu = document.getElementById("menu");
  function set(open) {
    var r = btn.getBoundingClientRect();
    menu.style.setProperty("--mx", (r.left + r.width / 2).toFixed(0) + "px");
    menu.style.setProperty("--my", (r.top + r.height / 2).toFixed(0) + "px");
    root.classList.toggle("menu-open", open);
    menu.inert = !open;
    btn.setAttribute("aria-expanded", open);
    btn.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
  }
  btn.addEventListener("click", function () { set(!root.classList.contains("menu-open")); });
  menu.addEventListener("click", function (e) { if (e.target.closest("a")) set(false); });
  window.addEventListener("keydown", function (e) { if (e.key === "Escape" && root.classList.contains("menu-open")) { set(false); btn.focus(); } });
  matchMedia("(max-width: 760px)").addEventListener("change", function () { set(false); });
})();

// Плавная прокрутка колесом: страница догоняет цель с мягким затуханием. Касания остаются родными
(function () {
  // Два сглаживания подряд: скорость нарастает мягко, щелчки колеса сливаются в одно движение
  var cur = 0, soft = 0, tgt = 0, on = false, last = 0, lastRest = 0, plains = document.querySelectorAll(".plain");
  function top() { return document.documentElement.scrollHeight - window.innerHeight; }
  window.siteLoop.push(function (now) {
    var dt = Math.max(.001, Math.min(.05, (now - last) / 1000)); last = now;
    if (!on) return;
    soft += (tgt - soft) * (1 - Math.exp(-dt * 9));
    cur += (soft - cur) * (1 - Math.exp(-dt * 7));
    if (Math.abs(tgt - cur) < .4) { cur = soft = tgt; on = false; }
    // Браузер двигает страницу целыми пикселями. Остаток добираем сдвигом разделов,
    // иначе на малой скорости текст идёт ступеньками
    var whole = Math.round(cur), rest = on ? (whole - cur).toFixed(2) : 0;
    window.scrollTo(0, whole);
    if (rest !== lastRest) {
      lastRest = rest;
      for (var i = 0; i < plains.length; i++) plains[i].style.transform = rest ? "translate3d(0," + rest + "px,0)" : "";
    }
  });
  function stop() { on = false; for (var i = 0; i < plains.length; i++) plains[i].style.transform = ""; lastRest = 0; }
  window.addEventListener("wheel", function (e) {
    if (e.ctrlKey || e.defaultPrevented || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    if (document.documentElement.classList.contains("pm-open")) return;
    if (document.documentElement.classList.contains("menu-open")) { e.preventDefault(); return; }
    var d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1);
    if (!on) cur = soft = tgt = window.scrollY;
    tgt = Math.max(0, Math.min(top(), tgt + d));
    e.preventDefault();
    on = true;
  }, { passive: false });
  // Клавиши, полоса прокрутки и переходы по меню перехватывают управление сразу
  window.addEventListener("keydown", stop);
  window.addEventListener("pointerdown", stop);
  window.smoothStop = stop;
})();

// Переход по меню: рядом страница плавно доезжает, издалека проявляется через белую вуаль
(function () {
  var id = 0, veil = document.querySelector(".veil"), ticket = 0;
  function jump(y) {
    var mine = ++ticket;
    cancelAnimationFrame(id);
    if (window.smoothStop) window.smoothStop();
    var done = false;
    function go() {
      if (done || mine !== ticket) return;
      done = true;
      window.scrollTo(0, y);
      window.dispatchEvent(new Event("site:jump"));   // челюсть и шарики сразу встают на новое место
      requestAnimationFrame(function () { requestAnimationFrame(function () { if (mine === ticket) veil.classList.remove("on"); }); });
    }
    // Прыгаем только когда вуаль полностью закрыла экран, даже если кадры идут медленно
    veil.addEventListener("transitionend", go, { once: true });
    veil.classList.add("on");
    setTimeout(go, 1500);
  }
  function glide(y) {
    var y0 = window.scrollY, d = y - y0, T = Math.min(2200, 900 + Math.abs(d) * .1), t0 = performance.now();
    cancelAnimationFrame(id);
    if (window.smoothStop) window.smoothStop();
    (function step(now) {
      var t = Math.min(1, (now - t0) / T), e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      window.scrollTo(0, y0 + d * e);
      if (t < 1) id = requestAnimationFrame(step);
    })(t0);
  }
  window.siteGlide = glide;
  ["wheel", "touchstart"].forEach(function (ev) { window.addEventListener(ev, function () { cancelAnimationFrame(id); }, { passive: true }); });
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var el = document.querySelector(a.getAttribute("href"));
      if (!el) return;
      e.preventDefault();
      // Клавиатура и экранные дикторы: фокус переходит в раздел, куда ведёт ссылка (раньше оставался на самой ссылке)
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
      try { el.focus({ preventScroll: true }); } catch (x) {}
      var r = el.getBoundingClientRect(), top = r.top + window.scrollY, H = window.innerHeight;
      if (window.siteLayout() === "side" || !el.classList.contains("film")) top -= window.siteLayout() === "wide" ? 0 : 70;
      else if (el.classList.contains("film")) top += (r.height - H) / 2;   // середина раздела: круг уже доехал
      var y = a.getAttribute("href") === "#top" ? 0 : top;
      if (Math.abs(y - window.scrollY) > H * 1.2) jump(y); else { ticket++; veil.classList.remove("on"); glide(y); }
    });
  });
})();

// Вопросы раскрываются плавно
(function () {
  document.querySelectorAll(".faq details").forEach(function (d) {
    var sum = d.querySelector("summary"), run = null;
    sum.addEventListener("click", function (e) {
      if (!d.animate) return;
      e.preventDefault();
      var closing = d.open && !d.dataset.closing, from = d.offsetHeight, ans = d.querySelector("p");
      if (run) run.cancel();
      d.open = true;
      if (closing) d.dataset.closing = 1; else delete d.dataset.closing;
      var edge = d.offsetHeight - d.clientHeight, to = (closing ? sum.offsetHeight : d.scrollHeight) + edge;   // рамка входит в высоту
      d.style.overflow = "hidden";
      ans.animate({ opacity: closing ? [1, 0] : [0, 1], transform: closing ? ["none", "translateY(-6px)"] : ["translateY(-6px)", "none"] }, { duration: closing ? 220 : 380, easing: "ease", fill: "both" });
      run = d.animate({ height: [from + "px", to + "px"] }, { duration: 420, easing: "cubic-bezier(.16,.84,.24,1)" });
      run.onfinish = function () {
        run = null; d.style.overflow = "";
        if (closing) { d.open = false; delete d.dataset.closing; }
        ans.getAnimations().forEach(function (a) { a.cancel(); });
        window.dispatchEvent(new Event("site:measure"));   // высота страницы изменилась
      };
    });
  });
})();

// Форма записи
(function () {
  var form = document.querySelector("form.r"), msg = form.querySelector(".msg");
  // Поле с ошибкой помечаем для вспомогательных технологий и снимаем пометку, как только человек начал исправлять
  // Маска телефона: +7 (999) 123-45-67. Принимает ввод, вставку и автозаполнение (8…, +7…, 9…), стирается по одной цифре
  var phone = form.phone, lastDigits = "";
  phone.addEventListener("input", function (e) {
    var d = phone.value.replace(/\D/g, "");
    if (e.inputType === "deleteContentBackward" && d === lastDigits) d = d.slice(0, -1);   // стёрли знак маски: убираем цифру
    if (d && d[0] === "8") d = "7" + d.slice(1);
    else if (d && d[0] !== "7") d = "7" + d;
    d = d.slice(0, 11); lastDigits = d;
    var v = d ? "+7" : "";
    if (d.length > 1) v += " (" + d.slice(1, 4);
    if (d.length >= 5) v += ") " + d.slice(4, 7);
    if (d.length >= 8) v += "-" + d.slice(7, 9);
    if (d.length >= 10) v += "-" + d.slice(9, 11);
    phone.value = v;
  });
  var fields = [form.name, form.phone, form.agree];
  function mark(bad) { fields.forEach(function (f) { if (f === bad) f.setAttribute("aria-invalid", "true"); else f.removeAttribute("aria-invalid"); }); }
  fields.forEach(function (f) { f.addEventListener("input", function () { f.removeAttribute("aria-invalid"); }); f.addEventListener("change", function () { f.removeAttribute("aria-invalid"); }); });
  function say(text, field, bad) {
    mark(bad || null);
    msg.textContent = text;
    if (!msg.animate) return;
    msg.animate({ opacity: [0, 1], transform: ["translateY(6px)", "none"] }, { duration: 300, easing: "ease" });
    if (field) field.animate({ transform: ["none", "translateX(-5px)", "translateX(4px)", "translateX(-2px)", "none"] }, { duration: 320, easing: "ease" });
  }
  // Адрес, который принимает заявки. Пока он пуст, форма честно говорит, что ничего не отправила
  var FORM_URL = "", btn = form.querySelector("button");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!form.name.value.trim()) { say("Укажите имя.", form.name, form.name); form.name.focus(); return; }
    if (form.phone.value.replace(/\D/g, "").length < 11) { say("Введите телефон полностью: 11 цифр.", form.phone, form.phone); form.phone.focus(); return; }
    if (!form.agree.checked) { say("Отметьте согласие на обработку данных.", form.agree.parentNode, form.agree); return; }
    if (!FORM_URL) { say("Это демо-версия сайта: заявка никуда не отправлена."); return; }
    btn.disabled = true;
    fetch(FORM_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name.value.trim(), phone: form.phone.value.trim() }) })
      .then(function (r) {
        if (!r.ok) throw r;
        say("Заявка отправлена. Перезвоним в течение 15 минут.");
        form.reset();
      })
      .catch(function () { say("Не получилось отправить. Позвоните нам: +7 (000) 000-00-00."); })
      .then(function () { btn.disabled = false; });
  });
})();

// Строки под названием: подбираем размер так, чтобы длинная строка совпала по ширине со словом «Белизна»
(function () {
  var name = document.querySelector(".intro-name"), line = document.querySelector(".intro-line");
  if (!name || !line) return;
  // Меряем сами буквы, без пустых полей шрифта по краям: иначе строка вылезает за «Б» и «а»
  var ctx = document.createElement("canvas").getContext("2d");
  function ink(text, font) { ctx.font = font; var m = ctx.measureText(text); return (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || m.width); }
  function fit() {
    var ns = getComputedStyle(name), ls = getComputedStyle(line);
    var nw = ink(name.textContent, ns.fontWeight + " " + ns.fontSize + " " + ns.fontFamily) + (parseFloat(ns.letterSpacing) || 0) * (name.textContent.length - 1);   // у названия сжатый трекинг
    var lw = Math.max.apply(null, line.innerText.split(String.fromCharCode(10)).map(function (s) { return ink(s.trim(), ls.fontWeight + " 20px " + ls.fontFamily); }));
    // Чуть уже названия: строка внутри «Б…а». Но не мельче 15 px: на широких экранах подпись иначе выходила около 14 px
    if (nw && lw) line.style.fontSize = Math.max(innerWidth >= 700 ? 15 : 14, 20 * nw / lw * .96).toFixed(2) + "px";   // на телефоне подпись остаётся ровно по ширине названия
  }
  fit();
  window.addEventListener("resize", fit);
  // Пересчитываем, когда догрузятся шрифты: до этого браузер мерит запасным шрифтом
  if (document.fonts) { document.fonts.ready.then(fit); document.fonts.addEventListener("loadingdone", fit); }
  window.addEventListener("load", fit);
  [400, 1500, 4000].forEach(function (ms) { setTimeout(fit, ms); });
})();

// Подсветка раздела в меню: тёмная капсула переезжает к пункту, в чьём разделе мы сейчас
(function () {
  var links = [].slice.call(document.querySelectorAll(".nav .links a")), pill = document.querySelector(".nav-pill");
  var mlinks = [].slice.call(document.querySelectorAll(".menu-links a"));
  var ids = links.map(function (a) { return a.getAttribute("href").slice(1); });
  var stopEl = document.getElementById("book"), cur = null, queued = false;
  function pick() {
    var line = window.innerHeight * .45, found = null;
    ids.forEach(function (id) { var el = document.getElementById(id); if (el && el.getBoundingClientRect().top <= line) found = id; });
    if (stopEl.getBoundingClientRect().top <= line) found = null;   // в записи подсветка не нужна
    return found;
  }
  function place() {
    queued = false;
    var id = pick();
    if (id === cur) return;
    cur = id;
    links.forEach(function (a, i) { a.classList.toggle("cur", ids[i] === id); });
    mlinks.forEach(function (a) { a.classList.toggle("cur", a.getAttribute("href") === "#" + id); });
    var a = links[ids.indexOf(id)];
    if (!a) { pill.style.opacity = 0; return; }
    pill.style.width = a.offsetWidth + "px";
    pill.style.transform = "translateX(" + a.offsetLeft + "px)";
    pill.style.opacity = 1;
  }
  function queue() { if (!queued) { queued = true; requestAnimationFrame(place); } }
  window.addEventListener("scroll", queue, { passive: true });
  window.addEventListener("resize", function () { cur = undefined; queue(); });
  if (document.fonts) document.fonts.ready.then(function () { cur = undefined; queue(); });
  place();
})();

// Подбор процедуры: три вопроса и совет с ценой
(function () {
  var box = document.querySelector(".qz");
  var Q = [
    { q: "Что хочется изменить?", a: [["plaque", "Налёт и камень"], ["dark", "Цвет эмали"], ["crooked", "Неровные зубы"], ["check", "Просто проверить"]] },
    { q: "Когда была последняя профчистка?", a: [["recent", "Меньше полугода назад"], ["long", "Больше полугода"], ["never", "Не помню или никогда"]] },
    { q: "Зубы реагируют на холодное?", a: [["yes", "Да, бывает"], ["no", "Нет"]] }
  ];
  var ans = [];
  function advice(a) {
    var clean = a[1] === "recent", soft = a[2] === "yes";
    if (a[0] === "crooked") return ["Консультация и 3D-скан", "Покажем на 3D, как сдвинутся зубы, и сколько займёт лечение. Сами элайнеры — от 140 000 ₽.", "0 ₽", "первый визит"];
    if (a[0] === "dark" && !clean) return ["Профгигиена, потом отбеливание", "Отбеливают только чистые зубы: сначала снимем налёт, через неделю осветлим эмаль.", "5 500 ₽", "+ 13 900 ₽ за отбеливание"];
    if (a[0] === "dark" && soft) return ["Домашнее отбеливание", "Мягче кабинетного: капы и гель на две недели, чувствительность почти не беспокоит.", "9 500 ₽", "капы и гель"];
    if (a[0] === "dark") return ["Кабинетное отбеливание", "Гель и лампа: 6–8 тонов светлее за один визит.", "13 900 ₽", "1 визит"];
    if (a[0] === "check" && clean) return ["Клуб чистых зубов", "Четыре визита в год по подписке: налёт не успеет затвердеть, а запись придёт сама.", "1 190 ₽", "в месяц"];
    return ["Профгигиена", soft ? "Возьмём мягкий режим ультразвука и закончим фтором: он снимает чувствительность." : "Ультразвук, Air Flow и полировка: снимем налёт и камень у самой десны.", "5 500 ₽", "40–60 минут"];
  }
  var busy = false, started = false;
  function swap(build) {
    if (busy) return;   // пока идёт смена шага, лишние клики игнорируем
    busy = true;
    var old = box.firstElementChild;
    function put() {
      box.textContent = ""; var el = build(); box.appendChild(el);
      if (el.animate) el.animate({ opacity: [0, 1], transform: ["translateY(14px)", "none"] }, { duration: 380, easing: "cubic-bezier(.16,.84,.24,1)" });
      busy = false;
      var f = el.querySelector("button");
      if (started && f) f.focus({ preventScroll: true });   // клавиатура не теряет место
      started = true;
    }
    if (!old || !old.animate) return put();
    old.animate({ opacity: [1, 0], transform: ["none", "translateY(-10px)"] }, { duration: 170, easing: "ease-in", fill: "forwards" }).onfinish = put;
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }
  function step(n) {
    swap(function () {
      var wrap = el("div"), top = el("div", "qz-top"), dots = el("span", "qz-dots");
      top.appendChild(el("span", "", "Вопрос " + (n + 1) + " из 3"));
      for (var i = 0; i < 3; i++) dots.appendChild(el("i", i <= n ? "on" : ""));
      top.appendChild(dots); wrap.appendChild(top);
      wrap.appendChild(el("p", "qz-q", Q[n].q));
      var opts = el("div", "qz-opts");
      Q[n].a.forEach(function (o) {
        var b = el("button", "", o[1]); b.type = "button";
        b.addEventListener("click", function () { ans[n] = o[0]; n < 2 ? step(n + 1) : result(); });
        opts.appendChild(b);
      });
      wrap.appendChild(opts);
      return wrap;
    });
  }
  function result() {
    var r = advice(ans);
    swap(function () {
      var res = el("div", "qz-res");
      res.appendChild(el("small", "", "Вам подойдёт"));
      res.appendChild(el("b", "", r[0]));
      res.appendChild(el("p", "", r[1]));
      var pr = el("span", "price", r[2]); pr.appendChild(el("small", "", r[3])); res.appendChild(pr);
      var acts = el("div", "qz-acts"), go = el("button", "btn", "Записаться"), again = el("button", "btn ghost", "Пройти заново");
      go.type = again.type = "button";
      go.addEventListener("click", function () { document.querySelector(".book-top").click(); });
      again.addEventListener("click", function () { ans = []; step(0); });
      acts.appendChild(go); acts.appendChild(again); res.appendChild(acts);
      return res;
    });
  }
  step(0);
})();
