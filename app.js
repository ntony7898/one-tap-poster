// app.js — UI, routing and wiring. Talks to data only through window.API.
(function () {
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const newSeed = () => (Math.random() * 2 ** 32) >>> 0;
const STY = Poster.STYLES;
const st = { spec: { t: '', s: 'bauhaus', seed: newSeed(), pal: -1, mix: 1 }, remixOf: null, challenge: false, me: null };
const toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2400); };
const link = spec => location.origin + location.pathname + '#/p/' + Poster.encode(spec);
const fname = spec => `one-tap-${spec.s}-${spec.seed.toString(36)}.png`;
const styleName = id => (STY.find(s => s.id === id) || {}).name || id;

// ---------- lazy thumbnails ----------
const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.unobserve(e.target); loadThumb(e.target); } }), { rootMargin: '300px' }) : null;
function loadThumb(img) { const spec = JSON.parse(img.dataset.spec); Poster.thumb(spec, +img.dataset.w || 360).then(u => { img.onload = () => img.classList.add('ld'); img.src = u; if (img.complete) img.classList.add('ld'); }); }
function hydrate(root) { $$('img[data-spec]', root).forEach(i => io ? io.observe(i) : loadThumb(i)); $$('img[data-av]', root).forEach(i => i.src = Poster.avatar(i.dataset.av, i.dataset.n)); }
const thumbImg = (spec, w = 360) => `<img alt="${esc(styleName(spec.s))} poster: ${esc(spec.t)}" data-w="${w}" data-spec='${esc(JSON.stringify(spec))}'>`;
const av = (h, n) => `<img alt="" data-av="${esc(h)}" data-n="${esc(n || h)}">`;

// ---------- create ----------
function buildCreate() {
  $('#styles').innerHTML = STY.map(s => `<button class="sty" role="radio" data-s="${s.id}" aria-checked="false">${thumbImg({ t: 'Aa', s: s.id, seed: 7, pal: 0, mix: 0 }, 180)}<span>${s.name}</span></button>`).join('');
  hydrate($('#styles'));
  $('#styles').onclick = e => { const b = e.target.closest('.sty'); if (b) { st.spec.s = b.dataset.s; st.spec.pal = -1; syncCreate(); } };
  $('#pals').onclick = e => { const b = e.target.closest('.pal'); if (b) { st.spec.pal = +b.dataset.p; syncCreate(); } };
  $('#txt').oninput = () => { st.spec.t = $('#txt').value; $('#cnt').textContent = [...$('#txt').value].length; };
  $('#txt').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); make(true); } };
  $('#mix').onchange = () => st.spec.mix = $('#mix').checked ? 1 : 0;
  $('#btnMake').onclick = () => make(true);
}
function syncCreate() {
  $('#txt').value = st.spec.t; $('#cnt').textContent = [...st.spec.t].length; $('#mix').checked = st.spec.mix !== 0;
  $$('.sty').forEach(b => b.setAttribute('aria-checked', b.dataset.s === st.spec.s));
  const S = Poster.STY[st.spec.s], sw = p => p.bg && typeof p.bg === 'string' ? `linear-gradient(135deg,${p.bg} 50%,${p.ink || p.c?.[0] || p.acc || p.a || p.b} 50%)` : p.sky ? `linear-gradient(${p.sky.join(',')})` : `linear-gradient(135deg,${p.bg[0]},${p.b[0]})`;
  $('#pals').innerHTML = `<button type="button" class="pal" role="radio" data-p="-1" aria-checked="${st.spec.pal < 0}" aria-label="Auto palette">AUTO</button>` + S.pals.map((p, i) => `<button type="button" class="pal" role="radio" data-p="${i}" aria-checked="${st.spec.pal === i}" aria-label="Palette ${i + 1}"><i style="background:${sw(p)}"></i></button>`).join('');
  const n = $('#remixNote'); n.hidden = !(st.remixOf || st.challenge);
  n.innerHTML = [st.remixOf ? `↻ Remixing <b>@${esc(st.remixOf)}</b>'s style & seed — add your own words.` : '', st.challenge ? `★ Daily Challenge entry — <b>${esc(st.challengeName || '')}</b>` : ''].filter(Boolean).join('<br>') + ' <button class="mini" id="clrCtx" type="button">✕</button>';
  const c = $('#clrCtx'); if (c) c.onclick = () => { st.remixOf = null; st.challenge = false; syncCreate(); };
}
async function make(fresh) { if (fresh && !st.keepSeed) st.spec.seed = newSeed(); st.keepSeed = false; st.spec.t = $('#txt').value.trim().slice(0, 80) || $('#txt').placeholder.replace('…', '').trim(); await Poster.ready(); location.hash = '#/result'; }

