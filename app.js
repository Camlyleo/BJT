// ================= BJT Dojo — app =================
const EXAM_DATE = new Date(2026, 11, 31, 23, 59);
const KEY = "bjt_dojo_v1";
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const partOf = q => BJT_INFO.types[q.type].part;
const isAudio = q => ["scene", "speech", "listen", "situation", "material", "integrated"].includes(q.type);

// ---------- state ----------
let S;
try { S = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { S = {}; }
S = Object.assign({ stats: {}, plan: {}, known: {}, mocks: [], rate: 1 }, S);
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
function record(q, ok) {
  const st = S.stats[q.id] || { a: 0, c: 0, last: null };
  st.a++; if (ok) st.c++; st.last = ok; S.stats[q.id] = st; save();
}
function acc(filter) {
  let a = 0, c = 0;
  QUESTIONS.filter(filter).forEach(q => { const st = S.stats[q.id]; if (st) { a += st.a; c += st.c; } });
  return { a, c, p: a ? Math.round(c / a * 100) : null };
}
const levelOf = sc => BJT_INFO.levels.find(l => sc >= l.min);

// ---------- TTS (Web Speech API) ----------
const TTS = {
  voices: [],
  init() {
    const load = () => { this.voices = speechSynthesis.getVoices().filter(v => /ja/i.test(v.lang)); };
    if ("speechSynthesis" in window) { load(); speechSynthesis.onvoiceschanged = load; }
  },
  stop() { if ("speechSynthesis" in window) speechSynthesis.cancel(); },
  play(lines, onDone) {
    if (!("speechSynthesis" in window)) { alertBox("Trình duyệt không hỗ trợ đọc giọng nói. Hãy dùng Chrome/Edge."); return; }
    this.stop();
    const vF = this.voices.find(v => /female|Nanami|Haruka|Kyoko|Ayumi|Mizuki/i.test(v.name)) || this.voices[0];
    const vM = this.voices.find(v => /male|Keita|Ichiro|Otoya|Takumi/i.test(v.name) && !/female/i.test(v.name)) || this.voices[1] || this.voices[0];
    lines.forEach(([sp, text], i) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "ja-JP"; u.rate = S.rate;
      const male = sp.startsWith("男");
      u.voice = male ? vM : vF;
      u.pitch = sp === "男2" ? 0.7 : male ? (vM === vF ? 0.75 : 1) : (vM === vF ? 1.25 : 1);
      if (i === lines.length - 1 && onDone) u.onend = onDone;
      speechSynthesis.speak(u);
    });
  }
};
TTS.init();
function audioLines(q) {
  const read = partOf(q) === 1;
  let L = [];
  if (q.type === "scene") L.push(["女", "写真を見てください。"]);
  if (q.type === "speech") L.push(["女", q.q]);
  if (q.script) L = L.concat(q.script);
  if (["listen", "situation", "integrated"].includes(q.type)) L.push(["女", "質問。" + q.q]);
  if (read) q.opts.forEach((o, i) => L.push(["男", `${i + 1}。${o}`]));
  return L;
}
function alertBox(msg) {
  const d = document.createElement("div");
  d.className = "card"; d.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:9;max-width:90%";
  d.textContent = msg; document.body.appendChild(d); setTimeout(() => d.remove(), 3500);
}

// ---------- router ----------
const views = {};
let cleanup = null;
function go(v, arg) {
  TTS.stop(); if (cleanup) { cleanup(); cleanup = null; }
  document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", b.dataset.v === v));
  views[v]($("#app"), arg); window.scrollTo(0, 0);
}
$("#nav").addEventListener("click", e => { const b = e.target.closest("button"); if (b) go(b.dataset.v); });

