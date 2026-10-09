/* Audio: música (archivos de assets/music con fundido en el loop, o música procedural de respaldo)
 * y efectos de sonido sintetizados con WebAudio. Los volúmenes salen de M.Settings. */
window.MOBA = window.MOBA || {};
(function (M) {
  'use strict';
  const XFADE = 3;               // segundos de fundido al dar la vuelta el tema / al cambiar de tema
  const S = function (k) { return M.Settings ? M.Settings.get(k) : ({ master: 80, music: 55, sfx: 80, mute: false })[k]; };
  function musicVol() { return S('mute') ? 0 : (S('master') / 100) * (S('music') / 100); }
  function sfxVol() { return S('mute') ? 0 : (S('master') / 100) * (S('sfx') / 100); }
  function baseDir() { return M.MUSIC_BASE != null ? M.MUSIC_BASE : 'assets/music/'; }

  // ---------------- Tema desde archivo (dos <audio> que se turnan para el fundido del loop) ----------------
  function FileTrack(url) {
    this.url = url; this.failed = false; this.ready = false; this.fade = 0; this.target = 0;
    this.els = [new Audio(), new Audio()];
    this.cur = 0; this.playing = false;
    const self = this;
    this.els.forEach(function (el, i) {
      el.preload = i === 0 ? 'auto' : 'none'; el.loop = false;
      el.addEventListener('error', function () { if (!self.ready) self.failed = true; });
      el.addEventListener('canplay', function () { self.ready = true; });
    });
    this.els[0].src = url;
  }
  FileTrack.prototype.start = function () {
    if (this.failed || this.playing) return;
    this.playing = true;
    const el = this.els[this.cur];
    el.volume = 0; el.currentTime = 0;
    const p = el.play(); if (p && p.catch) p.catch(function () { /* se reintenta al desbloquear */ });
  };
  FileTrack.prototype.stop = function () {
    this.playing = false;
    this.els.forEach(function (el) { el.pause(); });
  };
  FileTrack.prototype.tick = function (dt, vol) {
    // fundido de entrada/salida de todo el tema
    this.fade += Math.sign(this.target - this.fade) * Math.min(Math.abs(this.target - this.fade), dt / XFADE * 1.5);
    if (this.target === 0 && this.fade <= 0.001 && this.playing) this.stop();
    if (!this.playing) return;
    const a = this.els[this.cur], b = this.els[1 - this.cur];
    if (a.paused && a.currentTime === 0 && !a.ended) { const p = a.play(); if (p && p.catch) p.catch(function () {}); }
    let fa = 1, fb = 0;
    const d = a.duration;
    if (d && isFinite(d) && d > XFADE * 3) {
      const left = d - a.currentTime;
      if (left < XFADE) {
        if (b.paused) { if (!b.src) b.src = this.url; b.currentTime = 0; const p = b.play(); if (p && p.catch) p.catch(function () {}); }
        fa = Math.max(0, left / XFADE); fb = 1 - fa;
      }
      if (a.ended || left <= 0.05) { a.pause(); this.cur = 1 - this.cur; fa = fb; fb = 0; }
    } else if (a.ended) { a.currentTime = 0; a.play(); }
    const v = Math.max(0, Math.min(1, vol * this.fade));
    this.els[this.cur].volume = Math.max(0, Math.min(1, v * fa));
    const other = this.els[1 - this.cur];
    if (!other.paused) other.volume = Math.max(0, Math.min(1, v * fb));
  };

  // ---------------- Música procedural de respaldo ----------------
  const NOTE = function (n) { return 440 * Math.pow(2, (n - 69) / 12); };
  const SONGS = {
    // Tema de menú: tranquilo, pads + arpegio
    menu: { bpm: 84, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], drums: false,
      lead: [76, -1, 74, 72, -1, 69, -1, -1, 72, -1, 71, 67, -1, -1, -1, -1] },
    // Tema de partida: más rápido, con batería, bajo y riff
    match: { bpm: 124, chords: [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]], drums: true,
      lead: [74, -1, 77, 74, 72, -1, 69, -1, 70, -1, 72, -1, 69, -1, 65, -1] }
  };
  function Synth(ctx, out, song) { this.ctx = ctx; this.out = out; this.song = song; this.step = 0; this.next = 0; this.gain = ctx.createGain(); this.gain.gain.value = 0; this.gain.connect(out); this.fade = 0; this.target = 0; this.noise = null; }
  Synth.prototype.noiseBuf = function () {
    if (this.noise) return this.noise;
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return (this.noise = b);
  };
  Synth.prototype.tone = function (t, freq, dur, type, vol, attack, cutoff) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    let node = o;
    if (cutoff) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; o.connect(f); node = f; }
    node.connect(g); g.connect(this.gain);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + (attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t); o.stop(t + dur + 0.05);
  };
  Synth.prototype.drum = function (t, kind) {
    const c = this.ctx;
    if (kind === 'kick') {
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18);
      g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      o.connect(g); g.connect(this.gain); o.start(t); o.stop(t + 0.3);
    } else {
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noiseBuf();
      f.type = kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'hat' ? 7000 : 1800;
      const v = kind === 'hat' ? 0.06 : 0.22, d = kind === 'hat' ? 0.05 : 0.16;
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      s.connect(f); f.connect(g); g.connect(this.gain); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.02);
    }
  };
  Synth.prototype.tick = function (dt, vol) {
    this.fade += Math.sign(this.target - this.fade) * Math.min(Math.abs(this.target - this.fade), dt / XFADE * 1.5);
    this.gain.gain.value = vol * this.fade * 0.6;
    if (this.fade <= 0.001 && this.target === 0) { this.next = 0; return; }
    const c = this.ctx, sp = 60 / this.song.bpm / 4, song = this.song;
    if (!this.next || this.next < c.currentTime) this.next = c.currentTime + 0.05;
    while (this.next < c.currentTime + 0.2) {
      const t = this.next, st = this.step, bar = Math.floor(st / 16) % song.chords.length, ch = song.chords[bar], i = st % 16;
      if (i === 0) for (const n of ch) this.tone(t, NOTE(n), sp * 16, 'sawtooth', 0.035, song.drums ? 0.05 : 0.6, song.drums ? 1400 : 900);
      if (song.drums) {
        if (i % 4 === 0) this.drum(t, 'kick');
        if (i === 4 || i === 12) this.drum(t, 'snare');
        if (i % 2 === 0) this.drum(t, 'hat');
        if (i % 2 === 0) this.tone(t, NOTE(ch[0] - 24), sp * 1.8, 'sawtooth', 0.12, 0.005, 500);
        if ((Math.floor(st / 64) % 2) === 1 && song.lead[i] > 0) this.tone(t, NOTE(song.lead[i]), sp * 1.8, 'square', 0.045, 0.01, 2500);
      } else {
        if (i % 2 === 0) this.tone(t, NOTE(ch[(i / 2) % 3] + 12 + (i >= 8 ? 12 : 0)), sp * 3, 'triangle', 0.07, 0.01);
        if ((Math.floor(st / 64) % 2) === 1 && song.lead[i] > 0) this.tone(t, NOTE(song.lead[i]), sp * 6, 'sine', 0.08, 0.04);
      }
      this.next += sp; this.step++;
    }
  };

  // ---------------- Gestor ----------------
  const A = M.Audio = {
    ctx: null, master: null, sfxBus: null, musicBus: null, scene: null,
    tracks: {}, synths: {}, listener: null, lastSfx: {}, using: {},
    init: function () {
      const files = M.MUSIC_FILES || {};
      for (const k of ['menu', 'match']) if (files[k]) this.tracks[k] = new FileTrack(baseDir() + files[k]);
      const self = this;
      const unlock = function () { self.unlock(); };
      window.addEventListener('pointerdown', unlock, true);
      window.addEventListener('keydown', unlock, true);
      setInterval(function () { self.tick(0.1); }, 100);
      if (M.Settings) M.Settings.on(function () { self.tick(0); });
    },
    unlock: function () {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
        this.sfxBus = this.ctx.createGain(); this.sfxBus.connect(this.master);
        this.musicBus = this.ctx.createGain(); this.musicBus.connect(this.master);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.unlocked = true;
      // reintenta los <audio> que el navegador frenó por autoplay
      for (const k in this.tracks) { const tr = this.tracks[k]; if (tr.playing) { const el = tr.els[tr.cur]; if (el.paused) { const p = el.play(); if (p && p.catch) p.catch(function () {}); } } }
    },
    /** 'menu' | 'match' | null */
    setScene: function (s) { this.scene = s; this.tick(0); },
    /** Qué fuente suena para cada escena: 'archivo', 'generada' o 'silencio' (para tests/README). */
    source: function (s) { const tr = this.tracks[s]; return tr && !tr.failed ? 'archivo' : 'generada'; },
    tick: function (dt) {
      const vol = musicVol();
      for (const k of ['menu', 'match']) {
        const want = this.scene === k, tr = this.tracks[k];
        const useFile = tr && !tr.failed;
        if (useFile) {
          tr.target = want ? 1 : 0;
          if (want && !tr.playing && this.unlocked) tr.start();
          tr.tick(dt, vol);
        }
        if (this.ctx) {
          if (!this.synths[k]) this.synths[k] = new Synth(this.ctx, this.musicBus, SONGS[k]);
          const sy = this.synths[k];
          sy.target = want && !useFile ? 1 : 0;
          sy.tick(dt, vol);
        }
        this.using[k] = useFile ? 'archivo' : 'generada';
      }
      if (this.sfxBus) this.sfxBus.gain.value = sfxVol();
    },

    // ---------------- Efectos ----------------
    /** Efecto en una posición del mundo (se atenúa con la distancia a la cámara). */
    sfxAt: function (name, x, y, opts) {
      let g = 1;
      if (this.listener && x != null) {
        const d = Math.hypot(x - this.listener.x, y - this.listener.y);
        g = Math.max(0, 1 - d / 2400);
        if (g <= 0.02) return;
      }
      this.sfx(name, Object.assign({ gain: g }, opts || {}));
    },
    sfx: function (name, opts) {
      if (!this.ctx || this.ctx.state !== 'running' || sfxVol() <= 0) return;
      const now = this.ctx.currentTime;
      if (this.lastSfx[name] && now - this.lastSfx[name] < 0.06) return;   // anti-saturación
      this.lastSfx[name] = now;
      const c = this.ctx, o = opts || {}, G = (o.gain != null ? o.gain : 1);
      const out = c.createGain(); out.gain.value = G; out.connect(this.sfxBus);
      const tone = function (t, f0, f1, dur, type, vol) {
        const os = c.createOscillator(), g = c.createGain();
        os.type = type || 'sine'; os.frequency.setValueAtTime(f0, t); if (f1) os.frequency.exponentialRampToValueAtTime(f1, t + dur);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
        os.connect(g); g.connect(out); os.start(t); os.stop(t + dur + 0.02);
      };
      const noise = function (t, dur, freq, vol, type) {
        const len = Math.ceil(c.sampleRate * dur), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
        s.buffer = b; f.type = type || 'bandpass'; f.frequency.value = freq; g.gain.value = vol;
        s.connect(f); f.connect(g); g.connect(out); s.start(t);
      };
      const t = now + 0.005;
      switch (name) {
        case 'melee': noise(t, 0.12, 900, 0.5); tone(t, 220, 90, 0.1, 'triangle', 0.25); break;
        case 'ranged': tone(t, 900, 300, 0.12, 'triangle', 0.18); noise(t, 0.08, 3000, 0.15, 'highpass'); break;
        case 'tower': tone(t, 160, 50, 0.4, 'sawtooth', 0.3); noise(t, 0.3, 400, 0.4, 'lowpass'); break;
        case 'cast': {
          const base = [440, 520, 600, 330][o.slot || 0] || 440;
          tone(t, base, base * (o.slot === 3 ? 0.5 : 1.8), o.slot === 3 ? 0.5 : 0.22, o.slot === 3 ? 'sawtooth' : 'square', 0.12);
          noise(t, 0.2, 2000, 0.2);
          break;
        }
        case 'boom': tone(t, 120, 35, 0.5, 'sine', 0.6); noise(t, 0.45, 600, 0.6, 'lowpass'); break;
        case 'levelup': [523, 659, 784, 1047].forEach(function (f, i) { tone(t + i * 0.08, f, 0, 0.35, 'triangle', 0.2); }); break;
        case 'buy': tone(t, 1300, 0, 0.12, 'square', 0.1); tone(t + 0.07, 1750, 0, 0.2, 'square', 0.1); break;
        case 'sell': tone(t, 1000, 600, 0.18, 'square', 0.1); break;
        case 'death': tone(t, 300, 60, 0.7, 'sawtooth', 0.2); break;
        case 'kill': [784, 988, 1175].forEach(function (f, i) { tone(t + i * 0.06, f, 0, 0.3, 'square', 0.1); }); break;
        case 'ping': tone(t, 1400, 0, 0.15, 'sine', 0.25); tone(t + 0.12, 1800, 0, 0.2, 'sine', 0.2); break;
        case 'danger': tone(t, 700, 0, 0.12, 'square', 0.15); tone(t + 0.14, 500, 0, 0.18, 'square', 0.15); break;
        case 'error': tone(t, 200, 150, 0.15, 'square', 0.12); break;
        case 'click': tone(t, 1800, 0, 0.03, 'square', 0.06); break;
        // anuncios estilo LoL (cada uno con su "firma")
        case 'ann_kill': [523, 784, 1047, 1568].forEach(function (f, i) { tone(t + i * 0.07, f, 0, 0.4, 'square', 0.12); }); tone(t, 110, 55, 0.5, 'sawtooth', 0.2); break;
        case 'ann_good': [659, 880, 1175].forEach(function (f, i) { tone(t + i * 0.08, f, 0, 0.35, 'triangle', 0.18); }); break;
        case 'ann_bad': [622, 466, 349].forEach(function (f, i) { tone(t + i * 0.1, f, 0, 0.4, 'triangle', 0.18); }); break;
        case 'ann_death': tone(t, 392, 98, 0.9, 'sawtooth', 0.22); tone(t + 0.05, 196, 49, 1.0, 'sine', 0.3); noise(t, 0.5, 300, 0.3, 'lowpass'); break;
        case 'ann_first': tone(t, 98, 40, 0.8, 'sawtooth', 0.3); noise(t, 0.4, 500, 0.4, 'lowpass'); [440, 554, 659, 880].forEach(function (f, i) { tone(t + 0.15 + i * 0.09, f, 0, 0.45, 'square', 0.12); }); break;
        case 'ann_multi': [523, 659, 784, 1047, 1319, 1568].forEach(function (f, i) { tone(t + i * 0.05, f, 0, 0.3, 'square', 0.11); }); tone(t, 80, 40, 0.6, 'sawtooth', 0.3); break;
        case 'ann_tower': tone(t, 140, 35, 0.9, 'sawtooth', 0.3); noise(t, 0.8, 400, 0.5, 'lowpass'); break;
        case 'ann_ace': [392, 523, 659, 784, 1047].forEach(function (f, i) { tone(t + i * 0.1, f, 0, 0.6, 'triangle', 0.18); }); break;
        case 'ann_alert': for (let i = 0; i < 3; i++) tone(t + i * 0.18, 880, 660, 0.14, 'square', 0.14); break;
      }
    }
  };
})(window.MOBA);
