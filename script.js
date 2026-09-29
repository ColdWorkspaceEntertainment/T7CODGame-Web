const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* =========================================================
   DİL SİSTEMİ
   Metinler ["English", "Türkçe"] şeklinde yazılır.
   ========================================================= */
let lang = "en";
try { lang = localStorage.getItem("7cod-lang") || "en"; } catch (e) {}
const t = x => Array.isArray(x) ? x[lang === "tr" ? 1 : 0] : (x || "");

const UI = {
  gate:      ["Click to start", "Başlamak için tıkla"],
  gateHint:  ["Best played with sound", "Sesli oynamanız önerilir"],
  skip:      ["Click to skip", "Geçmek için tıkla"],
  play:      ["PLAY", "OYNA"],
  newGame:   ["NEW GAME", "YENİ OYUN"],
  cont:      ["CONTINUE", "DEVAM ET"],
  advance:   ["Continue", "Devam et"],
  hint:      ["Show hint", "İpucu göster"],
  wrong:     ["That's not it.", "Bu değil."],
  right:     ["Correct.", "Doğru."],
  seqWrong:  ["The windows go dark again.", "Pencereler yeniden karardı."],
  enter:     ["OK", "OK"],
  mute:      ["Mute", "Sesi kapat"],
  unmute:    ["Unmute", "Sesi aç"]
};

function applyLang() {
  document.documentElement.lang = lang;
  $("gateText").textContent = t(UI.gate);
  $("gateHint").textContent = t(UI.gateHint);
  $("skip").textContent = t(UI.skip);
  $("continueBtn").textContent = t(UI.cont);
  $("playBtn").textContent = t(Save.get() ? UI.newGame : UI.play);
  $("continueBtn").classList.toggle("on", !!Save.get());
  $("box").setAttribute("aria-label", t(UI.advance));
  $("pzHint").textContent = t(UI.hint);
  document.querySelectorAll("#langSwitch button").forEach(b =>
    b.classList.toggle("active", b.dataset.lang === lang));
}

/* =========================================================
   KAYIT (bölüm/sahne başlarında otomatik)
   ========================================================= */
const Save = {
  key: "7cod-save",
  get() { try { return JSON.parse(localStorage.getItem(this.key)); } catch (e) { return null; } },
  set(d) { try { localStorage.setItem(this.key, JSON.stringify(d)); } catch (e) {} },
  clear() { try { localStorage.removeItem(this.key); } catch (e) {} }
};

/* =========================================================
   SES SİSTEMİ (Web Audio API — sesler kodla üretilir)
   ========================================================= */
const Sound = {
  ctx: null, master: null, drone: null, muted: false,

  init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
  },

  noiseBuffer(seconds) {
    const len = this.ctx.sampleRate * seconds;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  },

  tone(freq, type, start, dur, vol) {
    const t0 = this.ctx.currentTime + start;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },

  boom() {
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(70, t0);
    osc.frequency.exponentialRampToValueAtTime(28, t0 + 2.2);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.7, t0 + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.6);
    osc.connect(g).connect(this.master);
    osc.start(t0); osc.stop(t0 + 2.7);

    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer(1.5);
    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 500;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.25, t0);
    ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
    n.connect(lp).connect(ng).connect(this.master);
    n.start(t0);
  },

  startDrone() {
    if (this.drone) return;
    const t0 = this.ctx.currentTime;
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(1, t0 + 4);
    out.connect(this.master);

    const lp = this.ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 260; lp.Q.value = 4;
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.06; lfoGain.gain.value = 120;
    lfo.connect(lfoGain).connect(lp.frequency);
    lfo.start();

    const oscs = [55, 55.35, 82.4].map(f => {
      const o = this.ctx.createOscillator();
      o.type = "sawtooth"; o.frequency.value = f;
      const g = this.ctx.createGain(); g.gain.value = 0.05;
      o.connect(g).connect(lp);
      o.start();
      return o;
    });
    lp.connect(out);

    const wind = this.ctx.createBufferSource();
    wind.buffer = this.noiseBuffer(4); wind.loop = true;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 400; bp.Q.value = 0.7;
    const wlfo = this.ctx.createOscillator();
    const wlfoG = this.ctx.createGain();
    wlfo.frequency.value = 0.09; wlfoG.gain.value = 250;
    wlfo.connect(wlfoG).connect(bp.frequency); wlfo.start();
    const wg = this.ctx.createGain(); wg.gain.value = 0.05;
    wind.connect(bp).connect(wg).connect(out);
    wind.start();

    this.drone = { out, nodes: [...oscs, lfo, wlfo, wind] };
  },

  stopDrone(sec = 1.2) {
    if (!this.drone) return;
    this.drone.out.gain.setTargetAtTime(0.0001, this.ctx.currentTime, sec / 4);
    const nodes = this.drone.nodes;
    setTimeout(() => nodes.forEach(n => n.stop()), sec * 1000 + 200);
    this.drone = null;
  },

  hover()   { this.tone(660, "sine", 0, 0.25, 0.06); },
  key()     { this.tone(520, "square", 0, 0.08, 0.03); },
  wrong()   { this.tone(110, "sawtooth", 0, 0.35, 0.12); this.tone(104, "sawtooth", 0.05, 0.35, 0.1); },
  success() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, "triangle", i * 0.09, 1.2, 0.1)); },
  tick()    { this.tone(1800, "square", 0, 0.03, 0.04); this.tone(1200, "square", 0.5, 0.03, 0.03); },
  chime()   { [392, 523, 392, 523].forEach((f, i) => this.tone(f, "sine", i * 0.35, 1.4, 0.12)); },

  confirm() {
    [220, 330, 440].forEach((f, i) => this.tone(f, "triangle", i * 0.06, 1.6, 0.12));
    this.boom();
  },

  whoosh() {
    const t0 = this.ctx.currentTime;
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer(2.2);
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.Q.value = 3;
    bp.frequency.setValueAtTime(2400, t0);
    bp.frequency.exponentialRampToValueAtTime(200, t0 + 2);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.1);
    n.connect(bp).connect(g).connect(this.master);
    n.start(t0);
  },

  heartbeat() {
    [0, 0.28].forEach(d => {
      const t0 = this.ctx.currentTime + d;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(60, t0);
      o.frequency.exponentialRampToValueAtTime(35, t0 + 0.2);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.6, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
      o.connect(g).connect(this.master);
      o.start(t0); o.stop(t0 + 0.35);
    });
  },

  door() {
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(90, t0);
    o.frequency.linearRampToValueAtTime(140, t0 + 0.6);
    o.frequency.linearRampToValueAtTime(70, t0 + 1.1);
    const lp = this.ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 700;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.08, t0 + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2);
    o.connect(lp).connect(g).connect(this.master);
    o.start(t0); o.stop(t0 + 1.3);
    this.tone(900, "square", 0, 0.05, 0.05);
  },

  toggleMute() {
    this.muted = !this.muted;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.1);
    return this.muted;
  }
};