// ---------- HOME ----------
views.home = el => {
  const days = Math.max(0, Math.ceil((EXAM_DATE - new Date()) / 864e5));
  const all = acc(() => true);
  const last = S.mocks[S.mocks.length - 1];
  const best = S.mocks.reduce((m, x) => Math.max(m, x.score), 0);
  const parts = [1, 2, 3].map(n => ({ ...acc(q => partOf(q) === n), n }));
  const doneTasks = Object.values(S.plan).filter(Boolean).length, totalTasks = PLAN.reduce((n, w) => n + w.tasks.length, 0);
  el.innerHTML = `
  <div class="card hero">
    <div><h1>Mục tiêu: <span style="color:var(--pri)">J1</span> (≥ 530 điểm)</h1>
    <div class="mute">Nền N2+ · Hạn chót cuối tháng 12/2026</div>
    <div class="row" style="margin-top:12px"><button class="btn pri" data-go="practice">▶ Luyện tập</button><button class="btn" data-go="mock">⏱ Thi thử</button><button class="btn" data-go="plan">🗓 Lộ trình</button></div></div>
    <div style="text-align:center"><div class="count">${days}</div><div class="mute">ngày còn lại</div></div>
  </div>
  <div class="grid" style="margin-top:14px">
    <div class="card stat"><div class="n">${all.p ?? "—"}${all.p != null ? "%" : ""}</div><div class="l">Tỉ lệ đúng (${all.a} lượt)</div></div>
    <div class="card stat"><div class="n">${last ? last.score : "—"}</div><div class="l">Thi thử gần nhất ${last ? "· " + levelOf(last.score).name : ""}</div></div>
    <div class="card stat"><div class="n">${best || "—"}</div><div class="l">Điểm cao nhất · cần 530</div><div class="meter" style="margin-top:8px"><i style="width:${Math.min(100, best / 530 * 100)}%"></i></div></div>
    <div class="card stat"><div class="n">${doneTasks}/${totalTasks}</div><div class="l">Nhiệm vụ lộ trình</div><div class="meter" style="margin-top:8px"><i style="width:${doneTasks / totalTasks * 100}%"></i></div></div>
  </div>
  <h2>Theo phần thi</h2>
  <div class="grid">${parts.map(x => `<div class="card"><span class="tag p${x.n}">${BJT_INFO.parts[x.n].name}</span>
    <div class="stat" style="margin-top:8px"><div class="n">${x.p ?? "—"}${x.p != null ? "%" : ""}</div><div class="l">${BJT_INFO.parts[x.n].vi} · ${x.a} lượt</div></div>
    <div class="meter" style="margin-top:8px"><i style="width:${x.p || 0}%"></i></div></div>`).join("")}</div>
  <h2>Cấu trúc đề BJT (CBT)</h2>
  <div class="card scroll"><table class="lv"><tr><th>Phần</th><th>Dạng câu hỏi</th><th>Số câu</th><th>Thời gian</th></tr>
    ${[1, 2, 3].map(p => `<tr><td><span class="tag p${p}">${BJT_INFO.parts[p].name}</span></td><td>${Object.values(BJT_INFO.types).filter(t => t.part === p).map(t => t.jp).join("・")}</td><td>${BJT_INFO.parts[p].count}</td><td>${BJT_INFO.parts[p].time}</td></tr>`).join("")}
    <tr><td colspan="2"><b>Tổng</b></td><td><b>80</b></td><td><b>~105 phút</b></td></tr></table>
    <p class="small mute" style="margin:8px 0 0">Thang điểm 0–800 (IRT), thi CBT tại trung tâm Pearson VUE, đăng ký và thi quanh năm.</p></div>
  <h2>Thang cấp độ</h2>
  <div class="card scroll"><table class="lv">${BJT_INFO.levels.map(l => `<tr class="${l.name === "J1" ? "target" : ""}"><td><b>${l.name}</b></td><td>${l.min}–${l.max}</td><td>${l.desc}</td></tr>`).join("")}</table></div>
  <h2>Tài liệu chính thức</h2>
  <div class="card"><ul style="margin:0;padding-left:18px">
    <li><a href="https://www.kanken.or.jp/bjt/" target="_blank" rel="noopener">Trang chủ BJT (kanken.or.jp/bjt)</a></li>
    <li><a href="https://www.kanken.or.jp/bjt/sample/sample01.html" target="_blank" rel="noopener">Đề mẫu 第1部 聴解</a> · <a href="https://www.kanken.or.jp/bjt/sample/sample02.html" target="_blank" rel="noopener">第2部 聴読解</a> · <a href="https://www.kanken.or.jp/bjt/sample/sample03.html" target="_blank" rel="noopener">第3部 読解</a></li>
    <li>Mục 「テスト体験コーナー(CBT)」 trên trang chủ — làm thử giao diện thi máy thật</li></ul></div>`;
  el.querySelectorAll("[data-go]").forEach(b => b.onclick = () => go(b.dataset.go));
};

