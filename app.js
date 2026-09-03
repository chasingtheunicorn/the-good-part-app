/* The Good Part — the sheet. v2.
   The book is the method; this runs it for you. Say one sentence and the app
   drafts the whole sheet, checks it against the book's three tests, works out
   the clock, and asks the one question seven days later.
   Local-first: every sheet lives on this device. No account, no server. */
(function () {
'use strict';

var KEY = 'tgp_v2', THEME = 'tgp_theme', PRICE = '$29';
// Test build: nothing is gated, so the whole loop can be judged before anyone pays.
// Flip DEMO to false for the store build. The gate then counts POSTED videos, not
// sheets started, and the first three are free.
var DEMO = true, FREE_VIDEOS = 3;
var Cap = window.Capacitor || null;
function has(p) { return Cap && Cap.Plugins && Cap.Plugins[p]; }

// ---------- the book's words ----------
var DOORS = [
  ['1', 'A thing you have', 'You find out on the object. It is different after than before.'],
  ['2', "A day you don't own", 'You find out on somebody’s face as they meet it.'],
  ['3', 'A conversation', 'You find out when the words land.'],
  ['4', 'A performance', 'You find out whether it lands.']
];
var SIZES = ['room', 'body', 'hands', 'face', 'through'];
var SHOTQ = [
  ['1 open', 'Why should I stop?'], ['2 place', 'What am I looking at?'],
  ['3 work', 'What’s happening?'], ['4 moment', 'Wait — what?'],
  ['5 proof', 'Was that worth it?'], ['6 door', 'What now?']
];
var NUMS = [
  ['views', 'Views', 'The weakest of the four. Read it last.'],
  ['first3', 'First 3 seconds (%)', 'Under about 70 and you opened on setup.'],
  ['avgpct', 'Average duration (%)', 'Of the whole length. The middle shows up here.'],
  ['shares', 'Shares', 'The one that tracks the moment. Not likes.']
];
var LENGTHS = { Short: 30, Medium: 360, Long: 1560 };
// Card images. build_preview.py swaps these for data URIs in the single-file build.
var IMG = { idle: 'img/idle.jpg', plan: 'img/plan.jpg', shoot: 'img/shoot.jpg',
            wait: 'img/wait.jpg', test: 'img/test.jpg' };
// The one person, by role rather than by name: nothing personal is stored, and
// the roles are comparable across videos. A friend is generous; a stranger is the test.
var ROLES = [['partner', 'My partner'], ['friend', 'A friend'], ['family', 'Family'],
  ['work', 'Someone at work'], ['stranger', 'A stranger'], ['audience', 'My audience']];
// Implementation intentions: a real day, and the routine it hangs off.
var ANCHORS = ['first thing', 'at lunch', 'when I get home', 'after dinner', 'before bed'];
var DAYS = [['today', 0], ['tomorrow', 1], ['in two days', 2], ['this weekend', -1]];

// ---------- 2. the checks, which actually check ----------
var DURATION = /\b(day|days|trip|weekend|morning|afternoon|evening|holiday|vacation|week|weeks|month|year|summer|winter|session|hours|hanging out|exploring|relaxing|chilling|our time)\b/i;
var ABSTRACT = /^(the |a |an |our |my )?(love|joy|happiness|memories|memory|fun|the experience|experience|journey|adventure|vibes|energy|beauty|life|freedom|connection|growth)\b/i;
var CHANGE = /\b(hold[s]?|light[s]?|lit|open[s]?|opened|catch(es)?|caught|break[s]?|broke|land[s]?|landed|work[s]?|worked|start[s]?|started|arriv\w+|finish\w+|snap[s]?|fall[s]?|fell|win[s]?|won|fit[s]?|turn[s]?|turned|crumbl\w+|arrive|comes? on|came on|arrives|says?|said|admits?|admitted|arrived|arriving|first try|goes? in|went in|clicks?|clicked|sits?|sat|stands?|stood|stops?|stopped|realis\w+|realiz\w+|sees? it|saw it|gets? it|got it|see(s|ing)?|saw|find(s|ing)? out|found out|turns? out|whether|is (free|empty|open|on)|lands?)\b/i;
var TURN = /\b(first|finally|when|the moment|as soon as|until|then|after two years|at last|for the first time)\b/i;

function checkMoment(text) {
  var t = (text || '').trim(), words = t ? t.split(/\s+/).length : 0;
  var out = [];
  // 1 — can a camera point at it
  var isDur = DURATION.test(t) && !CHANGE.test(t);
  var isAbs = ABSTRACT.test(t);
  out.push(!t ? { s: 0, why: '' }
    : isAbs ? { s: -1, why: 'That names a feeling, not a second. What would the camera see when it happens?' }
    : isDur ? { s: -1, why: 'That is a stretch of time, and a camera cannot hold a duration. Which second of it?' }
    : { s: 1, why: 'It happens somewhere, visibly.' });
  // 2 — does something change
  var hasChange = CHANGE.test(t) || TURN.test(t);
  out.push(!t ? { s: 0, why: '' }
    : hasChange ? { s: 1, why: 'The frame is different after than before.' }
    : { s: -1, why: 'Nothing turns in that sentence. Add what is different afterward.' });
  // 3 — could a stranger retell it in one line
  var clauses = (t.match(/,/g) || []).length + (/\b(because|so that|which|although|but)\b/i.test(t) ? 1 : 0);
  out.push(!t ? { s: 0, why: '' }
    : words > 24 ? { s: -1, why: 'Too long to repeat. Cut it to the part somebody would actually say.' }
    : clauses > 2 ? { s: -1, why: 'That needs setup to make sense, so it is not the moment yet.' }
    : { s: 1, why: 'Short enough to pass on in one line.' });
  return out;
}
var CHECK_TITLES = ['I can point a camera at it', 'Something changes in it', 'A stranger could retell it in one line'];

// ---------- 4. one sentence, and the app drafts the rest ----------
var DOOR_HINTS = [
  ['1', /\b(fix\w*|repair\w*|build\w*|made|make|finish\w*|install\w*|restor\w*|paint\w*|cook\w*|bak\w*|assembl\w*|sand\w*|weld\w*|glue\w*|wir\w*|solder\w*|plant\w*|switch|engine|drawer|lamp|chair|bike|door|shelf)\b/i],
  ['2', /\b(trip|park|beach|birthday|game|visit\w*|arriv\w*|meet\w*|ride|rode|first time|holiday|airport|ship|deck|sunrise|hike|market|road|cabin|snow)\b/i],
  ['3', /\b(says?|said|tells?|told|asks?|asked|admits?|admitted|answer\w*|talk\w*|interview|story|question|confess\w*|explain\w*)\b/i],
  ['4', /\b(plays?|played|perform\w*|sings?|sang|throws?|threw|race\w*|competes?|recital|lands? the|routine|solo|match|set|stage)\b/i]
];
var FOUND_HINTS = /\b(birthday|arriv\w*|says?|said|face|meets?|met|crowd|game|race|reaction|surprise|opens? the|when (he|she|they|we) )/i;

function guessDoor(t) {
  for (var i = 0; i < DOOR_HINTS.length; i++) if (DOOR_HINTS[i][1].test(t)) return DOOR_HINTS[i][0];
  return '1';
}
function guessMode(t, door) { return (door === '1' && !FOUND_HINTS.test(t)) ? 'Made' : 'Found'; }
function draftPromise(t, door) {
  return { '1': 'You can fix the thing you’ve been stepping around.',
           '2': 'The one minute of that day worth keeping.',
           '3': 'What somebody says when they stop performing.',
           '4': 'What it takes to get it right once.' }[door];
}
function draftFeeling(t, door) {
  return { '1': 'the small, dumb satisfaction of a thing that works — right when it holds.',
           '2': 'the lift of a day turning — right when the face changes.',
           '3': 'recognition — right when the sentence lands.',
           '4': 'relief, not triumph — right when it comes off.' }[door];
}
function draftShots(moment, door) {
  var m = (moment || 'the moment').replace(/[.!]$/, '');
  var D = {
    '1': ['? — found in the edit: two seconds of ' + m, 'The room, the thing small in it. Shoot this first.',
          'Me at it, then hands and the thing.', m + ' — recording before I reach for it.',
          'Hands off it, and it holds. Two seconds.', 'One line down the lens: what it cost, what’s next.'],
    '2': ['? — two seconds of the face, out of context', 'Where we are, wide. Shoot it as we arrive.',
          'Getting there — one beat, closer.', m + ' — the face as it happens.',
          'The thing itself, two seconds, held.', 'One line on the way back.'],
    '3': ['? — the sentence, out of context', 'The room, both people in it.', 'The question being asked.',
          m + ' — the face as the words land.', 'The reaction, two seconds.', 'The line after. One line.'],
    '4': ['? — the instant it lands, sliced out', 'The venue, wide, before.', 'The attempt — one beat.',
          m + ' — the landing, and the face.', 'The room reacting. Hands, two seconds.', 'One line: what it took.']
  }[door] || [];
  var sizes = ['hands', 'room', 'body', 'face', 'hands', 'face'];
  return D.map(function (t, i) { return { text: t, size: sizes[i], done: false }; });
}
function draftSheet(s) {
  var t = s.moment || '';
  if (!s.door) { s.door = guessDoor(t); s.guessed = { door: true, mode: true, promise: true, feeling: true, win: true }; }
  if (!s.mode) s.mode = guessMode(t, s.door);
  if (!s.promise) s.promise = draftPromise(t, s.door);
  if (!s.feeling) s.feeling = draftFeeling(t, s.door);
  if (!s.win) s.win = '20 minutes, once';
  if (!s.shots) s.shots = draftShots(t, s.door);
  return s;
}

// ---------- 6. the arithmetic the book makes you do ----------
function mmss(sec) { var m = Math.floor(sec / 60), r = Math.round(sec % 60);
  return m + ':' + (r < 10 ? '0' : '') + r; }
function timing(s) {
  var total = LENGTHS[s.length] || 30, rows = [];
  rows.push(['Whole thing, about', s.length === 'Short' ? '30 sec' : mmss(total)]);
  rows.push(['The moment lands at', mmss(total * 2 / 3)]);
  if (s.length === 'Short') {
    rows.push(['The moment runs', '3 to 5 sec, the only shot allowed to']);
    rows.push(['Every other shot', 'about 3 sec']);
    rows.push(['Filming takes', 'about 20 min for all six']);
  } else if (s.length === 'Medium') {
    rows.push(['The question opens by', '0:15']);
    rows.push(['First clean event by', '1:00']);
    rows.push(['Proof and door, last', '0:30']);
    rows.push(['Events to build', '3 to 8, no two the same length']);
  } else {
    rows.push(['Cold open ends', '1:30']);
    rows.push(['Act one closes', '9:00']);
    rows.push(['Act two closes', '17:00']);
    rows.push(['The button, last', '60 to 90 sec']);
  }
  return rows;
}

// ---------- 5. the diagnosis, as an interview ----------
var DIAG = [
  { q: 'Where did it go wrong?', a: [
    ['nobody', 'Nobody watched it', 'They scrolled past, or left in the first seconds'],
    ['flat', 'People watched, nothing happened', 'It played fine and landed on nobody'],
    ['shoot', 'The day itself went wrong', 'The filming, not the video'],
    ['edit', 'I can’t make it work', 'Too much footage, or it won’t cut together']
  ]},
];
var FIXES = {
  nobody: [
    ['They left in the first three seconds', 'You opened on setup.',
     'Slice two seconds out of the moment itself and lead with that, out of context. Shot one is never an introduction. Your own shot one says: '],
    ['They watched and never shared it', 'You gave them nothing to be by sending it.',
     'The moment is there but not legible. Cut less around it and take the narration off the top of it.']
  ],
  flat: [
    ['It was fine but forgettable', 'No moment. This is the most common failure by a long way.',
     'Run the three checks again on what you wrote. If it fails any of them, the video was never going to carry.'],
    ['It felt big to me and played small', 'It was interesting to you and invisible to everybody else.',
     'Ask whether a stranger with the sound off could see the change happen. If not, that is the whole answer.'],
    ['The middle sagged', 'The question closed early, or an event has no edges.',
     'Cut one whole event out. Do not trim everything by ten percent.'],
    ['The ending went flat', 'You found the ending in the edit instead of writing it.',
     'Pick one button and build the last stretch toward it. Your door line was: ']
  ],
  shoot: [
    ['I came home exhausted', 'The window was never closed.',
     'Announce it out loud next time. The sheet is permission to stop, not a target. Yours said: '],
    ['Everyone with me was fed up', 'You said “wait — let me get this.”',
     'That line costs more than any shot is worth. Anyone present can call it off, with no negotiation.'],
    ['Nothing visible happened all day', 'The change was real but not in the object.',
     'Find the point of no return and shoot an empty frame: the same place, twice, once full and once empty.'],
    ['It plays as fake', 'Something was performed, or asked for twice.',
     'Cut it. There is no fix in the edit, and people detect it faster than you can hide it.']
  ],
  edit: [
    ['I have hours of footage', 'You shot the day instead of the moment.',
     'Fill the sheet before you leave, not after you arrive. Six shots, then the camera goes away.'],
    ['It wants to be longer', 'Usually it does not.',
     'Name the person and name what changes in them. If either will not come, it is a medium, not a long.'],
    ['I don’t want to be on camera', 'Nothing. That is a reason, not a problem.',
     'Make the viewer the one who finds out. The last step becomes the thing itself, matched.']
  ]
};

// ---------- data ----------
var LAMP = {
  id: 'sample-lamp', sample: true, title: 'The lamp', created: '2026-09-01T19:50:00.000Z',
  moment: 'The switch, first try — and the light holds.',
  door: '1', mode: 'Made', length: 'Short', win: '20 minutes, after dinner', said: 'told the kitchen',
  promise: 'You can fix the thing you’ve been stepping around for two years.',
  feeling: 'the small, dumb satisfaction of a switch that works — right when the light holds.',
  shots: [
    { text: '? — found in the edit. Two seconds of filament.', size: 'hands', done: true },
    { text: 'Hallway from the kitchen doorway, lamp small. FIRST.', size: 'room', done: true },
    { text: 'Me at the table, shade off → hands and the cord.', size: 'body', done: true },
    { text: 'Plug in, switch. Recording BEFORE I reach for it.', size: 'face', done: true },
    { text: 'Hand lets go of the switch, light stays on. Two seconds.', size: 'hands', done: true },
    { text: 'Down the lens: “Two years. Eleven bucks.”', size: 'face', done: true }
  ],
  night: ['Yes — on take two.', '8:32. Close.', 'Empty hallway first. Nearly didn’t.'],
  posted: '2026-09-02', week: { answer: 'The switch, first try — and the light holds.', pass: true },
  numbers: { views: 412, first3: 78, avgpct: 71, shares: 31 }
};
var db = { sheets: [LAMP], lic: { unlocked: false, code: null, trialEnds: null } };
function migrate(v) {
  if (!v || !v.sheets) return null;
  if (!v.lic) v.lic = { unlocked: false, code: null, trialEnds: null };
  if (!v.sheets.some(function (s) { return s.id === 'sample-lamp'; })) v.sheets.unshift(LAMP);
  return v;
}
function loadSync() { try { var v = migrate(JSON.parse(localStorage.getItem(KEY) || 'null')); if (v) db = v; } catch (e) {} }
function save() {
  var json = JSON.stringify(db);
  try { localStorage.setItem(KEY, json); } catch (e) {}
  if (has('Preferences')) Cap.Plugins.Preferences.set({ key: KEY, value: json }).catch(function () {});
}
function blank() {
  return { id: 's' + Date.now(), created: new Date().toISOString(), title: '', moment: '',
    door: '', mode: '', length: 'Short', win: '', said: '', promise: '', feeling: '', shots: null,
    guessed: {}, night: ['', '', ''], posted: '', week: null, numbers: null, plan: null, shown: null };
}
function bySheet(id) { for (var i = 0; i < db.sheets.length; i++) if (db.sheets[i].id === id) return db.sheets[i]; return null; }
function mine() { return db.sheets.filter(function (s) { return !s.sample; }); }

// ---------- licence ----------
function trialLeft() { return db.lic.trialEnds ? Math.ceil((new Date(db.lic.trialEnds) - new Date()) / 86400000) : 0; }
function licensed() { return db.lic.unlocked || trialLeft() > 0; }
function posted() { return mine().filter(function (x) { return x.posted; }).length; }
function canStart() { return DEMO || licensed() || posted() < FREE_VIDEOS; }
var AL = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
function validCode(raw) {
  var c = String(raw || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (c.length !== 16) return false;
  var sum = 7;
  for (var i = 0; i < 15; i++) { var v = AL.indexOf(c[i]); if (v < 0) return false; sum = (sum * 31 + v) % 32; }
  return AL[sum] === c[15];
}
function redeem(raw) {
  if (!validCode(raw)) return false;
  var d = new Date(); d.setDate(d.getDate() + 30);
  db.lic.code = String(raw).toUpperCase(); db.lic.trialEnds = d.toISOString(); save();
  return true;
}
function purchase() {
  if (has('InAppPurchase')) return Cap.Plugins.InAppPurchase.purchase({ productId: 'goodpart.unlock' })
    .then(function () { db.lic.unlocked = true; save(); go('home'); });
  db.lic.unlocked = true; save(); go('home');
}

// ---------- 3. voice ----------
var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
function voiceAvailable() { return !!SR || has('SpeechRecognition'); }
function listen(onText, onState) {
  if (has('SpeechRecognition')) {
    var P = Cap.Plugins.SpeechRecognition;
    onState(true);
    P.requestPermissions().then(function () {
      return P.start({ language: 'en-US', partialResults: false, popup: false });
    }).then(function (r) {
      onState(false); if (r && r.matches && r.matches[0]) onText(r.matches[0]);
    }).catch(function () { onState(false); });
    return { stop: function () { P.stop().catch(function () {}); onState(false); } };
  }
  if (!SR) return null;
  var r = new SR();
  r.lang = 'en-US'; r.interimResults = true; r.continuous = false;
  var final = '';
  r.onresult = function (e) {
    var interim = '';
    for (var i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final += e.results[i][0].transcript; else interim += e.results[i][0].transcript;
    }
    onText(final || interim, !!final);
  };
  r.onend = function () { onState(false); };
  r.onerror = function () { onState(false); };
  onState(true); r.start();
  return { stop: function () { try { r.stop(); } catch (e) {} } };
}

// ---------- notifications ----------
function scheduleWeekTest(s) {
  if (!has('LocalNotifications')) return;
  var when = new Date(s.posted); when.setDate(when.getDate() + 7); when.setHours(9, 0, 0, 0);
  if (when < new Date()) return;
  Cap.Plugins.LocalNotifications.schedule({ notifications: [{
    id: Math.abs(hash(s.id)) % 100000, title: 'The Week Test',
    body: 'Without opening anything: name the moment.', schedule: { at: when } }] }).catch(function () {});
}
function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

// ---------- helpers ----------
var view = { screen: 'home', id: null, arg: null };
function go(screen, id, arg) {
  view = { screen: screen, id: id === undefined ? view.id : id, arg: arg === undefined ? null : arg };
  render(); window.scrollTo(0, 0);
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
  return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function fmt(d) { if (!d) return ''; var x = new Date(d);
  return isNaN(x) ? String(d) : x.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
function daysUntil(p) { var d = new Date(p); d.setDate(d.getDate() + 7); return Math.ceil((d - new Date()) / 86400000); }
function el(h) { var t = document.createElement('template'); t.innerHTML = h.trim(); return t.content; }
function $(s, r) { return (r || document).querySelector(s); }
function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

// ---------- render ----------
function render() {
  var main = $('#main'), bar = $('#barIn');
  main.innerHTML = ''; bar.innerHTML = '';
  var s = view.id ? bySheet(view.id) : null;
  var R = { home: home, say: say, sheet: sheetScreen, after: after, numbers: numbersScreen,
            log: logScreen, season: season, diagnose: diagnose, settings: settings, unlock: unlock,
            plan: planScreen, shown: shownScreen }[view.screen] || home;
  if (!s && ['say', 'sheet', 'after', 'numbers', 'plan', 'shown'].indexOf(view.screen) >= 0) return go('home');
  R(main, bar, s);
}
// ---------- one state at a time ----------
function allDone(s) { return (s.shots || []).length === 6 && s.shots.every(function (x) { return x.done; }); }
function stateOf(s) {
  if (!s || !s.moment) return 'idle';
  if (!s.plan || !s.plan.date) return 'plan';
  if (!allDone(s)) return 'shoot';
  if (!s.posted) return 'post';
  if (!s.week) return daysUntil(s.posted) <= 0 ? 'due' : 'wait';
  if (!s.shown) return 'show';
  return 'idle';
}
function live() {
  var open = mine().filter(function (s) { return s.moment && stateOf(s) !== 'idle'; });
  var due = open.filter(function (s) { return stateOf(s) === 'due'; });
  if (due.length) return due[0];
  return open.length ? open[open.length - 1] : null;
}
function planLabel(p) {
  if (!p || !p.date) return '';
  var d = new Date(p.date), now = new Date();
  var days = Math.round((d.setHours(12, 0, 0, 0) - new Date(now).setHours(12, 0, 0, 0)) / 86400000);
  var day = days === 0 ? 'today' : days === 1 ? 'tomorrow' :
    new Date(p.date).toLocaleDateString(undefined, { weekday: 'long' });
  return day + ', ' + p.anchor;
}
function pill(s) {
  if (s.week) return s.week.pass ? '<span class="pill ok">passed</span>' : '<span class="pill bad">failed</span>';
  if (s.posted) { var n = daysUntil(s.posted);
    return n <= 0 ? '<span class="pill due">week test</span>' : '<span class="pill">' + n + ' day' + (n === 1 ? '' : 's') + '</span>'; }
  if (s.shots) return '<span class="pill">ready to shoot</span>';
  return '<span class="pill">unfinished</span>';
}

function seasonStrip() {
  var done = mine().filter(function (s) { return s.week; })
    .sort(function (x, y) { return new Date(x.posted) - new Date(y.posted); });
  var pass = done.filter(function (s) { return s.week.pass; }).length, cells = '';
  for (var i = 0; i < 12; i++)
    cells += '<i class="' + (i < done.length ? (done[i].week.pass ? 'p' : 'f') : (i === done.length ? 'now' : '')) + '"></i>';
  return '<div class="striplab"><span>Your first season</span><span>' + pass + ' of ' + done.length +
    ' named cold</span></div><div class="strip">' + cells + '</div>' +
    '<p class="xs">' + (done.length === 0 ? 'Twelve videos makes a season. The first slot is waiting.'
      : done.length >= 12 ? 'A full season. Read the fails together.'
      : (12 - done.length) + ' to go. Only the fails are worth re-reading.') + '</p>';
}
function card(img, ey, title, body, acts) {
  return '<div class="hero"><div class="band" style="background-image:url(&quot;' + IMG[img] + '&quot;)">' +
    '<div class="ey">' + ey + '</div></div><div class="body"><h2 class="t">' + title + '</h2>' +
    '<p>' + body + '</p><div class="act">' + acts + '</div></div></div>';
}
function home(main, bar) {
  var s = live(), st = stateOf(s), html = '';
  if (st === 'idle') {
    html = card('idle', 'Start here', 'What\u2019s the good part?',
      'One sentence about the second where somebody finds out. Say it out loud and the app writes the rest of the sheet.',
      '<button class="btn go" id="a1">Say my moment</button>');
  } else if (st === 'plan') {
    html = card('plan', 'Next \u00b7 make it a plan', 'When are you shooting it?',
      'A day, and the thing you already do just before it. Deciding now is the difference between meaning to and doing it.',
      '<button class="btn go" id="a1">Set the day</button><button class="btn quiet" id="a2">See the sheet</button>');
  } else if (st === 'shoot') {
    var left = 6 - s.shots.filter(function (x) { return x.done; }).length;
    html = card('shoot', 'Next \u00b7 ' + planLabel(s.plan),
      left === 6 ? 'Six shots, then stop.' : left + ' shot' + (left === 1 ? '' : 's') + ' to go.',
      'Tick them as they land. When all six exist the camera goes away, and the rest of the day is yours.',
      '<button class="btn go" id="a1">Open my shots</button>');
  } else if (st === 'post') {
    html = card('wait', 'Next \u00b7 it exists', 'Six shots. Now put it out.',
      'Say what it is, don\u2019t sell what it is. Then tap posted and don\u2019t look at anything for seven days.',
      '<button class="btn go" id="a1">I posted it</button><button class="btn quiet" id="a2">Three lines first</button>');
  } else if (st === 'wait') {
    var n = daysUntil(s.posted);
    html = card('wait', 'Waiting', 'Week Test in ' + n + ' day' + (n === 1 ? '' : 's') + '.',
      'Nothing to do until then. Not the numbers, not the comments. The whole test is whether you can still name it.',
      '<button class="btn quiet" id="a1">Start the next one</button>');
  } else if (st === 'due') {
    html = card('test', 'Due today', 'Name the moment.',
      'Out loud, in one sentence, without opening anything. Then the app shows you what your sheet said.',
      '<button class="btn go" id="a1">Take the test</button>');
  } else if (st === 'show') {
    html = card('test', 'One more thing', 'Show it to one person.',
      'Ask what the moment was and write down what they say. This is the coaching a book cannot give you.',
      '<button class="btn go" id="a1">Log what they said</button><button class="btn quiet" id="a2">Skip</button>');
  }
  main.appendChild(el('<p class="eyebrow">The Good Part \u00b7 the sheet</p>' + html + seasonStrip() +
    '<div class="row" style="margin-top:16px"><button class="btn quiet" id="hist">All my sheets</button>' +
    '<button class="btn quiet" id="btnDiag">Something went wrong</button></div>' +
    '<p class="xs" style="margin-top:14px">Sheets stay on this device.' +
      (DEMO ? ' Test build \u2014 everything is open.' : db.lic.unlocked ? ' Unlocked.' :
       trialLeft() > 0 ? ' Book code: ' + trialLeft() + ' days left.' :
       ' ' + Math.max(0, FREE_VIDEOS - posted()) + ' free videos left.') + '</p>'));
  var a1 = $('#a1', main), a2 = $('#a2', main);
  if (a1) a1.onclick = function () {
    if (st === 'idle' || st === 'wait') return newSheet();
    if (st === 'plan') return go('plan', s.id);
    if (st === 'shoot') return go('sheet', s.id);
    if (st === 'post') { s.posted = new Date().toISOString().slice(0, 10); save(); scheduleWeekTest(s); return go('after', s.id); }
    if (st === 'due') return go('after', s.id);
    if (st === 'show') return go('shown', s.id);
  };
  if (a2) a2.onclick = function () {
    if (st === 'plan') return go('sheet', s.id);
    if (st === 'post') return go('after', s.id);
    if (st === 'show') { s.shown = { role: '', said: '', match: null, skipped: true }; save(); return render(); }
  };
  $('#hist', main).onclick = function () { go('log'); };
  $('#btnDiag', main).onclick = function () { go('diagnose', s ? s.id : null, null); };
  bar.innerHTML = '<button class="btn quiet" id="set">Settings</button><button class="btn go" id="b2">' +
    (st === 'idle' || st === 'wait' ? 'Say my moment' : 'Carry on') + '</button>';
  $('#set', bar).onclick = function () { go('settings'); };
  $('#b2', bar).onclick = function () { (st === 'idle' || st === 'wait') ? newSheet() : (a1 && a1.click()); };
}

// ---------- the plan: a day, and what you already do just before ----------
function dateFor(k) {
  var d = new Date();
  if (k === 'this weekend') { do { d.setDate(d.getDate() + 1); } while (d.getDay() !== 6); }
  else d.setDate(d.getDate() + ({ 'today': 0, 'tomorrow': 1, 'in two days': 2 })[k]);
  d.setHours(9, 0, 0, 0); return d.toISOString();
}
function dayKey(iso) {
  if (!iso) return '';
  var days = Math.round((new Date(new Date(iso).setHours(12, 0, 0, 0)) - new Date(new Date().setHours(12, 0, 0, 0))) / 86400000);
  return days === 0 ? 'today' : days === 1 ? 'tomorrow' : days === 2 ? 'in two days' : 'this weekend';
}
function planScreen(main, bar, s) {
  var p = s.plan || { date: '', anchor: 'after dinner', mins: 20 };
  main.appendChild(el('<p class="eyebrow e">Before you shoot</p><h1>When are you doing this?</h1>' +
    '<p>Pick the day, and the thing you already do just before it. Deciding now, rather than on the day, is the biggest single difference between meaning to and doing it.</p>' +
    '<label class="lbl">The day</label><div class="when" id="days">' +
      DAYS.map(function (d) { return '<button data-k="' + d[0] + '"' + (p.key === d[0] ? ' class="on"' : '') + '>' + d[0] + '</button>'; }).join('') + '</div>' +
    '<label class="lbl e">Right after I\u2026</label><div class="who" id="anchors">' +
      ANCHORS.map(function (x) { return '<button data-a="' + x + '"' + (p.anchor === x ? ' class="on"' : '') + '>' + x + '</button>'; }).join('') + '</div>' +
    '<div class="note e"><b>Say it out loud to whoever is with you.</b> The window is permission to stop, not a target. Twenty minutes, once, gets all six shots.</div>' +
    '<div id="pv"></div>'));
  function preview() {
    $('#pv', main).innerHTML = p.date ? '<div class="note"><b>The plan:</b> ' + esc(p.key || dayKey(p.date)) + ', ' +
      esc(p.anchor) + ', twenty minutes. Your phone will say so on the day.</div>' : '';
  }
  preview();
  $$('#days button', main).forEach(function (b) { b.onclick = function () {
    p.date = dateFor(b.dataset.k); p.key = b.dataset.k; $$('#days button', main).forEach(function (x) { x.classList.toggle('on', x === b); }); preview(); }; });
  $$('#anchors button', main).forEach(function (b) { b.onclick = function () {
    p.anchor = b.dataset.a; $$('#anchors button', main).forEach(function (x) { x.classList.toggle('on', x === b); }); preview(); }; });
  bar.innerHTML = '<button class="btn quiet" id="back">Back</button><button class="btn go" id="ok">That\u2019s the plan</button>';
  $('#back', bar).onclick = function () { go('home'); };
  $('#ok', bar).onclick = function () {
    if (!p.date) { p.date = dateFor('tomorrow'); p.key = 'tomorrow'; }
    s.plan = p; s.win = planLabel(p) + ', 20 minutes';
    if (s.guessed) s.guessed.win = false;
    save(); schedulePlan(s); go('home');
  };
}
function schedulePlan(s) {
  if (!has('LocalNotifications') || !s.plan || !s.plan.date) return;
  var when = new Date(s.plan.date);
  if (when < new Date()) return;
  Cap.Plugins.LocalNotifications.schedule({ notifications: [{
    id: (Math.abs(hash(s.id)) % 90000) + 90000, title: 'Six shots, twenty minutes',
    body: (s.moment || 'Your moment') + ' \u2014 ' + s.plan.anchor + '.',
    schedule: { at: when } }] }).catch(function () {});
}

// ---------- the one person, by role rather than by name ----------
function shownScreen(main, bar, s) {
  var w = s.shown || { role: '', said: '', match: null };
  main.appendChild(el('<p class="eyebrow e">One person, one question</p><h1>What did they say the moment was?</h1>' +
    '<p>Hand it to one person and ask. Do not tell them what you were going for. What they name back is worth more than any number the platform gives you.</p>' +
    '<label class="lbl">Who did you show it to?</label><div class="who" id="roles">' +
      ROLES.map(function (r) { return '<button data-r="' + r[0] + '"' + (w.role === r[0] ? ' class="on"' : '') + '>' + r[1] + '</button>'; }).join('') + '</div>' +
    '<label class="lbl e" for="said">They said the moment was\u2026</label>' +
    '<input type="text" id="said" value="' + esc(w.said) + '" placeholder="in their words, not yours">' +
    (voiceAvailable() ? '<button class="mic" id="smic" style="margin-top:8px"><span class="dot"></span><span id="smicTxt">Say it</span></button>' : '') +
    '<div class="note"><b>Your sheet said:</b> \u201c' + esc(s.moment) + '\u201d</div>' +
    '<label class="lbl">Is that the same thing?</label><div class="when" id="mt">' +
      '<button data-m="1"' + (w.match === true ? ' class="on"' : '') + '>Yes, same moment</button>' +
      '<button data-m="0"' + (w.match === false ? ' class="on"' : '') + '>No, something else</button></div>' +
    '<div class="note"><b>If they named something else, you have learned more than the Week Test can tell you.</b> That is not a failure. It is the one place the method gets corrected by somebody who was not there.</div>'));
  $$('#roles button', main).forEach(function (b) { b.onclick = function () {
    w.role = b.dataset.r; $$('#roles button', main).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
  $$('#mt button', main).forEach(function (b) { b.onclick = function () {
    w.match = b.dataset.m === '1'; $$('#mt button', main).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
  var sm = $('#smic', main), r4 = null;
  if (sm) sm.onclick = function () {
    if (r4) { r4.stop(); r4 = null; return; }
    r4 = listen(function (t) { $('#said', main).value = t; }, function (on) {
      sm.classList.toggle('rec', on); $('#smicTxt', main).textContent = on ? 'Listening' : 'Say it'; if (!on) r4 = null; });
  };
  bar.innerHTML = '<button class="btn quiet" id="skip">Skip</button><button class="btn go" id="ok">Save</button>';
  $('#skip', bar).onclick = function () { s.shown = { role: '', said: '', match: null, skipped: true }; save(); go('home'); };
  $('#ok', bar).onclick = function () { w.said = $('#said', main).value.trim(); s.shown = w; save(); go('season'); };
}

function newSheet() {
  if (!canStart()) return go('unlock');
  var n = blank(); db.sheets.push(n); save(); go('say', n.id);
}

// ---------- screen one: say it ----------
function say(main, bar, s) {
  main.appendChild(el(
    '<p class="eyebrow e">The one question</p>' +
    '<h1>What’s the one thing you’d tell someone about a week from now?</h1>' +
    '<p>Not the day. Not the subject. The second where somebody finds out. Say it the way you would say it out loud.</p>' +
    '<div class="say"><textarea id="m" rows="3" placeholder="The switch, first try — and the light holds.">' + esc(s.moment) + '</textarea></div>' +
    (voiceAvailable() ? '<button class="mic" id="mic"><span class="dot"></span><span id="micTxt">Say it out loud</span></button>' : '') +
    '<div id="checks" style="margin-top:16px"></div>'));
  var ta = $('#m', main);
  function paint() {
    var r = checkMoment(ta.value);
    $('#checks', main).innerHTML = r.map(function (c, i) {
      var cls = c.s === 1 ? 'y' : c.s === -1 ? 'n' : 'wait';
      var mark = c.s === 1 ? '✓' : c.s === -1 ? '!' : '·';
      return '<div class="chk ' + cls + '"><div class="m">' + mark + '</div><div><b>' + CHECK_TITLES[i] + '</b>' +
        (c.why ? '<small>' + esc(c.why) + '</small>' : '') + '</div></div>'; }).join('') +
      (r.every(function (c) { return c.s === 1; })
        ? '<div class="note"><b>All three. That is a moment.</b> The sheet is one tap away.</div>'
        : ta.value.trim() ? '<div class="note stop"><b>That reads as material, not a moment.</b> Material is fine, it just is not the thing anyone will carry. You can go on anyway, but the book would send you back out.</div>' : '');
  }
  ta.addEventListener('input', paint); paint(); ta.focus();
  var rec = null, micBtn = $('#mic', main);
  if (micBtn) micBtn.onclick = function () {
    if (rec) { rec.stop(); rec = null; return; }
    rec = listen(function (text) { ta.value = text; paint(); },
      function (on) { micBtn.classList.toggle('rec', on); $('#micTxt', main).textContent = on ? 'Listening — tap to stop' : 'Say it out loud';
        if (!on) rec = null; });
  };
  bar.innerHTML = '<button class="btn quiet" id="back">Back</button><button class="btn go" id="next">Draft my sheet</button>';
  $('#back', bar).onclick = function () { if (!s.moment) { db.sheets = db.sheets.filter(function (x) { return x.id !== s.id; }); save(); } go('home'); };
  $('#next', bar).onclick = function () {
    s.moment = ta.value.trim(); if (!s.moment) return ta.focus();
    s.title = s.moment.slice(0, 46); draftSheet(s); save(); go('sheet', s.id, 'fresh');
  };
}

// ---------- screen two: the sheet, fixed by tapping ----------
function field(k, val, opts) {
  opts = opts || {};
  return '<button class="field" data-f="' + k + '"><div class="k' + (opts.e ? ' e' : '') + '">' + opts.label +
    (opts.guess ? '<span class="guess">guessed</span>' : '') + '</div><div class="v' + (opts.plain ? ' plain' : '') + '">' +
    esc(val || '—') + '</div></button>';
}
function sheetScreen(main, bar, s) {
  var g = s.guessed || {};
  var open = view.arg;
  var rows = timing(s);
  main.appendChild(el(
    '<p class="eyebrow">' + (s.sample ? 'The book’s example, filled in' : 'Your sheet') + '</p>' +
    '<h1>' + (s.sample ? 'The lamp' : 'Fix what it got wrong.') + '</h1>' +
    (s.sample ? '<p>This is the lamp’s sheet from the book, exactly as it was written.</p>'
      : '<p>Drafted from your sentence. Tap anything to change it. Nothing here needs typing unless the app guessed badly.</p>') +
    field('moment', s.moment, { label: 'My moment', e: true }) +
    field('door', 'Door ' + s.door + ' · ' + (DOORS[+s.door - 1] || ['', ''])[1], { label: 'Door', guess: g.door, plain: true }) +
    field('mode', s.mode + (s.mode === 'Found' ? ' — plan the setting and the ending only' : ' — you get a second take'), { label: 'Made or Found', guess: g.mode, plain: true }) +
    field('length', s.length, { label: 'Length', plain: true }) +
    field('win', s.win, { label: 'Filming window', e: true, guess: g.win, plain: true }) +
    field('promise', s.promise, { label: 'The promise', guess: g.promise }) +
    field('feeling', s.feeling, { label: 'The feeling', guess: g.feeling }) +
    '<div class="timing"><div class="k">The clock, worked out for you</div><ul>' +
      rows.map(function (r) { return '<li><span>' + r[0] + '</span><b>' + r[1] + '</b></li>'; }).join('') + '</ul></div>' +
    '<h2>Your six shots</h2><p class="xs">Tick them as they are in the can. Six ticks and the camera goes away.</p>' +
    '<div id="shots">' + (s.shots || []).map(function (sh, i) {
      return '<label class="check"><input type="checkbox" data-i="' + i + '"' + (sh.done ? ' checked' : '') +
        '><span><b>' + SHOTQ[i][0] + ' · ' + sh.size + '</b><small>' + esc(sh.text) +
        '</small></span></label>'; }).join('') + '</div>' +
    '<div id="editor"></div>'));

  $$('.field', main).forEach(function (b) { b.onclick = function () { editField(main, s, b.dataset.f); }; });
  if (open) editField(main, s, open);
  $$('#shots input', main).forEach(function (c) { c.onchange = function () {
    s.shots[+c.dataset.i].done = c.checked; save();
    if (s.shots.every(function (x) { return x.done; })) alert('Six shots. The camera goes away.\nThe rest of the day is yours.');
    render(); }; });

  bar.innerHTML = '<div class="row"><button class="btn quiet" id="home">' + (s.sample ? 'Home' : 'Sheets') +
    '</button><button class="btn quiet" id="share">Share</button></div>' +
    '<button class="btn go" id="after">' + (s.sample ? 'Say mine' : (!s.plan || !s.plan.date) ? 'When?' : 'That night') + '</button>';
  $('#home', bar).onclick = function () { go('home'); };
  $('#share', bar).onclick = function () {
    var text = sheetText(s);
    if (has('Share')) return Cap.Plugins.Share.share({ title: 'My Day Sheet', text: text }).catch(function () {});
    if (navigator.share) return navigator.share({ text: text }).catch(function () {});
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () {
      var b = $('#share', bar); b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Share'; }, 1400); });
  };
  $('#after', bar).onclick = function () {
    if (s.sample) return newSheet();
    if (!s.plan || !s.plan.date) return go('plan', s.id);
    go('after', s.id);
  };
}
function editField(main, s, f) {
  if (s.sample) return;
  var box = $('#editor', main), html = '';
  function clear() { if (s.guessed) s.guessed[f] = false; }
  if (f === 'door') {
    html = '<div class="note"><b>Which door?</b> The moment is the same unit at all four. What changes is the question you are waiting on.<div class="seg">' +
      DOORS.map(function (d) { return '<button data-v="' + d[0] + '"' + (s.door === d[0] ? ' class="on"' : '') + '>Door ' + d[0] + '</button>'; }).join('') +
      '</div><div class="xs" style="margin-top:8px">' + (DOORS[+s.door - 1] || ['', '', ''])[2] + '</div></div>';
  } else if (f === 'mode') {
    html = '<div class="note e"><b>Do you control when it happens?</b><div class="seg">' +
      ['Made', 'Found'].map(function (m) { return '<button data-v="' + m + '"' + (s.mode === m ? ' class="on"' : '') + '>' + m + '</button>'; }).join('') +
      '</div><div class="xs" style="margin-top:8px">Never ask for it twice. A moment you can request on demand is a demonstration.</div></div>';
  } else if (f === 'length') {
    html = '<div class="note"><b>How long?</b> Pick one. Do not shoot for two.<div class="seg">' +
      Object.keys(LENGTHS).map(function (L) { return '<button data-v="' + L + '"' + (s.length === L ? ' class="on"' : '') + '>' + L + '</button>'; }).join('') +
      '</div><div class="xs" style="margin-top:8px">Everybody should start with a short, including people who intend to make long things.</div></div>';
  } else {
    var labels = { moment: 'My moment', win: 'Filming window', promise: 'A stranger watches this and gets…', feeling: 'I want them to feel ______ when ______' };
    html = '<div class="note' + (f === 'win' ? ' e' : '') + '"><b>' + labels[f] + '</b>' +
      '<input type="text" id="fx" value="' + esc(s[f]) + '" style="margin-top:8px">' +
      (voiceAvailable() && f !== 'win' ? '<button class="mic" id="fmic" style="margin-top:8px"><span class="dot"></span><span id="fmicTxt">Say it</span></button>' : '') +
      '<div class="row" style="margin-top:8px"><button class="btn go" id="fok">Save</button></div></div>';
  }
  box.innerHTML = html;
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  $$('.seg button', box).forEach(function (b) { b.onclick = function () {
    s[f] = b.dataset.v; clear();
    if (f === 'door') { s.shots = draftShots(s.moment, s.door);
      if (s.guessed && s.guessed.promise) { s.promise = draftPromise(s.moment, s.door); s.feeling = draftFeeling(s.moment, s.door); } }
    save(); go('sheet', s.id, f); }; });
  var ok = $('#fok', box);
  if (ok) {
    var inp = $('#fx', box); inp.focus();
    ok.onclick = function () { s[f] = inp.value.trim(); if (f === 'moment') s.title = s[f].slice(0, 46); clear(); save(); go('sheet', s.id); };
    var fm = $('#fmic', box), r2 = null;
    if (fm) fm.onclick = function () {
      if (r2) { r2.stop(); r2 = null; return; }
      r2 = listen(function (t) { inp.value = t; }, function (on) {
        fm.classList.toggle('rec', on); $('#fmicTxt', box).textContent = on ? 'Listening' : 'Say it'; if (!on) r2 = null; });
    };
  }
}
function sheetText(s) {
  return 'THE DAY SHEET — ' + (s.title || s.moment) + '\n\nMoment: ' + s.moment +
    '\nDoor ' + s.door + ' · ' + s.mode + ' · ' + s.length + '\nWindow: ' + s.win +
    '\nPromise: ' + s.promise + '\nFeeling: ' + s.feeling + '\n\n' +
    (s.shots || []).map(function (sh, i) { return (sh.done ? '[x] ' : '[ ] ') + SHOTQ[i][0] + ' — ' + sh.text + ' (' + sh.size + ')'; }).join('\n') +
    '\n\n' + timing(s).map(function (r) { return r[0] + ': ' + r[1]; }).join('\n') +
    '\n\nWhen every box is ticked, the camera goes away.';
}

// ---------- that night, posting, the week test ----------
function after(main, bar, s) {
  var due = s.posted ? daysUntil(s.posted) : null, wt = '';
  if (s.posted) {
    if (s.week) {
      wt = '<div class="note ' + (s.week.pass ? '' : 'stop') + '"><b>Week Test: ' + (s.week.pass ? 'passed' : 'failed') +
        '.</b><br>You said: “' + esc(s.week.answer) + '”<br>The sheet said: “' + esc(s.moment) + '”<br>' +
        (s.week.pass ? 'It worked. No number changes that.' : 'It didn’t, and no number changes that either.') + '</div>' +
        '<div class="row"><button class="btn ' + (s.numbers ? 'quiet' : 'go') + '" id="nums">' +
        (s.numbers ? 'Edit the four numbers' : 'Now the four numbers') + '</button>' +
        (s.week.pass ? '' : '<button class="btn quiet" id="dg">Work out why</button>') + '</div>';
    } else if (due > 0) {
      wt = '<div class="note"><b>Week Test in ' + due + ' day' + (due === 1 ? '' : 's') +
        '.</b> Without looking at anything, you’ll name the moment out loud. One sentence, no hedging.</div>';
    } else {
      wt = '<h2>The Week Test. Don’t look at anything.</h2><p>Name the moment out loud, in one sentence. Then compare.</p>' +
        '<input type="text" id="wa" placeholder="The moment was…">' +
        (voiceAvailable() ? '<button class="mic" id="wmic" style="margin-top:8px"><span class="dot"></span><span id="wmicTxt">Say it out loud</span></button>' : '') +
        '<div class="row" style="margin-top:12px"><button class="btn go" id="wgo">Compare with my sheet</button></div><div id="wres"></div>';
    }
  }
  main.appendChild(el('<p class="eyebrow e">Show it</p><h1>The same night, three lines.</h1><p>A record, not a verdict.</p>' +
    '<label class="lbl" for="n0">Moment land where I said?</label><input type="text" id="n0" value="' + esc(s.night[0]) + '" placeholder="Yes — on take two.">' +
    '<label class="lbl" for="n1">Camera down when I said?</label><input type="text" id="n1" value="' + esc(s.night[1]) + '" placeholder="8:32. Close.">' +
    '<label class="lbl" for="n2">One thing I’d do differently</label><input type="text" id="n2" value="' + esc(s.night[2]) + '" placeholder="Empty hallway first.">' +
    '<h2>Posted</h2><p class="xs">Say what it is. Don’t sell what it is. Then tap this and don’t look at anything for seven days.</p>' +
    '<div class="row"><button class="btn ' + (s.posted ? 'quiet' : 'go') + '" id="post">' +
    (s.posted ? 'Posted ' + fmt(s.posted) : 'I posted it') + '</button></div>' + wt));
  function keep() { s.night = [0, 1, 2].map(function (i) { return $('#n' + i, main).value.trim(); }); save(); }
  $('#post', main).onclick = function () { keep();
    if (!s.posted) { s.posted = new Date().toISOString().slice(0, 10); save(); scheduleWeekTest(s); render(); } };
  var nb = $('#nums', main); if (nb) nb.onclick = function () { keep(); go('numbers', s.id); };
  var dg = $('#dg', main); if (dg) dg.onclick = function () { keep(); go('diagnose', s.id, null); };
  var wgo = $('#wgo', main);
  if (wgo) {
    var wi = $('#wa', main), wm = $('#wmic', main), r3 = null;
    if (wm) wm.onclick = function () {
      if (r3) { r3.stop(); r3 = null; return; }
      r3 = listen(function (t) { wi.value = t; }, function (on) {
        wm.classList.toggle('rec', on); $('#wmicTxt', main).textContent = on ? 'Listening' : 'Say it out loud'; if (!on) r3 = null; });
    };
    wgo.onclick = function () {
      var a = wi.value.trim(); if (!a) return;
      $('#wres', main).innerHTML = '<div class="note"><b>You said:</b> “' + esc(a) + '”<br><b>The sheet said:</b> “' + esc(s.moment) +
        '”<div class="row" style="margin-top:10px"><button class="btn go" id="pass">Same thing — pass</button>' +
        '<button class="btn quiet" id="fail">Not the same — fail</button></div></div>';
      $('#pass', main).onclick = function () { s.week = { answer: a, pass: true, date: new Date().toISOString() }; save(); go('shown', s.id); };
      $('#fail', main).onclick = function () { s.week = { answer: a, pass: false, date: new Date().toISOString() }; save(); go('shown', s.id); };
    };
  }
  bar.innerHTML = '<button class="btn quiet" id="back">My sheet</button><button class="btn" id="log">The log</button>';
  $('#back', bar).onclick = function () { keep(); go('sheet', s.id); };
  $('#log', bar).onclick = function () { keep(); go('log'); };
}

function numbersScreen(main, bar, s) {
  var n = s.numbers || {};
  main.appendChild(el('<p class="eyebrow q">Show it · the numbers, read second</p><h1>Four numbers, once.</h1>' +
    '<p>Copy these from the platform’s own page. The Week Test already told you whether it worked. These only tell you what to change.</p>' +
    '<div class="num4">' + NUMS.map(function (k) {
      return '<div><label class="lbl" for="' + k[0] + '" style="margin-top:10px">' + k[1] + '</label>' +
        '<input type="number" inputmode="numeric" id="' + k[0] + '" value="' + esc(n[k[0]] == null ? '' : n[k[0]]) + '" placeholder="—">' +
        '<div class="xs" style="margin-top:5px">' + k[2] + '</div></div>'; }).join('') + '</div>' +
    '<div class="note"><b>Passed with poor numbers</b> is a distribution problem, so keep making the same thing. <b>Failed with good numbers</b> means you got lucky, and there is nothing in it to learn.</div>'));
  bar.innerHTML = '<button class="btn quiet" id="skip">Later</button><button class="btn go" id="sv">Save</button>';
  $('#skip', bar).onclick = function () { go('after', s.id); };
  $('#sv', bar).onclick = function () {
    var out = {}, any = false;
    NUMS.forEach(function (k) { var v = $('#' + k[0], main).value.trim(); out[k[0]] = v === '' ? '' : +v; if (v !== '') any = true; });
    s.numbers = any ? out : null; save(); go('season');
  };
}

// ---------- 5. diagnosis as an interview ----------
function diagnose(main, bar, s) {
  var step = view.arg;
  if (!step) {
    main.appendChild(el('<p class="eyebrow e">When something’s wrong</p><h1>Where did it go wrong?</h1>' +
      '<p>The cause is almost never where the symptom is. Answer two questions and the book will tell you which one it is.</p>' +
      '<div class="opts">' + DIAG[0].a.map(function (a) {
        return '<button class="opt" data-v="' + a[0] + '"><b>' + a[1] + '</b><small>' + a[2] + '</small></button>'; }).join('') + '</div>'));
    $$('.opt', main).forEach(function (o) { o.onclick = function () { go('diagnose', view.id, o.dataset.v); }; });
  } else if (FIXES[step]) {
    main.appendChild(el('<p class="eyebrow e">When something’s wrong</p><h1>Which one is it?</h1><div class="opts">' +
      FIXES[step].map(function (f, i) { return '<button class="opt" data-i="' + i + '"><b>' + f[0] + '</b></button>'; }).join('') + '</div>'));
    $$('.opt', main).forEach(function (o) { o.onclick = function () { go('diagnose', view.id, step + ':' + o.dataset.i); }; });
  } else {
    var p = step.split(':'), f = FIXES[p[0]][+p[1]];
    var quote = '';
    if (s) {
      if (/shot one says/.test(f[2])) quote = '“' + esc((s.shots || [{}])[0].text || '') + '”';
      else if (/door line was/.test(f[2])) quote = '“' + esc((s.shots || [])[5] ? s.shots[5].text : '') + '”';
      else if (/Yours said/.test(f[2])) quote = '“' + esc(s.win) + '”';
    }
    main.appendChild(el('<p class="eyebrow e">When something’s wrong</p><h1>' + esc(f[0]) + '</h1>' +
      '<div class="note stop"><b>What’s actually wrong:</b> ' + esc(f[1]) + '</div>' +
      '<h2>What to do</h2><p>' + esc(f[2]) + quote + '</p>' +
      (s ? '<div class="note"><b>On your sheet</b><br>Moment: “' + esc(s.moment) + '”<br>Door ' + esc(s.door) + ' · ' + esc(s.mode) + ' · ' + esc(s.length) + '</div>' : '') +
      '<div class="row"><button class="btn quiet" id="again">Try another symptom</button></div>'));
    $('#again', main).onclick = function () { go('diagnose', view.id, null); };
  }
  bar.innerHTML = '<button class="btn quiet" id="back">Back</button><button class="btn go" id="home">My sheets</button>';
  $('#back', bar).onclick = function () { step && step.indexOf(':') > 0 ? go('diagnose', view.id, step.split(':')[0]) : (step ? go('diagnose', view.id, null) : go('home')); };
  $('#home', bar).onclick = function () { go('home'); };
}

// ---------- log and season ----------
function logScreen(main, bar) {
  var rows = db.sheets.filter(function (s) { return s.posted; }).slice().reverse();
  main.appendChild(el('<p class="eyebrow q">Working pages · the log</p><h1>The Week Test log</h1>' +
    '<p>Twelve rows is about a season. This is the only record of whether you’re getting better, and it will disagree with your view counts, which is the point.</p>' +
    '<div class="rows">' + (rows.length ? rows.map(function (s) {
      return '<div class="rowi" data-id="' + s.id + '"><div><b>' + esc(s.title || s.moment) + '</b><small>Posted ' + fmt(s.posted) +
        ' · ' + esc(s.length) + (s.week ? ' · named: “' + esc(s.week.answer) + '”' : '') + '</small></div>' + pill(s) + '</div>'; }).join('')
      : '<div class="rowi"><small>Nothing posted yet. The first row starts the night you post.</small></div>') + '</div>' +
    '<div class="note" style="margin-top:16px"><b>Read it after twelve.</b> Look only at the fails and ask what they have in common. Almost always the moment was chosen after the shoot instead of before it, or it was interesting to you and never visible to anyone else.</div>'));
  $$('.rowi[data-id]', main).forEach(function (r) { r.onclick = function () { go('after', r.dataset.id); }; });
  bar.innerHTML = '<button class="btn quiet" id="home">My sheets</button><button class="btn go" id="season">My season</button>';
  $('#home', bar).onclick = function () { go('home'); };
  $('#season', bar).onclick = function () { go('season'); };
}
function spark(vals, color, unit) {
  var w = 300, h = 92, pad = 8;
  if (!vals.length) return '';
  var max = Math.max.apply(null, vals.concat([1]));
  var stepX = vals.length > 1 ? (w - pad * 2) / (vals.length - 1) : 0;
  var pts = vals.map(function (v, i) { return [pad + i * stepX, h - pad - (v / max) * (h - pad * 2 - 12)]; });
  var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="92" role="img" aria-label="trend">' +
    '<path d="' + line + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + (h - pad) + ' L' + pts[0][0].toFixed(1) + ' ' + (h - pad) +
    ' Z" fill="' + color + '" opacity=".12"></path>' +
    '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linejoin="round"></path>' +
    pts.map(function (p, i) { return '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="' +
      (i === pts.length - 1 ? 4 : 2.5) + '" fill="' + color + '"></circle>'; }).join('') +
    '<text x="' + pad + '" y="13" font-family="ui-monospace,monospace" font-size="10" fill="' + color + '">' +
    esc(vals[vals.length - 1]) + unit + ' now</text>' +
    '<text x="' + (w - pad) + '" y="13" text-anchor="end" font-family="ui-monospace,monospace" font-size="10" fill="' + color +
    '" opacity=".7">best ' + esc(max) + unit + '</text></svg>';
}
function season(main, bar) {
  var done = db.sheets.filter(function (s) { return s.week; })
    .sort(function (a, b) { return new Date(a.posted) - new Date(b.posted); });
  var pass = done.filter(function (s) { return s.week.pass; }).length;
  var rate = done.length ? Math.round(pass / done.length * 100) : 0;
  var withN = done.filter(function (s) { return s.numbers; });
  var byDoor = {};
  done.forEach(function (s) { var d = s.door || '?'; byDoor[d] = byDoor[d] || { n: 0, p: 0 }; byDoor[d].n++; if (s.week.pass) byDoor[d].p++; });
  var css = getComputedStyle(document.documentElement);
  var ember = css.getPropertyValue('--ember').trim() || '#B4552A', accent = css.getPropertyValue('--accent').trim() || '#0D4F5C';
  main.appendChild(el('<p class="eyebrow q">Show it · the season</p><h1>' +
    (done.length >= 12 ? 'A season, read together.' : 'How you’re doing so far.') + '</h1>' +
    '<p>' + (done.length ? 'Built from every Week Test you have answered. The pass rate is the one that matters.'
      : 'Nothing to read yet. The first row lands seven days after your first post.') + '</p>' +
    '<div class="stats"><div class="stat"><div class="k">Week Test</div><div class="v ' + (rate >= 50 ? 'ok' : 'e') + '">' + rate + '%</div>' +
      '<div class="n">' + pass + ' of ' + done.length + ' named cold, seven days later</div></div>' +
      '<div class="stat"><div class="k">Videos logged</div><div class="v">' + done.length + '</div>' +
      '<div class="n">' + (done.length >= 12 ? 'A full season. Read the fails together.' : (12 - done.length) + ' more makes a season') + '</div></div></div>' +
    (withN.length >= 2 ? '<div class="chart"><h4>Shares — the one that tracks the moment</h4>' +
        spark(withN.map(function (s) { return +s.numbers.shares || 0; }), ember, '') + '</div>' +
      '<div class="chart"><h4>First three seconds</h4>' +
        spark(withN.map(function (s) { return +s.numbers.first3 || 0; }), accent, '%') + '</div>'
      : '<div class="note">Add the four numbers to two videos and the trends appear here.</div>') +
    (function () {
      var sh = done.filter(function (x) { return x.shown && x.shown.role; });
      if (!sh.length) return '';
      var by = {};
      sh.forEach(function (x) { var r = x.shown.role; by[r] = by[r] || { n: 0, m: 0 }; by[r].n++; if (x.shown.match) by[r].m++; });
      return '<h2>Who names your moment</h2><p class="xs">A friend is generous. A stranger is the real test.</p><div class="rows">' +
        Object.keys(by).map(function (r) { var b = by[r], lab = (ROLES.filter(function (z) { return z[0] === r; })[0] || [r, r])[1];
          return '<div class="rowi"><div><b>' + lab + '</b><small>' + b.m + ' of ' + b.n + ' named the same moment</small></div>' +
            '<span class="pill' + (b.m === b.n ? ' ok' : b.m === 0 ? ' bad' : '') + '">' + Math.round(b.m / b.n * 100) + '%</span></div>'; }).join('') + '</div>';
    })() +
    (Object.keys(byDoor).length ? '<h2>Which door works for you</h2><div class="rows">' +
      Object.keys(byDoor).sort().map(function (d) { var b = byDoor[d];
        return '<div class="rowi"><div><b>Door ' + d + ' · ' + ((DOORS[+d - 1] || ['', '?'])[1]) + '</b><small>' +
          b.p + ' of ' + b.n + ' passed</small></div><span class="pill' + (b.n >= 2 && b.p === b.n ? ' ok' : b.p === 0 ? ' bad' : '') +
          '">' + Math.round(b.p / b.n * 100) + '%</span></div>'; }).join('') + '</div>' : '')));
  bar.innerHTML = '<button class="btn quiet" id="log">The log</button><button class="btn go" id="home">My sheets</button>';
  $('#log', bar).onclick = function () { go('log'); };
  $('#home', bar).onclick = function () { go('home'); };
}

// ---------- unlock and settings ----------
function unlock(main, bar) {
  main.appendChild(el('<p class="eyebrow e">Your first three videos are free</p><h1>Keep going.</h1>' +
    '<p>You have run the method three times, which is where the book says it starts to hold. Unlocking keeps every video after this one, along with the log, the season and the backup file. One payment, no subscription, no account.</p>' +
    '<div class="stats"><div class="stat"><div class="k">One time</div><div class="v">' + PRICE + '</div><div class="n">Yours on this device, for good</div></div>' +
    '<div class="stat"><div class="k">Bought the book?</div><div class="v e">30 days</div><div class="n">Free, with the code inside it</div></div></div>' +
    '<label class="lbl" for="code">The code from the book</label>' +
    '<input type="text" id="code" placeholder="XXXX-XXXX-XXXX-XXXX" autocapitalize="characters" spellcheck="false" style="font-family:var(--mono);font-style:normal">' +
    '<div id="cres"></div>'));
  bar.innerHTML = '<button class="btn quiet" id="use">Use my code</button><button class="btn go" id="buy">Unlock ' + PRICE + '</button>';
  $('#use', bar).onclick = function () {
    if (redeem($('#code', main).value)) {
      $('#cres', main).innerHTML = '<div class="note"><b>Thirty days, on the house.</b> Every feature, no card.</div>';
      setTimeout(function () { go('home'); }, 800);
    } else $('#cres', main).innerHTML = '<div class="note stop"><b>That code didn’t read.</b> Check it against the copyright page of the book. Sixteen characters.</div>';
  };
  $('#buy', bar).onclick = purchase;
}
function settings(main, bar) {
  var t = trialLeft();
  main.appendChild(el('<p class="eyebrow q">Settings</p><h1>Your copy.</h1>' +
    '<div class="rows"><div class="rowi" id="rLic"><div><b>' +
      (DEMO ? 'Test build · nothing is gated' : db.lic.unlocked ? 'Unlocked' : t > 0 ? 'Book code · ' + t + ' day' + (t === 1 ? '' : 's') + ' left' : Math.max(0, FREE_VIDEOS - posted()) + ' free videos left') +
      '</b><small>' + (DEMO ? 'Tap to see the unlock screen' : db.lic.unlocked ? 'One-time purchase, this device' : t > 0 ? 'Then ' + PRICE + ' once' : PRICE + ' unlocks everything') +
      '</small></div>' + (db.lic.unlocked ? '<span class="pill ok">paid</span>' : '<span class="pill due">unlock</span>') + '</div>' +
    '<div class="rowi" id="rTheme"><div><b>Appearance</b><small>Light, dark, or whatever the phone is doing</small></div><span class="pill">switch</span></div>' +
    '<div class="rowi" id="rExport"><div><b>Back up my sheets</b><small>One file with every sheet, the log and the numbers</small></div><span class="pill">export</span></div>' +
    '<div class="rowi" id="rImport"><div><b>Restore from a backup</b><small>Replaces what is on this device</small></div><span class="pill">import</span></div></div>' +
    '<h2>Where your sheets live</h2><p class="xs">On this device only. No account and no server, so nothing to leak and nothing to go down. Back up before you change phones.</p>' +
    '<p class="xs" style="margin-top:14px">The Good Part · the sheet · v2.0 · companion to the book by John Schuster</p>' +
    '<input type="file" id="fileIn" accept="application/json" class="hidden">'));
  if (DEMO || !db.lic.unlocked) $('#rLic', main).onclick = function () { go('unlock'); };
  $('#rTheme', main).onclick = toggleTheme;
  $('#rExport', main).onclick = function () {
    var data = JSON.stringify(db, null, 2), name = 'the-good-part-' + new Date().toISOString().slice(0, 10) + '.json';
    if (has('Share')) return Cap.Plugins.Share.share({ title: name, text: data }).catch(function () {});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = name; a.click();
    URL.revokeObjectURL(a.href);
  };
  $('#rImport', main).onclick = function () { $('#fileIn', main).click(); };
  $('#fileIn', main).onchange = function (e) {
    var f = e.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () { try { var v = migrate(JSON.parse(r.result)); if (!v) throw 0; db = v; save(); alert('Restored.'); go('home'); }
      catch (err) { alert('That file did not read as a backup.'); } };
    r.readAsText(f);
  };
  bar.innerHTML = '<button class="btn go" id="home">Done</button>';
  $('#home', bar).onclick = function () { go('home'); };
}
function toggleTheme() {
  var r = document.documentElement, cur = r.getAttribute('data-theme');
  var dark = cur ? cur === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  r.setAttribute('data-theme', dark ? 'light' : 'dark');
  try { localStorage.setItem(THEME, dark ? 'light' : 'dark'); } catch (e) {}
}

// ---------- boot ----------
function boot() {
  loadSync();
  try { var th = localStorage.getItem(THEME); if (th) document.documentElement.setAttribute('data-theme', th); } catch (e) {}
  $('#btnHome').onclick = function () { go('home'); };
  $('#btnTheme').onclick = toggleTheme;
  if (has('LocalNotifications')) Cap.Plugins.LocalNotifications.requestPermissions().catch(function () {});
  if (has('SplashScreen')) Cap.Plugins.SplashScreen.hide().catch(function () {});
  var due = db.sheets.filter(function (s) { return s.posted && !s.week && daysUntil(s.posted) <= 0; });
  go('home');
}
if (has('Preferences')) {
  Cap.Plugins.Preferences.get({ key: KEY }).then(function (r) {
    try { var v = migrate(JSON.parse(r.value || 'null')); if (v) db = v; } catch (e) {}
    boot();
  }).catch(boot);
} else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

window.TGP = { go: go, db: function () { return db; }, check: checkMoment, draft: draftSheet };
})();