/* =========================================================
   HİKAYE
   Satır özellikleri:
     text:    ["English", "Türkçe"]
     speaker: konuşan karakter ("Mira", "Vesper", "???")
     thought: true → iç ses (italik)
     bg:      "street" | "sky" | "red" | "shop" | "roof" | "black"
     fx:      "meteor" | "flash" | "shake"
     sfx:     "boom" | "whoosh" | "heartbeat" | "tick" | "chime" | "door" | "success"
     cycle:   "CYCLE 1 / 7"
     choices: [{ text: [..], goto: "sahne", set: "bayrak" }]
     if / ifNot: "bayrak" → satır sadece bayrak varsa / yoksa gösterilir
     puzzle:  bulmaca nesnesi (aşağıdaki örneklere bak)
     title:   [..] + sub: [..] → bölüm başlık kartı
     goto:    başka sahneye geç
     end:     [..] → bölüm sonu, menüye dön
   ========================================================= */
const STORY = {

  /* ---------------- PROLOG ---------------- */
  prologue: [
    { bg: "street", text: ["World 01. 11:57 PM.", "World 01. Saat 23:57."] },
    { text: ["The streetlights hummed the same tune they always did. Nobody else was outside.",
             "Sokak lambaları her zamanki melodilerini mırıldanıyordu. Dışarıda kimse yoktu."] },
    { thought: true, text: ["Just get home. Don't think about the dream again.",
                            "Sadece eve git. O rüyayı yine düşünme."] },
    { text: ["Then the air changed. It grew heavy, as if the sky were leaning down to listen.",
             "Sonra hava değişti. Ağırlaştı, sanki gökyüzü dinlemek için eğiliyormuş gibi."] },
    { speaker: "???", text: ["Do you hear it too?", "Sen de duyuyor musun?"] },
    { thought: true, text: ["That voice... it came from everywhere at once.",
                            "O ses... aynı anda her yerden geliyordu."] },
    { choices: [
      { text: ["Look up at the sky", "Gökyüzüne bak"], goto: "lookUp" },
      { text: ["Ignore it and keep walking", "Görmezden gel ve yürümeye devam et"], goto: "keepWalking" }
    ]}
  ],

  lookUp: [
    { bg: "sky", text: ["Above the rooftops, a single red line was cutting through the clouds.",
                        "Çatıların üstünde, tek bir kırmızı çizgi bulutları yarıyordu."] },
    { text: ["It wasn't falling from above. It was falling from somewhere else.",
             "Yukarıdan düşmüyordu. Başka bir yerden düşüyordu."] },
    { speaker: "???", text: ["World 93 sends its regards.", "World 93 selamlarını gönderiyor."] },
    { goto: "impact" }
  ],

  keepWalking: [
    { text: ["You kept your eyes on the pavement. Left foot. Right foot.",
             "Gözlerini kaldırımdan ayırmadın. Sol ayak. Sağ ayak."] },
    { speaker: "???", text: ["You've walked this street six times already. Tonight is no different.",
                             "Bu sokakta zaten altı kez yürüdün. Bu gece de farklı değil."] },
    { thought: true, text: ["Six times? What is that supposed to mean—", "Altı kez mi? Bu da ne demek—"] },
    { text: ["The ground beneath your feet began to glow red.",
             "Ayaklarının altındaki zemin kırmızı parlamaya başladı."] },
    { goto: "impact" }
  ],

  impact: [
    { bg: "red", fx: "meteor", sfx: "whoosh", text: ["The sky tore open.", "Gökyüzü yırtıldı."] },
    { bg: "black", fx: "flash", sfx: "boom", text: ["And then, silence.", "Ve sonra, sessizlik."] },
    { text: ["No pain. No sound. Only the feeling of something locking into place, like a door you would never find again.",
             "Ne acı vardı ne ses. Sadece bir şeyin yerine kilitlendiği hissi; bir daha asla bulamayacağın bir kapı gibi."] },
    { cycle: "CYCLE 1 / 7", sfx: "heartbeat", speaker: "???", text: ["Welcome to the cycle.", "Döngüye hoş geldin."] },
    { bg: "street", text: ["You opened your eyes.", "Gözlerini açtın."] },
    { text: ["The streetlights hummed the same tune they always did.",
             "Sokak lambaları her zamanki melodilerini mırıldanıyordu."] },
    { thought: true, text: ["...Wait.", "...Bir dakika."] },
    { sfx: "heartbeat", text: ["World 01. 11:57 PM.", "World 01. Saat 23:57."] },
    { title: ["CHAPTER 1", "BÖLÜM 1"], sub: ["The Same Night", "Aynı Gece"] },
    { goto: "ch1_wake" }
  ],

  /* ---------------- BÖLÜM 1 ---------------- */
  ch1_wake: [
    { bg: "street", cycle: "CYCLE 1 / 7",
      text: ["Same street. Same flickering lamp on the corner. Same cold wind slipping under your collar.",
             "Aynı sokak. Köşede aynı titreyen lamba. Yakandan içeri sızan aynı soğuk rüzgâr."] },
    { thought: true, text: ["It happened. The sky, the light, the silence. It all happened.",
                            "Oldu. Gökyüzü, ışık, sessizlik. Hepsi gerçekten oldu."] },
    { thought: true, text: ["So why am I standing here again?", "O zaman neden yine buradayım?"] },
    { speaker: "???", text: ["Because the world forgot how to move forward.",
                             "Çünkü dünya ileriye gitmeyi unuttu."] },
    { text: ["The voice again. This time it came from the dark glass of a shop window beside you.",
             "Yine o ses. Bu sefer yanındaki bir vitrinin karanlık camından geliyordu."] },
    { text: ["Your reflection stared back at you. But when you moved, it didn't.",
             "Yansıman sana bakıyordu. Ama sen kıpırdadığında o kıpırdamadı."] },
    { choices: [
      { text: ["\"Who are you?\"", "\"Sen kimsin?\""], goto: "ch1_who" },
      { text: ["\"What did you do to me?\"", "\"Bana ne yaptın?\""], goto: "ch1_what" }
    ]}
  ],

  ch1_who: [
    { speaker: "???", text: ["Someone who fell a very long way to find you.",
                             "Seni bulmak için çok uzun bir yoldan düşen biri."] },
    { speaker: "???", text: ["Names can wait. Time is the thing we are short on.",
                             "İsimler bekleyebilir. Şu an eksik olan şey zaman."] },
    { goto: "ch1_explain" }
  ],

  ch1_what: [
    { speaker: "???", text: ["Nothing. I am the reason you remember. That is not the same thing.",
                             "Hiçbir şey. Hatırlamanın sebebi benim. Bu aynı şey değil."] },
    { speaker: "???", text: ["Everyone else in World 01 starts over clean. You don't. You're welcome.",
                             "World 01'deki herkes tertemiz baştan başlıyor. Sen başlamıyorsun. Rica ederim."] },
    { goto: "ch1_explain" }
  ],

  ch1_explain: [
    { speaker: "???", text: ["Listen. At midnight, the meteor from World 93 strikes, and the world falls back to 11:57. Over and over.",
                             "Dinle. Gece yarısı World 93'ten gelen meteor çarpıyor ve dünya 23:57'ye geri düşüyor. Tekrar tekrar."] },
    { speaker: "???", text: ["But the cycle is not endless. Every reset tightens the lock. After the seventh, it never opens again.",
                             "Ama döngü sonsuz değil. Her sıfırlanma kilidi biraz daha sıkıyor. Yedincisinden sonra bir daha asla açılmıyor."] },
    { thought: true, text: ["Seven cycles. And one is already gone.", "Yedi döngü. Ve biri çoktan gitti."] },
    { speaker: "???", text: ["There are anchors hidden in this world. Pieces of how things were before. Find them, and the lock weakens.",
                             "Bu dünyada saklı çapalar var. Her şeyin eskiden nasıl olduğuna dair parçalar. Onları bulursan kilit zayıflar."] },
    { speaker: "???", text: ["The first one is close. Behind you.", "İlki yakın. Arkanda."] },
    { text: ["You turned. Across the street stood an old clock shop, its sign half eaten by rust: ELDEN CLOCKWORKS.",
             "Arkanı döndün. Karşıda eski bir saat dükkânı duruyordu, tabelasını pas yarı yarıya yemişti: ELDEN CLOCKWORKS."] },
    { text: ["The lights inside were off. A small keypad glowed beside the door.",
             "İçerideki ışıklar kapalıydı. Kapının yanında küçük bir tuş takımı parlıyordu."] },
    { speaker: "???", text: ["The code is the moment your world stopped. Write it the way a clock that never sleeps would.",
                             "Şifre, dünyanın durduğu an. Onu hiç uyumayan bir saatin yazacağı gibi yaz."] },
    { puzzle: {
        type: "keypad", answer: "2357",
        title: ["Door Keypad", "Kapı Tuş Takımı"],
        clue: ["The moment the world stopped, written the way a clock that never sleeps would.",
               "Dünyanın durduğu an, hiç uyumayan bir saatin yazacağı gibi."],
        hint: ["A clock that never sleeps counts all 24 hours. 11 PM is not 11.",
               "Hiç uyumayan bir saat 24 saatin hepsini sayar. Akşam 11, 11 değildir."]
    }},
    { sfx: "door", text: ["Click. The lock gave way, and the door swung open with a tired groan.",
                          "Klik. Kilit açıldı ve kapı yorgun bir gıcırtıyla aralandı."] },
    { goto: "ch1_shop" }
  ],

  ch1_shop: [
    { bg: "shop", sfx: "tick",
      text: ["Inside, hundreds of clocks covered the walls. Every single one of them was ticking.",
             "İçeride yüzlerce saat duvarları kaplıyordu. Hepsi tek tek tıkırdıyordu."] },
    { text: ["And every single one of them showed 11:58.", "Ve hepsi 23:58'i gösteriyordu."] },
    { speaker: "Mira", text: ["Don't move. I have a screwdriver and I'm not afraid to use it.",
                              "Kıpırdama. Elimde tornavida var ve kullanmaktan korkmam."] },
    { text: ["A girl stepped out from behind the counter, holding the screwdriver like a sword. Her apron was covered in tiny gears.",
             "Tezgâhın arkasından bir kız çıktı, tornavidayı kılıç gibi tutuyordu. Önlüğü minik dişlilerle kaplıydı."] },
    { speaker: "Mira", text: ["How did you get the code? Only Grandpa and I know it.",
                              "Şifreyi nereden bildin? Onu sadece dedemle ben biliyoruz."] },
    { choices: [
      { text: ["\"The voice in the glass told me.\"", "\"Camdaki ses söyledi.\""], goto: "ch1_truth" },
      { text: ["\"Lucky guess.\"", "\"Şansıma tuttu.\""], goto: "ch1_lie" }
    ]}
  ],

  ch1_truth: [
    { speaker: "Mira", text: ["...The voice in the glass.", "...Camdaki ses."] },
    { text: ["She lowered the screwdriver slowly.", "Tornavidayı yavaşça indirdi."] },
    { speaker: "Mira", text: ["I thought I was the only one who heard it.",
                              "Onu duyan tek kişinin ben olduğumu sanıyordum."] },
    { goto: "ch1_mira" }
  ],

  ch1_lie: [
    { speaker: "Mira", text: ["Nobody guesses 2357 by luck.", "Kimse 2357'yi şansla tutturamaz."] },
    { text: ["She studied your face for a long moment.", "Uzun bir süre yüzünü inceledi."] },
    { speaker: "Mira", text: ["Unless... you heard it too. The voice.", "Tabii eğer... sen de duymadıysan. O sesi."] },
    { goto: "ch1_mira" }
  ],

  ch1_mira: [
    { speaker: "Mira", text: ["I'm Mira. This is my grandfather's shop. He's... not here anymore.",
                              "Ben Mira. Burası dedemin dükkânı. O artık... burada değil."] },
    { speaker: "Mira", text: ["Every night I have the same dream. A red sky. Then I wake up at the counter, and it's 11:57 again.",
                              "Her gece aynı rüyayı görüyorum. Kırmızı bir gökyüzü. Sonra tezgâhta uyanıyorum ve saat yine 23:57 oluyor."] },
    { thought: true, text: ["She feels it. She doesn't remember, not like I do, but she feels it.",
                            "Hissediyor. Benim gibi hatırlamıyor, ama hissediyor."] },
    { speaker: "Mira", text: ["Grandpa used to say this shop kept 'the true time.' I never knew what he meant.",
                              "Dedem bu dükkânın 'gerçek zamanı' tuttuğunu söylerdi. Ne demek istediğini hiç anlamadım."] },
    { text: ["She pointed to the back wall, where a tall grandfather clock stood. Its face had no numbers, only five small round windows.",
             "Arka duvarı gösterdi. Orada uzun bir sarkaçlı saat duruyordu. Kadranında rakam yoktu, sadece beş küçük yuvarlak pencere vardı."] },
    { speaker: "Mira", text: ["He never let me touch it. He even had a line engraved on the back of his watch: 'Light is only borrowed.'",
                              "Ona dokunmama asla izin vermezdi. Kol saatinin arkasına bile bir cümle kazıtmıştı: 'Işık sadece ödünçtür.'"] },
    { speaker: "Mira", text: ["And in his notebook, there's just one sentence about the clock.",
                              "Defterinde de saat hakkında tek bir cümle var."] },
    { speaker: "Mira", text: ["'Wake the moon from nothing to whole.'", "'Ayı hiçlikten bütüne uyandır.'"] },
    { speaker: "???", text: ["Hurry. Midnight does not wait.", "Acele et. Gece yarısı beklemez."] },
    { puzzle: {
        type: "sequence",
        items: ["🌔", "🌑", "🌕", "🌒", "🌓"],
        order: ["🌑", "🌒", "🌓", "🌔", "🌕"],
        title: ["The Grandfather Clock", "Sarkaçlı Saat"],
        clue: ["Wake the moon from nothing to whole.", "Ayı hiçlikten bütüne uyandır."],
        hint: ["Start with the darkest moon and let the light grow until it's full.",
               "En karanlık aydan başla, ışık dolunaya kadar büyüsün."]
    }},
    { sfx: "chime", text: ["The last window lit up. Deep inside the clock, a mechanism unlocked with a heavy, satisfied clunk.",
                           "Son pencere de aydınlandı. Saatin derinliklerinde bir mekanizma ağır ve tatmin olmuş bir sesle açıldı."] },
    { text: ["The clock face swung open like a small door. Inside, resting on velvet, lay a shard of glass glowing faintly red.",
             "Kadran küçük bir kapı gibi açıldı. İçeride, kadifenin üstünde, hafifçe kırmızı parlayan bir cam parçası duruyordu."] },
    { speaker: "Mira", text: ["That's... the same color as the sky in my dream.", "Bu... rüyamdaki gökyüzüyle aynı renk."] },
    { speaker: "???", text: ["An anchor. Take it. Quickly.", "Bir çapa. Al onu. Çabuk."] },
    { text: ["You reached for the shard.", "Parçaya uzandın."] },
    { sfx: "chime", text: ["Every clock on the walls struck at once.", "Duvardaki bütün saatler aynı anda çaldı."] },
    { bg: "red", fx: "flash", sfx: "boom", text: ["Midnight.", "Gece yarısı."] },
    { bg: "black", text: ["Your fingers closed around nothing.", "Parmakların boşluğu kavradı."] },
    { cycle: "CYCLE 2 / 7", sfx: "heartbeat", speaker: "???", text: ["Too slow.", "Çok yavaş."] },
    { goto: "ch1_cycle2" }
  ],

  ch1_cycle2: [
    { bg: "street", cycle: "CYCLE 2 / 7", text: ["World 01. 11:57 PM.", "World 01. Saat 23:57."] },
    { thought: true, text: ["Again. The shard was right there. I almost had it.",
                            "Yine. Parça tam oradaydı. Neredeyse elimdeydi."] },
    { speaker: "???", text: ["Nothing crosses a reset except memory. You must claim the anchor before the strike.",
                             "Sıfırlanmadan hafızadan başka hiçbir şey geçemez. Çapayı çarpmadan önce almalısın."] },
    { speaker: "???", text: ["You know the way now. Use what you remember.",
                             "Artık yolu biliyorsun. Hatırladıklarını kullan."] },
    { text: ["You crossed the street, typed 2357 without thinking, and pushed the door open.",
             "Karşıya geçtin, hiç düşünmeden 2357'yi tuşladın ve kapıyı ittin."] },
    { bg: "shop", sfx: "tick", speaker: "Mira",
      text: ["Don't move. I have a screwdriver and I'm not afraid to—", "Kıpırdama. Elimde tornavida var ve kullanmaktan kork—"] },
    { thought: true, text: ["She doesn't remember me. Of course she doesn't.",
                            "Beni hatırlamıyor. Tabii ki hatırlamıyor."] },
    { thought: true, text: ["I need her to trust me, and fast. Something only she would know...",
                            "Bana güvenmesi lazım, hem de hızlı. Sadece onun bileceği bir şey..."] },
    { puzzle: {
        type: "memory",
        title: ["Earn Her Trust", "Güvenini Kazan"],
        clue: ["What was engraved on the back of her grandfather's watch?",
               "Dedesinin kol saatinin arkasında ne yazıyordu?"],
        options: [
          ["Time is only borrowed.", "Zaman sadece ödünçtür."],
          ["Light is only borrowed.", "Işık sadece ödünçtür."],
          ["Wake the moon from nothing to whole.", "Ayı hiçlikten bütüne uyandır."],
          ["This shop keeps the true time.", "Bu dükkân gerçek zamanı tutar."]
        ],
        correct: 1,
        hint: ["Mira mentioned it right before she talked about the notebook.",
               "Mira bunu defterden bahsetmeden hemen önce söylemişti."]
    }},
    { text: ["\"Light is only borrowed,\" you said. \"It's on the back of your grandfather's watch.\"",
             "\"Işık sadece ödünçtür,\" dedin. \"Dedenin saatinin arkasında yazıyor.\""] },
    { text: ["The screwdriver slipped from her hand and clattered across the floor.",
             "Tornavida elinden kayıp yere çarptı."] },
    { speaker: "Mira", text: ["Nobody knows that. Nobody. Who are you?", "Bunu kimse bilmiyor. Kimse. Sen kimsin?"] },
    { choices: [
      { text: ["\"Someone who has already lived this night.\"", "\"Bu geceyi zaten yaşamış biri.\""], goto: "ch1_c2a" },
      { text: ["\"A friend. I'll explain everything, but we have three minutes.\"",
               "\"Bir dost. Her şeyi anlatacağım ama üç dakikamız var.\""], goto: "ch1_c2b" }
    ]}
  ],

  ch1_c2a: [
    { speaker: "Mira", text: ["...The dream. The red sky. It isn't a dream, is it?",
                              "...Rüya. Kırmızı gökyüzü. Rüya değil, değil mi?"] },
    { thought: true, text: ["She's quicker than I expected.", "Beklediğimden hızlı kavrıyor."] },
    { goto: "ch1_c2" }
  ],

  ch1_c2b: [
    { speaker: "Mira", text: ["Three minutes until what?", "Neye üç dakika?"] },
    { text: ["You glanced at the walls. Every clock read 11:58.", "Duvarlara baktın. Bütün saatler 23:58'i gösteriyordu."] },
    { speaker: "Mira", text: ["...Until the red sky. Right?", "...Kırmızı gökyüzüne kadar. Değil mi?"] },
    { goto: "ch1_c2" }
  ],

  ch1_c2: [
    { sfx: "chime", text: ["You opened the clock without a word. Darkest moon to brightest. The face swung open.",
                           "Hiç konuşmadan saati açtın. En karanlık aydan en parlağa. Kadran açıldı."] },
    { text: ["This time, your hand closed around the shard.", "Bu sefer elin parçayı kavradı."] },
    { text: ["It was warm. Far warmer than glass should ever be. Faint letters crawled across its surface.",
             "Sıcaktı. Bir camın olabileceğinden çok daha sıcak. Yüzeyinde soluk harfler kıpırdıyordu."] },
    { speaker: "Mira", text: ["That's Grandpa's cipher! He used to leave me notes like this.",
                              "Bu dedemin şifresi! Bana böyle notlar bırakırdı."] },
    { speaker: "Mira", text: ["He always said: 'Every letter takes three steps back home.'",
                              "Hep şöyle derdi: 'Her harf eve üç adım geri döner.'"] },
    { puzzle: {
        type: "cipher",
        code:   ["DQFKRU", "FDSD"],
        answer: [["ANCHOR"], ["CAPA", "ÇAPA"]],
        title: ["The Shard", "Cam Parçası"],
        clue: ["Every letter takes three steps back home.", "Her harf eve üç adım geri döner."],
        hint: ["Move each letter three places back in the alphabet. D becomes A.",
               "Her harfi İngiliz alfabesinde üç harf geri al. F, C olur."]
    }},
    { speaker: "Mira", text: ["Anchor...", "Çapa..."] },
    { speaker: "???", text: ["Good. Now the roof. The anchor must meet the sky it was taken from.",
                             "Güzel. Şimdi çatıya. Çapa, alındığı gökyüzüyle buluşmalı."] },
    { speaker: "Mira", text: ["There's a ladder in the back. Come on!", "Arkada bir merdiven var. Hadi!"] },
    { goto: "ch1_roof" }
  ],

  ch1_roof: [
    { bg: "roof", text: ["The wind on the roof was sharp and cold. The whole city lay below, silent and asleep.",
                         "Çatıdaki rüzgâr keskin ve soğuktu. Bütün şehir aşağıda sessiz ve uykuda uzanıyordu."] },
    { sfx: "tick", text: ["11:59.", "23:59."] },
    { text: ["Above you, the red line was already cutting through the clouds.",
             "Tepende kırmızı çizgi çoktan bulutları yarmaya başlamıştı."] },
    { speaker: "Mira", text: ["It's real. It's really real.", "Gerçek. Gerçekten gerçek."] },
    { speaker: "???", text: ["Hold the anchor up. Toward it.", "Çapayı kaldır. Ona doğru."] },
    { choices: [
      { text: ["Raise the shard", "Parçayı kaldır"], goto: "ch1_raise" },
      { text: ["Ask the voice who it really is", "Sese gerçekte kim olduğunu sor"], goto: "ch1_ask", set: "askedName" }
    ]}
  ],

  ch1_ask: [
    { text: ["\"Not until you tell me who you are,\" you said.", "\"Kim olduğunu söylemeden olmaz,\" dedin."] },
    { speaker: "???", text: ["...Stubborn. Good. You will need that.", "...İnatçı. Güzel. Buna ihtiyacın olacak."] },
    { speaker: "Vesper", text: ["My name is Vesper. I came from World 93, the same way the meteor did.",
                                "Adım Vesper. World 93'ten geldim, meteorla aynı yoldan."] },
    { speaker: "Vesper", text: ["I am not your enemy. Now raise the shard, before you lose another cycle.",
                                "Senin düşmanın değilim. Şimdi parçayı kaldır, bir döngü daha kaybetmeden."] },
    { goto: "ch1_raise" }
  ],

  ch1_raise: [
    { bg: "red", fx: "meteor", sfx: "whoosh", text: ["You lifted the shard toward the falling star.",
                                                    "Parçayı düşen yıldıza doğru kaldırdın."] },
    { text: ["The glow in your hand answered the glow in the sky. Red met red.",
             "Elindeki parıltı gökyüzündeki parıltıya cevap verdi. Kırmızı kırmızıyla buluştu."] },
    { fx: "flash", sfx: "boom", text: ["And the world... stopped.", "Ve dünya... durdu."] },
    { bg: "roof", text: ["The meteor hung in the air, frozen, close enough to see the cracks running across its surface.",
                         "Meteor havada asılı kaldı, donmuştu; yüzeyindeki çatlakları görebilecek kadar yakındı."] },
    { sfx: "tick", text: ["Down in the shop, a single clock ticked past midnight. 12:00. 12:01.",
                          "Aşağıda, dükkânda, tek bir saat gece yarısını geçti. 00:00. 00:01."] },
    { speaker: "Mira", text: ["Did we... did we stop it?", "Biz... biz onu durdurduk mu?"] },
    { ifNot: "askedName", speaker: "???", text: ["Not stopped. Held.", "Durmadı. Tutuldu."] },
    { ifNot: "askedName", speaker: "Vesper", text: ["You can call me Vesper, by the way. I came from World 93, the same way the meteor did.",
                                                    "Bu arada bana Vesper diyebilirsin. World 93'ten geldim, meteorla aynı yoldan."] },
    { if: "askedName", speaker: "Vesper", text: ["Not stopped. Held.", "Durmadı. Tutuldu."] },
    { speaker: "Vesper", text: ["One anchor buys this world a single breath. Nothing more.",
                                "Tek bir çapa bu dünyaya sadece bir nefeslik zaman kazandırır. Fazlası değil."] },
    { speaker: "Vesper", text: ["Six anchors remain. And only five cycles. The lock will not wait for you to be ready.",
                                "Altı çapa kaldı. Ve sadece beş döngü. Kilit senin hazır olmanı beklemeyecek."] },
    { speaker: "Mira", text: ["Then we find them. Together.", "O zaman onları buluruz. Birlikte."] },
    { thought: true, text: ["For the first time tonight, the cold didn't feel so heavy.",
                            "Bu gece ilk kez soğuk o kadar ağır gelmedi."] },
    { sfx: "heartbeat", text: ["Above you, very slowly, the cracks in the meteor began to glow again.",
                               "Tepende, çok yavaşça, meteorun çatlakları yeniden parlamaya başladı."] },
    { end: ["CHAPTER 1 — END", "BÖLÜM 1 — SON"], sub: ["To be continued", "Devam edecek"] }
  ]
};