// ---------- PLAN ----------
function weekDates(w) {
  const [a, b] = w.range.split("–").map(s => s.trim().split("/").map(Number));
  return [new Date(2026, a[1] - 1, a[0]), new Date(2026, b[1] - 1, b[0], 23, 59)];
}
views.plan = el => {
  const now = new Date();
  el.innerHTML = `<h1>Lộ trình 8 tuần → J1</h1><p class="mute">Đánh dấu khi hoàn thành. Tuần hiện tại được làm nổi bật.</p>` +
    PLAN.map(w => {
      const [s, e] = weekDates(w); const cur = now >= s && now <= e;
      const done = w.tasks.filter((_, i) => S.plan[w.w + "-" + i]).length;
      return `<div class="card week ${cur ? "now" : ""}">
      <div class="row" style="justify-content:space-between"><h3>Tuần ${w.w}: ${w.title} ${cur ? '<span class="tag p1">Tuần này</span>' : ""}</h3><span class="mute small">${w.range} · ${done}/${w.tasks.length}</span></div>
      ${w.tasks.map((t, i) => { const k = w.w + "-" + i; return `<label class="task ${S.plan[k] ? "done" : ""}"><input type="checkbox" data-k="${k}" ${S.plan[k] ? "checked" : ""}><span>${esc(t)}</span></label>`; }).join("")}</div>`;
    }).join("");
  el.querySelectorAll("input[data-k]").forEach(c => c.onchange = () => { S.plan[c.dataset.k] = c.checked; save(); c.parentElement.classList.toggle("done", c.checked); });
};