// ---------- result ----------
async function showResult() {
  if (!st.spec.t) { location.hash = '#/create'; return; }
  await Poster.ready(); Poster.render($('#big').getContext('2d'), st.spec);
  const { palI, v } = Poster.resolve(st.spec);
  $('#resMeta').innerHTML = `<span><b>${esc(styleName(st.spec.s))}</b></span><span>PAL <b>${palI + 1}</b></span><span>LAYOUT <b>${v + 1}</b></span><span>SEED <b>#${st.spec.seed.toString(36).toUpperCase()}</b></span>${st.remixOf ? `<span>REMIX OF <b>@${esc(st.remixOf)}</b></span>` : ''}`;
  $('#btnPost').textContent = st.challenge ? 'SUBMIT TO CHALLENGE' : 'POST TO FEED';
}
async function share(spec) {
  const blob = await Poster.toBlob(spec), file = new File([blob], fname(spec), { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: 'One-Tap Poster' }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  download(blob, fname(spec)); toast('Share sheet not available here — PNG saved instead');
}
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
async function copyLink(spec) { const u = link(spec); try { await navigator.clipboard.writeText(u); toast('Link copied'); } catch { prompt('Copy this link', u); } }
function wireResult() {
  $('#btnShare').onclick = () => share(st.spec);
  $('#btnSave').onclick = async () => { download(await Poster.toBlob(st.spec), fname(st.spec)); toast('Saved 1080×1920 PNG'); };
  $('#btnShuffle').onclick = () => { st.spec.seed = newSeed(); showResult(); };
  $('#btnEdit').onclick = () => { st.keepSeed = true; location.hash = '#/create'; };
  $('#btnCopy').onclick = () => copyLink(st.spec);
  $('#btnPost').onclick = async () => {
    if (!st.me) return onboarding(() => $('#btnPost').click());
    try { const p = await API.publish(st.spec, { remixOf: st.remixOf });
      if (st.challenge) { await API.submitChallenge(p.id).then(r => toast(`Submitted! Streak: ${r.streak} 🔥`), e => toast(e.message)); st.challenge = false; location.hash = '#/challenge'; }
      else { toast('Posted to your feed'); location.hash = '#/post/' + p.id; }
      st.remixOf = null;
    } catch (e) { toast(e.message); } };
}

// ---------- feed ----------
let feedTab = 'discover';
const card = p => `<article class="card"><a class="thumb" href="#/post/${p.id}">${thumbImg(p.spec)}</a>
  <a class="who" href="#/u/${esc(p.handle)}">${av(p.handle)}<span>@${esc(p.handle)}</span>${p.demo ? '<i class="tag">DEMO</i>' : '<i class="tag you">YOU</i>'}</a>
  ${p.remixOf ? `<div class="remixed">↻ remixed from @${esc(p.remixOf)}</div>` : ''}
  <div class="bar"><button class="mini ${p.liked ? 'liked' : ''}" data-like="${p.id}" aria-pressed="${p.liked}" aria-label="Like">${p.liked ? '♥' : '♡'} <span>${p.likes}</span></button><button class="mini" data-remix="${p.id}" aria-label="Remix">↻ Remix</button></div></article>`;
async function showFeed() {
  $$('.seg button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === feedTab));
  const ps = await API.getFeed({ tab: feedTab }); let html = ps.map(card).join('');
  if (feedTab === 'following' && !ps.some(p => p.handle !== st.me?.handle)) { const cs = await API.getCreators();
    html = `<div class="empty"><h3>Follow some creators</h3>Tap a demo creator to see their posters and follow them.<div class="sugg">${cs.map(c => `<a href="#/u/${c.handle}">${av(c.handle, c.name)}@${esc(c.handle)}</a>`).join('')}</div></div>` + html; }
  $('#feedGrid').innerHTML = html; hydrate($('#feedGrid'));
}
async function onLike(btn) { const id = btn.dataset.like; const p = await (btn.getAttribute('aria-pressed') === 'true' ? API.unlike(id) : API.like(id));
  $$(`[data-like="${id}"]`).forEach(b => { b.classList.toggle('liked', p.liked); b.setAttribute('aria-pressed', p.liked); b.innerHTML = `${p.liked ? '♥' : '♡'} <span>${p.likes}</span>`; }); }
async function onRemix(id) { const r = await API.remix(id); st.spec = { ...r.spec, t: '' }; st.remixOf = r.remixOf; st.keepSeed = true; location.hash = '#/create'; setTimeout(() => $('#txt').focus(), 50); }

// ---------- post detail & deep link ----------
async function showPost(id, spec) {
  let p = null; if (id) { p = await API.getPost(id); if (!p) { $('#postBody').innerHTML = '<div class="empty"><h3>Poster not found</h3></div>'; return; } spec = p.spec; }
  $('#postBody').innerHTML = `${p ? `<a class="who" href="#/u/${esc(p.handle)}">${av(p.handle)}<span>@${esc(p.handle)}</span>${p.demo ? '<i class="tag">DEMO</i>' : ''}</a>` : '<p class="kicker">SHARED POSTER · MADE WITH ONE-TAP POSTER</p>'}
    <div class="stage" style="margin-top:8px"><canvas class="bigimg" id="pc" width="1080" height="1920" aria-label="${esc(spec.t)}"></canvas></div>
    <div class="meta"><span><b>${esc(styleName(spec.s))}</b></span><span>SEED <b>#${spec.seed.toString(36).toUpperCase()}</b></span>${p?.remixOf ? `<span>REMIXED FROM <b>@${esc(p.remixOf)}</b></span>` : ''}${p?.challengeDay ? '<span><b>★ CHALLENGE</b></span>' : ''}</div>
    <div class="actions">${p ? `<button class="ghost ${p.liked ? 'on' : ''}" id="pLike">${p.liked ? '♥' : '♡'} ${p.likes}</button>` : ''}<button class="ghost accent" id="pRemix">↻ REMIX</button><button class="ghost" id="pShare">SHARE</button><button class="ghost" id="pCopy">COPY LINK</button>${p ? '' : '<button class="ghost" id="pSave">SAVE PNG</button><a class="ghost" href="#/create" style="display:grid;place-items:center;text-decoration:none">MAKE YOUR OWN</a>'}</div>
    ${p?.demoReactions ? '<p class="fine">Likes on your posts include simulated demo-community reactions in this test build.</p>' : ''}`;
  hydrate($('#postBody')); await Poster.ready(); Poster.render($('#pc').getContext('2d'), spec);
  if (p) $('#pLike').onclick = async () => { const q = await (p.liked ? API.unlike(p.id) : API.like(p.id)); p.liked = q.liked; p.likes = q.likes; $('#pLike').textContent = `${q.liked ? '♥' : '♡'} ${q.likes}`; $('#pLike').classList.toggle('on', q.liked); };
  $('#pRemix').onclick = () => { if (p) return onRemix(p.id); st.spec = { ...spec, t: '' }; st.remixOf = null; st.keepSeed = true; location.hash = '#/create'; };
  $('#pShare').onclick = () => share(spec); $('#pCopy').onclick = () => copyLink(spec);
  const sv = $('#pSave'); if (sv) sv.onclick = async () => download(await Poster.toBlob(spec), fname(spec));
}

// ---------- challenge ----------
let lbPeriod = 'daily';
async function showChallenge() {
  const c = await API.getDailyChallenge(), lb = await API.getLeaderboard({ period: lbPeriod }); const hrs = Math.max(0, Math.floor((c.endsAt - Date.now()) / 36e5));
  $('#chBody').innerHTML = `<div class="chcard"><div class="kicker">DAILY CHALLENGE · ${c.day}</div><div class="h1">${esc(c.prompt)}</div>
    <div class="chrow"><div><b>${esc(styleName(c.style))}</b>FEATURED STYLE</div><div><b>${hrs}h</b>LEFT</div><div><b>${c.streak}🔥</b>STREAK</div></div>
    ${c.submitted ? `<a class="cta" href="#/post/${c.submitted}" style="text-decoration:none">✓ SUBMITTED — VIEW ENTRY</a>` : '<button class="cta" id="chGo">MAKE MY ENTRY →</button>'}</div>
    <p class="fine">One submission per day. Ranked by likes. Other entrants are the demo community.</p>
    <div class="seg" role="tablist" style="margin-top:16px"><button role="tab" data-lb="daily" aria-selected="${lbPeriod === 'daily'}">Today</button><button role="tab" data-lb="all" aria-selected="${lbPeriod === 'all'}">All-time</button></div>
    <ol class="lb">${lb.map(e => `<li class="${e.demo ? '' : 'me'}"><span class="rk">${e.rank}</span>${av(e.handle)}<a href="${e.post ? '#/post/' + e.post.id : '#/u/' + esc(e.handle)}">@${esc(e.handle)} ${e.demo ? '<i class="tag">DEMO</i>' : '<i class="tag you">YOU</i>'}</a><span class="lk">♥ ${e.likes.toLocaleString()}</span></li>`).join('')}</ol>`;
  hydrate($('#chBody'));
  $$('[data-lb]').forEach(b => b.onclick = () => { lbPeriod = b.dataset.lb; showChallenge(); });
  const g = $('#chGo'); if (g) g.onclick = () => { st.spec = { t: '', s: c.style, seed: newSeed(), pal: -1, mix: 1 }; st.challenge = true; st.challengeName = c.prompt; st.remixOf = null; $('#txt').placeholder = c.prompt + '…'; location.hash = '#/create'; };
}

// ---------- profile ----------
async function showProfile(handle) {
  if (!handle) { if (!st.me) { $('#profBody').innerHTML = '<div class="empty"><h3>No profile yet</h3><button class="cta" id="mkProf">SET UP PROFILE</button></div>'; $('#mkProf').onclick = () => onboarding(route); return; } handle = st.me.handle; }
  const p = await API.getProfile(handle); if (!p) { $('#profBody').innerHTML = '<div class="empty"><h3>Creator not found</h3></div>'; return; }
  $('#profBody').innerHTML = `<div class="phead">${av(p.handle, p.name)}<div><h2>${esc(p.name)}</h2><p>@${esc(p.handle)} ${p.demo ? '<i class="tag">DEMO CREATOR</i>' : ''}</p></div></div>
    <p class="bio">${esc(p.bio || '')}</p>
    ${p.me ? '<button class="ghost" id="edProf" style="width:100%">EDIT PROFILE</button>' : `<button class="cta sm" id="fol">${p.isFollowing ? 'FOLLOWING ✓' : 'FOLLOW'}</button>`}
    <div class="stats"><div><b>${p.stats.posters}</b><span>Posters</span></div><div><b>${p.stats.followers.toLocaleString()}</b><span>Followers</span></div><div><b>${p.stats.following}</b><span>Following</span></div><div><b>${p.stats.likes.toLocaleString()}</b><span>Likes</span></div></div>
    <div class="pgrid">${p.posts.map(q => `<a class="thumb" href="#/post/${q.id}">${thumbImg(q.spec, 240)}</a>`).join('') || '<div class="empty"><h3>No posters yet</h3><a href="#/create">Make your first one →</a></div>'}</div>`;
  hydrate($('#profBody'));
  const f = $('#fol'); if (f) f.onclick = async () => { await (p.isFollowing ? API.unfollow(p.handle) : API.follow(p.handle)); toast(p.isFollowing ? 'Unfollowed' : `Following @${p.handle}`); showProfile(handle); };
  const e = $('#edProf'); if (e) e.onclick = () => onboarding(route, true);
}

// ---------- dialogs ----------
function dialog(html, setup) { const d = $('#dlg'); $('#dlgBody').innerHTML = html; setup && setup($('#dlgBody'), d); if (!d.open) d.showModal(); }
function onboarding(after, edit) {
  const me = st.me || {};
  dialog(`<h2>${edit ? 'Edit profile' : 'Claim your handle'}</h2><small>${edit ? '' : 'Your profile, posters, likes and follows stay on this device in the test build.'}</small>
    <div class="avp" style="margin-top:12px"><img id="obAv" alt=""><small>Avatar is generated from your handle.</small></div>
    <label for="obH">HANDLE</label><input id="obH" autocomplete="off" autocapitalize="off" maxlength="20" placeholder="tony.makes" value="${esc(me.handle || '')}">
    <label for="obN">DISPLAY NAME</label><input id="obN" maxlength="30" placeholder="Tony Nguyen" value="${esc(me.name || '')}">
    <label for="obB">BIO</label><input id="obB" maxlength="120" placeholder="Graphic designer. Loud type." value="${esc(me.bio || '')}">
    <div class="err" id="obE"></div><button class="cta" id="obGo" value="">${edit ? 'SAVE' : "LET'S GO →"}</button>${edit || !st.me ? '<button class="ghost" style="width:100%;margin-top:8px" value="cancel">CANCEL</button>' : ''}`, (f, d) => {
    const upd = () => { $('#obAv').src = Poster.avatar(($('#obH').value || 'you').toLowerCase(), $('#obN').value || $('#obH').value); }; upd(); $('#obH').oninput = $('#obN').oninput = upd;
    $('#obGo').onclick = async ev => { ev.preventDefault(); try { st.me = await API.signIn({ handle: $('#obH').value, name: $('#obN').value, bio: $('#obB').value }); d.close(); toast(`Welcome, @${st.me.handle}`); after && after(); } catch (e) { $('#obE').textContent = e.message; } };
  });
}
$('#btnSettings').onclick = () => dialog(`<h2>About</h2><p><b>One-Tap Poster</b> · test build<br><small>by Tony Nguyen</small></p>
  <p class="fine">Test build. Social features run on-device with a demo community until the backend is connected.</p>
  <p class="fine">Backend: <b>${API.backend}</b>. Demo creators are fictional. Nothing is uploaded; deep links carry the poster recipe in the URL.</p>
  <p><a href="privacy.html">Privacy</a> · <a href="terms.html">Terms</a></p>
  <button class="ghost" id="rst" style="width:100%">RESET ON-DEVICE DATA</button><button class="cta" value="ok">DONE</button>`, f => { $('#rst', f).onclick = async e => { e.preventDefault(); if (confirm('Erase your profile, posts, likes and follows on this device?')) { await API.resetAll(); st.me = null; $('#dlg').close(); location.hash = '#/create'; onboarding(); } }; });

// ---------- router ----------
async function route() {
  const [r, ...rest] = (location.hash.replace(/^#\/?/, '') || 'create').split('/'); const arg = decodeURIComponent(rest.join('/'));
  const view = { create: 'create', result: 'result', feed: 'feed', challenge: 'challenge', profile: 'profile', u: 'profile', post: 'post', p: 'post' }[r] || 'create';
  $$('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + view));
  $$('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.r === (r === 'u' && arg !== st.me?.handle ? 'feed' : view === 'result' || view === 'post' ? '' : view)));
  window.scrollTo(0, 0);
  if (view === 'create') syncCreate(); else if (view === 'result') await showResult(); else if (view === 'feed') await showFeed(); else if (view === 'challenge') await showChallenge();
  else if (view === 'profile') await showProfile(r === 'u' ? arg : null);
  else if (r === 'post') await showPost(arg); else if (r === 'p') { const spec = Poster.decode(arg); if (spec) await showPost(null, spec); else $('#postBody').innerHTML = '<div class="empty"><h3>That link looks broken</h3><a href="#/create">Make a poster →</a></div>'; }
}
document.addEventListener('click', e => { const l = e.target.closest('[data-like]'); if (l) { e.preventDefault(); onLike(l); } const m = e.target.closest('[data-remix]'); if (m) { e.preventDefault(); onRemix(m.dataset.remix); } const s = e.target.closest('.seg [data-tab]'); if (s) { feedTab = s.dataset.tab; showFeed(); } });
window.addEventListener('hashchange', route);
(async () => {
  buildCreate(); wireResult(); st.me = await API.getMe(); await Poster.ready(); $$('.sty img').forEach(i => i.removeAttribute('src')); hydrate($('#styles'));
  await route();
  if (!st.me && !location.hash.startsWith('#/p/')) onboarding();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
})();
})();