/* =========================================================
   VISUAL NOVEL MOTORU
   ========================================================= */
const VN = {
  scene: null, i: 0, typing: false, full: "", timer: null,
  waiting: false, locked: false, flags: {}, cycle: "", bg: "black",
  speed: 26,

  start(state) {
    this.flags = state.flags || {};
    this.cycle = state.cycle || "";
    this.setBg(state.bg || "black");
    $("cycleTag").textContent = this.cycle;
    $("cycleTag").classList.toggle("on", !!this.cycle);
    $("card").classList.remove("on");
    $("choices").classList.remove("on");
    $("puzzle").classList.remove("on");
    $("box").classList.remove("hidden");
    $("line").textContent = "";
    $("speaker").classList.remove("on");
    this.locked = false; this.waiting = false;
    this.go(state.scene);
  },

  go(scene) {
    this.scene = scene; this.i = 0;
    Save.set({ scene, flags: this.flags, cycle: this.cycle, bg: this.bg });
    this.step();
  },

  setBg(name) { this.bg = name; $("bg").className = "bg " + name; },

  step() {
    const L = STORY[this.scene][this.i];
    if (!L) return;
    if (L.if && !this.flags[L.if]) return this.skip();
    if (L.ifNot && this.flags[L.ifNot]) return this.skip();

    if (L.bg) this.setBg(L.bg);
    if (L.fx) this.effect(L.fx);
    if (L.sfx && Sound[L.sfx]) Sound[L.sfx]();
    if (L.cycle) { this.cycle = L.cycle; $("cycleTag").textContent = L.cycle; $("cycleTag").classList.add("on"); }

    if (L.goto) return this.go(L.goto);
    if (L.end) return this.finish(L);
    if (L.title) return this.titleCard(L);
    if (L.choices) return this.showChoices(L.choices);
    if (L.puzzle) return Puzzle.open(L.puzzle, () => { this.waiting = false; this.skip(); });

    const sp = $("speaker");
    sp.textContent = L.speaker || "";
    sp.className = L.speaker ? "on " + L.speaker.toLowerCase() : "";
    $("line").classList.toggle("thought", !!L.thought);
    this.type(t(L.text));
  },

  skip() { this.i++; this.step(); },

  type(text) {
    clearInterval(this.timer);
    this.full = text; this.typing = true;
    $("next").classList.remove("on");
    const el = $("line"); el.textContent = "";
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return this.completeLine();
    let n = 0;
    this.timer = setInterval(() => {
      el.textContent = text.slice(0, ++n);
      if (n >= text.length) this.completeLine();
    }, this.speed);
  },

  completeLine() {
    clearInterval(this.timer);
    $("line").textContent = this.full;
    this.typing = false;
    $("next").classList.add("on");
  },

  advance() {
    if (this.locked || this.waiting) return;
    if (this.typing) return this.completeLine();
    this.skip();
  },

  showChoices(list) {
    this.waiting = true;
    $("next").classList.remove("on");
    const box = $("choices");
    box.innerHTML = "";
    list.forEach(c => {
      const b = document.createElement("button");
      b.textContent = t(c.text);
      b.addEventListener("mouseenter", () => Sound.hover());
      b.addEventListener("click", () => {
        Sound.hover();
        box.classList.remove("on");
        if (c.set) this.flags[c.set] = true;
        this.waiting = false;
        this.go(c.goto);
      });
      box.appendChild(b);
    });
    box.classList.add("on");
    box.querySelector("button").focus();
  },

  effect(name) {
    const fx = $("fx");
    if (name === "meteor") {
      const d = document.createElement("div"); d.className = "streak"; fx.appendChild(d);
      setTimeout(() => d.remove(), 2000);
    }
    if (name === "flash") {
      const d = document.createElement("div"); d.className = "flash"; fx.appendChild(d);
      setTimeout(() => d.remove(), 1300);
      name = "shake";
    }
    if (name === "shake") {
      const g = $("game"); g.classList.remove("shake"); void g.offsetWidth; g.classList.add("shake");
    }
  },

  async titleCard(L) {
    this.locked = true;
    $("box").classList.add("hidden");
    $("cardTitle").textContent = t(L.title);
    $("cardSub").textContent = t(L.sub);
    await sleep(600);
    Sound.boom();
    $("card").classList.add("on");
    await sleep(4200);
    $("card").classList.remove("on");
    await sleep(1200);
    $("line").textContent = "";
    $("speaker").classList.remove("on");
    $("box").classList.remove("hidden");
    this.locked = false;
    this.skip();
  },

  async finish(L) {
    this.locked = true;
    Save.clear();
    $("box").classList.add("hidden");
    $("cardTitle").textContent = t(L.end);
    $("cardSub").textContent = t(L.sub);
    $("card").classList.add("on");
    Sound.stopDrone(2);
    await sleep(5000);
    $("fade").classList.add("on");
    await sleep(1100);
    $("game").classList.remove("show");
    $("card").classList.remove("on");
    this.locked = false;
    applyLang();
    openMenu();
    $("fade").classList.remove("on");
  }
};