// ---------- question renderer ----------
function renderQ(box, q, opt) {
  // opt: {mode:'practice'|'mock', chosen, onPick(i), onNext}
  const t = BJT_INFO.types[q.type], p = t.part, audio = isAudio(q);
  const hideOpts = p === 1 && opt.mode === "practice" && opt.chosen == null;
  box.innerHTML = `
    <div class="qhead"><div><span class="tag p${p}">${BJT_INFO.parts[p].name}</span> <span class="tag">${t.jp}</span></div>${opt.head || ""}</div>
    ${q.scene ? `<div class="scene"><div class="ic">${q.scene.icon}</div><div class="d">🖼 ${esc(q.scene.desc)}</div></div>` : ""}
    ${q.doc ? `<div class="doc">${q.doc}</div>` : ""}
    ${q.passage ? `<div class="passage">${q.passage}</div>` : ""}
    ${audio ? `<div class="audio"><button class="btn pri sm" data-a="play">🔊 Nghe</button><button class="btn sm" data-a="stop">■ Dừng</button>
      <label class="small mute">Tốc độ <select data-a="rate">${[0.8, 0.9, 1, 1.1, 1.2].map(r => `<option ${r == S.rate ? "selected" : ""}>${r}</option>`).join("")}</select></label>
      ${hideOpts ? `<button class="btn sm" data-a="reveal">👁 Hiện chữ lựa chọn</button>` : ""}</div>` : ""}
    <div class="qtext">${p === 1 && q.type !== "speech" && q.type !== "scene" ? "質問：" : ""}${esc(q.q)}</div>
    <div class="opts ${hideOpts ? "hidden-opt" : ""}">${q.opts.map((o, i) => `<button class="opt" data-i="${i}"><span class="k">${i + 1}</span><span class="t">${esc(o)}</span></button>`).join("")}</div>
    <div class="fb"></div>`;
  const optsEl = $(".opts", box);
  const btns = [...box.querySelectorAll(".opt")];
  if (audio) {
    $('[data-a="play"]', box).onclick = () => TTS.play(audioLines(q));
    $('[data-a="stop"]', box).onclick = () => TTS.stop();
    $('[data-a="rate"]', box).onchange = e => { S.rate = +e.target.value; save(); };
    const rv = $('[data-a="reveal"]', box); if (rv) rv.onclick = () => { optsEl.classList.remove("hidden-opt"); rv.remove(); };
  }
  const showFeedback = i => {
    btns.forEach((b, j) => { b.disabled = true; if (j === q.ans) b.classList.add("ok"); else if (j === i) b.classList.add("ng"); });
    optsEl.classList.remove("hidden-opt");
    const ok = i === q.ans;
    $(".fb", box).innerHTML = `<div class="exp"><b style="color:${ok ? "var(--ok)" : "var(--ng)"}">${ok ? "✔ Chính xác!" : "✘ Chưa đúng — đáp án: " + (q.ans + 1)}</b>
      <div style="margin-top:6px">${esc(q.exp)}</div>
      ${q.script ? `<details class="script"><summary>📜 Xem script</summary>${q.script.map(([s, x]) => `<p><b>${s.replace("2", "")}：</b>${esc(x)}</p>`).join("")}</details>` : ""}
      <div class="small mute" style="margin-top:8px">💡 ${esc(BJT_INFO.types[q.type].tip)}</div></div>
      ${opt.onNext ? `<div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn pri" data-a="next">Câu tiếp →</button></div>` : ""}`;
    const nx = $('[data-a="next"]', box); if (nx) { nx.onclick = opt.onNext; nx.focus(); }
  };
  if (opt.mode === "practice") {
    if (opt.chosen != null) showFeedback(opt.chosen);
    btns.forEach(b => b.onclick = () => { const i = +b.dataset.i; TTS.stop(); record(q, i === q.ans); opt.onPick && opt.onPick(i); showFeedback(i); });
  } else {
    if (opt.chosen != null) btns[opt.chosen].classList.add("sel");
    btns.forEach(b => b.onclick = () => { btns.forEach(x => x.classList.remove("sel")); b.classList.add("sel"); opt.onPick(+b.dataset.i); });
  }
}

