/* 3D-сцена с челюстью, шарики на фоне */
(function () {
  if (!window.THREE || !THREE.GLTFLoader) { window.siteFail("3D не запустилось: не загрузилась библиотека, THREE=" + typeof window.THREE + ", GLTFLoader=" + typeof (window.THREE && THREE.GLTFLoader)); return; }
  var canvas = document.getElementById("jaw"), renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance" }); } catch (e) { window.siteFail("3D не запустилось: в браузере выключен WebGL"); return; }
  // Видеокарта может сбросить WebGL (драйвер, нехватка памяти): тогда холст пустеет насовсем.
  // Ждём возвращения контекста и перезагружаем страницу, браузер вернёт то же место прокрутки.
  canvas.addEventListener("webglcontextlost", function (ev) { ev.preventDefault(); }, false);
  canvas.addEventListener("webglcontextrestored", function () {
    var n = 0; try { n = +sessionStorage.getItem("bl-ctx") || 0; sessionStorage.setItem("bl-ctx", String(n + 1)); } catch (x) {}
    if (n < 3) location.reload();   // не больше трёх раз подряд, чтобы не зациклиться
  }, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0xffffff, 0);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;

  function col(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
  function V(x, y, z) { return new THREE.Vector3(x, y, z); }
  function clamp(v) { return Math.max(0, Math.min(1, v)); }
  function ease(t) { t = clamp(t); return t * t * (3 - 2 * t); }
  function seg(p, a, b) { return clamp((p - a) / (b - a)); }

  // ----- Сцена и студийный свет -----
  var scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(30, 1, .05, 100);
  var key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(4, 8, 9); scene.add(key);
  var fill = new THREE.DirectionalLight(0xFFF2EE, .5); fill.position.set(-7, 2, 5); scene.add(fill);
  var rim = new THREE.DirectionalLight(0xffffff, .6); rim.position.set(0, 5, -9); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8E7D7A, .5));
  var lampLight = new THREE.PointLight(col(0x6EC3FF), 0, 7); scene.add(lampLight);
  (function () {
    var pm = new THREE.PMREMGenerator(renderer), room = new THREE.Scene();
    room.add(new THREE.Mesh(new THREE.SphereGeometry(30, 16, 8), new THREE.MeshBasicMaterial({ color: 0x8A8A8E, side: THREE.BackSide })));
    [[new THREE.Color(5, 5, 5), [0, 12, 8], [18, 1, 10]], [new THREE.Color(2.4, 2.3, 2.3), [-14, 3, 6], [1, 10, 12]], [new THREE.Color(2, 2, 2.1), [14, 2, 2], [1, 10, 12]]].forEach(function (b) {
      var m = new THREE.Mesh(new THREE.BoxGeometry(b[2][0], b[2][1], b[2][2]), new THREE.MeshBasicMaterial({ color: b[0] }));
      m.position.fromArray(b[1]); room.add(m);
    });
    scene.environment = pm.fromScene(room, .04).texture;
  })();
  // Мягкая тень под челюстью
  var sc = document.createElement("canvas"); sc.width = sc.height = 64;
  var sx = sc.getContext("2d"), gr = sx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(40,40,50,.2)"); gr.addColorStop(1, "rgba(40,40,50,0)"); sx.fillStyle = gr; sx.fillRect(0, 0, 64, 64);
  var shadow = new THREE.Mesh(new THREE.PlaneGeometry(10, 7), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, toneMapped: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -3.2; scene.add(shadow);

  var W = 0, H = 0;
  var touchOnly = matchMedia("(pointer: coarse)").matches;
  function resize() {
    // На телефоне при прокрутке адресная строка прячется и возвращается, меняя только высоту экрана.
    // Холст и раскладку из-за этого не пересобираем: каждый такой пересбор давал подлаг и мигание
    if (touchOnly && W && innerWidth === W && Math.abs(innerHeight - H) < 220) return;
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H, false);
    innerEl.style.width = W + "px"; innerEl.style.height = H + "px";
    camera.aspect = W / H;
    camera.fov = W / H < .8 ? 44 : 30;
    camera.updateProjectionMatrix();
    measure();
  }
  // Круг: размер и центр зависят от раскладки экрана
  var portEl = document.querySelector(".port"), innerEl = document.querySelector(".inner"), lastS = "", lastXY = "", ringEl = document.querySelector(".ring"), circ = { r: 0, cx: 0, cy: 0, D: 0, k: 0 };
  var glowEl = document.querySelector(".glow");
  function smooth5(t) { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); }
  // Куда должен встать круг: каждый раздел задаёт сторону (-1 слева, 0 центр, 1 справа) и размер.
  // Между центрами соседних разделов круг переезжает, в середине раздела стоит на месте
  function circTarget() {
    var yc = window.scrollY + H / 2, pts = segs;
    if (!pts.length) return { c: 0, d: 1 };
    if (yc <= pts[0].mid) return pts[0];
    for (var i = 0; i < pts.length - 1; i++) {
      if (yc < pts[i + 1].mid) {
        var f = smooth5((((yc - pts[i].mid) / (pts[i + 1].mid - pts[i].mid)) - .3) / .4);
        return { c: pts[i].c + (pts[i + 1].c - pts[i].c) * f, d: pts[i].d + (pts[i + 1].d - pts[i].d) * f, y: pts[i].y + (pts[i + 1].y - pts[i].y) * f, v: pts[i].v + (pts[i + 1].v - pts[i].v) * f, m: pts[i].m + (pts[i + 1].m - pts[i].m) * f, g: pts[i].g + (pts[i + 1].g - pts[i].g) * f };
      }
    }
    return pts[pts.length - 1];
  }
  // Планшет вертикально: круг чуть меньше, чтобы между ним и карточкой оставался воздух
  function tabPortrait() { return window.siteLayout() === "wide" && W >= 761 && W <= 2400 && H > W; }   // и планшет, и большой вертикальный экран
  function baseD() { return Math.min(H * .72, W * (tabPortrait() ? .4 : W < 1000 ? .47 : .42)); }
  // Круг над карточкой. Высоту берём при смене ширины: адресная строка телефона не должна его дёргать
  var W0 = 0, H0 = 0;
  // Круг занимает всё место, что остаётся над самой высокой карточкой, чтобы под ней не было пустоты
  var cardH = 0;
  function stackD() {
    if (W !== W0) { W0 = W; H0 = H; }
    var cap = W >= 700 ? 620 : 440, base = Math.min(W * .62, H0 * .34, cap), room = H0 - 96 - cardH - 48;
    return cardH ? Math.max(base, Math.min(room, W * .86, cap)) : base;
  }
  var sp = { on: false, x: 0, y: 0, d: 0, vx: 0, vy: 0, vd: 0 };
  window.addEventListener("site:jump", function () { sp.on = false; sp.vx = sp.vy = sp.vd = 0; });
  // Планшет вертикально: карточки уходят под белую плашку над кругом и не наезжают на него
  var bandEl = document.querySelector(".band");
  function tabBand(o, h) { bandEl.style.opacity = o.toFixed(3); bandEl.style.height = h.toFixed(0) + "px"; }
  function circleAt(k) {
    var L = window.siteLayout(), tg = circTarget(), D, cx1, cy1, R0 = Math.hypot(W, H) / 2 + 20;
    if (L === "stack") { circ.Z = stackD(); D = circ.Z * tg.v; cx1 = W / 2; cy1 = 84 + circ.Z / 2 + (tg.y || 0) * H; if (W >= 700) tabBand(clamp((k - .55) / .3) * clamp(tg.v || 0), 84 + D + 22); }
    else if (L === "side") { D = circ.Z = H * .66; cx1 = W * .22; cy1 = H / 2 + 20; }
    else { D = circ.Z = baseD() * tg.d * (W < 1000 && tg.d > 1 ? .86 : 1); cx1 = W / 2 + tg.c * W * .24; cy1 = H / 2 + (tg.y || 0) * H; }
    circ.m = (tg.m || 0) * (k > .99 ? 1 : 0);
    circ.g = (L === "stack" ? (tg.v || 0) : (tg.g || 0)) * (k > .99 ? 1 : 0);
    // Пружина: круг слегка отстаёт на старте и мягко докатывается с маленьким перелётом
    var dt = Math.min(.033, circ.dt || .016);
    if (!sp.on) { sp.on = true; sp.x = cx1; sp.y = cy1; sp.d = D; }
    sp.vx += ((cx1 - sp.x) * 90 - sp.vx * 15) * dt; sp.x += sp.vx * dt;
    sp.vy += ((cy1 - sp.y) * 90 - sp.vy * 15) * dt; sp.y += sp.vy * dt;
    sp.vd += ((D - sp.d) * 90 - sp.vd * 15) * dt; sp.d += sp.vd * dt;
    cx1 = sp.x; cy1 = sp.y; D = sp.d;
    if (L === "wide") circ.Z = D;
    circ.k = k; circ.D = D; circ.r = R0 + (D / 2 - R0) * k; circ.cx = W / 2 + (cx1 - W / 2) * k; circ.cy = H / 2 + (cy1 - H / 2) * k;
    var X = (circ.cx - circ.r).toFixed(1), Y = (circ.cy - circ.r).toFixed(1), S = (circ.r * 2).toFixed(1) + "px";
    if (S !== lastS) { lastS = S; portEl.style.width = portEl.style.height = ringEl.style.width = ringEl.style.height = S; }
    if (X + Y !== lastXY) {
      lastXY = X + Y;
      portEl.style.transform = ringEl.style.transform = "translate3d(" + X + "px," + Y + "px,0)";
      innerEl.style.transform = "translate3d(" + -X + "px," + -Y + "px,0)";
    }
    ringEl.style.opacity = clamp((k - .6) / .4) * clamp(circ.r / 24);
    glowEl.style.opacity = k.toFixed(3);
  }
  function measure() {
    segs = [].slice.call(document.querySelectorAll("[data-p]")).map(function (el) {
      var r = el.getBoundingClientRect(), pp = el.dataset.p.split(" ");
      var top = r.top + window.scrollY;
      return { top: top, h: r.height, mid: top + r.height / 2, a: +pp[0], b: +pp[1], c: +(el.dataset.c || 0), d: +(el.dataset.d || 1), y: +(el.dataset.y || 0), v: el.classList.contains("plain") ? 0 : 1, m: el.dataset.cmp ? 1 : 0, g: el.classList.contains("split") ? 1 : 0 };
    });
    document.documentElement.style.setProperty("--gap", (baseD() * .62 + 56).toFixed(0) + "px");
    cardH = 0;
    if (window.siteLayout() === "stack") [].forEach.call(document.querySelectorAll(".film .tx"), function (e) { cardH = Math.max(cardH, e.offsetHeight); });
    document.documentElement.style.setProperty("--stk", (stackD() + 96).toFixed(0) + "px");
    // Телефон: у коротких карточек («Чистая, ровная улыбка», «Было / стало») круг опускаем ближе к карточке
    var els = document.querySelectorAll("[data-p]"), stk = window.siteLayout() === "stack", tab = window.siteLayout() === "wide" && (W < 1000 || tabPortrait());
    segs.forEach(function (sg, i) {
      var el = els[i], tx = el.querySelector(".film .tx, .tx");
      if (stk && el.classList.contains("film") && +(el.dataset.d || 1) < 1 && tx) {
        var space = H0 - (stackD() + 96) - 20;
        sg.y = Math.max(0, (space - tx.offsetHeight) / 2 - 45) / H;
      } else if (stk) sg.y = 0;
      else if (tabPortrait() && el.classList.contains("film") && el.dataset.c === "0" && !el.dataset.cmp) {
        // «Чистая, ровная, белая улыбка»: круг крупнее, а на большом вертикальном экране ещё больше (внизу под ним только заголовок)
        sg.d = Math.max(sg.d, 1);
        if (W <= 1100) sg.y = -.10;   // планшет: круг чуть выше центра, под ним заголовок с зазором
      }
      else if (tabPortrait() && W <= 1100 && el.classList.contains("film") && el.dataset.cmp) sg.d = Math.max(sg.d, 1);   // «Было / стало» тоже крупнее
      else if (tab && el.classList.contains("book")) {
        sg.y = -.3;   // планшет: круг над двумя широкими карточками
        if (tabPortrait()) {
          // Вертикальный планшет: круг ставим по центру свободного места между шапкой и верхом карточек, не больше этого места
          var card = el.querySelector(".l"), secH = el.offsetHeight, secTop = el.getBoundingClientRect().top;
          var cardTop = card.getBoundingClientRect().top - secTop - Math.max(0, secH - H);   // верх карточек, когда страница доехала до конца
          var free = cardTop - 84 - 56;
          if (free > 120) {
            sg.d = Math.min(Math.max(sg.d, 1.15), free / baseD());   // круг крупный, но не лезет на карточки
            var dEff = baseD() * sg.d * (W < 1000 && sg.d > 1 ? .86 : 1);   // так же, как считает circleAt
            sg.y = (cardTop - 56 - dEff / 2 - H / 2) / H;   // круг стоит прямо над карточками, зазор около 56 px
          }
        }
      }
    });
  }
  function filmP() {
    var yc = window.scrollY + H / 2, p = segs.length ? segs[0].a : 0;
    for (var i = 0; i < segs.length; i++) {
      var sg = segs[i];
      if (yc < sg.top) break;
      p = yc < sg.top + sg.h ? sg.a + (sg.b - sg.a) * (yc - sg.top) / sg.h : sg.b;
    }
    return p;
  }
  window.addEventListener("resize", resize); resize();
  window.addEventListener("load", measure);
  window.addEventListener("site:measure", measure);
  if (document.fonts) document.fonts.ready.then(measure);

  // Модель лежит отдельным файлом model.glb: качается параллельно скриптам (см. preload в начале страницы) и кэшируется сама по себе
  var loader = new THREE.GLTFLoader(), fail = function (e) { console.error("Модель не загрузилась", e); window.siteFail("3D не запустилось: не загрузилась модель"); };
  // Адрес модели берём из предзагрузки в <head>: так версия файла указана только в одном месте, и браузер не качает модель дважды
  var modelLink = document.querySelector('link[rel="preload"][as="fetch"]');
  loader.load(modelLink ? modelLink.getAttribute("href") : "model.glb", build, undefined, fail);

  function build(gltf) {
    var root = gltf.scene, gumsMesh = null, teethMesh = null;
    root.updateMatrixWorld(true);
    root.traverse(function (o) { if (o.isMesh) { if (/gum/i.test(o.name)) gumsMesh = o; else teethMesh = o; } });
    if (!gumsMesh || !teethMesh) { console.error("В модели нет дёсен или зубов"); window.siteFail("3D не запустилось: модель повреждена"); return; }

    // ----- Нормализация: центр зубов в начало координат, ширина дуги ~6.4 -----
    var gT = teethMesh.geometry.clone().applyMatrix4(teethMesh.matrixWorld);
    gT.computeBoundingBox();
    var C0 = gT.boundingBox.getCenter(V(0, 0, 0)), S = 6.4 / (gT.boundingBox.max.x - gT.boundingBox.min.x);
    function normGeo(mesh) { var g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld); g.translate(-C0.x, -C0.y, -C0.z); g.scale(S, S, S); return g; }
    var mouth = new THREE.Group(); scene.add(mouth);

    var gumMat = gumsMesh.material, teethMat = teethMesh.material;
    teethMat.envMapIntensity = .7; gumMat.envMapIntensity = .9;
    var gums = new THREE.Mesh(normGeo(gumsMesh), gumMat); mouth.add(gums);

    // ----- Разделяем зубы на 32 отдельных (у модели каждый зуб — свой островок) -----
    var tg = normGeo(teethMesh), P = tg.attributes.position, idx = tg.index.array, n = P.count;
    var parent = new Int32Array(n), keyMap = {};
    for (var i = 0; i < n; i++) {
      var k = Math.round(P.getX(i) * 2000) + "," + Math.round(P.getY(i) * 2000) + "," + Math.round(P.getZ(i) * 2000);
      parent[i] = keyMap[k] === undefined ? (keyMap[k] = i) : keyMap[k];
    }
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    for (i = 0; i < idx.length; i += 3) { var a = find(idx[i]), b = find(idx[i + 1]), c = find(idx[i + 2]); parent[b] = a; parent[find(c)] = find(a); }
    var groups = {};
    for (i = 0; i < idx.length; i += 3) { var r = find(idx[i]); (groups[r] = groups[r] || []).push(idx[i], idx[i + 1], idx[i + 2]); }

    function subGeo(tris) {
      var map = {}, list = [], out = new THREE.BufferGeometry();
      var newIdx = tris.map(function (v) { if (map[v] === undefined) { map[v] = list.length; list.push(v); } return map[v]; });
      Object.keys(tg.attributes).forEach(function (name) {
        var src = tg.attributes[name], sz = src.itemSize, arr = new Float32Array(list.length * sz);
        list.forEach(function (v, j) { for (var q = 0; q < sz; q++) arr[j * sz + q] = src.array[v * sz + q]; });
        out.setAttribute(name, new THREE.BufferAttribute(arr, sz));
      });
      out.setIndex(newIdx);
      return out;
    }

    var teeth = [];
    Object.keys(groups).forEach(function (r) {
      var g = subGeo(groups[r]); g.computeBoundingBox();
      var c = g.boundingBox.getCenter(V(0, 0, 0)), size = g.boundingBox.getSize(V(0, 0, 0));
      g.translate(-c.x, -c.y, -c.z);
      teeth.push({ geo: g, c: c, h: size.y });
    });
    // Верх/низ: рот приоткрыт, граница между рядами — наклонная плоскость (подобрана по модели)
    var zMin = Infinity, zMax = -Infinity, xMax = 0;
    teeth.forEach(function (t) {
      var oz = t.c.z / S + C0.z, oy = t.c.y / S + C0.y;
      t.upper = oy > 19 + (11.5 - oz) * .27;
      zMin = Math.min(zMin, t.c.z); zMax = Math.max(zMax, t.c.z); xMax = Math.max(xMax, Math.abs(t.c.x));
    });
    var F = zMax;
    teeth.forEach(function (t) {
      // Направление «наружу» — по нормали к U-образной дуге
      t.out = V(t.c.x / (xMax * xMax), 0, (t.c.z - zMin) / ((zMax - zMin) * (zMax - zMin))).normalize();
      t.gs = t.upper ? 1 : -1;   // в какую сторону от коронки десна
      var p = t.geo.attributes.position, face = 0, back = 0;
      for (var i = 0; i < p.count; i++) { var d = p.getX(i) * t.out.x + p.getZ(i) * t.out.z; face = Math.max(face, d); back = Math.min(back, d); }
      t.face = face; t.back = back;
      t.front = Math.abs(t.c.x) < xMax * .72 && t.c.z > zMin + (zMax - zMin) * .55;
      t.mesh = new THREE.Mesh(t.geo, teethMat);
      t.mesh.position.copy(t.c);
      mouth.add(t.mesh);
    });
    function sideList(upper, side) { return teeth.filter(function (t) { return t.upper === upper && (side < 0 ? t.c.x < 0 : t.c.x > 0); }); }
    function byZ(list, dir) { return list.sort(function (a, b) { return (a.c.z - b.c.z) * dir; }); }
    var PATH_R = byZ(sideList(true, -1), 1).concat(byZ(sideList(false, -1), -1));
    var PATH_L = byZ(sideList(true, 1), 1).concat(byZ(sideList(false, 1), -1));
    var upperFront = teeth.filter(function (t) { return t.upper && t.front; }).sort(function (a, b) { return a.c.x - b.c.x; });
    var lowerFront = teeth.filter(function (t) { return !t.upper && t.front; }).sort(function (a, b) { return a.c.x - b.c.x; });
    var POLISH = upperFront.slice().reverse().concat(lowerFront);
    var GAPS = [];
    upperFront.forEach(function (t, i) { if (i && Math.abs(t.c.x + upperFront[i - 1].c.x) < 1.6) GAPS.push([upperFront[i - 1], t]); });

    // Скученность нижних передних зубов: поворот вокруг своей оси и небольшой наклон
    var CROOK = [[.42, .05], [-.38, -.05], [.3, .04], [-.32, -.04], [.18, .02], [-.16, -.02]];
    lowerFront.slice().sort(function (a, b) { return Math.abs(a.c.x) - Math.abs(b.c.x); }).slice(0, 4).forEach(function (t, i) { t.crook = CROOK[i]; });

    // Точка на зубе: hf — от десны (0) к режущему краю (1), off — отступ от поверхности
    function onTooth(t, hf, off, inner) {
      var v = t.c.clone().addScaledVector(t.out, inner ? t.back - off : t.face + off);
      v.y += t.gs * t.h * (.5 - hf);
      return mouth.localToWorld(v);
    }
    function worldOut(t) { return t.out.clone().applyQuaternion(mouth.quaternion); }

    // ----- Налёт у десны и камень с внутренней стороны нижних резцов -----
    var plaqueItems = [], dummy = new THREE.Object3D();
    teeth.forEach(function (t, ti) {
      var p = t.geo.attributes.position, nrm = t.geo.attributes.normal, picked = [];
      for (var i = 0; i < p.count && picked.length < 400; i++) {
        var d = p.getX(i) * t.out.x + p.getZ(i) * t.out.z, band = t.gs * p.getY(i) / t.h;
        var outer = d > t.face * .3, inner = !t.upper && t.front && d < t.back * .3;
        if ((outer || inner) && band > .12 && band < .34) picked.push([i, inner]);
      }
      for (var k = 0; k < picked.length; k += Math.max(1, Math.floor(picked.length / 7))) {
        var vi = picked[k][0], isIn = picked[k][1];
        var pos = V(p.getX(vi), p.getY(vi), p.getZ(vi)), nn = V(nrm.getX(vi), nrm.getY(vi), nrm.getZ(vi));
        dummy.position.copy(pos).addScaledVector(nn, .006); dummy.lookAt(dummy.position.clone().add(nn)); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
        var sz = (isIn ? .085 : .065) * (1 + (k % 3) * .15);
        plaqueItems.push({ t: t, local: dummy.matrix.clone(), s: V(sz * 1.5, sz, sz * .45), tartar: isIn });
      }
    });
    var plaqueMat = new THREE.MeshStandardMaterial({ color: col(0xC9A251), roughness: .85 });
    var plaque = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), plaqueMat, plaqueItems.length);
    plaque.frustumCulled = false; mouth.add(plaque);
    var tmpM = new THREE.Matrix4(), tmpS = new THREE.Matrix4(), lastPlaqueKey = "";

    // ----- Оболочки: гель для отбеливания и элайнер -----
    function hull(geo, wd) {
      var g = geo.clone(), p = g.attributes.position, nr = g.attributes.normal;
      for (var i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + nr.getX(i) * wd, p.getY(i) + nr.getY(i) * wd, p.getZ(i) + nr.getZ(i) * wd);
      return g;
    }
    var gelMat = new THREE.MeshPhysicalMaterial({ color: col(0x4DAEFF), roughness: .1, clearcoat: 1, transparent: true, opacity: 0, depthWrite: false });
    var trays = [];
    upperFront.concat(lowerFront).forEach(function (t) { var m = new THREE.Mesh(hull(t.geo, .035), gelMat); m.visible = false; t.mesh.add(m); trays.push(m); });
    var alignMat = new THREE.MeshPhysicalMaterial({ color: col(0xD8F0FF), roughness: .05, clearcoat: 1, envMapIntensity: 1.8, transparent: true, opacity: 0, depthWrite: false });
    var aligner = new THREE.Group(); mouth.add(aligner);
    teeth.forEach(function (t) { if (t.upper) return; var m = new THREE.Mesh(hull(t.geo, .04), alignMat); m.position.copy(t.c); aligner.add(m); });

    // ----- Инструменты -----
    var steel = new THREE.MeshStandardMaterial({ color: col(0xD3D8DE), metalness: .9, roughness: .25 });
    var plastic = new THREE.MeshPhysicalMaterial({ color: col(0xF6F7F8), roughness: .35, clearcoat: .6 });
    var mint = new THREE.MeshPhysicalMaterial({ color: col(0x4FC79F), roughness: .4, clearcoat: .5 });
    function cyl(r1, r2, len, mat, z) { var g = new THREE.CylinderGeometry(r1, r2, len, 24); g.rotateX(Math.PI / 2); g.translate(0, 0, z + len / 2); return new THREE.Mesh(g, mat); }
    var scaler = new THREE.Group();
    scaler.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, 0, 0), V(0, .05, .1), V(0, .07, .25), V(0, .04, .42)]), 16, .02, 8, false), steel),
      cyl(.05, .07, .3, steel, .42), cyl(.12, .12, .2, mint, .72), cyl(.12, .14, 2.4, plastic, .92));
    scene.add(scaler);
    var drops = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshPhysicalMaterial({ color: col(0xCFEFFF), roughness: .05, clearcoat: 1, transparent: true, opacity: .8 }), 40), dropData = [];
    for (i = 0; i < 40; i++) dropData.push({ life: 9, p: V(0, 0, 0), v: V(0, 0, 0) });
    drops.frustumCulled = false; scene.add(drops);
    var brush = new THREE.Group();
    (function () {
      var bristle = new THREE.CylinderGeometry(.005, .005, .14, 4), nb = 150, bm = new THREE.InstancedMesh(bristle, new THREE.MeshStandardMaterial({ color: 0xF2F6FA, roughness: .6 }), nb);
      for (var i = 0; i < nb; i++) {
        var z = .02 + (i / nb) * .36, a = i * 2.4, rr = .06 * (1 - .35 * (z / .38));
        dummy.position.set(Math.cos(a) * rr * .5, Math.sin(a) * rr * .5, z); dummy.rotation.set(0, 0, a); dummy.rotateZ(Math.PI / 2);
        dummy.scale.set(1, rr / .07, 1); dummy.updateMatrix(); bm.setMatrixAt(i, dummy.matrix);
      }
      brush.add(bm, cyl(.012, .012, .7, steel, 0), cyl(.07, .09, .3, mint, .65), cyl(.09, .07, 1.3, mint, .95));
    })();
    scene.add(brush);
    var polisher = new THREE.Group(), cup = new THREE.Group();
    (function () {
      var cg = new THREE.CylinderGeometry(.17, .12, .16, 24, 1, true); cg.rotateX(Math.PI / 2); cg.translate(0, 0, .08);
      cup.add(new THREE.Mesh(cg, new THREE.MeshPhysicalMaterial({ color: col(0xFF9DB5), roughness: .6, side: THREE.DoubleSide })));
      var neck = new THREE.Group(); neck.add(cyl(.09, .1, 1.6, plastic, 0)); neck.position.set(0, 0, .26); neck.rotation.x = -.55;
      polisher.add(cup, cyl(.12, .12, .14, steel, .16), neck);
    })();
    scene.add(polisher);
    var lamp = new THREE.Group(), glowMat = new THREE.MeshBasicMaterial({ color: col(0x8FD0FF), transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    (function () {
      lamp.add(new THREE.Mesh(new THREE.TorusGeometry(1.6, .14, 16, 64), plastic), new THREE.Mesh(new THREE.CircleGeometry(1.5, 48), glowMat));
      var arm = cyl(.1, .1, 2.6, plastic, 0); arm.rotation.x = -Math.PI / 2; arm.position.y = 1.7; lamp.add(arm);
    })();
    scene.add(lamp);
    // Блики-искорки на чистых зубах
    var sparkShape = new THREE.Shape(), sm = function (X, Y) { return [(X - 12) / 12, (12 - Y) / 12]; }, s0 = sm(12, 0);
    sparkShape.moveTo(s0[0], s0[1]);
    [[12.9, 7.6, 16.4, 11.1, 24, 12], [16.4, 12.9, 12.9, 16.4, 12, 24], [11.1, 16.4, 7.6, 12.9, 0, 12], [7.6, 11.1, 11.1, 7.6, 12, 0]].forEach(function (cc) {
      var a = sm(cc[0], cc[1]), b = sm(cc[2], cc[3]), e = sm(cc[4], cc[5]); sparkShape.bezierCurveTo(a[0], a[1], b[0], b[1], e[0], e[1]);
    });
    var glintGeo = new THREE.ShapeGeometry(sparkShape, 10), glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), glints = [];
    upperFront.concat(lowerFront.slice(1, 3)).forEach(function (t, i) { var m = new THREE.Mesh(glintGeo, glintMat); m.userData = { t: t, ph: i * 1.7 }; scene.add(m); glints.push(m); });

    // ----- Цвета «до» и «после» -----
    var DIRTY = new THREE.Color(1, .82, .55), CLEAN = new THREE.Color(1, 1, 1);
    var GUM_SORE = new THREE.Color(1, .62, .62), GUM_OK = new THREE.Color(1, 1, 1);

    // ----- Раскадровка: камера стоит, пока идёт действие, и плавно переезжает к следующему кадру -----
    // Кадр: азимут° (0 — спереди), высота°, дистанция, точка, на которую смотрим
    var SHOT = {
      front: [0, 6, 13.5, V(0, 0, 0)],
      sideA: [-45, 12, 14, V(-2, 0, .8)],
      sideB: [45, 12, 14, V(2, 0, .8)],
      close: [0, 3, 8, V(0, -.05, F - 1)],
      white: [0, 4, 9.5, V(0, 0, F - 1.2)],
      above: [0, 20, 10, V(0, -.5, F - 1.6)],
      final: [-22, 8, 13, V(0, 0, 0)]
    };
    // Пока идёт действие, камера медленно «доезжает» в одну сторону: [азимут°, высота°, дистанция]
    var DRIFT = {
      front: [-10, 2, -1.5],
      sideA: [-14, -3, -1],
      sideB: [14, -3, -1],
      close: [6, 0, -.9],
      white: [-6, 2, -1.2],
      above: [0, 6, -1.2],
      final: [-12, -2, -.8]
    };
    // [начало переезда, конец переезда, откуда, куда]
    var MOVES = [
      [.05, .11, "front", "sideA"],
      [.27, .33, "sideA", "sideB"],
      [.49, .54, "sideB", "close"],
      [.68, .72, "close", "white"],
      [.81, .85, "white", "above"],
      [.95, 1, "above", "final"]
    ];
    function smoother(t) { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); }
    // Кадр с учётом дрейфа d (0 — начало, 1 — конец): азимут, высота, дистанция, цель
    function shotState(name, d, out) {
      var s = SHOT[name], dr = DRIFT[name];
      out.az = s[0] + dr[0] * d; out.el = s[1] + dr[1] * d; out.r = s[2] + dr[2] * d; out.aim = s[3];
      return out;
    }
    var DEG = Math.PI / 180, aimTmp = V(0, 0, 0), stA = {}, stB = {};
    function placeCamera(p) {
      var name = "front", d0 = 0, holdStart = 0;
      for (var i = 0; i < MOVES.length; i++) {
        var m = MOVES[i];
        if (p < m[0]) { name = m[2]; d0 = (p - holdStart) / (m[0] - holdStart); break; }
        if (p <= m[1]) {
          // Переезд: из конца дрейфа одного кадра в начало следующего, скорость не обрывается
          var f = smoother(seg(p, m[0], m[1]));
          shotState(m[2], 1, stA); shotState(m[3], 0, stB);
          var az = stA.az + (stB.az - stA.az) * f, el = stA.el + (stB.el - stA.el) * f, r = stA.r + (stB.r - stA.r) * f;
          aimTmp.copy(stA.aim).lerp(stB.aim, f);
          return orbit(az, el, r);
        }
        holdStart = m[1]; name = m[3]; d0 = (p - holdStart) / Math.max(1e-4, 1 - holdStart);
      }
      // Дрейф идёт равномерно: так он стыкуется с переездами без рывка
      shotState(name, clamp(d0), stA); aimTmp.copy(stA.aim);
      orbit(stA.az, stA.el, stA.r);
    }
    var azShift = 0, rot = { y: 0, x: 0, z: 1, vy: 0, vx: 0, drag: false, idle: 9, used: false, on: false }, grabEl = document.querySelector(".grab"), gx = 0, gy = 0;
    var ptrs = {}, pinch0 = 0, z0 = 1;
    function ptrDist() { var k = Object.keys(ptrs); return k.length < 2 ? 0 : Math.hypot(ptrs[k[0]].x - ptrs[k[1]].x, ptrs[k[0]].y - ptrs[k[1]].y); }
    grabEl.addEventListener("pointerdown", function (e) {
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      rot.drag = true; gx = e.clientX; gy = e.clientY; grabEl.classList.add("drag");
      if (!rot.used) { rot.used = true; grabEl.classList.add("used"); }
      if (Object.keys(ptrs).length === 2) { pinch0 = ptrDist(); z0 = rot.z; }
      if (grabEl.setPointerCapture) grabEl.setPointerCapture(e.pointerId);
    });
    grabEl.addEventListener("pointermove", function (e) {
      if (!rot.drag || !ptrs[e.pointerId]) return;
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      rot.idle = 0;
      if (Object.keys(ptrs).length >= 2) {   // щипок: приблизить и отдалить
        if (pinch0 > 10) rot.z = Math.max(.7, Math.min(2.4, z0 * ptrDist() / pinch0));
        return;
      }
      var dx = e.clientX - gx, dy = e.clientY - gy; gx = e.clientX; gy = e.clientY;
      rot.y = Math.max(-80, Math.min(80, rot.y - dx * .45)); rot.vy = -dx * 27;
      if (e.pointerType === "mouse" || window.siteLayout() === "stack") { rot.x = Math.max(-15, Math.min(18, rot.x + dy * .15)); rot.vx = dy * 9; }
    });
    ["pointerup", "pointercancel"].forEach(function (n) {
      grabEl.addEventListener(n, function (e) {
        delete ptrs[e.pointerId];
        var k = Object.keys(ptrs);
        if (k.length) { gx = ptrs[k[0]].x; gy = ptrs[k[0]].y; pinch0 = 0; return; }
        rot.drag = false; grabEl.classList.remove("drag");
      });
    });
    grabEl.addEventListener("dblclick", function () { rot.z = 1; rot.idle = 9; });
    // С клавиатуры: стрелки поворачивают (как перетаскивание в ту же сторону), +/- приближают, 0 возвращает
    grabEl.addEventListener("keydown", function (e) {
      var k = e.key, ok = true;
      if (k === "ArrowLeft") rot.y = Math.min(80, rot.y + 12);
      else if (k === "ArrowRight") rot.y = Math.max(-80, rot.y - 12);
      else if (k === "ArrowUp") rot.x = Math.max(-15, rot.x - 5);
      else if (k === "ArrowDown") rot.x = Math.min(18, rot.x + 5);
      else if (k === "+" || k === "=") rot.z = Math.min(2.4, rot.z * 1.15);
      else if (k === "-" || k === "_") rot.z = Math.max(.7, rot.z / 1.15);
      else if (k === "0" || k === "Home") { rot.y = 0; rot.x = 0; rot.z = 1; }
      else ok = false;
      if (!ok) return;
      e.preventDefault(); rot.idle = 0; rot.vy = 0; rot.vx = 0;
      if (!rot.used) { rot.used = true; grabEl.classList.add("used"); }
    });
    // Вращение: инерция после броска, потом челюсть сама плавно возвращается
    var hintState = 0, hintT = 0;   // подсказка: 0 — ещё не показывали, 1 — идёт, 2 — показана, больше не покажем
    var calmMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;   // тогда челюсть сама не поворачивается, остаётся только надпись
    function spinStep(dt) {
      // Крутить можно везде, где челюсть в круге (на ПК и планшете — и рядом с карточками), кроме «Было / стало»
      var show = (window.siteLayout() === "stack" ? circ.g > .9 : circ.k > .99 && circ.r > 40) && circ.m < .01;
      if (show !== rot.on) { rot.on = show; grabEl.tabIndex = show ? 0 : -1; if (!show && document.activeElement === grabEl) grabEl.blur(); grabEl.style.visibility = show ? "visible" : "hidden"; grabEl.style.opacity = show ? 1 : 0; if (!show) rot.drag = false; }
      // Один раз, когда круг впервые встал на место: надпись «Покрутите» и лёгкий поворот челюсти, чтобы было понятно, что её можно крутить
      if (hintState === 0 && show) { hintState = 1; hintT = 3.6; grabEl.classList.add("tip"); }
      if (hintState === 1) {
        if (rot.used || !show) { hintState = 2; grabEl.classList.remove("tip"); }
        else {
          hintT -= dt;
          if (hintT > 1.2 && !calmMotion) rot.y = 15 * Math.sin((3.6 - hintT) / 2.4 * Math.PI * 2) * Math.min(1, (3.6 - hintT) * 2); rot.vy = 0; rot.idle = 0;
          if (hintT <= 0) { hintState = 2; grabEl.classList.remove("tip"); }
        }
      }
      if (show) {
        var s = (circ.r * 2).toFixed(1) + "px";
        grabEl.style.width = grabEl.style.height = s;
        grabEl.style.transform = "translate3d(" + (circ.cx - circ.r).toFixed(1) + "px," + (circ.cy - circ.r).toFixed(1) + "px,0)";
      }
      if (rot.drag) return;
      rot.idle += dt;
      rot.y = Math.max(-80, Math.min(80, rot.y + rot.vy * dt)); rot.x = Math.max(-15, Math.min(18, rot.x + rot.vx * dt));
      rot.vy *= Math.exp(-dt * 4); rot.vx *= Math.exp(-dt * 4);
      if (rot.idle > 2.5 || !show) { var back = 1 - Math.exp(-dt * 2.5); rot.y -= rot.y * back; rot.x -= rot.x * back; rot.z += (1 - rot.z) * back * .6; }
    }
    function orbit(az, el, r) {
      az += azShift + rot.y; el += rot.x; r -= azShift * .12;   // в «было / стало» камера чуть ближе
      camera.position.set(aimTmp.x + Math.sin(az * DEG) * Math.cos(el * DEG) * r, aimTmp.y + Math.sin(el * DEG) * r, aimTmp.z + Math.cos(az * DEG) * Math.cos(el * DEG) * r);
      camera.lookAt(aimTmp);
      // Крупно на первом экране, потом вписываем в круг и ставим в его центр
      var tanF = Math.tan(camera.fov * DEG / 2), k = circ.k;
      // На невысоком экране челюсть меньше, чтобы не наезжать на название
      // На телефоне размер челюсти зависит от высоты экрана, а название задано по ширине. С адресной строкой Safari
      // экран короче, и челюсть выходила мелкой рядом с крупным названием. Поэтому на узком экране зум растёт с W/H:
      // челюсть занимает ту же долю ширины, что на высоком экране (за 1 взят iPhone 390×844)
      var zHero = (W / H < .62 ? .48 * Math.max(.9, Math.min(1.4, (W / H) / .462)) : W / H < .8 ? .58 : .64 * Math.max(.72, Math.min(1, (H - 300) / 560))) * 1.15, zCirc = .6 * circ.Z * tanF / (.212 * H);
      camera.zoom = (zHero + (zCirc - zHero) * k) * (1 + (rot.z - 1) * k);
      camera.setViewOffset(W, H, -(circ.cx - W / 2), (W / H < .8 ? .14 : .15) * H * (1 - k) - (circ.cy - H / 2), W, H);   // на первом экране челюсть чуть выше: снизу название
    }

    // ----- Кадр -----
    var wasCirc = false;
    var clock = new THREE.Clock(), prev = 0, pS = null, q = V(0, 0, 0), NP = PATH_R.length;
    window.addEventListener("site:jump", function () { pS = null; });
    function placeTool(tool, at, dir, vis) {
      tool.visible = vis > .001;
      if (!tool.visible) return;
      tool.position.copy(at); tool.lookAt(q.copy(at).add(dir)); tool.scale.setScalar(ease(vis));
    }
    // Пока страницу не трогают (нет прокрутки, мыши, касаний), рисуем каждый второй кадр: челюсть плывёт плавно, а видеокарта и батарея отдыхают
    var lastAct = performance.now(), skipFrame = false;
    ["scroll", "pointermove", "pointerdown", "touchstart", "wheel", "keydown", "site:jump", "resize"].forEach(function (n) { window.addEventListener(n, function () { lastAct = performance.now(); }, { passive: true }); });
    function frame(now) {
      if ((now || performance.now()) - lastAct > 2500 && !rot.drag && (skipFrame = !skipFrame)) return;
      var t = clock.getElapsedTime(), dt = Math.max(.001, Math.min(.05, ((now || 0) - prev) / 1000)); prev = now || 0;
      var kk = smoother(window.scrollY / (H * .85));
      circ.dt = dt;
      circleAt(kk);
      var isCirc = kk > .5;
      if (isCirc !== wasCirc) { wasCirc = isCirc; document.body.classList.toggle("circ", isCirc); }
      var target = filmP();
      pS = pS === null ? target : pS + (target - pS) * (1 - Math.exp(-dt * 7));
      var P = pS;

      // Появление при загрузке — единственное движение без прокрутки
      var enter = ease(t / 1.6);
      mouth.scale.setScalar(.94 + .06 * enter);
      mouth.updateMatrixWorld();
      azShift = 22 * ease(circ.m);
      spinStep(dt);
      placeCamera(P);

      // 1. Скейлер: сначала одна сторона, потом другая; налёт исчезает за кончиком
      var spR = P < .125 ? -1 : seg(P, .125, .26) * (NP - 1), spL = P < .345 ? -1 : seg(P, .345, .48) * (NP - 1);
      var vR = Math.min(seg(P, .11, .125), 1 - seg(P, .26, .27)), vL = Math.min(seg(P, .33, .345), 1 - seg(P, .48, .49));
      var sideB = P > .3, SP = sideB ? PATH_L : PATH_R, sp = Math.max(0, sideB ? spL : spR), vS = sideB ? vL : vR;
      var si = Math.min(Math.floor(sp), NP - 2), sf = sp - si, a = SP[si], b = SP[si + 1];
      var at = onTooth(a, .18, .02).lerp(onTooth(b, .18, .02), ease(sf));
      var dirS = worldOut(a).lerp(worldOut(b), sf).multiplyScalar(.8).add(V(0, (a.gs + (b.gs - a.gs) * sf) * 1.3, .5));
      at.addScaledVector(worldOut(a), Math.sin(Math.PI * sf) * .15);
      placeTool(scaler, at, dirS, vS);
      var bulk = seg(P, .48, .5);
      var cleanOf = function (tt, tartar) {
        if (tartar) return bulk;
        var kR = PATH_R.indexOf(tt), kL = PATH_L.indexOf(tt);
        if (kR >= 0) return clamp((spR - kR + .2) / .5);
        if (kL >= 0) return clamp((spL - kL + .2) / .5);
        return bulk;
      };
      var keyStr = Math.round(spR * 20) + "|" + Math.round(spL * 20) + "|" + Math.round(bulk * 20);
      if (keyStr !== lastPlaqueKey) {
        lastPlaqueKey = keyStr;
        plaqueItems.forEach(function (it, k) {
          var r = 1 - cleanOf(it.t, it.tartar), s = it.s;
          tmpS.makeScale(Math.max(.0001, s.x * r), Math.max(.0001, s.y * r), Math.max(.0001, s.z * r));
          it.t.mesh.updateMatrix();
          plaque.setMatrixAt(k, tmpM.multiplyMatrices(it.t.mesh.matrix, it.local).multiply(tmpS));
        });
        plaque.instanceMatrix.needsUpdate = true;
      }
      plaque.visible = bulk < 1;
      // Брызги воды из кончика
      var live = 0;
      if (vS > .5) for (var e = 0; e < 2; e++) {
        var dd = dropData[(Math.floor(t * 60) * 2 + e) % dropData.length];
        if (dd.life > .45) { dd.life = 0; dd.p.copy(at); dd.v.copy(dirS).normalize().multiplyScalar(.02).add(V((Math.random() - .5) * .03, .02 + Math.random() * .02, (Math.random() - .5) * .03)); }
      }
      dropData.forEach(function (d, i) {
        d.life += dt; d.p.add(d.v); d.v.y -= .0015;
        var s = d.life < .45 ? .022 * (1 - d.life / .45) : 0;
        if (s > 0) live++;
        dummy.position.copy(d.p); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(Math.max(s, .0001)); dummy.updateMatrix(); drops.setMatrixAt(i, dummy.matrix);
      });
      drops.instanceMatrix.needsUpdate = live > 0; drops.visible = live > 0;
      gumMat.color.copy(GUM_SORE).lerp(GUM_OK, seg(P, .125, .5));

      // 2. Ершик между передними зубами
      var vB = Math.min(seg(P, .545, .555), 1 - seg(P, .6, .61));
      if (GAPS.length) {
        var bp = seg(P, .55, .605) * GAPS.length, bi = Math.min(Math.floor(bp), GAPS.length - 1), bf = Math.min(1, bp - bi);
        var g1 = GAPS[bi][0], g2 = GAPS[bi][1];
        var gapPt = onTooth(g1, .45, -.12).lerp(onTooth(g2, .45, -.12), .5), gOut = worldOut(g1).lerp(worldOut(g2), .5).normalize();
        var depth = bf < .25 ? 1.3 - ease(bf / .25) * 1.1 : bf > .78 ? .2 + ease((bf - .78) / .22) * 1.1 : .2 - .4 * (.5 - .5 * Math.cos((bf - .25) / .53 * Math.PI * 4));
        placeTool(brush, gapPt.clone().addScaledVector(gOut, depth), gOut.clone().add(V(.25, .3, 0)), vB);
        if (brush.visible) brush.rotateZ(t * 6);
      } else brush.visible = false;

      // 3. Полировка: чашечка крутится по передним зубам
      var pp = seg(P, .615, .67) * (POLISH.length - 1), pi = Math.min(Math.floor(pp), POLISH.length - 2), pf = pp - pi;
      var pa = POLISH[pi], pb = POLISH[pi + 1];
      var pAt = onTooth(pa, .5, .02).lerp(onTooth(pb, .5, .02), ease(pf)).addScaledVector(worldOut(pa), Math.sin(Math.PI * pf) * .12);
      var vP = Math.min(seg(P, .61, .62), 1 - seg(P, .67, .68));
      placeTool(polisher, pAt, worldOut(pa).lerp(worldOut(pb), pf).add(V(0, .55 * pa.gs, 0)), vP);
      cup.rotation.z = t * 30;

      // 4. Отбеливание: капа с гелем, лампа, зубы белеют
      var trayK = ease(seg(P, .72, .745)) * (1 - ease(seg(P, .79, .81)));
      gelMat.opacity = .5 * trayK;
      trays.forEach(function (m) { m.visible = trayK > .01; m.position.z = (1 - trayK) * 1.4; });
      var lampK = Math.min(seg(P, .74, .76), 1 - seg(P, .79, .805));
      lamp.visible = lampK > .01;
      if (lamp.visible) { lamp.position.set(0, 0, F + 2.4 + (1 - ease(lampK)) * 3); lamp.lookAt(0, 0, F - 5); }
      var on = P > .76 && P < .79 ? 1 : 0;
      glowMat.opacity = .5 * lampK * (on ? .85 : .3);
      lampLight.position.copy(lamp.position); lampLight.intensity = 2.5 * lampK * on;
      teethMat.color.copy(DIRTY).lerp(CLEAN, seg(P, .76, .79));

      // 5. Элайнер опускается на нижние зубы, они выравниваются, элайнер снимается
      var aIn = ease(seg(P, .85, .875)), aOut = ease(seg(P, .92, .945)), seat = aIn * (1 - aOut);
      alignMat.opacity = .42 * seat; aligner.visible = seat > .01;
      aligner.position.set(0, (1 - aIn) * 1.9 + aOut * 1.9, (1 - aIn) * 1.2 + aOut * 1.2);
      aligner.rotation.x = -(1 - aIn) * .25 - aOut * .25;
      var straight = ease(seg(P, .875, .92));
      teeth.forEach(function (tt) {
        if (!tt.crook) return;
        var k = 1 - straight;
        tt.mesh.rotation.set(0, tt.crook[0] * k, tt.crook[1] * k);
      });

      // Блики: за полировкой и в финале
      glints.forEach(function (m, i) {
        var tt = m.userData.t, st = .615 + (Math.min(i, 5) / 12) * .055;
        var after = Math.sin(Math.PI * seg(P, st, st + .05)), fin = seg(P, .96, 1) * Math.pow(Math.max(0, Math.sin(t * 1.2 + m.userData.ph)), 6);
        var k = Math.max(i < 6 ? after : 0, fin);
        m.visible = k > .01;
        if (!m.visible) return;
        m.position.copy(onTooth(tt, .65, .05)); m.lookAt(camera.position); m.scale.setScalar(.12 * k);
      });

      // Слайдер прячем и тогда, когда круга уже нет (прыжок по меню из этого раздела на телефоне), иначе он оставался поверх текста
      var showCmp = circ.m > .9 && circ.r > 1;
      if (showCmp !== cmpOn) {
        cmpOn = showCmp;
        cmpEl.style.visibility = showCmp ? "visible" : "hidden";
        cmpEl.style.opacity = showCmp ? 1 : 0;
        cmpEl.tabIndex = showCmp ? 0 : -1;
      }
      if (circ.r > 1) {   // круг спрятан: рисовать нечего
        var pad = circ.r + 3, left = circ.cx - pad, low = H - circ.cy - pad;
        renderer.setScissorTest(true);
        if (circ.m > .01) {
          // Пока не трогали, ползунок сам покачивается: видно, что его можно тянуть
          if (!cmpTouched) cmpGoal = .5 + .2 * Math.sin(t * 1.1);
          cmpS += (cmpGoal - cmpS) * (1 - Math.exp(-dt * 14));
          var cut = circ.cx - circ.r + circ.r * 2 * cmpS, size = (circ.r * 2).toFixed(1) + "px";
          cmpEl.style.width = cmpEl.style.height = size;
          cmpEl.style.transform = "translate3d(" + (circ.cx - circ.r).toFixed(1) + "px," + (circ.cy - circ.r).toFixed(1) + "px,0)";
          cmpEl.style.setProperty("--s", (cmpS * 100).toFixed(2) + "%");
          // Справа «стало": обычная картинка
          renderer.setScissor(cut, low, left + pad * 2 - cut, pad * 2);
          renderer.render(scene, camera);
          // Слева «было»: те же зубы в начальном состоянии
          teethMat.color.copy(DIRTY); gumMat.color.copy(GUM_SORE);
          teeth.forEach(function (tt) { if (tt.crook) tt.mesh.rotation.set(0, tt.crook[0], tt.crook[1]); });
          glints.forEach(function (m) { m.visible = false; });
          plaque.visible = false; plaqueFull.visible = true;
          renderer.setScissor(left, low, cut - left, pad * 2);
          renderer.render(scene, camera);
          plaqueFull.visible = false;
        } else {
          renderer.setScissor(left, low, pad * 2, pad * 2);   // видеокарта считает только круг
          renderer.render(scene, camera);
        }
      }
    }
    // Начальное состояние кривых зубов
    teeth.forEach(function (tt) { if (tt.crook) tt.mesh.rotation.set(0, tt.crook[0], tt.crook[1]); });
    // Налёт для половины «было»: неподвижная копия, считается один раз
    var plaqueFull = new THREE.InstancedMesh(plaque.geometry, plaque.material, plaqueItems.length);
    plaqueItems.forEach(function (it, k) {
      it.t.mesh.updateMatrix();
      tmpS.makeScale(it.s.x, it.s.y, it.s.z);
      plaqueFull.setMatrixAt(k, tmpM.multiplyMatrices(it.t.mesh.matrix, it.local).multiply(tmpS));
    });
    plaqueFull.frustumCulled = false; plaqueFull.visible = false; mouth.add(plaqueFull);

    // Ползунок «было / стало»
    var cmpEl = document.querySelector(".cmp"), cmpS = .5, cmpGoal = .5, cmpTouched = false, cmpOn = false;
    function cmpSet(v) { cmpGoal = Math.max(.06, Math.min(.94, v)); var pc = Math.round(cmpGoal * 100); cmpEl.setAttribute("aria-valuenow", pc); cmpEl.setAttribute("aria-valuetext", "Было: " + pc + "%, стало: " + (100 - pc) + "%"); }
    function cmpFrom(e) { var r = cmpEl.getBoundingClientRect(); cmpSet((e.clientX - r.left) / r.width); }
    cmpEl.addEventListener("pointerdown", function (e) {
      cmpTouched = true; cmpEl.classList.add("drag"); cmpFrom(e);
      if (cmpEl.setPointerCapture) cmpEl.setPointerCapture(e.pointerId);
    });
    cmpEl.addEventListener("pointermove", function (e) { if (cmpEl.classList.contains("drag")) cmpFrom(e); });
    ["pointerup", "pointercancel"].forEach(function (n) { cmpEl.addEventListener(n, function () { cmpEl.classList.remove("drag"); }); });
    cmpEl.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault(); cmpTouched = true; cmpSet(cmpGoal + (e.key === "ArrowRight" ? .05 : -.05));
    });

    // Прогрев под экраном загрузки: всё скрытое рисуем один раз, иначе браузер споткнётся,
    // когда инструмент впервые появится на экране
    var seen = [];
    scene.traverse(function (o) { seen.push([o, o.visible]); o.visible = true; });
    renderer.compile(scene, camera);
    renderer.setScissorTest(true); renderer.setScissor(0, 0, 1, 1);
    renderer.render(scene, camera);
    seen.forEach(function (s) { s[0].visible = s[1]; });

    frame(performance.now());
    window.siteLoop.push(frame);
    document.body.classList.add("ready");
    window.siteReady();
  }
})();