/* =========================================================
   BULMACA SİSTEMİ
   type: "keypad" | "sequence" | "memory" | "cipher"
   ========================================================= */
const Puzzle = {
  data: null, done: null, fails: 0,

  open(p, done) {
    this.data = p; this.done = done; this.fails = 0;
    VN.waiting = true;
    $("pzTitle").textContent = t(p.title);
    $("pzClue").textContent = t(p.clue);
    $("pzMsg").textContent = ""; $("pzMsg").className = "";
    $("pzHint").style.display = "inline-block";
    const body = $("pzBody"); body.innerHTML = "";
    this[p.type](body, p);
    $("puzzle").classList.add("on");
    const first = body.querySelector("button, input");
    if (first) first.focus();
  },

  fail(msg) {
    this.fails++;
    Sound.wrong();
    const m = $("pzMsg"); m.textContent = t(msg || UI.wrong); m.className = "bad";
    const card = document.querySelector(".pz-card");
    card.classList.remove("wrong"); void card.offsetWidth; card.classList.add("wrong");
    if (this.fails >= 3) this.showHint();
  },

  showHint() {
    const m = $("pzMsg"); m.textContent = t(this.data.hint); m.className = "";
    $("pzHint").style.display = "none";
  },

  async solve() {
    Sound.success();
    const m = $("pzMsg"); m.textContent = t(UI.right); m.className = "good";
    await sleep(1100);
    $("puzzle").classList.remove("on");
    this.done();
  },

  keypad(body, p) {
    let input = "";
    const len = p.answer.length;
    body.innerHTML = `<div class="kp-display">${"<span></span>".repeat(len)}</div><div class="kp-grid"></div>`;
    const slots = body.querySelectorAll(".kp-display span");
    const draw = () => slots.forEach((s, i) => s.textContent = input[i] || "");
    const grid = body.querySelector(".kp-grid");
    ["1","2","3","4","5","6","7","8","9","←","0","OK"].forEach(k => {
      const b = document.createElement("button");
      b.className = "pz-btn" + (k === "OK" ? " ok" : "");
      b.textContent = k;
      b.addEventListener("click", () => press(k));
      grid.appendChild(b);
    });
    const press = k => {
      Sound.key();
      if (k === "←") input = input.slice(0, -1);
      else if (k === "OK") {
        if (input === p.answer) return this.solve();
        input = ""; this.fail();
      }
      else if (input.length < len) input += k;
      draw();
    };
    body.tabIndex = -1;
    body.onkeydown = e => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("←");
      else if (e.key === "Enter") { e.preventDefault(); press("OK"); }
    };
  },

  sequence(body, p) {
    let step = 0;
    body.innerHTML = `<div class="seq-row"></div><div class="seq-progress">${"<i></i>".repeat(p.order.length)}</div>`;
    const row = body.querySelector(".seq-row");
    const dots = body.querySelectorAll(".seq-progress i");
    const btns = p.items.map(sym => {
      const b = document.createElement("button");
      b.className = "pz-btn"; b.textContent = sym;
      b.addEventListener("click", () => {
        if (b.classList.contains("lit")) return;
        if (sym === p.order[step]) {
          Sound.tone(300 + step * 90, "sine", 0, 0.6, 0.1);
          b.classList.add("lit"); dots[step].classList.add("on"); step++;
          if (step === p.order.length) this.solve();
        } else {
          step = 0;
          btns.forEach(x => x.classList.remove("lit"));
          dots.forEach(d => d.classList.remove("on"));
          this.fail(UI.seqWrong);
        }
      });
      row.appendChild(b);
      return b;
    });
  },

  memory(body, p) {
    body.innerHTML = `<div class="mem-list"></div>`;
    const list = body.querySelector(".mem-list");
    p.options.forEach((o, i) => {
      const b = document.createElement("button");
      b.className = "pz-btn"; b.textContent = t(o);
      b.addEventListener("click", () => {
        if (i === p.correct) this.solve();
        else { b.disabled = true; b.style.opacity = .35; this.fail(); }
      });
      list.appendChild(b);
    });
  },

  cipher(body, p) {
    body.innerHTML = `<div class="ci-code"></div>
      <form class="ci-form"><input type="text" autocomplete="off" spellcheck="false" aria-label="Answer"><button class="pz-btn ok" type="submit"></button></form>`;
    body.querySelector(".ci-code").textContent = t(p.code);
    body.querySelector(".ci-form button").textContent = t(UI.enter);
    const input = body.querySelector("input");
    body.querySelector(".ci-form").addEventListener("submit", e => {
      e.preventDefault();
      const v = input.value.trim().toLocaleUpperCase(lang === "tr" ? "tr-TR" : "en-US").replace(/\s+/g, "");
      if (t(p.answer).includes(v)) this.solve();
      else { input.select(); this.fail(); }
    });
  }
};