// ---------- PRACTICE ----------
views.practice = (el, preset) => {
  if (preset) return runSession(el, preset.list, preset.title);
  el.innerHTML = `<h1>Luyện tập theo dạng</h1><p class="mute">9 dạng câu hỏi theo đúng cấu trúc đề chính thức. Phần nghe dùng giọng đọc tiếng Nhật của trình duyệt (khuyên dùng Chrome/Edge).</p>` +
    [1, 2, 3].map(p => `<h2><span class="tag p${p}">${BJT_INFO.parts[p].name}</span> ${BJT_INFO.parts[p].vi}</h2><div class="types">` +
      Object.entries(BJT_INFO.types).filter(([, t]) => t.part === p).map(([k, t]) => {
        const n = QUESTIONS.filter(q => q.type === k).length, a = acc(q => q.type === k);
        return `<div class="card type" data-t="${k}"><div class="jp">${t.jp}</div><div class="mute small">${t.vi}</div>
        <div class="row small" style="margin-top:8px;justify-content:space-between"><span>${n} câu</span><span>${a.p != null ? "Đúng " + a.p + "%" : "Chưa làm"}</span></div>
        <div class="meter" style="margin-top:6px"><i style="width:${a.p || 0}%"></i></div></div>`;
      }).join("") + `</div>`).join("") +
    `<div class="row" style="margin-top:22px"><button class="btn pri" id="mix">🎲 Trộn ngẫu nhiên 15 câu</button></div>`;
  el.querySelectorAll("[data-t]").forEach(c => c.onclick = () => runSession(el, QUESTIONS.filter(q => q.type === c.dataset.t), BJT_INFO.types[c.dataset.t].jp));
  $("#mix", el).onclick = () => runSession(el, shuffle(QUESTIONS).slice(0, 15), "Trộn ngẫu nhiên");
};
function runSession(el, list, title) {
  let i = 0, right = 0;
  const step = () => {
    if (i >= list.length) {
      el.innerHTML = `<div class="card qwrap" style="text-align:center"><h1>Hoàn thành: ${esc(title)}</h1><div class="count" style="margin:14px 0">${right}/${list.length}</div>
      <p class="mute">${right / list.length >= 0.75 ? "Tốt lắm! Mức này tương đương vùng J1." : "Xem lại sổ lỗi sai và làm lại nhé."}</p>
      <div class="row" style="justify-content:center"><button class="btn pri" id="again">Làm lại</button><button class="btn" id="back">Về danh sách</button></div></div>`;
      $("#again").onclick = () => runSession(el, shuffle(list), title); $("#back").onclick = () => go("practice"); return;
    }
    el.innerHTML = `<div class="qwrap"><div class="row" style="justify-content:space-between;margin-bottom:10px"><button class="btn sm" id="quit">← Thoát</button><span class="mute small">${esc(title)} · ${i + 1}/${list.length}</span></div><div class="meter" style="margin-bottom:14px"><i style="width:${i / list.length * 100}%"></i></div><div class="card" id="qb"></div></div>`;
    $("#quit").onclick = () => go("practice");
    renderQ($("#qb"), list[i], { mode: "practice", onPick: k => { if (k === list[i].ans) right++; }, onNext: () => { TTS.stop(); i++; step(); } });
  };
  step();
}