/* Белые шарики за страницей. Рисуются один раз заранее, дальше картинки только сдвигаются */
(function () {
  var world = document.querySelector(".world"), W = innerWidth, H = innerHeight, items = [];
  var dpr = Math.min(Math.max(devicePixelRatio || 1, 1.5), 2), mob = W <= 760;
  var seed = 7; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  function sheet(s) { var c = document.createElement("canvas"); c.width = c.height = Math.ceil(s * dpr); c.style.width = c.style.height = s + "px"; var x = c.getContext("2d"); x.scale(dpr, dpr); return { c: c, x: x }; }
  function stops(g, list) { list.forEach(function (k) { g.addColorStop(k[0], k[1]); }); return g; }
  function blotch(x, cx, cy, r, rgb, a) { x.fillStyle = stops(x.createRadialGradient(cx, cy, 0, cx, cy, r), [[0, "rgba(" + rgb + "," + a + ")"], [1, "rgba(" + rgb + ",0)"]]); x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }
  // Белый шарик: объём дают только нейтральная серая тень по краю и блик
  function ball(d, blur) {
    var pad = blur * 3 + d * .2, T = d + pad * 2, s = sheet(T), x = s.x, c = T / 2, r = d / 2, out;
    x.save(); x.translate(c + r * .06, c + r * .2); blotch(x, 0, 0, r * 1.2, "96,100,108", .13); x.restore();
    x.fillStyle = "#fff"; x.beginPath(); x.arc(c, c, r, 0, 7); x.fill();
    x.save(); x.beginPath(); x.arc(c, c, r, 0, 7); x.clip();
    x.fillStyle = stops(x.createRadialGradient(c - r * .28, c - r * .32, r * .5, c - r * .1, c - r * .1, r * 1.16), [[0, "rgba(120,125,135,0)"], [.7, "rgba(120,125,135,.12)"], [1, "rgba(120,125,135,.34)"]]);
    x.fillRect(0, 0, T, T);
    x.fillStyle = stops(x.createRadialGradient(c - r * .1, c - r * .1, r * .9, c - r * .1, c - r * .1, r * 1.12), [[0, "rgba(255,255,255,0)"], [1, "rgba(255,255,255,.6)"]]);
    x.fillRect(0, 0, T, T);
    x.restore();
    if (!blur) return s.c;
    out = sheet(T); out.x.filter = "blur(" + blur + "px)"; out.x.drawImage(s.c, 0, 0, T, T);
    return out.c;
  }
  function build() {
    world.textContent = ""; items = []; seed = 7;
    // [диаметр, размытие, глубина, сколько]; крупные держатся у краёв, чтобы не лезть за текст
    var set = mob ? [[140, 4, .62, 1], [60, 3, .34, 2], [26, 1.5, .18, 2]] : [[260, 6, .7, 2], [120, 4, .42, 2], [56, 2.5, .26, 3]];
    set.forEach(function (k, n) {
      for (var i = 0; i < k[3]; i++) {
        var d = k[0] * (.85 + rnd() * .3), c = ball(d, k[1]), size = c.width / dpr, span = H + size + 40, side = i % 2 ? 1 : 0;
        var x = n < 2 ? (side ? W * (.84 + rnd() * .14) : W * (-.06 + rnd() * .14)) - size / 2 : rnd() * W - size / 2;
        world.appendChild(c);
        items.push({ el: c, x: x, y: (i + rnd() * .7) / k[3] * span, s: k[2], span: span, size: size, v: 2 + k[2] * 7 + rnd() * 2, amp: 5 + size * .03, fq: .22 + rnd() * .22, ph: rnd() * 6.28, px: 0, py: 0, vx: 0, vy: 0, r: d / 2 });
      }
    });
  }
  var sm = scrollY, last = 0, clock = 0, mx = -9999, my = -9999, mvx = 0, mvy = 0, pmx = 0, pmy = 0, pmt = 0;
  // При включённом «уменьшении движения» шарики не замирают совсем, а плывут вдвое медленнее
  var drift = matchMedia("(prefers-reduced-motion: reduce)").matches ? .5 : 1;
  function tick(now) {
    var dt = Math.min(.05, (now - last) / 1000 || 0); last = now;
    clock += dt * drift;
    mvx *= Math.exp(-dt * 7); mvy *= Math.exp(-dt * 7);   // скорость курсора затухает, когда он остановился
    sm += (scrollY - sm) * (1 - Math.exp(-dt * 4.5));          // шарики упруго догоняют прокрутку
    // На телефоне внизу страницы шариков нет: на белом фоне они выдают края панелей Safari
    var left = document.documentElement.scrollHeight - innerHeight - scrollY;
    world.style.opacity = window.siteLayout() === "wide" ? 1 : Math.max(0, Math.min(1, (left - 40) / 460)).toFixed(3);
    for (var i = 0; i < items.length; i++) {
      var it = items[i], y = (it.y - sm * it.s - clock * it.v) % it.span; if (y < 0) y += it.span; y -= it.size + 20;
      var x = it.x + Math.sin(clock * it.fq + it.ph) * it.amp;
      // Шарик как лёгкий мячик на пружинке: курсор толкает его и увлекает за собой, он отлетает и мягко возвращается
      var dx = x + it.px + it.size / 2 - mx, dy = y + it.py + it.size / 2 - my, hit = it.r + 40, dist = Math.hypot(dx, dy) || 1;
      var mass = Math.max(1, Math.min(3.2, it.r / 45)), ax = -it.px * 9 - it.vx * 2.6, ay = -it.py * 9 - it.vy * 2.6, near = 0;
      if (dist < hit) {
        near = 1 - dist / hit;
        var push = 3600 * near * near / mass;
        ax += dx / dist * push + (mvx - it.vx) * near * 11 / mass;   // отталкивание и увлечение движением курсора
        ay += dy / dist * push + (mvy - it.vy) * near * 11 / mass;
      }
      it.vx += ax * dt; it.vy += ay * dt;
      it.px += it.vx * dt; it.py += it.vy * dt;
      var lim = it.size * 1.3; it.px = Math.max(-lim, Math.min(lim, it.px)); it.py = Math.max(-lim, Math.min(lim, it.py));
      it.el.style.transform = "translate3d(" + (x + it.px).toFixed(1) + "px," + (y + it.py).toFixed(1) + "px,0) scale(" + (1 + near * .07).toFixed(3) + ")";
    }
  }
  addEventListener("site:jump", function () { sm = scrollY; });
  addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse") return;
    var t = performance.now(), d = Math.max(8, t - pmt);   // скорость курсора в пикселях за секунду
    if (pmt) { mvx = Math.max(-2500, Math.min(2500, (e.clientX - pmx) / d * 1000)); mvy = Math.max(-2500, Math.min(2500, (e.clientY - pmy) / d * 1000)); }
    pmx = mx = e.clientX; pmy = my = e.clientY; pmt = t;
  }, { passive: true });
  document.addEventListener("pointerleave", function () { mx = my = -9999; pmt = 0; });
  addEventListener("resize", function () { if (innerWidth === W) return; W = innerWidth; H = innerHeight; mob = W <= 760; build(); });
  build();
  window.siteLoop.push(tick);
})();