$("pzHint").addEventListener("click", () => Puzzle.showHint());

/* =========================================================
   AKIŞ: Başlat → Intro → Ana Menü → Oyun
   ========================================================= */
const INTRO = [
  "A Cold Works Production Project",
  "Music: CW PLAY Music",
  "Created by Claude.AI"
];
let introDone = false;

function startGame() {
  if (Sound.ctx) return;
  Sound.init();
  $("gate").classList.remove("show");
  $("intro").classList.add("show");
  $("muteBtn").classList.add("show");
  $("intro").focus();
  runIntro();
}

async function runIntro() {
  await sleep(800);
  for (const line of INTRO) {
    if (introDone) return;
    const el = $("introText");
    el.textContent = line;
    el.classList.add("on");
    Sound.boom();
    await sleep(2400);
    if (introDone) return;
    el.classList.remove("on");
    await sleep(1200);
  }
  showMenu();
}

function showMenu() {
  if (introDone) return;
  introDone = true;
  $("intro").classList.remove("show");
  openMenu();
}

function openMenu() {
  applyLang();
  $("menu").classList.add("show");
  requestAnimationFrame(() => requestAnimationFrame(() => $("menu").classList.add("visible")));
  Sound.startDrone();
  ($("continueBtn").classList.contains("on") ? $("continueBtn") : $("playBtn")).focus({ preventScroll: true });
}