// ---------- MOCK ----------
views.mock = el => {
  const hist = S.mocks.slice(-8).reverse();
  el.innerHTML = `<h1>Thi thử BJT</h1><p class="mute">Không hiện đáp án trong lúc làm. Câu hỏi sắp theo thứ tự 第1部 → 第2部 → 第3部 như đề thật. Điểm quy đổi thang 800 chỉ mang tính ước lượng.</p>
  <div class="grid">
    <div class="card"><h3>Mini test</h3><p class="mute small">24 câu (8 câu mỗi phần) · 30 phút</p><button class="btn pri" data-m="mini">Bắt đầu</button></div>
    <div class="card"><h3>Full ngân hàng đề</h3><p class="mute small">Toàn bộ ${QUESTIONS.length} câu · 80 phút</p><button class="btn pri" data-m="full">Bắt đầu</button></div>
  </div>
  <h2>Lịch sử</h2>
  <div class="card scroll">${hist.length ? `<table class="lv"><tr><th>Ngày</th><th>Loại</th><th>Đúng</th><th>Điểm ước tính</th><th>Cấp</th></tr>${hist.map(m => `<tr><td>${m.date}</td><td>${m.kind}</td><td>${m.c}/${m.n}</td><td><b>${m.score}</b></td><td>${levelOf(m.score).name}</td></tr>`).join("")}</table>` : `<span class="mute">Chưa có bài thi nào.</span>`}</div>`;
  el.querySelectorAll("[data-m]").forEach(b => b.onclick = () => startMock(el, b.dataset.m));
};
function startMock(el, kind) {
  const by = p => shuffle(QUESTIONS.filter(q => partOf(q) === p));
  const list = kind === "mini" ? [1, 2, 3].flatMap(p => by(p).slice(0, 8)) : [1, 2, 3].flatMap(by);
  const ans = Array(list.length).fill(null);
  const end = Date.now() + (kind === "mini" ? 30 : 80) * 60e3;
  let cur = 0, finished = false;
  el.innerHTML = `<div class="qwrap"><div class="card" style="margin-bottom:12px"><div class="row" style="justify-content:space-between"><span class="timer" id="tm"></span><button class="btn sm" id="sub">Nộp bài</button></div><div class="dots" id="dots"></div></div><div class="card" id="qb"></div>
  <div class="row" style="justify-content:space-between;margin-top:12px"><button class="btn" id="prev">← Trước</button><button class="btn pri" id="next">Sau →</button></div></div>`;
  const tick = () => {
    const ms = end - Date.now();
    if (ms <= 0) return finish();
    $("#tm").textContent = "⏱ " + String(Math.floor(ms / 60e3)).padStart(2, "0") + ":" + String(Math.floor(ms / 1e3) % 60).padStart(2, "0");
    $("#tm").style.color = ms < 5 * 60e3 ? "var(--ng)" : "";
  };
  const iv = setInterval(tick, 1000); tick();
  cleanup = () => clearInterval(iv);
  const dots = () => { $("#dots").innerHTML = list.map((q, k) => `<span class="${ans[k] != null ? "a" : ""} ${k === cur ? "c" : ""}" data-k="${k}">${k + 1}</span>`).join(""); };
  $("#dots").onclick = e => { const s = e.target.closest("span"); if (s) show(+s.dataset.k); };
  const show = k => {
    TTS.stop(); cur = k; dots();
    renderQ($("#qb"), list[k], { mode: "mock", chosen: ans[k], head: `<span class="mute small">Câu ${k + 1}/${list.length}</span>`, onPick: i => { ans[k] = i; dots(); } });
    $("#prev").disabled = k === 0; $("#next").textContent = k === list.length - 1 ? "Nộp bài ✓" : "Sau →";
  };
  $("#prev").onclick = () => show(cur - 1);
  $("#next").onclick = () => cur === list.length - 1 ? confirmSubmit() : show(cur + 1);
  $("#sub").onclick = confirmSubmit;
  function confirmSubmit() {
    const left = ans.filter(a => a == null).length;
    $("#qb").insertAdjacentHTML("afterbegin", `<div class="exp" id="cf" style="margin:0 0 14px">${left ? `Còn <b>${left}</b> câu chưa trả lời. ` : ""}Nộp bài ngay? <button class="btn pri sm" id="yes">Nộp</button> <button class="btn sm" id="no">Tiếp tục làm</button></div>`);
    $("#yes").onclick = finish; $("#no").onclick = () => $("#cf").remove();
  }
  function finish() {
    if (finished) return; finished = true; clearInterval(iv); TTS.stop();
    let c = 0; const per = { 1: [0, 0], 2: [0, 0], 3: [0, 0] };
    list.forEach((q, k) => { const ok = ans[k] === q.ans; if (ok) c++; per[partOf(q)][1]++; if (ok) per[partOf(q)][0]++; record(q, ok); });
    const score = Math.round(c / list.length * 800);
    const lv = levelOf(score);
    S.mocks.push({ date: new Date().toLocaleDateString("vi-VN"), kind: kind === "mini" ? "Mini" : "Full", c, n: list.length, score }); save();
    el.innerHTML = `<div class="qwrap"><div class="card result" style="text-align:center"><div class="mute">Điểm ước tính</div><div class="score">${score}</div><div style="font-size:20px;font-weight:700;margin:6px 0">${lv.name}</div>
      <div class="mute">${c}/${list.length} câu đúng · ${score >= 530 ? "🎉 Đạt mục tiêu J1!" : "Còn thiếu " + (530 - score) + " điểm để đạt J1"}</div></div>
      <div class="grid" style="margin-top:14px">${[1, 2, 3].map(p => `<div class="card"><span class="tag p${p}">${BJT_INFO.parts[p].name}</span><div class="stat"><div class="n">${per[p][0]}/${per[p][1]}</div></div><div class="meter"><i style="width:${per[p][1] ? per[p][0] / per[p][1] * 100 : 0}%"></i></div></div>`).join("")}</div>
      <h2>Xem lại</h2><div id="rv"></div><div class="row" style="margin-top:14px"><button class="btn pri" id="bk">Về trang thi thử</button></div></div>`;
    $("#rv").innerHTML = list.map((q, k) => `<div class="card" style="margin-bottom:8px"><div class="row" style="justify-content:space-between"><span>${ans[k] === q.ans ? "✔" : "✘"} <b>Câu ${k + 1}</b> · <span class="small mute">${BJT_INFO.types[q.type].jp}</span></span><span class="small">Bạn chọn: ${ans[k] == null ? "—" : ans[k] + 1} · Đáp án: ${q.ans + 1}</span></div><div class="small" style="margin-top:4px">${esc(q.q)}</div>${ans[k] !== q.ans ? `<div class="small mute" style="margin-top:4px">→ ${esc(q.opts[q.ans])}<br>${esc(q.exp)}</div>` : ""}</div>`).join("");
    $("#bk").onclick = () => go("mock");
    cleanup = null;
  }
  show(0);
}

