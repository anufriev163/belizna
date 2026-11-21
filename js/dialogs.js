/* Окно политики и плашка cookie */
// Политика конфиденциальности открывается окном поверх сайта, без перехода на другую страницу
(function () {
  var root = document.documentElement, box = document.getElementById("policy"), card = box.querySelector(".pm-card"), x = box.querySelector(".pm-x"), last = null;
  function open(e) {
    if (e) e.preventDefault();
    last = document.activeElement;
    box.setAttribute("aria-hidden", "false"); box.classList.add("open"); root.classList.add("pm-open");
    card.scrollTop = 0; setTimeout(function () { card.focus({ preventScroll: true }); }, 60);
  }
  function close() {
    if (!box.classList.contains("open")) return;
    box.classList.remove("open"); box.setAttribute("aria-hidden", "true"); root.classList.remove("pm-open");
    if (last && last.focus) last.focus({ preventScroll: true });
  }
  [].forEach.call(document.querySelectorAll('a[href="politika.html"]'), function (a) { a.removeAttribute("target"); a.addEventListener("click", open); });
  x.addEventListener("click", close);
  box.addEventListener("click", function (e) { if (e.target === box) close(); });
  box.addEventListener("touchmove", function (e) { if (!card.contains(e.target)) e.preventDefault(); }, { passive: false });
  window.addEventListener("keydown", function (e) {
    if (!box.classList.contains("open")) return;
    if (e.key === "Escape") { close(); return; }
    if (e.key === "Tab") {   // фокус не уходит за окно
      var f = [].slice.call(card.querySelectorAll("button, a[href]")), first = f[0], end = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end.focus(); }
      else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus(); }
    }
  });
})();

// Плашка cookie: выбор запоминается в браузере
(function () {
  var box = document.getElementById("cookie"), KEY = "belizna-cookie", saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved) return;
  function show() { box.classList.add("show"); box.setAttribute("aria-hidden", "false"); }
  function choose(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
    box.classList.remove("show"); box.setAttribute("aria-hidden", "true");
  }
  box.querySelector(".ck-yes").addEventListener("click", function () { choose("all"); });
  box.querySelector(".ck-no").addEventListener("click", function () { choose("necessary"); });
  window.addEventListener("keydown", function (e) { if (e.key === "Escape" && box.classList.contains("show") && !document.documentElement.classList.contains("pm-open")) choose("necessary"); });
  // Показываем, когда экран загрузки ушёл и человек начал листать: первый экран остаётся чистым.
  // Не листает — всё равно покажем через 8 секунд после загрузки.
  var wait = setInterval(function () {
    if (!document.documentElement.classList.contains("go")) return;
    clearInterval(wait);
    var done = false;
    function once() { if (done) return; done = true; removeEventListener("scroll", onScroll); setTimeout(show, 600); }
    function onScroll() { if (window.scrollY > 60) once(); }
    addEventListener("scroll", onScroll, { passive: true });
    setTimeout(once, 8000);
    onScroll();
  }, 300);
})();
