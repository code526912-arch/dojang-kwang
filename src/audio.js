// 효과음·배경음은 외부 음원 없이 Web Audio로 직접 합성한다(저작권 문제 없음).
window.Sfx = (function () {
  var ctx = null, master = null, bgmGain = null, bgmTimer = null, step = 0;
  var muted = false;
  try { muted = localStorage.getItem('pps_muted') === '1'; } catch (e) { muted = false; }
  var capture = /[?&]capture=1/.test(location.search);

  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.7;
    master.connect(ctx.destination);
    bgmGain = ctx.createGain();
    bgmGain.gain.value = 0.35;
    bgmGain.connect(master);
    return ctx;
  }

  function tone(freq, dur, type, vol, delay, slideTo, out) {
    var t = ctx.currentTime + (delay || 0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out || master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, delay, cutoff) {
    var t = ctx.currentTime + (delay || 0);
    var len = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = buf; f.type = 'lowpass'; f.frequency.value = cutoff; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t);
  }

  var R = {
    click: function () { tone(700, 0.06, 'square', 0.06); },
    stamp: function () { noise(0.14, 0.9, 0, 700); tone(95, 0.22, 'sine', 0.7, 0, 45); },
    good: function () { tone(880, 0.14, 'triangle', 0.3, 0.05); tone(1318.5, 0.26, 'triangle', 0.3, 0.15); },
    bad: function () { tone(233, 0.32, 'square', 0.12, 0, 150); },
    combo: function () { [1046.5, 1318.5, 1568].forEach(function (f, i) { tone(f, 0.12, 'triangle', 0.22, i * 0.07); }); },
    clear: function () { [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone(f, 0.22, 'triangle', 0.28, i * 0.12); }); },
    slide: function () { noise(0.3, 0.18, 0, 500); },
    test: function () { tone(440, 0.18, 'sine', 0.18, 0, 880); },
    tick: function () { tone(1500, 0.03, 'square', 0.04); }
  };

  // 16스텝 반복 배경음(C 펜타토닉)
  var MEL = [523.25, 0, 659.25, 0, 783.99, 659.25, 0, 587.33, 523.25, 0, 440, 0, 523.25, 587.33, 659.25, 0];
  var BAS = [130.81, 0, 0, 0, 174.61, 0, 0, 0, 196, 0, 0, 0, 130.81, 0, 196, 0];
  function bgmStep() {
    if (!ctx || muted) return;
    var m = MEL[step % 16], b = BAS[step % 16];
    if (m) tone(m, 0.22, 'triangle', 0.10, 0, 0, bgmGain);
    if (b) tone(b, 0.4, 'sine', 0.22, 0, 0, bgmGain);
    step++;
  }

  return {
    play: function (name) {
      if (window.__events) window.__events.push({ t: window.__t || 0, name: name });
      if (capture) return;
      var c = ensure();
      if (!c || muted) return;
      if (c.state === 'suspended') c.resume();
      if (R[name]) R[name]();
    },
    startBgm: function () {
      if (window.__events) window.__events.push({ t: window.__t || 0, name: 'bgm' });
      if (capture || bgmTimer) return;
      if (!ensure()) return;
      bgmTimer = setInterval(bgmStep, 230);
    },
    isMuted: function () { return muted; },
    toggle: function () {
      muted = !muted;
      try { localStorage.setItem('pps_muted', muted ? '1' : '0'); } catch (e) { /* 저장 불가 환경 */ }
      if (master) master.gain.value = muted ? 0 : 0.7;
      return muted;
    }
  };
})();
