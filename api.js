// api.js — One-Tap Poster data layer (LocalStorage implementation for the test build).
// To connect a real backend, replace this file with one exposing the same async interface on window.API
// (see PLAN.md). Every method returns a Promise so the UI never depends on storage details.
(function () {
const KEY = 'otp.v1', DAY = 864e5, H = 36e5;
const h = s => Poster.hash(s);
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
let db = Object.assign({ me: null, posts: [], likes: {}, follows: [], challenge: {} }, load());
const save = () => localStorage.setItem(KEY, JSON.stringify(db));
const ok = v => Promise.resolve(v);
const ST = Poster.STYLES.map(s => s.id);

const CREATORS = [
  ['mika.grid', 'Mika Grid', 'Swiss grids & red dots. Zürich-ish.', 'swiss'], ['otto.form', 'Otto Form', 'Shapes first, words second.', 'bauhaus'],
  ['riso_rae', 'Rae Inkwell', 'Two colours, zero regrets.', 'riso'], ['kofi.type', 'Kofi Mensah', 'Type nerd. Kerning is self-care.', 'editorial'],
  ['lena.paste', 'Lena Pastel', 'Squiggles on main.', 'memphis'], ['brutal_ben', 'Ben Concrete', 'NO GRADIENTS. (mostly)', 'brutal'],
  ['chrome.jun', 'Jun Chrome', 'Dial-up dreams ★', 'y2k'], ['sol.sunset', 'Sol Ortega', 'Every poster is golden hour.', 'sunset'],
  ['vex.noir', 'Vex Noir', 'Spooky season is a lifestyle.', 'gothic'], ['ines.edit', 'Inés Editorial', 'Magazine covers for my feelings.', 'editorial'],
  ['paco.pixel', 'Paco Pixel', 'Remix everything.', 'riso'], ['zuri.zine', 'Zuri Zine', 'Zines, stickers, loud words.', 'memphis']
].map(([handle, name, bio, style]) => ({ handle, name, bio, style, demo: true }));
const PHR = ['Stay weird', 'Make it loud', 'Coffee first, then chaos', 'Less but better', 'Ghost mode on 👻', 'No sleep till launch', 'Touch grass', 'Soft launch, hard feelings',
  'Born to design, forced to invoice', 'Kerning matters', 'Main character energy', 'Out of office ☀️', 'Tiny wins only', 'Be the plot twist', 'Pixels & patience',
  'Monday again?!', 'Good things take time', 'Trick or treat yourself 🎃', 'Ship it', 'Do it for the poster', 'Bold moves only', 'Weekend loading…', 'Hello, Phoenix',
  'Analog heart, digital brain', 'I came, I saw, I kerned', 'Vibes over views', 'Neon nights', 'Print is not dead', 'Say less, mean more', 'Dream in CMYK'];
const now = Date.now();
const DEMO = PHR.map((t, i) => { const c = CREATORS[(i * 5) % 12]; const s = i % 3 ? ST[(h(t) + i) % ST.length] : c.style;
  return { id: 'd' + i, handle: c.handle, demo: true, spec: { t, s, seed: h(t + i) % 1e9, pal: -1, mix: 1 }, base: 14 + h('l' + t) % 460, createdAt: now - (i * 5 + h(t) % 4 + 1) * H, remixOf: i % 7 === 3 ? CREATORS[(i + 1) % 12].handle : null }; });

const PROMPTS = ['Monday energy', 'Your villain origin story', 'A coffee order as a motto', 'Ghost of a deadline', 'The best advice you ignored', 'Weekend plans: none', 'A sign for your desk',
  'Your city in 3 words', 'Something you will never say in a meeting', 'Spooky but cute', 'An album title for your life', 'The loudest whisper', 'A warning label for yourself',
  'Fortune cookie wisdom', 'Breakup letter to your phone', 'A protest sign for snacks', 'Motivational but useless', 'Your superpower, badly', 'Out of office reply', 'Love letter to a font',
  'The vibe of 3am', 'A movie poster tagline', 'Things your cat thinks', 'Rules of the group chat', 'Hot take, served cold', 'Your 2027 forecast', 'A slogan for sleep',
  'Rename the moon', 'An excuse that always works', 'Dear future me', 'The weather inside your head', 'Inspiration, upside down', 'One word that ruins dinner', 'Tiny victory of the day',
  'A band name you would join', 'A headline from 1999', 'Advertise your favorite color', 'Unpopular opinion: design edition', 'The mood of Sunday night', 'Pitch your hometown',
  'Make the mundane majestic', 'Your inner monologue, live', 'A lullaby for robots', 'Rules for the dance floor', 'Neon confession', 'The plot of your week', 'A spell for productivity',
  'Bumper sticker for a bike', 'If walls could talk', 'Last words of a houseplant', 'A gym motto for introverts', 'Poster for a party nobody asked for', 'Recipe for chaos',
  'Postcard from tomorrow', 'Ode to the color black', 'A warning from your inbox', 'Graffiti for a library', 'Your playlist title', 'The secret of good mornings', 'A toast to small wins'];
const pad = n => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayNum = k => Math.round(Date.parse(k + 'T12:00:00Z') / DAY);
function challengeFor(k) { return { day: k, prompt: PROMPTS[h('p' + k) % PROMPTS.length], style: ST[dayNum(k) % ST.length] }; }
function challengeEntries(k) { const c = challengeFor(k), start = Date.parse(k + 'T00:00:00'), frac = Math.min(1, Math.max(0.15, (Date.now() - start) / DAY));
  const tpl = [p => p, p => p + '!', p => 'Me vs ' + p.toLowerCase(), p => p + ' 🔥', p => p.toUpperCase() + '?', p => 'Okay but ' + p.toLowerCase(), p => p + '…'];
  return [0, 1, 2, 3, 4, 5, 6].map(j => { const cr = CREATORS[(h(k) + j * 5) % 12]; return { id: `c${k}-${j}`, handle: cr.handle, demo: true, challengeDay: k, spec: { t: tpl[j](c.prompt).slice(0, 80), s: c.style, seed: h(k + j) % 1e9, pal: -1, mix: 1 }, base: Math.round((20 + h('c' + k + j) % 260) * frac), createdAt: start + (j + 1) * 47 * 6e4, remixOf: null }; }); }
function decorate(p) { const liked = !!db.likes[p.id]; const base = p.demo ? p.base : (h(p.id) % 6 + Math.min(48, Math.floor((Date.now() - p.createdAt) / H * 2)));
  return { ...p, liked, likes: base + (liked ? 1 : 0), demoReactions: !p.demo }; }
function allPosts() { return [...db.posts, ...DEMO, ...challengeEntries(dayKey())]; }
function creator(handle) { if (db.me && db.me.handle === handle) return { ...db.me, demo: false, me: true }; return CREATORS.find(c => c.handle === handle) || null; }
function streak() { let n = 0, d = new Date(); if (!db.challenge[dayKey(d)]) d.setDate(d.getDate() - 1); while (db.challenge[dayKey(d)]) { n++; d.setDate(d.getDate() - 1); } return n; }

window.API = {
  backend: 'local-demo',
  getMe: () => ok(db.me),
  signIn({ handle, name, bio = '' }) { handle = String(handle || '').toLowerCase().replace(/^@/, '');
    if (!/^[a-z0-9._]{3,20}$/.test(handle)) return Promise.reject(new Error('Handle: 3–20 letters, numbers, dot or underscore.'));
    if (CREATORS.some(c => c.handle === handle)) return Promise.reject(new Error('That handle is taken by a demo creator.'));
    const old = db.me && db.me.handle; db.me = { handle, name: (name || handle).slice(0, 30), bio: bio.slice(0, 120), joined: db.me?.joined || Date.now() };
    if (old && old !== handle) db.posts.forEach(p => p.handle = handle); save(); return ok(db.me); },
  updateProfile(p) { return this.signIn({ ...db.me, ...p }); },
  getCreators: () => ok(CREATORS),
  async getProfile(handle) { const c = creator(handle); if (!c) return null; const posts = allPosts().filter(p => p.handle === handle).sort((a, b) => b.createdAt - a.createdAt).map(decorate);
    const following = db.follows.includes(handle);
    return { ...c, posts, isFollowing: following, stats: { posters: posts.length, likes: posts.reduce((s, p) => s + p.likes, 0),
      followers: c.me ? 0 : 180 + h('f' + handle) % 2400 + (following ? 1 : 0), following: c.me ? db.follows.length : 20 + h('g' + handle) % 300 } }; },
  follow(handle) { if (!db.follows.includes(handle)) db.follows.push(handle); save(); return ok(true); },
  unfollow(handle) { db.follows = db.follows.filter(x => x !== handle); save(); return ok(true); },
  like(id) { db.likes[id] = 1; save(); return this.getPost(id); },
  unlike(id) { delete db.likes[id]; save(); return this.getPost(id); },
  getPost: id => { const p = allPosts().find(p => p.id === id); return ok(p ? decorate(p) : null); },
  getFeed({ tab = 'discover' } = {}) { let ps = [...db.posts, ...DEMO]; if (tab === 'following') ps = ps.filter(p => db.follows.includes(p.handle) || (db.me && p.handle === db.me.handle));
    return ok(ps.sort((a, b) => b.createdAt - a.createdAt).map(decorate)); },
  publish(spec, { remixOf = null, challengeDay = null } = {}) { if (!db.me) return Promise.reject(new Error('Set up your profile first.'));
    const p = { id: 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), handle: db.me.handle, demo: false, spec: { t: spec.t, s: spec.s, seed: spec.seed, pal: spec.pal, mix: spec.mix }, createdAt: Date.now(), remixOf, challengeDay };
    db.posts.unshift(p); save(); return ok(decorate(p)); },
  async remix(id) { const p = await this.getPost(id); return p && { spec: { ...p.spec }, remixOf: p.handle }; },
  getDailyChallenge() { const k = dayKey(), c = challengeFor(k), end = new Date(); end.setHours(24, 0, 0, 0); return ok({ ...c, submitted: db.challenge[k] || null, streak: streak(), endsAt: end.getTime() }); },
  submitChallenge(postId) { const k = dayKey(); if (db.challenge[k]) return Promise.reject(new Error('Already submitted today — come back tomorrow.'));
    const p = db.posts.find(p => p.id === postId); if (!p) return Promise.reject(new Error('Post not found.')); p.challengeDay = k; db.challenge[k] = postId; save(); return ok({ streak: streak() }); },
  getLeaderboard({ period = 'daily' } = {}) { const k = dayKey();
    if (period === 'daily') { const ps = [...challengeEntries(k), ...db.posts.filter(p => p.challengeDay === k)].map(decorate).sort((a, b) => b.likes - a.likes);
      return ok(ps.map((p, i) => ({ rank: i + 1, handle: p.handle, likes: p.likes, post: p, demo: p.demo }))); }
    const tot = {}; allPosts().map(decorate).forEach(p => tot[p.handle] = (tot[p.handle] || 0) + p.likes);
    CREATORS.forEach(c => tot[c.handle] = (tot[c.handle] || 0) + 900 + h('a' + c.handle) % 4000); // demo history
    if (db.me) tot[db.me.handle] = tot[db.me.handle] || 0;
    return ok(Object.entries(tot).sort((a, b) => b[1] - a[1]).map(([handle, likes], i) => ({ rank: i + 1, handle, likes, demo: handle !== db.me?.handle }))); },
  resetAll() { localStorage.removeItem(KEY); db = { me: null, posts: [], likes: {}, follows: [], challenge: {} }; return ok(true); }
};
})();