// ---------- VOCAB ----------
views.vocab = el => {
  let onlyNew = false, deck, idx = 0, flipped = false;
  const build = () => { deck = shuffle(VOCAB.filter(v => !onlyNew || !S.known[v[0]])); idx = 0; flipped = false; };
  build();
  const render = () => {
    const knownN = VOCAB.filter(v => S.known[v[0]]).length;
    const v = deck[idx];
    el.innerHTML = `<h1>Từ vựng kinh doanh</h1><p class="mute">Bấm vào thẻ để lật. Đã thuộc ${knownN}/${VOCAB.length}.</p>
    <div class="meter" style="margin-bottom:14px"><i style="width:${knownN / VOCAB.length * 100}%"></i></div>
    <div class="row" style="margin-bottom:12px"><label class="small"><input type="checkbox" id="on" ${onlyNew ? "checked" : ""}> Chỉ từ chưa thuộc</label><button class="btn sm" id="ls">📋 Xem danh sách</button></div>
    ${v ? `<div class="card flash" id="fc"><div>${flipped ? `<div class="w" style="font-size:30px">${esc(v[0])}</div><div class="r">${esc(v[1])}</div><div class="m">${esc(v[2])}</div><div class="ex">例：${esc(v[3])}</div>` : `<div class="w">${esc(v[0])}</div><div class="mute small" style="margin-top:10px">Bấm để xem nghĩa</div>`}</div></div>
    <div class="row" style="justify-content:space-between;margin-top:12px"><span class="mute small">${idx + 1}/${deck.length}</span>
    <div class="row"><button class="btn sm" id="spk">🔊</button><button class="btn" id="nk">Chưa thuộc</button><button class="btn pri" id="kn">Đã thuộc ✓</button></div></div>`
      : `<div class="card" style="text-align:center">🎉 Hết thẻ! <button class="btn sm" id="rs">Trộn lại</button></div>`}`;
    $("#on").onchange = e => { onlyNew = e.target.checked; build(); render(); };
    $("#ls").onclick = list;
    if (!v) { $("#rs").onclick = () => { build(); render(); }; return; }
    $("#fc").onclick = () => { flipped = !flipped; render(); };
    $("#spk").onclick = () => TTS.play([["女", v[1].match(/[a-z]/i) ? v[0] : v[1]], ["女", v[3]]]);
    const next = k => { S.known[v[0]] = k; save(); idx++; flipped = false; render(); };
    $("#kn").onclick = () => next(true); $("#nk").onclick = () => next(false);
  };
  const list = () => {
    el.innerHTML = `<div class="row" style="justify-content:space-between"><h1>Danh sách từ vựng</h1><button class="btn sm" id="bk">← Thẻ</button></div>
    <div class="card scroll"><table class="lv"><tr><th></th><th>Từ</th><th>Đọc</th><th>Nghĩa</th><th>Ví dụ</th></tr>${VOCAB.map(v => `<tr><td>${S.known[v[0]] ? "✔" : ""}</td><td><b>${esc(v[0])}</b></td><td>${esc(v[1])}</td><td>${esc(v[2])}</td><td class="small">${esc(v[3])}</td></tr>`).join("")}</table></div>`;
    $("#bk").onclick = render;
  };
  render();
};