async function enterGame(state) {
  document.querySelectorAll(".menu-btn").forEach(b => b.disabled = true);
  Sound.confirm();
  Sound.stopDrone(1.2);
  $("fade").classList.add("on");
  await sleep(1300);
  $("menu").classList.remove("show", "visible");
  $("game").classList.add("show");
  VN.start(state);
  await sleep(300);
  $("fade").classList.remove("on");
  Sound.startDrone();
  document.querySelectorAll(".menu-btn").forEach(b => b.disabled = false);
  $("box").focus({ preventScroll: true });
}

/* Logo yüklenemezse yazılı başlık göster */
$("logoImg").addEventListener("error", () => $("logoBox").classList.add("fallback"));

/* Olaylar */
$("gate").addEventListener("click", startGame);
$("gate").addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") startGame(); });

$("intro").addEventListener("click", showMenu);
$("intro").addEventListener("keydown", e => { if (["Enter", " ", "Escape"].includes(e.key)) showMenu(); });

document.querySelectorAll(".menu-btn").forEach(b => b.addEventListener("mouseenter", () => Sound.hover()));
$("playBtn").addEventListener("click", () => { Save.clear(); enterGame({ scene: "prologue" }); });
$("continueBtn").addEventListener("click", () => { const s = Save.get(); if (s) enterGame(s); });

document.querySelectorAll("#langSwitch button").forEach(b => b.addEventListener("click", () => {
  lang = b.dataset.lang;
  try { localStorage.setItem("7cod-lang", lang); } catch (e) {}
  if (Sound.ctx) Sound.hover();
  applyLang();
}));

$("meteor").addEventListener("animationstart", () => Sound.whoosh());
$("meteor").addEventListener("animationiteration", () => Sound.whoosh());

$("box").addEventListener("click", () => VN.advance());
document.addEventListener("keydown", e => {
  if (!$("game").classList.contains("show")) return;
  if ($("puzzle").classList.contains("on") || $("choices").classList.contains("on")) return;
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); VN.advance(); }
});

$("muteBtn").addEventListener("click", () => {
  const m = Sound.toggleMute();
  $("muteBtn").classList.toggle("muted", m);
  $("muteBtn").setAttribute("aria-label", t(m ? UI.unmute : UI.mute));
});

applyLang();
$("muteBtn").setAttribute("aria-label", t(UI.mute));
$("gate").focus();
