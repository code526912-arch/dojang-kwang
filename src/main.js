(function () {
  'use strict';
  // 화면 크기: PC·가로 화면은 1920×1080, 휴대폰 세로 화면은 1080×1920 배치를 쓴다(5일차만 가로 전용)
  var W = 1920, H = 1080, PORT = false;
  var Q = new URLSearchParams(location.search);
  var CAPTURE = Q.get('capture') === '1';
  var KIOSK = Q.get('kiosk') === '1';
  var TOUCH = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  function isPortrait() { return window.innerHeight > window.innerWidth * 1.05; }
  var FONT = 'Pretendard, "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';
  var C = {
    navy: 0x1f3a5f, navyS: '#1f3a5f', green: 0x2e9e5b, greenS: '#2e9e5b', greenD: 0x24804a,
    red: 0xd94a3a, redS: '#d94a3a', redD: 0xb93a2c, yellow: 0xffc93c, paper: 0xffffff,
    kraft: 0xf3e3c3, kraftD: 0xb98a4e, ink: '#26323f', gray: '#5f6875', cream: 0xf6f1e7, blue: 0x3b82c4,
    orange: 0xf08a24, steel: 0x4b5b70, steelH: 0x5f7189, brown: 0x9c6b35, brownH: 0xb07b40
  };
  // 움직임 줄이기 설정이면 화면 흔들림과 색종이를 끈다
  var REDUCED = !CAPTURE && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 글자 크게(접근성): 30px 이하 글자를 12% 키운다. 설정은 이 브라우저에 저장되고, 저장된 설정이 없으면 작은 화면에서 켠다.
  var BIG = Q.get('big') === '1' || (function () {
    try { var v = localStorage.getItem('pps_big'); if (v !== null) return v === '1'; } catch (e) {}
    return !CAPTURE && Math.min(screen.width, screen.height) < 500;
  })();
  document.body.classList.toggle('big', BIG);
  // 세로 화면은 화면이 좁아 작은 글자를 25% 더 키운다
  function fz(n) { var k = (PORT && n <= 30 ? 1.25 : 1) * (BIG && n <= 30 ? 1.12 : 1); return Math.round(n * k); }
  var D = window.DATA;
  var G = { correct: 0, total: 0, streak: 0, best: 0, tests: 0, audits: [], mode: 'normal', run: null, cases: 0, seed: 7, ending: null };
  var COUNTRIES = ['중국', '베트남', '인도네시아', '태국'];

  // ---------- 무작위 사례 생성(시드를 주면 같은 판이 나온다) ----------
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(r, arr) {
    for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    return arr;
  }
  var DAY_MS = 86400000;
  function fmtD(t) { var d = new Date(t); return d.getUTCFullYear() + '. ' + (d.getUTCMonth() + 1) + '. ' + d.getUTCDate() + '.'; }
  // 직접생산 확인증명서 유효기간은 발급일부터 2년. 만료본은 계약일(2026. 9. 1.) 전에 끝난다.
  function certRange(r, expired, subtle) {
    var start;
    if (expired) start = subtle ? Date.UTC(2024, 8, 1) : Date.UTC(2023, 5, 1) + Math.floor(r() * 450) * DAY_MS;
    else start = Date.UTC(2024, 9, 1) + Math.floor(r() * 640) * DAY_MS;
    var s = new Date(start);
    return fmtD(start) + ' ~ ' + fmtD(Date.UTC(s.getUTCFullYear() + 2, s.getUTCMonth(), s.getUTCDate()) - DAY_MS);
  }
  var PLACE = { doc: '납품 확인서', plate: '명판', cert: '증명서', both: '납품 확인서·명판' };
  var PLATE_KEYS = ['제품명', '제조사', '원산지', '제조 연월', '인증 표시'], CERT_KEYS = ['업체명', '제품명', '유효기간'];
  function markText(kc, green) { return kc && green ? 'KC 인증 · 최소녹색기준 제품' : kc ? 'KC 인증' : green ? '최소녹색기준 제품' : '표시 없음'; }
  function makeCase(r, row, faults, day) {
    var it = { art: row[0], name: row[1], spec: row[2], alt: row[3], near: row[4], featL: row[5], featV: row[6], featAlt: row[7], unit: row[8], qty: row[9], maker: row[10], makerAlt: row[11], need: row[12] || '' };
    var kc = it.need.indexOf('K') >= 0, gr = it.need.indexOf('G') >= 0;
    var con = { '품명': it.name, '규격': it.spec, feat: it.featV, '수량': it.qty + it.unit, '원산지': '대한민국', '제조사': it.maker };
    var doc = {}; for (var k in con) doc[k] = con[k];
    var plate = { '제품명': it.name, '제조사': it.maker, '원산지': '대한민국', '제조 연월': '2026. ' + (7 + Math.floor(r() * 4)) + '.', '인증 표시': kc || gr ? markText(kc, gr) : '해당 없음' };
    var cond = '계약 조건 · ' + (kc || gr ? [kc ? 'KC 인증 표시' : '', gr ? '최소녹색기준 제품' : ''].filter(Boolean).join(' · ') : '인증 표시 조건 없음');
    var no = '나라장터 계약 제2026-' + String(100 + Math.floor(r() * 900)) + '호';
    var cert = { '업체명': it.maker, '제품명': it.name, '유효기간': certRange(r, false) };
    var near = day.kind === 'near', list = [];
    faults.forEach(function (f) {
      var o = { type: f, lesson: D.faults[f].lesson, audit: D.faults[f].audit };
      if (f === 'spec') { doc['규격'] = near ? it.near : it.alt; o.accept = ['doc:규격']; o.where = PLACE.doc; o.label = '규격'; o.a = it.spec; o.b = doc['규격']; }
      if (f === 'feat') { doc.feat = it.featAlt; o.accept = ['doc:feat']; o.where = PLACE.doc; o.label = it.featL; o.a = it.featV; o.b = it.featAlt; }
      if (f === 'qty') {
        var d = Math.min(it.qty - 1, near ? 1 + Math.floor(r() * 2) : 2 + Math.floor(r() * 4));
        doc['수량'] = (it.qty - d) + it.unit; o.accept = ['doc:수량']; o.where = PLACE.doc; o.label = '수량'; o.a = con['수량']; o.b = doc['수량'];
      }
      // 원산지는 나라 이름으로 적는다(게임 속 가상 사례)
      var land = COUNTRIES[it.name.length % COUNTRIES.length];
      if (f === 'origin_doc') { doc['원산지'] = land; plate['원산지'] = land; o.accept = ['doc:원산지', 'plate:원산지']; o.where = PLACE.both; o.label = '원산지'; o.a = '대한민국'; o.b = land; }
      if (f === 'origin_plate') { plate['원산지'] = land; o.accept = ['plate:원산지']; o.where = PLACE.plate; o.label = '원산지'; o.a = '대한민국'; o.b = land; }
      if (f === 'maker_doc') { doc['제조사'] = it.makerAlt; plate['제조사'] = it.makerAlt; o.accept = ['doc:제조사', 'plate:제조사']; o.where = PLACE.both; o.label = '제조사'; o.a = it.maker; o.b = it.makerAlt; }
      if (f === 'maker_plate') { plate['제조사'] = it.makerAlt; o.accept = ['plate:제조사']; o.where = PLACE.plate; o.label = '제조사'; o.a = it.maker; o.b = it.makerAlt; }
      if (f === 'cert_date') { cert['유효기간'] = certRange(r, true, near || r() < 0.4); o.accept = ['cert:유효기간']; o.where = PLACE.cert; o.label = '유효기간'; o.a = '계약일 ' + D.contractDate; o.b = cert['유효기간']; }
      if (f === 'cert_item') {
        var others = D.items.filter(function (x) { return x[1] !== it.name; });
        cert['제품명'] = others[Math.floor(r() * others.length)][1]; o.accept = ['cert:제품명']; o.where = PLACE.cert; o.label = '제품명'; o.a = it.name; o.b = cert['제품명'];
      }
      if (f === 'kc' || f === 'green') {
        o.a = plate['인증 표시']; plate['인증 표시'] = f === 'kc' ? markText(false, gr) : markText(kc, false); o.b = plate['인증 표시'];
        o.accept = ['plate:인증 표시']; o.where = PLACE.plate; o.label = '인증 표시';
      }
      list.push(o);
    });
    return { it: it, con: con, doc: doc, plate: plate, cert: cert, cond: cond, no: no, faults: list };
  }
  // KC·최소녹색기준 이상은 그 조건이 있는 물품에만 낸다
  function fits(row, pat) { var need = row[12] || ''; return pat.every(function (f) { return f === 'kc' ? need.indexOf('K') >= 0 : f === 'green' ? need.indexOf('G') >= 0 : true; }); }
  // 판의 날 설정: 3분 체험은 하루(D.quick), 캠페인은 1~4일차(D.days)
  function dayOf(i) { return G.mode === 'quick' ? D.quick : D.days[i]; }
  function newRun(seed, mode) {
    var r = rng(seed);
    G.correct = 0; G.total = 0; G.streak = 0; G.best = 0; G.tests = 0; G.audits = []; G.mode = mode || 'normal'; G.seed = seed; G.ending = null;
    var pool = shuffle(r, D.items.slice()), k = 0;
    G.run = (G.mode === 'quick' ? [D.quick] : D.days).map(function (day) {
      var n = day.n;
      var rest = shuffle(r, day.pool.slice()).slice(0, n - (day.teach ? 1 : 0));
      if (!rest.some(function (p) { return p.length === 0; })) rest[rest.length - 1] = [];
      if (!day.teach && !rest.some(function (p) { return p.length > 0; })) rest[0] = day.pool[0];
      // 새 기준(must)은 판마다 하나씩 꼭 나오게 한다
      (day.must || []).forEach(function (f) {
        if (rest.some(function (p) { return p.indexOf(f) >= 0; })) return;
        for (var j = 0; j < rest.length; j++) {
          if (rest[j].length && !rest[j].some(function (x) { return day.must.indexOf(x) >= 0; })) { rest[j] = [f]; return; }
        }
      });
      shuffle(r, rest);
      var pats = day.teach ? [day.teach].concat(rest) : rest;
      return pats.map(function (p) {
        for (var j = k; j < pool.length + k && !fits(pool[j % pool.length], p); j++);
        var a = k % pool.length, b = j % pool.length, t = pool[a]; pool[a] = pool[b]; pool[b] = t;
        return makeCase(r, pool[k++ % pool.length], p, day);
      });
    });
    G.cases = G.run.reduce(function (a, d) { return a + d.length; }, 0);
  }
  function randomSeed() { return Math.floor(Math.random() * 2147483647); }
  function comma(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function man(n) { return comma(n) + '만 원'; }

  // ---------- 공용 UI ----------
  function T(s, x, y, str, size, color, weight, extra) {
    var st = { fontFamily: FONT, fontSize: fz(size) + 'px', color: color || C.ink, fontStyle: String(weight || 700) };
    if (extra) for (var k in extra) st[k] = extra[k];
    return s.add.text(x, y, str, st);
  }
  // 숫자와 단위(839억 원, 2026. 9. 1.)가 줄바꿈으로 갈라지지 않게 붙인다
  function keepUnits(str) { return String(str).replace(/(\d[\d,.%]*(?:조|억|만|천)?) (?=\d|원|개|건|곳|회|초|일|년|대|본|명|상자|억|만)/g, '$1\u00a0'); }
  function wrapT(s, x, y, str, size, color, width, weight, align) {
    return T(s, x, y, keepUnits(str), size, color, weight || 600, { wordWrap: { width: width, useAdvancedWrap: true }, lineSpacing: Math.round(size * 0.35), align: align || 'left' });
  }
  // 한 줄 글이 칸보다 길면 칸 너비에 맞게 줄인다
  function fitW(t, maxW) { t.setScale(1); if (t.width > maxW) t.setScale(maxW / t.width); return t; }
  // 문장 끝 마침표를 한 번만 붙인다(날짜 ‘2026. 9. 1.’ 뒤에 또 붙지 않게)
  function dot(str) { str = String(str); return /[.!?]$/.test(str) ? str : str + '.'; }
  // 장면 전환: 가로·세로에 맞춰 게임 화면 크기를 정한다(5일차는 가로 전용)
  function fitSize(key) {
    var p = isPortrait() && key !== 'Pilot', w = p ? 1080 : 1920, h = p ? 1920 : 1080;
    PORT = p;
    if (w !== W || h !== H) { W = w; H = h; window.__game.scale.setGameSize(W, H); }
    var rot = document.getElementById('rotate');
    if (rot) rot.hidden = !(key === 'Pilot' && isPortrait());
  }
  function go(s, key, data) { fitSize(key); s.scene.start(key, data); }
  function reg(s, key, obj, fn) { s.targets = s.targets || {}; s.targets[key] = { obj: obj, fn: fn }; }
  function rrect(g, x, y, w, h, r, fill, alpha, stroke, sw) {
    if (fill !== null && fill !== undefined) { g.fillStyle(fill, alpha === undefined ? 1 : alpha); g.fillRoundedRect(x, y, w, h, r); }
    if (stroke !== undefined && stroke !== null) { g.lineStyle(sw || 4, stroke, 1); g.strokeRoundedRect(x, y, w, h, r); }
  }
  // 키보드: 한글 입력 상태에서도 같은 키로 동작하도록 물리 키(code)를 먼저 본다
  function keyOf(e) {
    var c = e.code || '';
    if (/^Digit[0-9]$/.test(c)) return c.slice(5);
    if (/^Numpad[0-9]$/.test(c)) return c.slice(6);
    if (/^Key[A-Z]$/.test(c)) return c.slice(3);
    if (c === 'NumpadEnter') return 'Enter';
    if (c === 'Space' || c === 'Enter' || c === 'Escape') return c;
    var k = e.key || '';
    if (k === ' ') return 'Space';
    if (k === 'Esc') return 'Escape';
    return k.length === 1 ? k.toUpperCase() : k;
  }
  function button(s, key, x, y, w, h, label, fill, hover, fn, size) {
    var c = s.add.container(x, y);
    var g = s.add.graphics();
    var r = Math.min(30, h / 2), hovered = false;
    // 눌림: 버튼 면이 내려가고 그림자가 짧아진다
    function draw(on, down) {
      var d = down ? 6 : 0;
      g.clear();
      rrect(g, -w / 2, -h / 2 + 8, w, h, r, 0x000000, 0.22);
      rrect(g, -w / 2, -h / 2 + d, w, h, r, on ? hover : fill, 1);
      rrect(g, -w / 2 + 6, -h / 2 + 6 + d, w - 12, h * 0.42, r - 6, 0xffffff, 0.14);
      t.y = -2 + d;
    }
    var t = T(s, 0, -2, label, size || 40, '#ffffff', 800).setOrigin(0.5);
    draw(false);
    c.add([g, t]); c.setSize(w, h); c.setInteractive({ useHandCursor: true });
    c.label = t;
    function press() {
      if (c.disabled || !c.active) return;
      draw(true, true);
      s.time.delayedCall(110, function () { if (c.active) draw(hovered, false); });
      Sfx.play('click');
      fn();
    }
    c.on('pointerover', function () { hovered = true; draw(true); });
    c.on('pointerout', function () { hovered = false; draw(false); });
    c.on('pointerdown', press);
    reg(s, key, c, press);
    return c;
  }
  function art(s, x, y, key, maxW, maxH, label) {
    if (s.textures.exists(key)) {
      var im = s.add.image(x, y, key);
      var k = Math.min(maxW / im.width, maxH / im.height);
      im.setScale(k); im.baseScale = k;
      return im;
    }
    var c = s.add.container(x, y);
    var g = s.add.graphics();
    rrect(g, -maxW / 2, -maxH / 2, maxW, maxH, 24, 0xdfe6ee, 1, 0x9aa8b8, 4);
    c.add([g, T(s, 0, 0, label || key, 30, C.gray, 700, { align: 'center', wordWrap: { width: maxW - 20 } }).setOrigin(0.5)]);
    c.baseScale = 1;
    return c;
  }
  // 세로 화면: 배경을 1.5배로 키워 검수대 윗면(가로 기준 y 505)이 baseY에 오게 두고, 그 아래는 바닥색으로 채운다
  function background(s, key, baseY) {
    if (s.textures.exists(key)) {
      if (PORT && baseY) {
        var k = 1.5, im2 = s.add.image(W / 2, baseY - 505 * k, key).setOrigin(0.5, 0).setScale(k);
        s.add.rectangle(W / 2, (im2.y + 1080 * k + H) / 2, W, H - (im2.y + 1080 * k) + 4, 0xe2cfb0);
        return im2;
      }
      var im = s.add.image(W / 2, H / 2, key);
      im.setScale(Math.max(W / im.width, H / im.height));
      return im;
    }
    var g = s.add.graphics();
    g.fillGradientStyle(0xf8f3ea, 0xf8f3ea, 0xe9dfcf, 0xe9dfcf, 1);
    g.fillRect(0, 0, W, H);
    return g;
  }
  function dim(s, alpha) {
    var r = s.add.rectangle(W / 2, H / 2, W, H, 0x101826, alpha === undefined ? 0.6 : alpha);
    r.setInteractive();
    return r;
  }
  function smallButton(s, key, x, y, w, label, fn) {
    var c = s.add.container(x, y);
    var g = s.add.graphics();
    rrect(g, -w / 2, -30, w, 60, 30, 0xffffff, 0.18);
    var t = T(s, 0, 0, label, 26, '#ffffff', 700).setOrigin(0.5);
    c.add([g, t]); c.setSize(w, 60); c.setInteractive({ useHandCursor: true });
    c.on('pointerdown', fn);
    reg(s, key, c, fn);
    c.label = t;
    return c;
  }
  // 위쪽 막대. 세로 화면은 두 줄(제목·버튼 / 부제·남은 시간)
  function hud(s, title, sub) {
    var g = s.add.graphics(), hh = PORT ? 180 : 110;
    g.fillStyle(C.navy, 0.96); g.fillRect(0, 0, W, hh);
    g.fillStyle(0x000000, 0.12); g.fillRect(0, hh, W, 6);
    var tt = T(s, PORT ? 36 : 50, 55, title, 46, '#ffffff', 900).setOrigin(0, 0.5);
    if (PORT) { fitW(tt, W - 440); fitW(T(s, 36, 143, sub, 26, '#c9d7ea', 600).setOrigin(0, 0.5), W - 420); }
    else T(s, 50 + tt.width + 28, 58, sub, 30, '#c9d7ea', 600).setOrigin(0, 0.5);
    smallButton(s, 'gloss', W - 275, 55, 210, PORT ? '용어 풀이' : '용어 풀이 (H)', function () { openInfo(s, 'glossary'); });
    var mute = smallButton(s, 'mute', W - 85, 55, 140, '', function () { Sfx.toggle(); upd(); });
    function upd() { mute.label.setText(Sfx.isMuted() ? '소리 끔' : '소리 켬'); }
    upd();
    s.input.keyboard.on('keydown', function (e) {
      var k = keyOf(e);
      if (k === 'M') { Sfx.toggle(); upd(); }
      if (k === 'H') openInfo(s, 'glossary');
    });
  }
  function termChip(s, x, y, term) {
    var c = s.add.container(x, y);
    var g = s.add.graphics();
    g.fillStyle(0xffffff, 1); g.fillCircle(0, 0, 22); g.lineStyle(3, 0xc9d3df, 1); g.strokeCircle(0, 0, 22);
    c.add([g, T(s, 0, 0, '?', 28, C.navyS, 900).setOrigin(0.5)]);
    c.setSize(48, 48); c.setInteractive({ useHandCursor: true });
    var fn = function () { openInfo(s, 'term', term); };
    c.on('pointerdown', fn);
    reg(s, 'term_' + term, c, fn);
    return c;
  }
  // 조달청 공식 캐릭터(나르미·달이): 배포된 원본을 자르고 크기만 바꿔 쓴다. 표정을 그리지 않고 몸짓과 기호로 반응한다.
  function mascot(s, key, x, y, h) {
    var o = art(s, x, y, key, h * 2, h, key === 'narmi' ? '나르미' : '달이');
    o.setDepth(20); o.homeY = y;
    return o;
  }
  function react(s, o, mood) {
    if (!o) return;
    s.tweens.killTweensOf(o); o.y = o.homeY; o.angle = 0;
    if (mood === 'happy') s.tweens.add({ targets: o, y: o.homeY - 24, duration: 150, yoyo: true, repeat: 1, ease: 'Quad.easeOut' });
    else if (mood === 'oops') s.tweens.add({ targets: o, angle: { from: -6, to: 6 }, duration: 90, yoyo: true, repeat: 2, onComplete: function () { o.angle = 0; } });
    else s.tweens.add({ targets: o, y: o.homeY - 12, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
    if (mood !== 'happy' && mood !== 'oops') return;
    var b = o.getBounds(), ok = mood === 'happy';
    var c = s.add.container(b.right - 24, b.top + 30).setDepth(21);
    var g = s.add.graphics(); g.fillStyle(ok ? C.green : C.red, 1); g.fillCircle(0, 0, 30); g.lineStyle(4, 0xffffff, 1); g.strokeCircle(0, 0, 30);
    c.add([g, T(s, 0, 0, ok ? '✓' : '!', 38, '#ffffff', 900).setOrigin(0.5)]);
    c.setScale(0.3);
    s.tweens.add({ targets: c, scale: 1, duration: 180, ease: 'Back.easeOut' });
    s.tweens.add({ targets: c, alpha: 0, delay: 1100, duration: 300, onComplete: function () { c.destroy(); } });
  }
  function nameTag(s, x, y, str) {
    return T(s, x, y, str, 22, '#ffffff', 800, { backgroundColor: 'rgba(31,58,95,0.9)', padding: { x: 14, y: 5 } }).setOrigin(0.5).setDepth(21);
  }
  function logoBadge(s, x, y, w) {
    var h = Math.round(w * 0.34);
    var g = s.add.graphics(); rrect(g, x, y + 5, w, h, 22, 0x000000, 0.12); rrect(g, x, y, w, h, 22, 0xffffff, 1);
    var im = art(s, x + w / 2, y + h / 2, 'logo_pps', w - 40, h - 20, '조달청');
    return [g, im];
  }
  // QR 코드(서버 없이 브라우저에서 만든다): 어두운 칸 목록
  function qrMatrix(text) {
    var q = qrcode(0, 'M'); q.addData(text); q.make();
    var n = q.getModuleCount(), m = [];
    for (var r = 0; r < n; r++) { m.push([]); for (var c = 0; c < n; c++) m[r].push(q.isDark(r, c)); }
    return m;
  }
  function drawQR(fill, m, x, y, size) {
    var cell = Math.floor(size / (m.length + 4)), off = Math.floor((size - cell * m.length) / 2);
    fill(x, y, size, size, '#ffffff');
    m.forEach(function (row, r) { row.forEach(function (d, c) { if (d) fill(x + off + c * cell, y + off + r * cell, cell, cell, '#111111'); }); });
  }
  // 결과 카드(1080×1350 이미지): 등급·기록·결말·공공조달 통계·공식 캐릭터·QR
  function shareCard(s, rank) {
    var S = D.stats, cv = document.createElement('canvas');
    cv.width = 1080; cv.height = 1350;
    var x = cv.getContext('2d');
    function img(key, X, Y, h) {
      if (!s.textures.exists(key)) return;
      var im = s.textures.get(key).getSourceImage(), w = im.width * h / im.height;
      x.drawImage(im, X, Y, w, h);
    }
    function txt(str, X, Y, size, color, weight, maxW) {
      x.font = (weight || 800) + ' ' + size + 'px ' + FONT; x.fillStyle = color; x.textAlign = 'center'; x.textBaseline = 'middle';
      if (maxW) x.fillText(str, X, Y, maxW); else x.fillText(str, X, Y);
    }
    function box(X, Y, w, h, color) { x.fillStyle = color; x.fillRect(X, Y, w, h); }
    box(0, 0, 1080, 1350, '#fdf8ef');
    box(0, 0, 1080, 130, '#ffffff');
    img('logo_pps', 36, 20, 90);
    txt('공공조달 교육 게임', 900, 66, 30, '#5f6875', 700);
    box(0, 130, 1080, 190, '#1f3a5f');
    txt(D.title, 540, 225, 76, '#ffffff', 900);
    txt('나의 검사관 등급', 540, 385, 34, '#5f6875', 700);
    txt(rank, 540, 470, 104, '#d94a3a', 900);
    txt('정확한 검사 기록 ' + G.correct + ' / ' + G.cases + '건 · 감사 지적 ' + G.audits.length + '건', 540, 565, 36, '#26323f', 800);
    if (G.ending) txt('5일차 결말 「' + G.ending + '」', 540, 618, 34, '#1f3a5f', 800);
    else if (G.mode === 'quick') txt('3분 체험 · 하루 검사 결과', 540, 618, 34, '#1f3a5f', 800);
    box(70, 670, 940, 250, '#ffffff');
    txt(S.label, 540, 718, 30, '#5f6875', 700);
    txt(S.big, 540, 800, 86, '#1f3a5f', 900);
    txt(srcShort(S.src), 540, 880, 22, '#5f6875', 600);
    img('narmi', 40, 960, 360);
    img('dali', 330, 1120, 200);
    drawQR(function (X, Y, w, h, c) { box(X, Y, w, h, c); }, qrMatrix(D.share.url), 790, 970, 240);
    txt(D.share.cta, 910, 1250, 24, '#26323f', 800, 330);
    txt(D.share.label, 910, 1284, 22, '#1d5fa8', 700, 330);
    txt('게임 속 물품·회사는 가상입니다', 540, 1330, 18, '#8a94a1', 600);
    return cv;
  }
  function bubble(s, x, y, w, h) {
    var c = s.add.container(x, y);
    var g = s.add.graphics();
    rrect(g, 0, 6, w, h, 28, 0x000000, 0.15);
    rrect(g, 0, 0, w, h, 28, 0xffffff, 1, 0xd6dde6, 3);
    g.fillStyle(0xffffff, 1); g.fillTriangle(2, h * 0.45, -34, h * 0.62, 2, h * 0.7);
    var t = wrapT(s, 34, h / 2, '', 30, C.ink, w - 68, 600).setOrigin(0, 0.5);
    c.add([g, t]); c.setDepth(19);
    c.say = function (str, color) {
      // [버튼 이름]과 숫자·단위는 줄바꿈으로 쪼개지지 않게 한다
      str = keepUnits(str.replace(/\[[^\]]*\]/g, function (m) { return m.replace(/ /g, '\u00a0'); }));
      announce(str.replace(/\u00a0/g, ' '));
      t.setFontSize(fz(30)); t.setLineSpacing(10); t.setText(str); t.setColor(color || C.ink);
      if (t.height > h - 24) { t.setFontSize(fz(25)); t.setLineSpacing(7); }
      s.tweens.add({ targets: c, scale: { from: 0.97, to: 1 }, duration: 160, ease: 'Back.easeOut' });
    };
    return c;
  }
  function stampMark(s, x, y, ok) {
    var c = s.add.container(x, y).setDepth(30);
    var col = ok ? C.green : C.red, colS = ok ? C.greenS : C.redS;
    var g = s.add.graphics();
    g.lineStyle(10, col, 0.95); g.strokeRoundedRect(-200, -78, 400, 156, 26);
    g.lineStyle(4, col, 0.95); g.strokeRoundedRect(-184, -62, 368, 124, 18);
    var t = T(s, 0, 0, ok ? '이상 없음' : '이상 발견', 68, colS, 900).setOrigin(0.5);
    c.add([g, t]); c.setAngle(ok ? -8 : 8); c.setAlpha(0.92);
    c.setScale(2.4);
    s.tweens.add({ targets: c, scale: 1, duration: 170, ease: 'Quad.easeIn', onComplete: function () {
      Sfx.play('stamp');
      if (!REDUCED) s.cameras.main.shake(110, 0.004);
    } });
    return c;
  }
  function popText(s, x, y, str, color, size) {
    var t = T(s, x, y, str, size || 56, color || '#ffffff', 900, { stroke: '#1f3a5f', strokeThickness: 10 }).setOrigin(0.5).setDepth(40);
    t.setScale(0.4);
    s.tweens.add({ targets: t, scale: 1, duration: 220, ease: 'Back.easeOut' });
    s.tweens.add({ targets: t, y: y - 70, alpha: 0, delay: 650, duration: 450, onComplete: function () { t.destroy(); } });
    return t;
  }
  // 색종이는 화면 양옆으로만 떨어져 제목과 숫자를 가리지 않는다
  function confetti(s, n) {
    if (REDUCED) return;
    var cols = [0xff6b6b, 0xffc93c, 0x4dabf7, 0x51cf66, 0xcc5de8];
    for (var i = 0; i < n; i++) {
      var x0 = i % 2 ? Phaser.Math.Between(30, 290) : Phaser.Math.Between(W - 290, W - 30);
      var r = s.add.rectangle(x0, -30, 16, 26, cols[i % cols.length]).setDepth(90);
      s.tweens.add({ targets: r, y: H + 40, x: x0 + Phaser.Math.Between(-50, 50), angle: Phaser.Math.Between(-540, 540),
        duration: Phaser.Math.Between(1300, 2200), delay: Phaser.Math.Between(0, 500), onComplete: function (tw, tg) { tg[0].destroy(); } });
    }
  }
  // 모달: 열림은 천천히 감속, 닫힘은 빠르게
  function openFx(s, layer) {
    layer.setAlpha(0);
    s.tweens.add({ targets: layer, alpha: 1, duration: 240, ease: 'Cubic.easeOut' });
  }
  function closeFx(s, objs, then) {
    s.tweens.add({ targets: objs, alpha: 0, duration: 150, ease: 'Cubic.easeIn', onComplete: function () {
      objs.forEach(function (o) { o.destroy(); });
      if (then) then();
    } });
  }
  // 화면 읽기 프로그램용: 캔버스 밖 aria-live 영역에 지금 화면의 핵심 글을 알린다
  var srBuf = [], srTimer = null;
  function announce(str) {
    var el = document.getElementById('sr');
    if (!el || !str) return;
    srBuf.push(str);
    clearTimeout(srTimer);
    srTimer = setTimeout(function () { el.textContent = srBuf.join(' '); srBuf = []; }, 60);
  }
  function srcLine(id) { var x = D.sources[id]; return x.date + ' · ' + x.name; }
  // 짧은 출처 표기(결과 화면·결과 카드). 원문 제목과 주소는 [출처 보기]에 싣는다.
  function srcShort(ids) { return '출처: ' + ids.map(function (id) { return D.sources[id].short; }).join(' · '); }
  function factCard(s, fact, x, y, w) {
    var c = s.add.container(x, y);
    var g = s.add.graphics();
    var body = wrapT(s, -w / 2 + 44, 0, fact.body, 30, C.ink, w - 88, 600);
    var src = wrapT(s, -w / 2 + 44, 0, fact.src.map(srcLine).join('\n'), 26, '#3f4a57', w - 88, 600);
    var h = 116 + body.height + 22 + src.height + 36;
    rrect(g, -w / 2, 0, w, h, 26, 0xfff8e6, 1, 0xf0c35a, 5);
    var chip = s.add.graphics();
    rrect(chip, -w / 2 + 40, 32, 230, 56, 28, 0xf0a830, 1);
    var head = T(s, -w / 2 + 155, 60, '실제로는?', 32, '#ffffff', 900).setOrigin(0.5);
    c.add([g, chip, head]);
    if (fact.tag) {
      // 알약 너비는 글자 너비에 맞춘다
      var tt = T(s, 0, 60, fact.tag, 26, '#ffffff', 800).setOrigin(0.5), tw = tt.width + 48;
      tt.x = -w / 2 + 290 + tw / 2;
      var tg = s.add.graphics(); rrect(tg, -w / 2 + 290, 34, tw, 52, 26, 0x8a6d3b, 1);
      c.add([tg, tt]);
    }
    body.y = 116; src.y = 116 + body.height + 22;
    c.add([body, src]);
    c.cardH = h;
    return c;
  }
  function makeArrow(s) {
    var a = s.add.container(0, 0).setDepth(60).setVisible(false);
    var g = s.add.graphics();
    a.add(g);
    a.point = function (x, y, dir) {
      a.setVisible(true); a.bx = x; a.by = y; a.dir = dir; a.setPosition(x, y);
      g.clear(); g.fillStyle(C.red, 1); g.lineStyle(5, 0xffffff, 1);
      if (dir === 'down') { g.fillTriangle(0, 0, -26, -44, 26, -44); g.strokeTriangle(0, 0, -26, -44, 26, -44); }
      else { g.fillTriangle(0, 0, -44, -26, -44, 26); g.strokeTriangle(0, 0, -44, -26, -44, 26); }
    };
    a.hide = function () { a.setVisible(false); };
    a.bob = function (t) {
      if (!a.visible) return;
      var d = Math.sin(t / 160) * 10;
      if (a.dir === 'down') a.y = a.by + d; else a.x = a.bx + d;
    };
    return a;
  }

  // ---------- 부팅 ----------
  class Boot extends Phaser.Scene {
    constructor() { super('Boot'); }
    preload() {
      var A = window.ASSETS || {};
      for (var k in A) this.load.image(k, A[k]);
    }
    create() {
      window.__game = this.game;
      if (CAPTURE) { window.__ready = true; return; }
      go(this, 'Title');
    }
  }

  // ---------- 타이틀 ----------
  class Title extends Phaser.Scene {
    constructor() { super('Title'); }
    create() {
      var s = this;
      s.targets = {};
      background(s, s.textures.exists('bg_title') ? 'bg_title' : 'bg_office');
      var P = PORT, cx = P ? W / 2 : 580;
      var shade = s.add.graphics();
      if (P) {
        shade.fillStyle(0xfdf8ef, 0.95); shade.fillRoundedRect(40, 160, W - 80, H - 330, 40);
        logoBadge(s, W / 2 - 160, 30, 320);
      } else {
        shade.fillStyle(0x000000, 0.10); shade.fillRoundedRect(130, 92, 920, 900, 40);
        shade.fillStyle(0xfdf8ef, 0.95); shade.fillRoundedRect(120, 80, 920, 900, 40);
        logoBadge(s, 1530, 36, 350);
      }
      var logo1 = T(s, cx, P ? 300 : 230, '도장 쾅!', 170, C.redS, 900, { stroke: '#ffffff', strokeThickness: 16 }).setOrigin(0.5);
      logo1.setAngle(-4);
      T(s, cx, P ? 450 : 385, '조달 검수소', 110, C.navyS, 900, { stroke: '#ffffff', strokeThickness: 12 }).setOrigin(0.5);
      wrapT(s, cx, P ? 575 : 510, '서류와 명판을 살펴 숨은 차이를 찾고,\n도장을 찍어 공정한 공공조달을 지켜요!', 36, C.ink, P ? 940 : 860, 600, 'center').setOrigin(0.5);
      function begin(mode) {
        Sfx.startBgm(); newRun(CAPTURE ? G.seed : randomSeed(), mode);
        go(s, 'Inspect', { day: 0 });
      }
      // 처음 온 사람은 3분 체험부터(Enter). 5일 캠페인과 학습 모드는 바로 옆에 둔다.
      var y0 = P ? 1250 : 640;
      button(s, 'start', cx, y0, P ? 880 : 640, 124, '3분 체험 시작', C.red, C.redD, function () { begin('quick'); }, 54);
      T(s, cx, y0 + (P ? 88 : 82), '처음이라면 여기부터 · 납품물 7건', 26, C.gray, 700).setOrigin(0.5);
      var y1 = P ? 1470 : 800, dx = P ? 230 : 160, bw = P ? 440 : 310;
      button(s, 'camp', cx - dx, y1, bw, 96, '5일 캠페인', C.navy, 0x2c5282, function () { begin('normal'); }, 36);
      button(s, 'learn', cx + dx, y1, bw, 96, '학습 모드', 0x2c6e8f, 0x3a83a6, function () { begin('learn'); }, 36);
      fitW(T(s, cx, y1 + (P ? 76 : 70), '캠페인: 5일 동안 21건 + 시범구매 · 학습 모드: 시간 제한 없음', 22, C.gray, 700).setOrigin(0.5), P ? 940 : 860);
      function toggleBig() { BIG = !BIG; try { localStorage.setItem('pps_big', BIG ? '1' : '0'); } catch (e) {} document.body.classList.toggle('big', BIG); s.scene.restart(); }
      var y2 = P ? 1650 : 940, sw = P ? 300 : 260;
      button(s, 'gloss', cx - (P ? 320 : 280), y2, sw, 70, '용어 풀이', 0x6b7a8c, 0x7d8da0, function () { openInfo(s, 'glossary'); }, 28);
      button(s, 'srcs', cx, y2, sw, 70, '출처 보기', 0x6b7a8c, 0x7d8da0, function () { openInfo(s, 'sources'); }, 28);
      button(s, 'big', cx + (P ? 320 : 280), y2, sw, 70, BIG ? '글자 크기: 크게' : '글자 크기: 보통', 0x6b7a8c, 0x7d8da0, toggleBig, 26);
      if (!TOUCH && !P) T(s, 1450, 965, (KIOSK ? '전시용 · ' : '') + 'Enter 3분 체험 · C 5일 캠페인 · L 학습 모드 · H 용어 · S 출처 · F 글자 크기', 22, '#ffffff', 700, { backgroundColor: 'rgba(31,58,95,0.75)', padding: { x: 16, y: 8 } }).setOrigin(0.5);
      s.guide = mascot(s, 'narmi', P ? 370 : 1290, P ? 870 : 610, P ? 440 : 540);
      s.helper = mascot(s, 'dali', P ? 760 : 1640, P ? 965 : 735, P ? 250 : 290);
      nameTag(s, P ? 370 : 1290, P ? 1115 : 905, '나르미 · 선배 검사관');
      nameTag(s, P ? 760 : 1640, P ? 1115 : 905, '달이 · 학습 도우미');
      s.time.delayedCall(400, function () { react(s, s.guide, 'happy'); });
      var fh = P ? 150 : 76;
      var foot = s.add.graphics(); foot.fillStyle(0x1f3a5f, 0.88); foot.fillRect(0, H - fh, W, fh);
      wrapT(s, W / 2, H - fh / 2, D.disclaimer, 22, '#e6edf6', P ? 980 : 1800, 500, 'center').setOrigin(0.5);
      announce(D.title + '. 3분 체험 시작은 Enter, 5일 캠페인은 C, 학습 모드는 L, 용어 풀이는 H, 출처는 S, 글자 크기는 F.');
      s.input.keyboard.on('keydown', function (e) {
        var k = keyOf(e);
        if (k === 'Enter' || k === 'Space') s.targets.start.fn();
        else if (k === 'C') s.targets.camp.fn();
        else if (k === 'L') s.targets.learn.fn();
        else if (k === 'H') openInfo(s, 'glossary');
        else if (k === 'S') openInfo(s, 'sources');
        else if (k === 'F') toggleBig();
      });
    }
  }

  // ---------- 1~4일차: 검사 ----------
  var ROWS = { 4: { y0: 330, dy: 125, h: 112, vs: 38 }, 5: { y0: 318, dy: 104, h: 94, vs: 34 } };
  // 검사 화면 배치: 가로(PC)와 세로(휴대폰). 세로는 납품물 → 서류 두 장 → 나르미·도장 순서로 쌓는다.
  function inspectLayout(n) {
    if (!PORT) return {
      con: [60, 148, 620, 690], doc: [1240, 148, 620, 690], rows: ROWS[n], rowW: 580,
      itemX: 960, itemFrom: 1500, baseY: 505, chipY: 590, chipX: [825, 1095, 960], hintY: [745, 590],
      guide: [170, 942, 230, 1055], bub: [330, 872, 850, 160], btnX: [1395, 1735], btnY: 958, btnW: 330, keyY: 1050, score: [1565, 864],
      zoom: { x: 700, y: 148, w: 1160, h: 690, artX: 860, artY: 450, artW: 270, artH: 300, capY: 640, capW: 280, fx: 1010, fy: 250, fw: 820, fh: 470,
        rowX: 1420, rowW: 760, py0: 312, pdy: 88, prh: 80, cy0: 395, cdy: 104, crh: 88, btnY: 785, btnX: [1100, 1500, 1280], btnW: 380 },
      wrong: [960, 540, 495, 660], modalW: 1200, endW: 1300
    };
    return {
      con: [30, 770, 500, 680], doc: [550, 770, 500, 680], rows: n === 5 ? { y0: 932, dy: 100, h: 90, vs: 34 } : { y0: 942, dy: 120, h: 106, vs: 36 }, rowW: 470,
      itemX: 540, itemFrom: 900, baseY: 520, chipY: 588, chipX: [400, 680, 540], hintY: [695, 680],
      guide: [115, 1590, 200, 1700], bub: [235, 1478, 815, 200], btnX: [280, 800], btnY: 1830, btnW: 470, keyY: 0, score: [540, 1720],
      zoom: { x: 30, y: 190, w: 1020, h: 1260, artX: 540, artY: 410, artW: 300, artH: 230, capY: 535, capW: 900, fx: 70, fy: 590, fw: 940, fh: 590,
        rowX: 540, rowW: 880, py0: 650, pdy: 110, prh: 96, cy0: 760, cdy: 120, crh: 100, btnY: 1360, btnX: [300, 780, 540], btnW: 440 },
      wrong: [540, 960, 1010, 900], modalW: 1000, endW: 1020
    };
  }
  var TEACH = {
    doc: '규격서와 확인서를 한 칸씩 비교해 봐요. 다른 칸을 눌러 표시하세요!',
    plate: '확인서는 모두 같아 보여요. 제품을 눌러 명판을 확대해 봐요!',
    plateLine: '명판의 원산지를 왼쪽 계약 규격서와 비교해요. 다른 줄을 눌러 표시!',
    cert: '이번엔 증명서! [증명서 보기]를 눌러요.',
    certLine: '유효기간 안에 계약일(2026. 9. 1.)이 들어 있나요?\n들어 있지 않으면 유효기간 줄을 눌러 표시!',
    stamp: '잘 찾았어요! 이제 [이상 발견] 도장을 찍어요.'
  };
  class Inspect extends Phaser.Scene {
    constructor() { super('Inspect'); }
    init(d) {
      this.dayIdx = d.day || 0; this.startItem = d.item || 0; this.skipIntro = !!d.skipIntro; this.presetCorrect = d.dayCorrect || 0;
      this.presetTime = d.timeLeft; this.presetAudits = d.audits || [];
    }
    create() {
      var s = this;
      s.targets = {};
      s.day = dayOf(s.dayIdx); s.cases = G.run[s.dayIdx];
      s.timed = G.mode !== 'learn';
      s.idx = s.startItem; s.locked = true; s.timeLeft = s.presetTime === undefined ? s.day.time : s.presetTime; s.timerOn = false;
      s.dayCorrect = s.presetCorrect; s.fx = []; s.ended = false; s.audits = s.presetAudits.slice(); s.marks = {}; s.zoom = null; s.coach = false;
      s.pendingKey = null; s.lockAt = 0; s.answered = false; s.introDone = false;
      // 장면 객체는 다시 쓰이므로 이전 판(다른 날·학습 모드)에서 만든 화면 요소 참조를 지운다
      s.condT = null; s.dali = null; s.daliTxt = null; s.itemBox = null; s.timeBar = null; s.modalKey = null;
      s.LY = inspectLayout(s.day.rows.length); s.L = s.LY.rows;
      var LY = s.LY;
      background(s, 'bg_office', LY.baseY);
      hud(s, s.day.title, s.day.sub);
      s.buildTimer();
      s.buildPanels();
      s.buildCenter();
      s.guide = mascot(s, 'narmi', LY.guide[0], LY.guide[1], LY.guide[2]);
      nameTag(s, LY.guide[0], LY.guide[3], '나르미 선배');
      s.bub = bubble(s, LY.bub[0], LY.bub[1], LY.bub[2], LY.bub[3]);
      s.okBtn = button(s, 'ok', LY.btnX[0], LY.btnY, LY.btnW, 124, '이상 없음', C.green, C.greenD, function () { s.stamp(false); }, 44);
      s.badBtn = button(s, 'bad', LY.btnX[1], LY.btnY, LY.btnW, 124, '이상 발견', C.red, C.redD, function () { s.stamp(true); }, 44);
      if (LY.keyY && !TOUCH) {
        T(s, LY.btnX[0], LY.keyY, 'Space 키', 20, C.gray, 700).setOrigin(0.5);
        T(s, LY.btnX[1], LY.keyY, 'Enter 키', 20, C.gray, 700).setOrigin(0.5);
      }
      s.arrow = makeArrow(s);
      s.input.keyboard.on('keydown', function (e) { s.onKey(keyOf(e)); });
      if (s.idx >= s.cases.length) s.endDay(false);
      else if (s.skipIntro) s.beginDay(); else s.showIntro();
    }
    // 화면 방향이 바뀌어 다시 그릴 때 이어 갈 상태
    resumeData() {
      var s = this;
      return { day: s.dayIdx, item: Math.min(s.idx + (s.answered ? 1 : 0), s.cases.length), skipIntro: s.introDone, dayCorrect: s.dayCorrect, timeLeft: s.timeLeft, audits: s.audits };
    }
    rowY(i) { return this.L.y0 + i * this.L.dy; }
    onKey(k) {
      var s = this;
      if (k === 'S') { openInfo(s, 'sources'); return; }
      if (s.modalKey) { if (k === 'Space' || k === 'Enter' || k === 'Escape') s.targets[s.modalKey].fn(); return; }
      // 화면이 바뀌는 사이에 누른 키는 버리지 않고, 다음 납품물이 준비되면 바로 처리한다(도장 직후 0.4초 안의 키는 연타로 보고 버린다)
      if (s.locked) { if (!s.ended && s.time.now - s.lockAt > 400) s.pendingKey = k; return; }
      if (k === 'Q' && s.dali) { s.daliHint(); return; }
      if (k.length === 1 && '12345'.indexOf(k) >= 0) {
        var n = Number(k) - 1;
        if (n < s.day.rows.length) { if (s.zoom) s.closeZoom(); s.toggle('doc:' + s.day.rows[n]); }
        return;
      }
      if (k.length === 1 && 'ABCDE'.indexOf(k) >= 0 && s.zoom) {
        var a = 'ABCDE'.indexOf(k);
        if (a < s.zoom.keys.length) s.toggle(s.zoom.keys[a]);
        return;
      }
      if (k === 'Z' && s.day.plate) s.openZoom('plate');
      else if (k === 'X' && s.day.cert) s.openZoom('cert');
      else if (k === 'Escape' && s.zoom) s.closeZoom();
      else if (k === 'Space') s.stamp(false);
      else if (k === 'Enter') s.stamp(true);
    }
    buildTimer() {
      var s = this;
      // 남은 시간: 가로는 제목 줄 오른쪽, 세로는 둘째 줄 오른쪽
      s.barX = PORT ? W - 280 : 1100; s.barY = PORT ? 126 : 38;
      var tx = PORT ? W - 300 : 1505, ty = PORT ? 143 : 55;
      if (!s.timed) { T(s, PORT ? W - 36 : 1505, ty, '학습 모드 · 시간 제한 없음', 28, '#ffe08a', 800).setOrigin(1, 0.5); }
      else {
        var g = s.add.graphics(); rrect(g, s.barX, s.barY, 240, 34, 17, 0xffffff, 0.2);
        s.timeBar = s.add.graphics();
        s.timeTxt = T(s, tx, ty, '', 28, '#ffffff', 800).setOrigin(1, 0.5);
        s.drawTimer();
      }
      var sc = s.LY.score;
      var sb = s.add.graphics(); rrect(sb, sc[0] - 170, sc[1] - 22, 340, 44, 22, 0xffffff, 0.94, 0xc9d3df, 3);
      s.scoreTxt = T(s, sc[0], sc[1], '', 24, C.navyS, 800).setOrigin(0.5).setDepth(5);
      s.updateScore();
    }
    updateScore() { fitW(this.scoreTxt.setText('정확한 기록 ' + G.correct + '건 · 연속 ' + G.streak), 320); }
    drawTimer() {
      if (!this.timed) return;
      var p = Phaser.Math.Clamp(this.timeLeft / this.day.time, 0, 1);
      this.timeBar.clear();
      rrect(this.timeBar, this.barX, this.barY, Math.max(34, 240 * p), 34, 17, p < 0.25 ? C.red : C.yellow, 1);
      this.timeTxt.setText('남은 ' + Math.ceil(this.timeLeft) + '초');
    }
    buildPanels() {
      var s = this, L = s.L, A = s.LY.con, B = s.LY.doc;
      var g = s.add.graphics();
      rrect(g, A[0], A[1] + 10, A[2], A[3], 30, 0x000000, 0.14);
      rrect(g, A[0], A[1], A[2], A[3], 30, 0xffffff, 1, 0xc9d3df, 4);
      g.fillStyle(C.navy, 1); g.fillRoundedRect(A[0], A[1], A[2], 110, { tl: 30, tr: 30, bl: 0, br: 0 });
      T(s, A[0] + A[2] / 2, A[1] + 38, '계약 규격서', 44, '#ffffff', 900).setOrigin(0.5);
      s.conNo = T(s, A[0] + A[2] / 2, A[1] + 85, '', 22, '#c9d7ea', 700).setOrigin(0.5);
      termChip(s, A[0] + A[2] - 42, A[1] + 44, '계약 규격서');
      // 명판의 ‘인증 표시’와 비교할 계약 조건(명판을 보는 날만)
      if (s.day.plate) s.condT = T(s, A[0] + A[2] / 2, A[1] + A[3] - 30, '', 22, C.navyS, 800).setOrigin(0.5);
      rrect(g, B[0], B[1] + 10, B[2], B[3], 30, 0x000000, 0.14);
      rrect(g, B[0], B[1], B[2], B[3], 30, C.kraft, 1, C.kraftD, 4);
      g.fillStyle(0x9c6b35, 1); g.fillRoundedRect(B[0], B[1], B[2], 110, { tl: 30, tr: 30, bl: 0, br: 0 });
      T(s, B[0] + B[2] / 2, B[1] + 38, '납품 확인서', 44, '#ffffff', 900).setOrigin(0.5);
      s.docNo = T(s, B[0] + B[2] / 2, B[1] + 85, '', 22, '#f6e6c8', 700).setOrigin(0.5);
      termChip(s, B[0] + B[2] - 42, B[1] + 44, '납품 확인서');
      s.specRows = []; s.docRows = [];
      s.day.rows.forEach(function (field, i) {
        var y = s.rowY(i);
        var sf = T(s, A[0] + 40, y - L.h / 2 + 8, '', 22, C.gray, 700);
        var sv = T(s, A[0] + 40, y + 12, '', L.vs, C.ink, 800).setOrigin(0, 0.5);
        if (i < s.day.rows.length - 1) { var sl = s.add.graphics(); sl.lineStyle(2, 0xe3e8ee, 1); sl.lineBetween(A[0] + 30, y + L.dy / 2, A[0] + A[2] - 30, y + L.dy / 2); }
        s.specRows.push({ f: sf, v: sv });
        s.docRows.push(s.makeRow('row' + i, B[0] + B[2] / 2, y, s.LY.rowW, L.h, String(i + 1), function () { s.toggle('doc:' + field); }));
      });
    }
    // 표시할 수 있는 한 줄(확인서 칸, 명판·증명서 줄 공용)
    makeRow(key, x, y, w, h, tag, fn, parent) {
      var s = this;
      var c = s.add.container(x, y).setDepth(3);
      var g = s.add.graphics();
      var paper = parent ? 0xffffff : 0xfffaf0;
      function draw(state) {
        g.clear();
        var fill = { hover: 0xfff3d6, marked: 0xffe6c4, found: 0xffe1dc, hint: 0xfff1b8, okrow: 0xe3f5e9 }[state] || paper;
        var st = { hover: 0xf0a830, marked: C.orange, found: C.red, hint: 0xf0a830, okrow: C.green }[state] || (parent ? 0xc4ccd6 : 0xd9c39d);
        rrect(g, -w / 2, -h / 2, w, h, 16, fill, parent ? 0.92 : 1, st, state === 'idle' ? 3 : 6);
      }
      var f = T(s, -w / 2 + 24, -h / 2 + 8, '', 22, parent ? '#5f6875' : '#8a6d3b', 700);
      var v = T(s, -w / 2 + 24, 12, '', h > 100 ? 38 : 34, C.ink, 800).setOrigin(0, 0.5);
      var chip = s.add.graphics();
      var n = T(s, w / 2 - 34, 0, tag, 24, '#8a7350', 800).setOrigin(0.5);
      var mk = T(s, w / 2 - 105, 0, '표시', 24, '#ffffff', 900).setOrigin(0.5).setVisible(false);
      c.add([g, f, v, chip, n, mk]); c.setSize(w, h); c.setInteractive({ useHandCursor: true });
      c.on('pointerover', function () { if (!s.locked && c.state === 'idle') draw('hover'); });
      c.on('pointerout', function () { if (c.state === 'idle') draw('idle'); });
      c.on('pointerdown', function () { if (!s.locked) fn(); });
      reg(s, key, c, function () { if (!s.locked) fn(); });
      c.state = 'idle';
      // 색만으로 구분하지 않도록 상태를 글자로도 보여 준다
      c.setLook = function (st) {
        c.state = st; draw(st);
        chip.clear();
        var pill = { marked: [C.orange, '표시'], found: [C.red, '다름'], okrow: [C.green, '같음'] }[st];
        if (pill) { rrect(chip, w / 2 - 150, -22, 90, 44, 22, pill[0], 1); mk.setText(pill[1]); }
        mk.setVisible(!!pill);
      };
      c.setLook('idle');
      if (parent) parent.add(c);
      return { c: c, f: f, v: v };
    }
    buildCenter() {
      var s = this, LY = s.LY, cx = LY.itemX;
      s.chips = {};
      var both = s.day.plate && s.day.cert;
      // 납품물은 baseY(배경 검수대 윗면)에 서고, 버튼은 검수대 앞면, 힌트는 그 아래 바닥에 둔다
      if (s.day.plate) s.chips.plate = s.chip('zplate', both ? LY.chipX[0] : LY.chipX[2], LY.chipY, PORT ? '명판 보기' : '명판 보기 (Z)', C.steel, C.steelH, 'plate');
      if (s.day.cert) s.chips.cert = s.chip('zcert', LY.chipX[1], LY.chipY, PORT ? '증명서 보기' : '증명서 보기 (X)', C.brown, C.brownH, 'cert');
      var hy = s.day.plate ? LY.hintY[0] : LY.hintY[1];
      if (s.timed) {
        var ht = T(s, cx, hy, s.day.cert ? '명판·증명서까지 살펴보고 다른 곳을 표시해요' : s.day.plate ? '제품을 눌러 명판까지 살펴보고 다른 곳을 표시해요' : '다른 칸을 눌러 표시하고 도장을 골라요', 24, C.ink, 800).setOrigin(0.5).setDepth(5);
        var hg = s.add.graphics().setDepth(4);
        rrect(hg, cx - ht.width / 2 - 22, hy - ht.height / 2 - 10, ht.width + 44, ht.height + 20, (ht.height + 20) / 2, 0xffffff, 0.9, 0xd9c3a5, 2);
        return;
      }
      // 학습 모드: 달이가 단계별 힌트를 준다
      var dg = s.add.graphics().setDepth(4);
      rrect(dg, cx - 260, hy - 62, 520, 124, 30, 0xffffff, 0.9, 0xd9c3a5, 2);
      s.dali = mascot(s, 'dali', cx - 190, hy, 112).setDepth(5);
      s.daliTxt = wrapT(s, cx - 125, hy, '', 24, C.ink, 365, 800).setOrigin(0, 0.5).setDepth(5);
      [s.dali, s.daliTxt].forEach(function (o) { o.setInteractive({ useHandCursor: true }); o.on('pointerdown', function () { s.daliHint(); }); });
      reg(s, 'dali', s.dali, function () { s.daliHint(); });
    }
    daliHint() {
      var s = this;
      if (s.locked || !s.dali) return;
      s.hintLv++;
      var F = s.case.faults;
      var left = F.filter(function (f) { return !f.accept.some(function (a) { return s.marks[a]; }); });
      var msg;
      if (s.hintLv === 1) msg = s.day.cert ? '확인서 → 명판 → 증명서 순서로 계약과 비교해 봐요.' : s.day.plate ? '확인서와 명판을 계약과 한 줄씩 비교해 봐요.' : '계약 규격서와 확인서를 한 칸씩 비교해 봐요.';
      else if (left.length) msg = '‘' + left[0].where + '’에서 ' + left[0].label + ' 칸을 다시 봐요.';
      else msg = F.length ? '다 찾았어요! [이상 발견] 도장!' : '달이가 보기엔 모두 계약과 같아요.';
      s.daliTxt.setText(msg + (s.hintLv === 1 ? ' (한 번 더 누르면 더 알려 줘요)' : ''));
      react(s, s.dali, 'normal');
      Sfx.play('click');
    }
    chip(key, x, y, label, fill, hover, kind) {
      var s = this;
      var b = button(s, key, x, y, 262, 72, label, fill, hover, function () { s.openZoom(kind); }, 26);
      var badge = s.add.container(x + 118, y - 34).setDepth(6).setVisible(false);
      var bg = s.add.graphics(); bg.fillStyle(C.orange, 1); bg.fillCircle(0, 0, 22); bg.lineStyle(3, 0xffffff, 1); bg.strokeCircle(0, 0, 22);
      var bt = T(s, 0, 0, '', 24, '#ffffff', 900).setOrigin(0.5);
      badge.add([bg, bt]);
      b.badge = function (n) { badge.setVisible(n > 0); bt.setText(String(n)); };
      return b;
    }
    showIntro() {
      var s = this;
      var layer = s.add.container(0, 0).setDepth(80);
      var dm = dim(s, 0.55);
      var lines = s.day.intro.slice();
      if (s.timed && s.day.timed) lines.push(s.day.timed);
      if (!s.timed) lines.push('학습 모드에서는 달이가 도와줘요. 막히면 달이를 눌러요' + (TOUCH ? '.' : '(Q).'));
      var mw = s.LY.modalW, mx = (W - mw) / 2, cx = W / 2, top = PORT ? 250 : 210;
      var body = wrapT(s, mx + 80, top + 190, lines.join('\n'), 34, C.ink, mw - 160, 700);
      var extra = [];
      var y = top + 190 + body.height + 20;
      if (s.day.note) { var nt = wrapT(s, mx + 80, y, s.day.note, 26, C.gray, mw - 160, 700); extra.push(nt); y += nt.height + 16; }
      var mode = T(s, cx, y + 18, s.timed ? '제한 시간 ' + s.day.time + '초 · 하루 ' + s.cases.length + '건' : '학습 모드 · 시간 제한 없음 · 하루 ' + s.cases.length + '건', 28, C.navyS, 800).setOrigin(0.5);
      var bottom = y + 70 + 120;
      var g = s.add.graphics(); rrect(g, mx, top, mw, bottom - top, 40, 0xffffff, 1);
      g.fillStyle(C.navy, 1); g.fillRoundedRect(mx, top, mw, 150, { tl: 40, tr: 40, bl: 0, br: 0 });
      var t1 = fitW(T(s, cx, top + 52, s.day.title, 60, '#ffffff', 900).setOrigin(0.5), mw - 80);
      var t2 = fitW(T(s, cx, top + 116, s.day.sub, 32, '#c9d7ea', 700).setOrigin(0.5), mw - 80);
      layer.add([dm, g, t1, t2, body, mode].concat(extra));
      // 나르미(학습 모드는 달이도)는 화면에 이미 있는 캐릭터를 어둡게 덮지 않고 앞으로 꺼내 하나만 보이게 한다
      s.lift(true);
      announce(s.day.title + '. ' + s.day.sub + ' ' + lines.join(' ') + ' Enter를 누르면 시작해요.');
      var b = button(s, 'go', cx, bottom - 75, 420, 100, '검사 시작', C.red, C.redD, function () {
        s.modalKey = null; b.disabled = true; closeFx(s, [layer, b], function () { s.lift(false); s.beginDay(); });
      }, 44);
      b.setDepth(81);
      s.modalKey = 'go';
      openFx(s, layer);
    }
    lift(on) {
      var s = this;
      [s.guide, s.dali].forEach(function (o) { if (o) o.setDepth(on ? 85 : (o === s.guide ? 20 : 5)); });
    }
    beginDay() {
      this.introDone = true;
      this.loadItem(this.idx);
      this.timerOn = this.timed && !this.coach;
    }
    rowLabel(field) { return field === 'feat' ? this.case.it.featL : field; }
    loadItem(i) {
      var s = this, LY = s.LY;
      s.case = s.cases[i]; s.marks = {}; s.answered = false;
      s.fx.forEach(function (m) { m.destroy(); }); s.fx = [];
      var pw = LY.con[2] - 40;
      fitW(s.conNo.setText(s.case.no + ' · 계약일 ' + D.contractDate), pw);
      fitW(s.docNo.setText('업체가 보낸 서류 · ' + s.case.no.replace('나라장터 계약 ', '')), pw);
      if (s.condT) fitW(s.condT.setText(s.case.cond), pw);
      s.day.rows.forEach(function (field, r) {
        s.specRows[r].f.setText(s.rowLabel(field)); fitW(s.specRows[r].v.setText(s.case.con[field]), LY.con[2] - 80);
        s.docRows[r].f.setText(s.rowLabel(field)); fitW(s.docRows[r].v.setText(s.case.doc[field]), LY.rowW - 190);
      });
      if (s.itemBox) s.itemBox.destroy();
      // 그림은 투명 여백 없이 잘려 있으므로, 아래 가장자리를 검수대 윗면(baseY)에 맞추고 그림자를 바로 밑에 깐다
      var BASE_Y = LY.baseY, HALF = 165;
      var box = s.add.container(LY.itemFrom, BASE_Y - HALF).setDepth(4);
      var im = art(s, 0, HALF, s.case.it.art, 400, 330, s.case.it.name);
      if (im.setOrigin) im.setOrigin(0.5, 1);
      var dw = im.displayWidth || 300, dh = im.displayHeight || 300;
      var sh = s.add.graphics();
      sh.fillStyle(0x3b2410, 0.22); sh.fillEllipse(0, HALF, dw * 0.9, 26);
      sh.fillStyle(0x3b2410, 0.18); sh.fillEllipse(0, HALF, dw * 0.6, 14);
      box.add([sh, im]);
      if (s.day.plate) {
        // 제품에 붙은 작은 명판(눌러서 확대)
        var mp = s.add.graphics(), px = Math.round(dw * 0.12), py = HALF - Math.round(dh * 0.42);
        rrect(mp, px, py, 92, 58, 8, 0xb8c2ce, 1, 0x7f8b99, 4);
        mp.lineStyle(3, 0x7f8b99, 1); mp.lineBetween(px + 14, py + 17, px + 78, py + 17); mp.lineBetween(px + 14, py + 29, px + 70, py + 29); mp.lineBetween(px + 14, py + 41, px + 76, py + 41);
        box.add(mp);
      }
      box.setSize(420, 350);
      if (s.day.plate) {
        box.setInteractive({ useHandCursor: true });
        box.on('pointerdown', function () { s.openZoom('plate'); });
        reg(s, 'product', box, function () { s.openZoom('plate'); });
      }
      s.itemBox = box;
      // 서류 칸은 바로 바뀌므로 납품물이 미끄러져 들어오는 동안에도 입력을 받는다
      s.tweens.add({ targets: box, x: LY.itemX, duration: 420, ease: 'Back.easeOut' });
      s.locked = false;
      Sfx.play('slide');
      react(s, s.guide, 'normal');
      if (s.dali) { s.hintLv = 0; s.daliTxt.setText('막히면 나를 눌러요! (Q)'); }
      s.coach = (i === 0 && s.startItem === 0 && !!s.day.teach);
      announce((i + 1) + '번째 납품물 ' + s.case.it.name + '. ' + s.day.rows.map(function (field, r) {
        return (r + 1) + '번 ' + s.rowLabel(field) + ': 계약 ' + s.case.con[field] + ', 확인서 ' + dot(s.case.doc[field]);
      }).join(' ') + (s.day.plate ? ' Z 명판' : '') + (s.day.cert ? ', X 증명서' : '') + (s.day.plate ? '. ' : ' ') + '숫자로 표시, Enter 이상 발견, Space 이상 없음.');
      if (!s.coach) s.bub.say((i + 1) + '번째 납품물 · ' + s.case.it.name + '\n' + s.day.hint);
      else s.bub.say('첫 납품물은 함께 해 봐요!');
      s.refresh();
      s.coachStep();
      if (s.pendingKey) { var k = s.pendingKey; s.pendingKey = null; s.onKey(k); }
    }
    toggle(key) {
      var s = this;
      if (s.locked) return;
      s.marks[key] = !s.marks[key];
      Sfx.play('click');
      s.refresh();
      s.coachStep();
    }
    markCount() { var s = this; return Object.keys(s.marks).filter(function (k) { return s.marks[k]; }).length; }
    refresh() {
      var s = this;
      if (s.locked && s.fx.length) return;
      s.day.rows.forEach(function (field, i) { s.docRows[i].c.setLook(s.marks['doc:' + field] ? 'marked' : 'idle'); });
      if (s.zoom) s.zoom.rows.forEach(function (r, i) { r.c.setLook(s.marks[s.zoom.keys[i]] ? 'marked' : 'idle'); });
      ['plate', 'cert'].forEach(function (kind) {
        if (!s.chips[kind]) return;
        s.chips[kind].badge(Object.keys(s.marks).filter(function (k) { return s.marks[k] && k.indexOf(kind + ':') === 0; }).length);
      });
      var n = s.markCount();
      s.badBtn.label.setText(n ? '이상 발견 · ' + n + '곳' : '이상 발견');
    }
    openZoom(kind) {
      var s = this;
      if (s.locked) return;
      if (s.zoom) { var same = s.zoom.kind === kind; s.closeZoom(); if (same) return; }
      Sfx.play('slide');
      var Z = s.LY.zoom, fx = Z.fx, fy = Z.fy, fw = Z.fw, fh = Z.fh;
      var z = s.add.container(0, 0).setDepth(40);
      // 확대 화면 아래의 확인서 칸이 눌리지 않도록 막는다
      z.add(s.add.rectangle(Z.x + Z.w / 2, Z.y + Z.h / 2, Z.w, Z.h, 0x000000, 0.001).setInteractive());
      var g = s.add.graphics();
      rrect(g, Z.x, Z.y + 10, Z.w, Z.h, 30, 0x000000, 0.16);
      rrect(g, Z.x, Z.y, Z.w, Z.h, 30, 0xf4f6f9, 1, 0x9aa8b8, 4);
      g.fillStyle(kind === 'plate' ? C.steel : C.brown, 1); g.fillRoundedRect(Z.x, Z.y, Z.w, 84, { tl: 30, tr: 30, bl: 0, br: 0 });
      z.add(g);
      z.add(T(s, Z.x + Z.w / 2, Z.y + 42, kind === 'plate' ? '명판 확대' : '직접생산 확인증명서', 38, '#ffffff', 900).setOrigin(0.5));
      z.add(art(s, Z.artX, Z.artY, s.case.it.art, Z.artW, Z.artH, s.case.it.name));
      z.add(wrapT(s, Z.artX, Z.capY, kind === 'plate' ? (PORT ? '제품에 붙은 명판을 확대했어요' : '제품에 붙은 명판을\n확대했어요') : '업체가 낸 증명서예요', 24, C.gray, Z.capW, 700, 'center').setOrigin(0.5, 0));
      var p = s.add.graphics();
      var lines, y0, dy, rh;
      if (kind === 'plate') {
        rrect(p, fx, fy, fw, fh, 18, 0x8a96a6, 1);
        rrect(p, fx + 8, fy + 8, fw - 16, fh - 16, 14, 0xdde2e8, 1, 0xf4f6f8, 3);
        [[fx + 26, fy + 26], [fx + fw - 18, fy + 26], [fx + 26, fy + fh - 26], [fx + fw - 18, fy + fh - 26]].forEach(function (q) { p.fillStyle(0x9aa5b2, 1); p.fillCircle(q[0], q[1], 9); p.fillStyle(0xf4f6f8, 1); p.fillCircle(q[0] - 2, q[1] - 2, 3); });
        lines = PLATE_KEYS.map(function (k) { return [k, s.case.plate[k]]; });
        y0 = Z.py0; dy = Z.pdy; rh = Z.prh;
      } else {
        rrect(p, fx, fy, fw, fh, 8, 0xfffdf3, 1, 0xb59b6a, 4);
        p.lineStyle(2, 0xd8c8a2, 1); p.strokeRect(fx + 16, fy + 16, fw - 32, fh - 32);
        lines = CERT_KEYS.map(function (k) { return [k, s.case.cert[k]]; });
        y0 = Z.cy0; dy = Z.cdy; rh = Z.crh;
      }
      z.add(p);
      if (kind === 'cert') {
        z.add(T(s, Z.rowX, fy + 62, '직접생산 확인증명서', 34, '#5c4520', 900).setOrigin(0.5));
        z.add(T(s, Z.rowX, fy + fh - 38, '게임 속 가상 서류', 20, '#8a7350', 700).setOrigin(0.5));
      }
      termChip(s, Z.x + Z.w - 42, Z.y + 42, kind === 'plate' ? '명판' : '직접생산 확인증명서').setDepth(41);
      var keys = lines.map(function (l) { return kind + ':' + l[0]; });
      announce((kind === 'plate' ? '명판' : '직접생산 확인증명서') + '. ' + lines.map(function (l, i) { return 'ABCDE'[i] + ' ' + l[0] + ': ' + dot(l[1]); }).join(' ') + (kind === 'plate' ? ' ' + dot(s.case.cond) : '') + ' 글자 키로 표시, Esc 닫기.');
      var rows = lines.map(function (l, i) {
        var r = s.makeRow((kind === 'plate' ? 'pl' : 'ce') + i, Z.rowX, y0 + i * dy, Z.rowW, rh, 'ABCDE'[i], function () { s.toggle(keys[i]); }, z);
        r.f.setText(l[0]); fitW(r.v.setText(l[1]), Z.rowW - 190);
        return r;
      });
      var btns = [];
      var other = kind === 'plate' ? 'cert' : 'plate';
      var hasOther = !!s.chips[other];
      btns.push(button(s, 'zclose', hasOther ? Z.btnX[0] : Z.btnX[2], Z.btnY, Z.btnW, 72, '확인서로 돌아가기', C.navy, 0x2c5282, function () { s.closeZoom(); }, 28));
      if (hasOther) btns.push(button(s, 'zswitch', Z.btnX[1], Z.btnY, Z.btnW, 72, (other === 'cert' ? '증명서 보기' : '명판 보기') + (PORT ? '' : other === 'cert' ? ' (X)' : ' (Z)'), other === 'cert' ? C.brown : C.steel, other === 'cert' ? C.brownH : C.steelH, function () { s.openZoom(other); }, 28));
      btns.forEach(function (b) { b.setDepth(42); });
      s.zoom = { kind: kind, c: z, rows: rows, keys: keys, btns: btns, chip: s.targets['term_' + (kind === 'plate' ? '명판' : '직접생산 확인증명서')].obj };
      z.setAlpha(0); s.tweens.add({ targets: z, alpha: 1, duration: 160, ease: 'Cubic.easeOut' });
      s.refresh();
      s.coachStep();
    }
    closeZoom() {
      var s = this;
      if (!s.zoom) return;
      s.zoom.c.destroy(); s.zoom.chip.destroy(); s.zoom.btns.forEach(function (b) { b.destroy(); });
      s.zoom = null;
      s.coachStep();
    }
    // 첫 납품물 안내: 지금 해야 할 일 한 가지만 화살표로 가리킨다
    coachStep() {
      var s = this;
      if (!s.coach || s.locked) { s.arrow.hide(); return; }
      var key = s.case.faults[0].accept[0], kind = key.split(':')[0];
      if (s.marks[key]) { s.arrow.point(s.badBtn.x, s.badBtn.y - 73, 'down'); s.bub.say(TEACH.stamp); return; }
      if (kind === 'doc') {
        var i = s.day.rows.indexOf(key.split(':')[1]);
        s.arrow.point(s.LY.doc[0] + s.LY.doc[2] * 0.74, s.rowY(i) - s.L.h / 2 + 4, 'down'); s.bub.say(TEACH.doc); return;
      }
      if (!s.zoom || s.zoom.kind !== kind) {
        var c = s.zoom ? s.zoom.btns[1] : s.chips[kind];
        s.arrow.point(c.x, c.y - 40, 'down'); s.bub.say(TEACH[kind]); return;
      }
      var li = s.zoom.keys.indexOf(key);
      s.arrow.point(s.LY.zoom.rowX - s.LY.zoom.rowW / 2 - 8, s.zoom.rows[li].c.y, 'right'); s.bub.say(TEACH[kind + 'Line']);
    }
    stamp(bad) {
      var s = this;
      if (s.locked) return;
      var keys = Object.keys(s.marks).filter(function (k) { return s.marks[k]; });
      if (bad && keys.length === 0) { s.bub.say('먼저 다른 곳을 눌러 표시해요. 모두 같으면 [이상 없음]!', C.redS); return; }
      s.locked = true; s.answered = true; s.lockAt = s.time.now;
      s.arrow.hide();
      if (s.zoom) s.closeZoom();
      announce(bad ? '이상 발견 도장을 찍었어요.' : '이상 없음 도장을 찍었어요.');
      var F = s.case.faults;
      var found = F.filter(function (f) { return bad && f.accept.some(function (a) { return keys.indexOf(a) >= 0; }); });
      var extra = bad ? keys.filter(function (k) { return !F.some(function (f) { return f.accept.indexOf(k) >= 0; }); }) : [];
      var ok = bad ? (F.length > 0 && found.length === F.length && extra.length === 0) : F.length === 0;
      if (ok) s.right(); else s.wrong(bad, found, extra);
    }
    right() {
      var s = this, F = s.case.faults, sx = s.LY.itemX, sy = s.LY.baseY - 35;
      G.total++; G.correct++; s.dayCorrect++; G.streak++; G.best = Math.max(G.best, G.streak);
      if (F.length) {
        s.day.rows.forEach(function (field, i) { if (s.marks['doc:' + field]) s.docRows[i].c.setLook('found'); });
        s.fx.push(stampMark(s, sx, sy, false));
        s.bub.say(F.length > 1 ? '두 곳을 모두 찾았어요! ' + F[0].lesson : '찾았다! ' + F[0].lesson, C.redS);
      } else {
        s.docRows.forEach(function (r) { r.c.setLook('okrow'); });
        s.fx.push(stampMark(s, sx, sy, true));
        s.bub.say(s.day.cert ? '확인서·명판·증명서가 모두 계약과 같아요. 이상 없음, 통과!' : s.day.plate ? '확인서와 명판이 모두 계약과 같아요. 이상 없음, 통과!' : '모든 칸이 계약과 같아요. 이상 없음, 통과!', C.greenS);
      }
      ['plate', 'cert'].forEach(function (k) { if (s.chips[k]) s.chips[k].badge(0); });
      react(s, s.guide, 'happy');
      react(s, s.dali, 'happy');
      s.time.delayedCall(260, function () { Sfx.play('good'); });
      if (G.streak >= 2) s.time.delayedCall(300, function () { Sfx.play('combo'); popText(s, sx, PORT ? 260 : 250, '연속 ' + G.streak + '!', '#ffc93c', 64); });
      s.updateScore();
      s.afterAnswer(s.coach || !s.timed ? 3400 : 2500);
    }
    addAudit(text) { var a = { name: this.case.it.name, text: text }; this.audits.push(a); G.audits.push(a); }
    wrong(bad, found, extra) {
      var s = this, F = s.case.faults;
      G.total++; G.streak = 0;
      s.timerOn = false;
      Sfx.play('bad');
      if (!REDUCED) s.cameras.main.shake(220, 0.006);
      react(s, s.guide, 'oops');
      var missed = F.filter(function (f) { return found.indexOf(f) < 0; });
      missed.forEach(function (f) { s.addAudit(f.audit); });
      if (F.length === 0 || extra.length) s.addAudit(D.falseAudit);
      var head = [];
      if (F.length === 0) head.push(D.okWrong);
      else if (!bad) head.push('계약과 다른 곳이 있었어요.');
      else if (missed.length) head.push('찾아야 할 곳 ' + F.length + '곳 중 ' + found.length + '곳을 찾았어요.');
      if (extra.length && F.length) head.push('계약과 같은 곳까지 표시했어요.');
      var body = head.join('\n');
      F.forEach(function (f) { body += '\n\n' + f.where + ' · ' + f.label + '\n계약 ' + f.a + '\n→ 실제 ' + f.b + '\n' + f.lesson; });
      // 다른 곳은 색과 글자 표식으로 함께 알려 준다
      s.day.rows.forEach(function (field, i) {
        var isFault = F.some(function (f) { return f.accept.indexOf('doc:' + field) >= 0; });
        s.docRows[i].c.setLook(isFault ? 'hint' : (F.length ? 'idle' : 'okrow'));
        if (isFault) s.fx.push(s.tag(s.LY.doc[0] + s.LY.doc[2] - 40, s.rowY(i)));
      });
      ['plate', 'cert'].forEach(function (k) {
        if (!s.chips[k]) return;
        s.chips[k].badge(0);
        if (F.some(function (f) { return f.accept.some(function (a) { return a.indexOf(k + ':') === 0; }); })) s.fx.push(s.tag(s.chips[k].x + 131, s.chips[k].y - 50));
      });
      s.bub.say(F.length ? '앗, 다시 볼까요? 노란 표시와 가운데 설명을 확인해요.' : '앗, 이 납품물은 이상이 없었어요.', C.redS);
      var layer = s.add.container(0, 0).setDepth(70);
      var WR = s.LY.wrong, wx = WR[0] - WR[1] / 2;
      var txt = wrapT(s, wx + 34, 0, body, 25, C.ink, WR[1] - 68, 600);
      var hgt = Math.min(WR[3], 90 + txt.height + 130), top = Math.round(WR[2] - hgt / 2);
      var g = s.add.graphics();
      rrect(g, wx + 6, top + 6, WR[1] - 12, hgt, 26, 0x000000, 0.2);
      rrect(g, wx, top, WR[1], hgt, 26, 0xffffff, 1, C.red, 6);
      var h = T(s, WR[0], top + 46, '다시 볼까요?', 40, C.redS, 900).setOrigin(0.5);
      txt.y = top + 86;
      layer.add([g, h, txt]);
      announce('다시 볼까요? ' + body.replace(/\n+/g, ' ') + ' Enter를 누르면 계속해요.');
      openFx(s, layer);
      s.updateScore();
      var b = button(s, 'reason', WR[0], top + hgt - 56, 300, 80, '알겠어요', C.navy, 0x2c5282, function () {
        s.modalKey = null; b.disabled = true;
        closeFx(s, [layer, b], function () { s.afterAnswer(0); });
      }, 34);
      b.setDepth(71);
      s.modalKey = 'reason';
    }
    tag(x, y) {
      var s = this;
      var t = s.add.container(x, y).setDepth(8);
      var g = s.add.graphics(); rrect(g, -150, -26, 150, 52, 26, 0xf0a830, 1);
      t.add([g, T(s, -75, 0, '여기 달라요', 22, '#ffffff', 800).setOrigin(0.5)]);
      return t;
    }
    afterAnswer(delay) {
      var s = this;
      s.time.delayedCall(delay, function () {
        s.coach = false;
        s.timerOn = s.timed && s.timeLeft > 0;
        s.idx++;
        if (s.idx >= s.cases.length || (s.timed && s.timeLeft <= 0)) { s.endDay(s.timed && s.timeLeft <= 0 && s.idx < s.cases.length); return; }
        var old = s.itemBox; s.itemBox = null;
        s.tweens.add({ targets: old, x: s.LY.itemX - (PORT ? 360 : 660), alpha: 0, duration: 260, onComplete: function () { old.destroy(); } });
        s.loadItem(s.idx);
      });
    }
    update(t, dt) {
      this.arrow.bob(t);
      if (!this.timerOn || this.ended) return;
      this.timeLeft -= dt / 1000;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0; this.timerOn = false;
        if (!this.locked) { this.locked = true; if (this.zoom) this.closeZoom(); this.endDay(true); }
      }
      this.drawTimer();
    }
    endDay(timeout) {
      var s = this;
      if (s.ended) return;
      s.ended = true; s.timerOn = false; s.locked = true; s.arrow.hide();
      var unchecked = timeout ? s.cases.length - s.idx : 0;
      G.total += unchecked;
      // 승리 연출은 실제로 잘한 날에만
      var good = s.dayCorrect >= Math.ceil(s.cases.length * 0.8);
      Sfx.play(good ? 'clear' : 'test');
      if (good) confetti(s, 40);
      var layer = s.add.container(0, 0).setDepth(80);
      var dm = dim(s, 0.55);
      var mw = s.LY.endW, mx = (W - mw) / 2, cx = W / 2, fcw = mw - 140, ax = mx + 70;
      var fc = factCard(s, D.facts[s.day.fact], cx, 0, fcw);
      var au = s.add.container(0, 0);
      var ag = s.add.graphics();
      var at, ah;
      if (s.audits.length) {
        var shown = s.audits.slice(0, 3).map(function (a) { return '• ' + a.name + ' — ' + a.text; });
        if (s.audits.length > 3) shown.push('외 ' + (s.audits.length - 3) + '건');
        at = wrapT(s, ax + 40, 0, '나르미 선배의 감사 지적 ' + s.audits.length + '건 (게임 속 사후 점검)\n' + shown.join('\n'), 26, '#9b2c1f', fcw - 80, 700);
      } else {
        at = fitW(T(s, ax + 40, 0, '나르미 선배의 감사 지적 0건 · 깔끔한 검사였어요!', 28, C.greenS, 800), fcw - 80);
      }
      ah = at.height + 36;
      au.add([ag, at]);
      var ph = 200 + ah + 24 + fc.cardH + 170, top = Math.round((H - ph) / 2);
      rrect(ag, ax, top + 196, fcw, ah, 20, s.audits.length ? 0xfff0ed : 0xeaf7ef, 1, s.audits.length ? 0xe8a598 : 0x9fd3b2, 3);
      at.y = top + 196 + 18;
      fc.y = top + 200 + ah + 24;
      var g = s.add.graphics(); rrect(g, mx, top, mw, ph, 40, 0xffffff, 1);
      var head = T(s, cx, top + 72, s.day.title.split(' · ')[0] + ' 검사 끝!', 60, C.navyS, 900).setOrigin(0.5);
      var line = '정확한 검사 기록 ' + s.dayCorrect + ' / ' + s.cases.length + '건' + (unchecked > 0 ? '  (시간 초과로 ' + unchecked + '건 미검사)' : '');
      var sc = fitW(T(s, cx, top + 150, line, 36, C.ink, 800).setOrigin(0.5), mw - 80);
      layer.add([dm, g, head, sc, au, fc]);
      announce(head.text + ' ' + line + '. ' + at.text.replace(/\n+/g, ' ') + ' 실제로는? ' + D.facts[s.day.fact].body + ' Enter를 누르면 ' + (G.mode === 'quick' ? '결과를 봐요.' : '다음 날로 가요.'));
      // 나르미는 화면에 있는 한 명만 앞으로 꺼내 반응한다
      s.lift(true);
      s.time.delayedCall(300, function () { react(s, s.guide, s.audits.length ? 'oops' : 'happy'); });
      var quick = G.mode === 'quick', last = quick || s.dayIdx === D.days.length - 1;
      var b = button(s, 'next', cx - 140, top + ph - 90, 420, 104, quick ? '결과 보기' : last ? '마지막 날로' : '다음 날로', C.red, C.redD, function () {
        s.modalKey = null;
        go(s, quick ? 'Result' : last ? 'Pilot' : 'Inspect', { day: s.dayIdx + 1 });
      }, 42);
      var b2 = button(s, 'srcs', cx + 240, top + ph - 90, 300, 104, PORT ? '출처 보기' : '출처 보기 (S)', 0x6b7a8c, 0x7d8da0, function () { openInfo(s, 'sources'); }, 30);
      b.setDepth(81); b2.setDepth(81);
      s.modalKey = 'next';
      openFx(s, layer);
    }
    // 자동 플레이(시연·테스트용): 지금 납품물의 정답 또는 오답 조작 순서
    solution(correct) {
      var s = this, F = s.case.faults, out = [], open = null;
      if (!correct) return F.length ? ['ok'] : ['row1', 'bad'];
      if (!F.length) return ['ok'];
      F.forEach(function (f) {
        var k = f.accept[0], kind = k.split(':')[0];
        if (kind === 'doc') {
          if (open) { out.push('zclose'); open = null; }
          out.push('row' + s.day.rows.indexOf(k.split(':')[1]));
        } else {
          if (open !== kind) { out.push(open ? 'zswitch' : (kind === 'plate' ? 'zplate' : 'zcert')); open = kind; }
          var names = kind === 'plate' ? PLATE_KEYS : CERT_KEYS;
          out.push((kind === 'plate' ? 'pl' : 'ce') + names.indexOf(k.split(':')[1]));
        }
      });
      out.push('bad');
      return out;
    }
  }

  // ---------- 5일차: 혁신제품 시범구매(기관 매칭 → 구매 → 현장 테스트 → 보완) ----------
  var SITE_X = [400, 960, 1520], PROD_X = [255, 715, 1175, 1635];
  class Pilot extends Phaser.Scene {
    constructor() { super('Pilot'); }
    create() {
      var s = this, P = D.pilot;
      s.targets = {}; s.sel = -1; s.busy = false; s.phase = 'match'; s.modalKey = null;
      s.assign = [-1, -1, -1]; s.res = [null, null, null];
      background(s, 'bg_office');
      hud(s, P.title, P.sub);
      s.stepG = s.add.graphics(); s.stepT = [];
      P.steps.forEach(function (st, i) {
        var x = 330 + i * 420;
        s.stepT.push(T(s, x, 170, st, 28, C.navyS, 800).setOrigin(0.5).setDepth(2));
        if (i < 3) T(s, x + 210, 170, '→', 32, C.gray, 900).setOrigin(0.5);
      });
      s.drawSteps(1);
      s.slots = [];
      P.sites.forEach(function (site, i) {
        var x = SITE_X[i];
        var g = s.add.graphics();
        rrect(g, x - 250, 225, 500, 360, 28, 0x000000, 0.14);
        rrect(g, x - 250, 215, 500, 360, 28, 0xffffff, 1, 0xc9d3df, 4);
        art(s, x, 282, site.art, 300, 118, site.name);
        T(s, x - 228, 236, '기관 신청서', 20, C.gray, 800);
        T(s, x, 370, site.name, 32, C.navyS, 900).setOrigin(0.5);
        T(s, x, 412, (site.outdoor ? '실외' : '실내') + ' · 넓이 ' + site.area + 'm²', 26, C.ink, 700).setOrigin(0.5);
        T(s, x, 448, '소음 ' + site.noise + 'dB 이하', 26, C.ink, 700).setOrigin(0.5);
        T(s, x, 484, site.note, 24, C.gray, 700).setOrigin(0.5);
        var slot = s.add.container(x, 538);
        var sg = s.add.graphics();
        var st = T(s, 0, 0, '', 24, C.gray, 800).setOrigin(0.5);
        var sk = T(s, 196, 0, String(i + 1), 24, '#8a96a6', 900).setOrigin(0.5);
        slot.add([sg, st, sk]); slot.setSize(440, 56); slot.setInteractive({ useHandCursor: true });
        slot.on('pointerdown', function () { s.pickSlot(i); });
        reg(s, 'slot' + i, slot, function () { s.pickSlot(i); });
        s.slots.push({ c: slot, g: sg, t: st, x: x });
      });
      s.cards = [];
      P.products.forEach(function (p, i) {
        var x = PROD_X[i];
        var sh = s.add.graphics(); rrect(sh, x - 215, 608, 430, 240, 24, 0x000000, 0.12);
        var c = s.add.container(x, 720);
        var g = s.add.graphics();
        var im = art(s, -130, 0, p.art, 130, 190, p.name);
        var nm = T(s, -50, -92, p.name, 28, C.navyS, 900);
        var ln = T(s, -50, -46, '소음 ' + p.noise + 'dB\n정화 면적 ' + p.area + 'm²\n' + (p.outdoor ? '실외 가능(방수)' : '실내용'), 24, C.ink, 700, { lineSpacing: 8 });
        var pr = T(s, -50, 72, '가격 ' + man(p.price), 26, C.redS, 900);
        var kc = T(s, 192, -94, 'ABCD'[i], 24, '#8a96a6', 900).setOrigin(0.5);
        // 배정된 기관은 카드 위쪽 띠로 보여 준다(가격과 겹치지 않게)
        var tg = s.add.container(0, -122).setVisible(false);
        var tgg = s.add.graphics(); rrect(tgg, -130, -22, 260, 44, 22, C.blue, 1);
        var tgt = T(s, 0, 0, '', 24, '#ffffff', 900).setOrigin(0.5);
        tg.add([tgg, tgt]);
        c.add([g, im, nm, ln, pr, kc, tg]);
        if (p.tag) {
          var pg = s.add.graphics(); rrect(pg, 104, -60, 98, 38, 19, C.green, 1);
          c.add([pg, T(s, 153, -41, p.tag, 20, '#ffffff', 900).setOrigin(0.5)]);
        }
        c.setSize(430, 240); c.setInteractive({ useHandCursor: true });
        c.on('pointerdown', function () { s.pickProduct(i); });
        reg(s, 'prod' + i, c, function () { s.pickProduct(i); });
        s.cards.push({ c: c, g: g, tag: tg, tagT: tgt });
      });
      s.guide = mascot(s, 'narmi', 170, 945, 230);
      nameTag(s, 170, 1055, '나르미 선배');
      s.bub = bubble(s, 330, 878, 820, 150);
      var bb = s.add.graphics(); rrect(bb, 1290, 862, 540, 48, 24, 0xffffff, 0.95, 0xc9d3df, 3);
      s.budgetT = T(s, 1560, 886, '', 26, C.navyS, 800).setOrigin(0.5);
      s.testBtn = button(s, 'test', 1560, 975, 540, 110, '구매하고 현장 테스트 (Enter)', C.green, C.greenD, function () { s.runTest(); }, 30);
      s.redraw();
      s.input.keyboard.on('keydown', function (e) { s.onKey(keyOf(e)); });
      s.showIntro();
    }
    onKey(k) {
      var s = this;
      if (k === 'S') { openInfo(s, 'sources'); return; }
      if (s.modalKey) { if (k === 'Space' || k === 'Enter' || k === 'Escape') s.targets[s.modalKey].fn(); return; }
      if (s.phase === 'improve') { var o = '1234'.indexOf(k); if (k.length === 1 && o >= 0 && s.targets['opt' + o]) s.targets['opt' + o].fn(); return; }
      if (s.phase !== 'match' || s.busy) return;
      var a = 'ABCD'.indexOf(k);
      if (k.length === 1 && a >= 0) { s.pickProduct(a); return; }
      var n = '123'.indexOf(k);
      if (k.length === 1 && n >= 0) { s.pickSlot(n); return; }
      if (k === 'Enter' || k === 'Space') s.runTest();
    }
    drawSteps(cur) {
      var s = this, g = s.stepG;
      g.clear();
      D.pilot.steps.forEach(function (st, i) {
        var x = 330 + i * 420, done = i < cur, now = i === cur;
        rrect(g, x - 185, 140, 370, 60, 30, now ? 0xf0a830 : 0xffffff, now ? 1 : 0.92, now ? null : 0xc9d3df, 3);
        s.stepT[i].setText(st + (done ? '  ✓' : '')).setColor(now ? '#ffffff' : (done ? C.greenS : C.gray));
      });
    }
    showIntro() {
      var s = this, P = D.pilot;
      var layer = s.add.container(0, 0).setDepth(80);
      var dm = dim(s, 0.55);
      var body = wrapT(s, 410, 390, P.intro.join('\n'), 32, C.ink, 1100, 700);
      var bottom = 390 + body.height + 190;
      var g = s.add.graphics(); rrect(g, 330, 200, 1260, bottom - 200, 40, 0xffffff, 1);
      g.fillStyle(C.navy, 1); g.fillRoundedRect(330, 200, 1260, 150, { tl: 40, tr: 40, bl: 0, br: 0 });
      var t1 = T(s, 960, 252, P.title, 58, '#ffffff', 900).setOrigin(0.5);
      var t2 = T(s, 960, 316, P.sub, 32, '#c9d7ea', 700).setOrigin(0.5);
      layer.add([dm, g, t1, t2, body]);
      s.guide.setDepth(85);
      announce(P.title + '. ' + P.intro.join(' '));
      var b = button(s, 'go', 960, bottom - 80, 420, 100, '매칭 시작', C.red, C.redD, function () {
        s.modalKey = null; b.disabled = true;
        closeFx(s, [layer, b], function () {
          s.guide.setDepth(20);
          announce(P.sites.map(function (x, i) { return '기관 ' + (i + 1) + ' ' + x.name + ': ' + (x.outdoor ? '실외' : '실내') + ', 넓이 ' + x.area + '제곱미터, 소음 ' + x.noise + '데시벨 이하.'; }).join(' ') + ' ' +
            P.products.map(function (p, i) { return '제품 ' + 'ABCD'[i] + ' ' + p.name + ': 소음 ' + p.noise + '데시벨, 정화 면적 ' + p.area + '제곱미터, ' + (p.outdoor ? '실외 가능' : '실내용') + ', 가격 ' + man(p.price) + (p.tagNote ? ', ' + p.tagNote : '') + '.'; }).join(' '));
          s.bub.say('제품 카드를 누르고, 알맞은 기관 아래 칸을 눌러 짝지어요. 예산 ' + man(D.pilot.budget) + ' 안에서!');
        });
      }, 42);
      b.setDepth(81);
      s.modalKey = 'go';
      openFx(s, layer);
    }
    total() { var P = D.pilot; return this.assign.reduce(function (a, p) { return a + (p >= 0 ? P.products[p].price : 0); }, 0); }
    redraw() {
      var s = this, P = D.pilot;
      s.slots.forEach(function (sl, i) {
        var p = s.assign[i];
        sl.g.clear();
        var hot = s.sel >= 0 && s.phase === 'match';
        rrect(sl.g, -220, -28, 440, 56, 18, p >= 0 ? 0xeaf3fc : 0xf3f6f9, 1, hot ? 0xf0a830 : (p >= 0 ? C.blue : 0xc9d3df), hot ? 5 : 3);
        sl.t.setText(p >= 0 ? P.products[p].name + ' · ' + man(P.products[p].price) : '제품을 골라 여기에 놓아요').setColor(p >= 0 ? '#1f4f86' : C.gray);
      });
      s.cards.forEach(function (cd, i) {
        var on = s.sel === i, at = s.assign.indexOf(i);
        cd.g.clear();
        rrect(cd.g, -215, -120, 430, 240, 24, on ? 0xfff1b8 : (at >= 0 ? 0xeef4fb : 0xffffff), 1, on ? 0xf0a830 : (at >= 0 ? C.blue : 0xc9d3df), on ? 6 : 3);
        cd.tag.setVisible(at >= 0); cd.tagT.setText(at >= 0 ? P.sites[at].short + '에 배정' : '');
      });
      var t = s.total(), over = t > P.budget;
      s.budgetT.setText('예산 ' + man(P.budget) + ' 중 ' + man(t) + (over ? ' · 초과!' : '')).setColor(over ? C.redS : C.navyS);
    }
    pickProduct(i) {
      var s = this;
      if (s.busy || s.phase !== 'match' || s.modalKey) return;
      Sfx.play('click');
      s.sel = s.sel === i ? -1 : i;
      s.redraw();
      if (s.sel >= 0) s.bub.say(D.pilot.products[i].name + ' → 어느 기관에 줄까요? 기관 아래 칸을 눌러요(1~3).');
    }
    pickSlot(j) {
      var s = this;
      if (s.busy || s.phase !== 'match' || s.modalKey) return;
      Sfx.play('slide');
      if (s.sel >= 0) {
        var prev = s.assign.indexOf(s.sel);
        if (prev >= 0) { s.assign[prev] = -1; s.clearResult(prev); }
        s.assign[j] = s.sel; s.sel = -1;
      } else if (s.assign[j] >= 0) { s.assign[j] = -1; }
      else { s.bub.say('먼저 아래 제품 카드를 눌러 골라요(A~D).'); return; }
      s.clearResult(j);
      s.redraw();
      s.bub.say(s.assign.indexOf(-1) < 0 ? '세 기관을 모두 채웠어요. 예산을 확인하고 [구매하고 현장 테스트]!' : '좋아요. 남은 기관도 채워요.');
    }
    clearResult(i) { if (this.res[i]) { this.res[i].destroy(); this.res[i] = null; } }
    checks(i) {
      var P = D.pilot, p = P.products[this.assign[i]], site = P.sites[i];
      return [
        [p.noise <= site.noise, '소음 ' + p.noise + 'dB (기준 ' + site.noise + 'dB 이하)'],
        [p.area >= site.area, '정화 면적 ' + p.area + 'm² (넓이 ' + site.area + 'm²)'],
        [!site.outdoor || p.outdoor, site.outdoor ? (p.outdoor ? '비를 맞아도 잘 작동' : '실내용이라 비에 젖어 멈춤') : '실내에 설치']
      ];
    }
    runTest() {
      var s = this, P = D.pilot;
      if (s.busy || s.phase !== 'match' || s.modalKey) return;
      if (s.assign.indexOf(-1) >= 0) { s.bub.say('세 기관 모두 제품을 놓아야 해요.', C.redS); return; }
      if (s.total() > P.budget) { s.bub.say('예산 ' + man(P.budget) + '을 넘어요! 예산 안에서 다시 골라요.', C.redS); Sfx.play('bad'); return; }
      s.busy = true; G.tests++; s.sel = -1; s.redraw();
      s.drawSteps(2);
      s.time.delayedCall(350, function () { s.drawSteps(3); });
      s.bub.say('조달청이 구매해 기관에 보냈어요. 현장에서 직접 써 보는 중…');
      var allOk = true;
      [0, 1, 2].forEach(function (i) {
        s.clearResult(i);
        var ck = s.checks(i), ok = ck.every(function (c) { return c[0]; });
        if (!ok) allOk = false;
        s.time.delayedCall(450 + i * 450, function () {
          Sfx.play('test');
          var x = SITE_X[i], r = s.add.container(0, 0).setDepth(9);
          var g = s.add.graphics();
          rrect(g, x - 236, 392, 472, 176, 18, ok ? 0xe3f5e9 : 0xffe1dc, 1, ok ? C.green : C.red, 4);
          g.fillStyle(ok ? C.green : C.red, 1); g.fillCircle(x + 214, 236, 40);
          r.add(g);
          r.add(T(s, x + 214, 236, ok ? '✓' : '✗', 52, '#ffffff', 900).setOrigin(0.5));
          ck.forEach(function (c, j) { r.add(T(s, x - 214, 420 + j * 50, (c[0] ? '✓ ' : '✗ ') + c[1], 23, c[0] ? C.greenS : C.redS, 800).setOrigin(0, 0.5)); });
          s.res[i] = r;
          Sfx.play(ok ? 'good' : 'bad');
        });
      });
      s.time.delayedCall(450 + 3 * 450 + 400, function () {
        s.busy = false;
        if (allOk) { s.drawSteps(4); s.improve(); return; }
        s.drawSteps(1);
        react(s, s.guide, 'oops');
        s.bub.say('맞지 않는 곳이 있어요. 빨간 결과를 읽고 제품을 바꿔 봐요.', C.redS);
      });
    }
    // 사용 결과 보고: 정답이 하나가 아닌 선택. 한 번 고르면 되돌릴 수 없고 결말이 갈린다.
    improve() {
      // 민원실에 놓은 제품(대형 B 또는 기후테크 D)에 따라 다른 사용 결과 보고가 온다
      var s = this, P = D.pilot, I = P.improve.paths[s.assign[P.improve.site]];
      s.I = I;
      s.phase = 'improve';
      react(s, s.guide, 'normal');
      s.bub.say('세 곳 모두 기준을 통과했어요! 그런데 사용 결과 보고가 하나 왔어요.');
      s.time.delayedCall(900, function () {
        var layer = s.add.container(0, 0).setDepth(80);
        var dm = dim(s, 0.5);
        var g = s.add.graphics(); rrect(g, 310, 190, 1300, 720, 40, 0xffffff, 1);
        g.fillStyle(C.navy, 1); g.fillRoundedRect(310, 190, 1300, 120, { tl: 40, tr: 40, bl: 0, br: 0 });
        var h1 = T(s, 960, 250, '사용 결과 보고 · ' + P.sites[P.improve.site].name, 46, '#ffffff', 900).setOrigin(0.5);
        var rp = wrapT(s, 380, 345, I.report, 32, C.ink, 1160, 700);
        var ask = wrapT(s, 380, 345 + rp.height + 16, P.improve.ask, 26, C.gray, 1160, 700);
        layer.add([dm, g, h1]);
        s.impG = g;
        var parts = [rp, ask], btns = [];
        I.options.forEach(function (o, i) {
          var x = i % 2 ? 1275 : 645, y = i < 2 ? 600 : 740;
          parts.push(T(s, x, y + 54, o.cost, 24, C.gray, 700).setOrigin(0.5, 0));
          var b = button(s, 'opt' + i, x, y, 580, 84, (i + 1) + '. ' + o.label, C.navy, 0x2c5282, function () { s.decide(i, layer, btns, parts); }, 32);
          b.setDepth(81);
          btns.push(b);
        });
        layer.add(parts);
        announce('사용 결과 보고. ' + I.report + ' ' + P.improve.ask + ' ' + I.options.map(function (o, i) { return (i + 1) + '번 ' + o.label + ', ' + o.cost + '.'; }).join(' '));
        openFx(s, layer);
      });
    }
    decide(i, layer, btns, parts) {
      var s = this, o = s.I.options[i];
      if (s.phase !== 'improve') return;
      s.phase = 'decided'; G.ending = o.ending; G.endingOk = !o.audit;
      if (o.audit) G.audits.push({ name: D.pilot.sites[D.pilot.improve.site].name, text: o.audit });
      Sfx.play(o.audit ? 'bad' : 'test');
      btns.forEach(function (b) { b.destroy(); }); parts.forEach(function (p) { p.destroy(); });
      var et = T(s, 960, 350, '결말 「' + o.ending + '」', 46, o.audit ? C.redS : C.navyS, 900).setOrigin(0.5, 0);
      var mt = wrapT(s, 380, 425, o.msg, 30, C.ink, 1160, 700);
      var my = 425 + mt.height + 30, mg = s.add.graphics(), mts = [];
      o.meters.forEach(function (m, j) {
        var x = 380 + j * 395;
        rrect(mg, x, my, 375, 64, 32, m[0] ? 0xe3f5e9 : 0xffe1dc, 1, m[0] ? C.green : C.red, 3);
        mts.push(fitW(T(s, x + 187, my + 32, (m[0] ? '✓ ' : '✗ ') + m[1], 25, m[0] ? C.greenS : C.redS, 800).setOrigin(0.5), 345));
      });
      layer.add([et, mt, mg].concat(mts));
      // 결말 창은 내용 높이에 맞춰 다시 그린다(가운데 빈 공간 없이)
      var by = my + 64 + 90, bottom = by + 80;
      s.impG.clear();
      rrect(s.impG, 310, 190, 1300, bottom - 190, 40, 0xffffff, 1);
      s.impG.fillStyle(C.navy, 1); s.impG.fillRoundedRect(310, 190, 1300, 120, { tl: 40, tr: 40, bl: 0, br: 0 });
      announce('결말 ' + o.ending + '. ' + o.msg + ' ' + o.meters.map(function (m) { return (m[0] ? '좋음: ' : '나쁨: ') + m[1]; }).join(', '));
      var b = button(s, 'cont', 960, by, 420, 96, '하루 정리 (Enter)', C.red, C.redD, function () {
        s.modalKey = null; b.disabled = true;
        closeFx(s, [layer, b], function () { s.finish(o); });
      }, 36);
      b.setDepth(81);
      s.modalKey = 'cont';
    }
    finish(o) {
      var s = this;
      s.phase = 'done';
      react(s, s.guide, o.audit ? 'oops' : 'happy');
      s.bub.say(o.after, o.audit ? C.redS : C.greenS);
      Sfx.play(o.audit ? 'test' : 'clear');
      if (!o.audit) confetti(s, 60);
      s.testBtn.disabled = true;
      s.tweens.add({ targets: s.testBtn, alpha: 0, duration: 150 });
      s.time.delayedCall(1200, function () {
        var layer = s.add.container(0, 0).setDepth(80);
        var dm = dim(s, 0.55);
        var fc = factCard(s, D.facts.pilot, 960, 0, 1160);
        var ph = 210 + fc.cardH + 170, top = Math.round((H - ph) / 2);
        fc.y = top + 210;
        var g = s.add.graphics(); rrect(g, 310, top, 1300, ph, 40, 0xffffff, 1);
        var head = T(s, 960, top + 72, '5일차 시범구매 끝!', 60, C.navyS, 900).setOrigin(0.5);
        var sc = T(s, 960, top + 150, '현장 테스트 ' + G.tests + '회 · 결말 「' + G.ending + '」', 36, C.ink, 800).setOrigin(0.5);
        layer.add([dm, g, head, sc, fc]);
        var b = button(s, 'next', 820, top + ph - 90, 420, 104, '최종 결과 보기', C.red, C.redD, function () {
          s.modalKey = null; go(s, 'Result');
        }, 40);
        var b2 = button(s, 'srcs', 1200, top + ph - 90, 300, 104, '출처 보기 (S)', 0x6b7a8c, 0x7d8da0, function () { openInfo(s, 'sources'); }, 30);
        b.setDepth(81); b2.setDepth(81);
        s.modalKey = 'next';
        openFx(s, layer);
      });
    }
    // 자동 플레이: 예산 안에서 조건을 모두 맞춘 조합 중 pick번째(0 = 대형 B, 1 = 기후테크 D)
    solution(pick) {
      var P = D.pilot, valid = [];
      for (var a = 0; a < 4; a++) for (var b = 0; b < 4; b++) for (var c = 0; c < 4; c++) {
        if (a === b || b === c || a === c) continue;
        var asg = [a, b, c];
        var ok = asg.every(function (p, i) {
          var pr = P.products[p], st = P.sites[i];
          return pr.noise <= st.noise && pr.area >= st.area && (!st.outdoor || pr.outdoor);
        }) && asg.reduce(function (t, p) { return t + P.products[p].price; }, 0) <= P.budget;
        if (ok) valid.push(asg);
      }
      var best = valid[Math.min(typeof pick === 'number' ? pick : 0, valid.length - 1)];
      var out = [];
      best.forEach(function (p, i) { out.push('prod' + p, 'slot' + i); });
      out.push('test');
      return out;
    }
  }

  // ---------- 결과 ----------
  class Result extends Phaser.Scene {
    constructor() { super('Result'); }
    create() {
      var s = this, S = D.stats;
      s.targets = {};
      background(s, 'bg_office');
      s.add.rectangle(W / 2, H / 2, W, H, 0xfdf8ef, 0.86);
      var P = PORT, cx = W / 2, quick = G.mode === 'quick';
      s.cardLayer = null;
      var ratio = G.cases ? G.correct / G.cases : 0;
      var rank = D.ranks.filter(function (r) { return ratio >= r[0]; })[0][1];
      logoBadge(s, P ? 40 : 36, P ? 40 : 30, P ? 280 : 320);
      T(s, cx, P ? 210 : 78, '검사 결과', 40, C.gray, 800).setOrigin(0.5);
      var rk = T(s, cx, P ? 300 : 160, rank, 92, C.redS, 900, { stroke: '#ffffff', strokeThickness: 12 }).setOrigin(0.5);
      rk.setScale(0.3); s.tweens.add({ targets: rk, scale: 1, duration: 420, ease: 'Back.easeOut' });
      var rec = '정확한 검사 기록 ' + G.correct + ' / ' + G.cases + '건 · 최고 연속 ' + G.best + '회 · 감사 지적 ' + G.audits.length + '건';
      var end = quick ? '3분 체험 · 다음엔 5일 캠페인에서 혁신제품 시범구매까지!'
        : (G.ending ? '5일차 결말 「' + G.ending + '」 · ' : '') + '현장 테스트 ' + G.tests + '회' + (G.mode === 'learn' ? ' · 학습 모드' : '');
      fitW(T(s, cx, P ? 400 : 258, rec, 34, C.ink, 800).setOrigin(0.5), W - 80);
      fitW(T(s, cx, P ? 455 : 306, end, 30, G.ending && !G.endingOk ? '#9b2c1f' : C.navyS, 800).setOrigin(0.5), W - 80);
      fitW(T(s, cx, P ? 535 : 384, S.head, 46, C.navyS, 900).setOrigin(0.5), W - 80);
      // 대표 수치 1개 + 보조 한 줄. 세로 화면은 통계 → QR → 버튼 순서로 쌓는다.
      var st = P ? [40, 590, 1000, 400] : [360, 428, 1200, 320];
      var g = s.add.graphics();
      rrect(g, st[0], st[1] + 10, st[2], st[3], 30, 0x000000, 0.12);
      rrect(g, st[0], st[1], st[2], st[3], 30, 0xffffff, 1, 0xc9d3df, 4);
      fitW(T(s, cx, st[1] + 54, S.label, 32, C.gray, 700).setOrigin(0.5), st[2] - 60);
      T(s, cx, st[1] + (P ? 160 : 144), S.big, 100, C.navyS, 900).setOrigin(0.5);
      wrapT(s, cx, st[1] + (P ? 300 : 262), S.sub, 30, C.ink, st[2] - 80, 700, 'center').setOrigin(0.5);
      fitW(T(s, cx, st[1] + st[3] + 50, srcShort(S.src) + ' · 원문 주소는 [출처 보기]', 24, '#3f4a57', 600).setOrigin(0.5), W - 80);
      var nm, dl;
      if (P) { nm = mascot(s, 'narmi', 170, 1230, 300); dl = mascot(s, 'dali', 910, 1290, 190); }
      else { nm = mascot(s, 'narmi', 175, 590, 330); dl = mascot(s, 'dali', 290, 700, 190); }
      s.time.delayedCall(500, function () { react(s, nm, ratio >= 0.8 ? 'happy' : 'normal'); react(s, dl, 'happy'); });
      // 휴대폰으로 찍으면 게임 주소로 바로 이어지는 QR(주소는 data.js의 share.url)
      var qx = P ? cx - 160 : 1596, qy = P ? 1080 : 428, qw = P ? 320 : 290;
      var qg = s.add.graphics();
      rrect(qg, qx, qy + 10, qw, 320, 26, 0x000000, 0.12); rrect(qg, qx, qy, qw, 320, 26, 0xffffff, 1, 0xc9d3df, 4);
      drawQR(function (X, Y, w, h, c) { qg.fillStyle(Phaser.Display.Color.HexStringToColor(c).color, 1); qg.fillRect(X, Y, w, h); }, qrMatrix(D.share.url), qx + (qw - 210) / 2, qy + 18, 210);
      fitW(T(s, qx + qw / 2, qy + 252, D.share.cta, 20, C.ink, 800).setOrigin(0.5), qw - 24);
      fitW(T(s, qx + qw / 2, qy + 290, D.share.label, 18, '#1d5fa8', 700).setOrigin(0.5), qw - 24);
      // 버튼: 3분 체험은 5일 캠페인으로 이어지는 버튼을 하나 더 둔다
      var list = [
        ['again', '다시 하기', 'Enter', C.red, C.redD, function () { newRun(CAPTURE ? G.seed : randomSeed(), G.mode); go(s, 'Inspect', { day: 0 }); }],
        ['card', '결과 카드', 'P', C.green, C.greenD, function () { s.openCard(rank); }]
      ];
      if (quick) list.push(['camp', '5일 캠페인', 'C', C.navy, 0x2c5282, function () { newRun(CAPTURE ? G.seed : randomSeed(), 'normal'); go(s, 'Inspect', { day: 0 }); }]);
      list.push(['home', '처음으로', 'Esc', quick ? 0x2c6e8f : C.navy, quick ? 0x3a83a6 : 0x2c5282, function () { go(s, 'Title'); }]);
      list.push(['srcs', '출처 보기', 'S', 0x6b7a8c, 0x7d8da0, function () { openInfo(s, 'sources'); }]);
      list.forEach(function (b, i) {
        var bx, by, bw;
        if (P) { bw = 470; bx = cx + (i % 2 ? 245 : -245); by = 1500 + Math.floor(i / 2) * 130; if (i === list.length - 1 && i % 2 === 0) bx = cx; }
        else { bw = quick ? 330 : 370; var gap = 24; bx = cx - (list.length * bw + (list.length - 1) * gap) / 2 + bw / 2 + i * (bw + gap); by = 960; }
        button(s, b[0], bx, by, bw, 104, b[1] + (TOUCH ? '' : ' (' + b[2] + ')'), b[3], b[4], b[5], 32);
      });
      s.input.keyboard.on('keydown', function (e) {
        var k = keyOf(e);
        if (s.cardLayer) { if (k === 'Escape') s.targets.cardclose.fn(); else if (k === 'Enter' || k === 'P') s.targets.cardsave.fn(); return; }
        if (k === 'Enter' || k === 'Space' || k === 'R') s.targets.again.fn();
        else if (k === 'Escape') s.targets.home.fn();
        else if (k === 'P') s.targets.card.fn();
        else if (k === 'C' && quick) s.targets.camp.fn();
        else if (k === 'S') openInfo(s, 'sources');
      });
      announce('검사 결과. 등급 ' + rank + '. ' + rec + '. ' + dot(end) + ' ' + S.label + ' ' + S.big + '. Enter 다시 하기, ' + (quick ? 'C 5일 캠페인, ' : '') + 'Esc 처음으로, P 결과 카드, S 출처.');
      Sfx.play('clear');
      if (ratio >= 0.8) confetti(s, 70);
    }
    // 결과 카드: 미리 보고 이미지 파일로 저장(서버 없이 브라우저에서 만든다)
    openCard(rank) {
      var s = this;
      if (s.cardLayer) return;
      var cv = shareCard(s, rank), key = 'card' + Date.now();
      s.textures.addCanvas(key, cv);
      var layer = s.add.container(0, 0).setDepth(80);
      var P = PORT, bx = P ? W / 2 : 1520;
      var im = s.add.image(P ? W / 2 : 760, P ? 760 : 540, key).setScale(P ? 0.86 : 0.74);
      layer.add([dim(s, 0.9), im]);
      var save = button(s, 'cardsave', P ? W / 2 - 250 : bx, P ? 1490 : 470, 460, 100, TOUCH ? '이미지로 저장' : '이미지로 저장 (Enter)', C.green, C.greenD, function () {
        if (CAPTURE) return;
        var a = document.createElement('a'); a.href = cv.toDataURL('image/png'); a.download = D.share.file;
        document.body.appendChild(a); a.click(); a.remove();
      }, 32);
      var close = button(s, 'cardclose', P ? W / 2 + 250 : bx, P ? 1490 : 600, P ? 460 : 420, 100, TOUCH ? '닫기' : '닫기 (Esc)', C.navy, 0x2c5282, function () {
        [layer, save, close, note].forEach(function (o) { o.destroy(); });
        s.cardLayer = null; s.textures.remove(key);
      }, 32);
      var note = wrapT(s, bx, P ? 1580 : 690, '카드를 저장해 SNS나 수업 자료에 쓸 수 있어요. 카드의 QR을 찍으면 게임으로 바로 이어져요.', 24, '#ffffff', P ? 960 : 420, 700, 'center').setOrigin(0.5, 0);
      [save, close, note].forEach(function (o) { o.setDepth(81); });
      s.cardLayer = layer;
      announce('결과 카드를 열었어요. Enter를 누르면 이미지로 저장하고, Esc를 누르면 닫아요.');
      openFx(s, layer);
    }
  }

  // ---------- 용어 풀이 · 게임과 실제 · 출처 ----------
  // 웹 문서 창(DOM)으로 띄운다: Tab으로 버튼·원문 주소를 고르고 Enter로 열 수 있고, 화면 읽기 프로그램이 그대로 읽으며, 글자 크기 설정을 따른다.
  var infoFrom = null;
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function link(url) { return '<a href="' + esc(url) + '" target="_blank" rel="noopener">' + esc(url) + '</a>'; }
  function srcItem(id) { var x = D.sources[id]; return '<li>' + esc(x.name) + ' · ' + esc(x.date) + '<br>' + link(x.url) + '</li>'; }
  function openInfo(s, page, term) {
    var box = document.getElementById('info');
    if (!infoFrom) { if (s.scene.isPaused()) return; infoFrom = s; s.scene.pause(); }
    var title, body, btns;
    var bt = function (k, label, go, sub) { return '<button type="button" data-k="' + k + '"' + (go ? ' data-go="' + go + '"' : '') + (sub ? ' class="sub"' : '') + '>' + label + '</button>'; };
    var close = bt('close', '닫기 (Esc)');
    if (page === 'term') {
      var def = D.glossary.filter(function (t) { return t[0] === term; })[0];
      title = '달이의 쉬운 용어 풀이';
      body = '<div class="term"><img src="' + (window.ASSETS || {}).dali + '" alt=""><div><h3>' + esc(def[0]) + '</h3><p>' + esc(def[1]) + '</p></div></div>';
      btns = bt('all', '모든 용어 보기', 'glossary', true) + close;
    } else if (page === 'glossary') {
      title = '달이의 쉬운 용어 풀이';
      body = '<dl>' + D.glossary.map(function (t) { return '<div><dt>' + esc(t[0]) + '</dt><dd>' + esc(t[1]) + '</dd></div>'; }).join('') + '</dl>';
      btns = bt('reality', '게임과 실제 비교', 'reality', true) + close;
    } else if (page === 'reality') {
      title = D.reality.title;
      body = D.reality.lines.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') + '<h3>근거</h3><ul class="src">' + D.reality.src.map(srcItem).join('') + '</ul>';
      btns = bt('gl', '용어 풀이', 'glossary', true) + close;
    } else {
      title = '출처';
      body = '<p class="note">주소를 누르면 원문이 새 창으로 열려요(인터넷 필요).</p><ul class="src">' + Object.keys(D.sources).map(srcItem).join('') + '</ul>' +
        '<h3>그림 자료</h3><ul class="src">' + D.credits.map(function (c) { return '<li>' + esc(c.name) + (c.url ? '<br>' + link(c.url) : '') + '</li>'; }).join('') + '</ul>';
      btns = bt('reality', '게임과 실제 비교', 'reality', true) + close;
    }
    box.innerHTML = '<div class="card"><h2 id="info-h" tabindex="-1">' + esc(title) + '</h2><div class="body">' + body + '</div><div class="btns">' + btns + '</div></div>';
    box.hidden = false;
    Array.prototype.forEach.call(box.querySelectorAll('button'), function (b) {
      b.onclick = function () { Sfx.play('click'); if (b.dataset.go) openInfo(infoFrom, b.dataset.go); else closeInfo(); };
    });
    if (CAPTURE) Array.prototype.forEach.call(box.querySelectorAll('a'), function (a) { a.onclick = function (e) { e.preventDefault(); }; });
    box.querySelector('#info-h').focus();
  }
  function closeInfo() {
    var box = document.getElementById('info');
    if (box.hidden) return;
    box.hidden = true; box.innerHTML = '';
    if (infoFrom) { infoFrom.scene.resume(); infoFrom = null; }
    var cv = document.querySelector('#game canvas');
    if (cv) { cv.setAttribute('tabindex', '-1'); cv.focus(); }
  }
  // 창이 열려 있을 때: 키는 게임으로 넘기지 않는다. Esc로 닫고, Tab은 창 안에서만 돈다.
  document.addEventListener('keydown', function (e) {
    var box = document.getElementById('info');
    if (!box || box.hidden) return;
    e.stopPropagation();
    if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); closeInfo(); return; }
    if (e.key !== 'Tab') return;
    var f = box.querySelectorAll('a, button'), first = f[0], lastF = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement.id === 'info-h')) { e.preventDefault(); lastF.focus(); }
    else if (!e.shiftKey && document.activeElement === lastF) { e.preventDefault(); first.focus(); }
  });

  // ---------- 시연 자동 조작(시연영상 녹화·자동 플레이 테스트용) ----------
  class Demo extends Phaser.Scene {
    constructor() { super('Demo'); }
    init(d) { this.script = d.script.slice(); this.waitMs = 0; this.hide = !!d.hide; this.touch = !!d.touch; }
    create() {
      this.cursor = this.add.container(W / 2, H / 2).setDepth(1000);
      var g = this.add.graphics();
      if (this.touch) {
        // 터치 시연: 손끝 자리를 반투명 원으로 보여 준다
        g.fillStyle(0xffffff, 0.55); g.fillCircle(0, 0, 38); g.lineStyle(5, 0x1f2937, 0.7); g.strokeCircle(0, 0, 38);
      } else {
        g.fillStyle(0x000000, 0.25); g.fillTriangle(6, 8, 6, 70, 52, 50);
        g.fillStyle(0xffffff, 1); g.lineStyle(4, 0x1f2937, 1);
        g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 62); g.lineTo(16, 48); g.lineTo(28, 74); g.lineTo(40, 68); g.lineTo(28, 43); g.lineTo(48, 42); g.closePath(); g.fillPath(); g.strokePath();
      }
      this.ring = this.add.circle(0, 0, 10, 0xf0a830, 0.0).setStrokeStyle(6, 0xf0a830, 1).setAlpha(0);
      this.cursor.add([this.ring, g]);
      this.busy = false;
      this.cursor.setVisible(!this.hide);
      this.scene.bringToTop();
    }
    findTarget(key) {
      var scenes = this.game.scene.getScenes(true);
      for (var i = scenes.length - 1; i >= 0; i--) {
        var sc = scenes[i];
        if (sc !== this && sc.targets && sc.targets[key] && sc.targets[key].obj.active) return sc.targets[key];
      }
      // 용어 풀이·출처 창(DOM) 버튼
      var el = document.querySelector('#info:not([hidden]) [data-k="' + key + '"]'), cv = this.game.canvas;
      if (!el) return null;
      return { obj: { getBounds: function () {
        var r = el.getBoundingClientRect(), c = cv.getBoundingClientRect();
        return { centerX: (r.left + r.width / 2 - c.left) * W / c.width, centerY: (r.top + r.height / 2 - c.top) * H / c.height };
      } }, fn: function () { el.click(); } };
    }
    update(t, dt) {
      this.scene.bringToTop();
      if (this.busy) return;
      if (this.waitMs > 0) { this.waitMs -= dt; return; }
      var st = this.script[0];
      if (!st) { window.__demoDone = true; return; }
      if (st.wait !== undefined) { this.waitMs = st.wait; this.script.shift(); return; }
      if (st.solve) {
        var key = st.solve === 'pilot' ? 'Pilot' : 'Inspect';
        var sc = this.game.scene.getScene(key);
        if (!sc || !sc.sys.isActive()) return;
        if (key === 'Inspect' && (sc.locked || sc.modalKey)) return;
        if (key === 'Pilot' && (sc.busy || sc.modalKey || sc.phase !== 'match')) return;
        this.script.shift();
        var keys = sc.solution(key === 'Pilot' ? st.pick : st.solve !== 'wrong'), add = [];
        keys.forEach(function (k) { add.push({ click: k, ms: st.ms || 450 }, { wait: st.gap === undefined ? 250 : st.gap }); });
        this.script = add.concat(this.script);
        return;
      }
      if (st.move) { this.busy = true; this.script.shift(); this.tweens.add({ targets: this.cursor, x: st.move[0], y: st.move[1], duration: st.ms || 500, ease: 'Sine.easeInOut', onComplete: function () { this.busy = false; }.bind(this) }); return; }
      if (st.click) {
        var tg = this.findTarget(st.click);
        if (!tg) return;
        this.script.shift(); this.busy = true;
        var b = tg.obj.getBounds();
        var tx = b.centerX + (st.dx || 0), ty = b.centerY + (st.dy || 0);
        var self = this;
        this.tweens.add({ targets: this.cursor, x: tx, y: ty, duration: st.ms || 500, ease: 'Sine.easeInOut', onComplete: function () {
          self.ring.setAlpha(1); self.ring.setScale(0.5);
          self.tweens.add({ targets: self.ring, scale: 3, alpha: 0, duration: 300 });
          self.tweens.add({ targets: self.cursor, scale: 0.86, duration: 80, yoyo: true });
          self.time.delayedCall(90, function () { tg.fn(); self.busy = false; });
        } });
      }
    }
  }

  // ---------- 캡션(시연영상 녹화용) ----------
  class Caption extends Phaser.Scene {
    constructor() { super('Caption'); }
    init(d) { this.text = d.text; this.ms = d.ms || 3500; }
    create() {
      var t = T(this, W / 2, H - 8, this.text, 34, '#ffffff', 800, { backgroundColor: 'rgba(20,30,48,0.82)', padding: { x: 28, y: 12 }, align: 'center', wordWrap: { width: W - 120, useAdvancedWrap: true } }).setOrigin(0.5, 1).setDepth(900);
      t.setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 250 });
      this.tweens.add({ targets: t, alpha: 0, delay: this.ms, duration: 300 });
      this.scene.bringToTop();
    }
  }

  window.__startSegment = function (seg) {
    var game = window.__game;
    var keep = {};
    if (seg.setG) for (var k in seg.setG) keep[k] = seg.setG[k];
    newRun(seg.seed || 7, seg.mode || 'normal');
    for (var j in keep) G[j] = keep[j];
    fitSize(seg.scene);
    game.scene.start(seg.scene, seg.data || {});
    game.scene.start('Demo', { script: seg.script, hide: seg.hideCursor, touch: seg.touch });
    if (seg.caption) game.scene.start('Caption', { text: seg.caption, ms: seg.captionMs });
  };
  window.__G = G;
  window.__runSummary = function () {
    return G.run.map(function (day) { return day.map(function (c) { return c.it.name + ':' + c.faults.map(function (f) { return f.type; }).join('+'); }); });
  };
  // 자동 플레이 테스트가 읽는 현재 상태
  window.__probe = function () {
    var g = window.__game, act = g.scene.getScenes(true).map(function (x) { return x.scene.key; });
    var ins = g.scene.getScene('Inspect');
    return {
      scenes: act, correct: G.correct, total: G.total, cases: G.cases, audits: G.audits.length, tests: G.tests, mode: G.mode, ending: G.ending,
      day: ins && ins.sys.isActive() ? ins.dayIdx : null, idx: ins && ins.sys.isActive() ? ins.idx : null,
      locked: ins && ins.sys.isActive() ? ins.locked : null, modal: ins && ins.sys.isActive() ? ins.modalKey || null : null,
      marks: ins && ins.sys.isActive() ? ins.markCount() : null, zoom: ins && ins.zoom ? ins.zoom.kind : null,
      faults: ins && ins.sys.isActive() && ins.case ? ins.case.faults.map(function (f) { return f.type; }) : null,
      timeLeft: ins && ins.sys.isActive() ? ins.timeLeft : null
    };
  };

  function boot() {
    var ld = document.getElementById('loading');
    if (ld) ld.remove();
    var game = new Phaser.Game({
      type: Phaser.AUTO,
      width: W, height: H,
      parent: 'game',
      backgroundColor: '#f6f1e7',
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: true, preserveDrawingBuffer: CAPTURE },
      banner: false,
      scene: [Boot, Title, Inspect, Pilot, Result, Demo, Caption]
    });
    window.__game = game;
    var MAIN = ['Title', 'Inspect', 'Pilot', 'Result'];
    function current() { return MAIN.filter(function (k) { return game.scene.isActive(k) || game.scene.isPaused(k); })[0]; }
    if (!CAPTURE) {
      // 휴대폰을 돌리면 그 방향에 맞는 배치로 다시 그린다(검사 중이면 지금 납품물부터 이어서)
      var rt = null;
      window.addEventListener('resize', function () {
        clearTimeout(rt);
        rt = setTimeout(function () {
          var key = current();
          if (!key) return;
          var rot = document.getElementById('rotate');
          if (rot) rot.hidden = !(key === 'Pilot' && isPortrait());
          if (key === 'Pilot' || (isPortrait() && key !== 'Pilot') === PORT) return;
          var sc = game.scene.getScene(key);
          if (key === 'Inspect' && sc.ended) return;
          closeInfo();
          var data = key === 'Inspect' ? sc.resumeData() : {};
          fitSize(key);
          sc.scene.restart(data);
        }, 250);
      });
    }
    if (KIOSK && !CAPTURE) {
      // 전시용: 90초 동안 입력이 없으면 처음 화면으로 돌아간다
      var last = Date.now();
      ['pointerdown', 'keydown'].forEach(function (ev) { window.addEventListener(ev, function () { last = Date.now(); }, true); });
      setInterval(function () {
        if (Date.now() - last < 90000) return;
        last = Date.now();
        if (game.scene.isActive('Title')) return;
        closeInfo();
        game.scene.scenes.forEach(function (sc) { var k = sc.scene.key; if (k !== 'Boot' && (sc.sys.isActive() || sc.sys.isPaused())) sc.scene.stop(); });
        fitSize('Title');
        game.scene.start('Title');
      }, 5000);
    }
  }
  var fonts = ['900 40px Pretendard', '800 40px Pretendard', '700 40px Pretendard', '600 40px Pretendard', '500 40px Pretendard'];
  if (document.fonts && document.fonts.load) {
    Promise.all(fonts.map(function (f) { return document.fonts.load(f, '가'); })).then(boot, boot);
  } else boot();
})();