// ---------- KEIGO ----------
views.keigo = el => {
  el.innerHTML = `<h1>Kính ngữ (敬語) — chìa khóa của BJT</h1><p class="mute">Phần 発言聴解 và 表現読解 kiểm tra trực tiếp kính ngữ. Bấm 🔊 để nghe.</p>
  <div class="card scroll"><table class="lv"><tr><th>Động từ</th><th>尊敬語 (tôn kính — hành động của người trên/khách)</th><th>謙譲語 (khiêm nhường — hành động của mình)</th><th></th></tr>
  ${KEIGO.map((k, i) => `<tr><td><b>${k[0]}</b></td><td>${k[1]}</td><td>${k[2]}</td><td><button class="btn sm" data-i="${i}">🔊</button></td></tr>`).join("")}</table></div>
  <h2>Quy tắc hay bị bẫy</h2><div class="grid">${KEIGO_TIPS.map(t => `<div class="card"><h3>${esc(t[0])}</h3><div class="small">${esc(t[1])}</div></div>`).join("")}</div>
  <div class="row" style="margin-top:20px"><button class="btn pri" id="pq">Luyện câu hỏi kính ngữ →</button></div>`;
  el.querySelectorAll("[data-i]").forEach(b => b.onclick = () => { const k = KEIGO[+b.dataset.i]; TTS.play([["女", k[0]], ["女", k[1].replace(/\//g, "、")], ["男", k[2].replace(/\//g, "、")]]); });
  $("#pq").onclick = () => go("practice", { list: shuffle(QUESTIONS.filter(q => q.type === "speech" || q.type === "expression")), title: "Kính ngữ" });
};

// ---------- REVIEW ----------
views.review = el => {
  const wrong = QUESTIONS.filter(q => S.stats[q.id] && S.stats[q.id].last === false);
  const weak = Object.entries(BJT_INFO.types).map(([k, t]) => ({ k, t, ...acc(q => q.type === k) })).filter(x => x.a).sort((a, b) => a.p - b.p);
  el.innerHTML = `<h1>Sổ lỗi sai</h1><p class="mute">Các câu bạn trả lời sai ở lần gần nhất. Làm đúng sẽ tự động rời khỏi sổ.</p>
  ${wrong.length ? `<button class="btn pri" id="go">Làm lại ${wrong.length} câu sai</button>` : `<div class="card">Chưa có câu sai nào 👏</div>`}
  ${wrong.length ? `<div style="margin-top:14px">${wrong.map(q => `<div class="card" style="margin-bottom:8px"><span class="tag p${partOf(q)}">${BJT_INFO.types[q.type].jp}</span> <span class="small">${esc(q.q)}</span><div class="small mute" style="margin-top:4px">→ ${esc(q.opts[q.ans])}</div></div>`).join("")}</div>` : ""}
  ${weak.length ? `<h2>Dạng yếu nhất</h2><div class="card scroll"><table class="lv">${weak.map(x => `<tr><td>${x.t.jp}</td><td>${x.t.vi}</td><td style="width:35%"><div class="meter"><i style="width:${x.p}%"></i></div></td><td><b>${x.p}%</b></td></tr>`).join("")}</table></div>` : ""}
  <h2>Dữ liệu</h2><div class="card row"><span class="small mute">Tiến độ lưu trong trình duyệt này.</span><button class="btn sm" id="rst">Xoá toàn bộ tiến độ</button></div>`;
  if (wrong.length) $("#go").onclick = () => go("practice", { list: shuffle(wrong), title: "Sổ lỗi sai" });
  $("#rst").onclick = e => {
    if (e.target.dataset.c) { localStorage.removeItem(KEY); location.reload(); }
    else { e.target.dataset.c = 1; e.target.textContent = "Bấm lần nữa để xác nhận"; e.target.classList.add("pri"); }
  };
};

go("home");
