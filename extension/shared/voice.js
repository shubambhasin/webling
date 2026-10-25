// What weblings say. Every pet has a vibe (picked from its seed at hatching), and every event has a
// pool of lines; a vibe's own lines are twice as likely as the shared ones. Lines can use {name},
// {host}, {n}, {mins}, {time}, {other} and {tier}. Keep them short (they're speech bubbles) and PG.
(() => {
  const WL = (globalThis.WL ||= {});

  const VIBES = {
    unbothered: {
      label: 'Unbothered', blurb: 'deadpan, side-eyes everything, moisturized',
      chatty: 0.7, speed: 0.85, idle: { sideeye: 0.45, meh: 0.3, dance: 0.05 },
    },
    chaotic: {
      label: 'Chaotic', blurb: 'zero thoughts, full send, causes problems',
      chatty: 1.2, speed: 1.35, idle: { sideeye: 0.1, meh: 0.05, dance: 0.45 },
    },
    dramatic: {
      label: 'Dramatic', blurb: 'every pop-up is a personal attack',
      chatty: 1.1, speed: 1, idle: { sideeye: 0.25, meh: 0.35, dance: 0.1 },
    },
    wholesome: {
      label: 'Wholesome', blurb: 'your biggest fan, emotionally supportive',
      chatty: 1, speed: 0.95, idle: { sideeye: 0.02, meh: 0.02, dance: 0.4 },
    },
    online: {
      label: 'Chronically online', blurb: 'speaks fluent meme, has never touched grass',
      chatty: 1.3, speed: 1.05, idle: { sideeye: 0.3, meh: 0.15, dance: 0.3 },
    },
  };
  const VIBE_IDS = Object.keys(VIBES);

  const LINES = {
    // ---- just existing ----
    ambient: {
      all: ['no thoughts. just vibes', 'lowkey thriving rn', 'this font is giving 2014', "i'm just a little guy",
        'the pixels are pixeling', 'ok but who designed this page', 'plotting something. unsure what',
        'romanticizing this paragraph rn', 'this sentence? my roman empire', 'manifesting zero pop-ups today',
        'walking on sentences like a runway', 'currently in my explorer era', 'do you ever just… scroll'],
      unbothered: ['anyway', "and that's on minding my business", 'unbothered. moisturized. in my lane',
        'not my circus', "i've seen better websites. it's fine", 'peace and quiet era', 'hm.'],
      chaotic: ['what if i just jumped off this', 'hehe', 'AAAAAA ok i’m good', 'so much energy, nowhere to put it',
        "let's cause problems", 'who left this sentence unattended', 'full send', 'i bite. jk. unless?'],
      dramatic: ['this layout is a crime', "i'm so tired (i did nothing)", 'nobody understands me. not even css',
        'the WEIGHT of this paragraph', "i'm being so brave right now", 'if i fall, tell my story',
        'this is my villain origin story'],
      wholesome: ["you're doing amazing sweetie", 'proud of you for opening this tab', 'drink some water bestie',
        'this website is lucky to have you', 'i like it here with you', 'remember to unclench your jaw',
        'you deserve a snack too'],
      online: ['chat is this real', 'this is so me coded', 'no because why is this so real', "it's giving main character",
        'brain rot level: critical', "pov: you're reading this", "i'm the blueprint", 'lowkey a core memory'],
    },

    // ---- you, poking it ----
    poke: {
      all: ['hi!', 'yes?', 'boop received', 'hehe stop', 'that tickles', 'you rang?', 'oh hey bestie', 'present!'],
      unbothered: ['mm.', 'can i help you'],
      chaotic: ['AGAIN', 'boop back! (i can’t reach)'],
      dramatic: ['you could have ASKED', 'gasp. a poke'],
      wholesome: ['hi friend!! 💕', 'yay attention'],
      online: ['notification received', 'ok i felt that in my soul'],
    },
    poke_annoyed: {
      all: ['ok what', 'ma’am this is a website', 'do i look like a button', "i'm not a fidget toy",
        'touch grass, not me', 'the audacity', 'this is harassment (cute harassment)'],
      unbothered: ['…', "i'm choosing to ignore that"],
      chaotic: ['do it again. i dare you', 'ok now i’m hyper. your fault'],
      dramatic: ['i will remember this', 'how could you'],
      wholesome: ['ok one more but that’s it 🥰'],
      online: ['chat, they’re doing it again', 'this is giving bully'],
    },
    poke_done: {
      all: ['blocked. jk… unless?', '-aura for both of us', "you've unlocked: my silence",
        "i'm telling the other weblings", "we're no longer mutuals"],
      dramatic: ['this is the WORST day of my life'],
      online: ['ratio + pokes don’t count'],
    },

    // ---- you, throwing it around ----
    held: {
      all: ['put me down (don’t)', 'where are we going', 'this is kidnapping but cozy', "i'm a little guy, be gentle"],
      chaotic: ['higher!!', 'spin me'],
      dramatic: ['UNHAND ME', 'i fear heights'],
    },
    thrown: {
      all: ['WHEEE', 'yeet', 'i believe i can fly', 'launched into the stratosphere', 'this is NOT a ride'],
      unbothered: ['ok.', 'cool. flying. sure'],
      chaotic: ['AGAIN AGAIN AGAIN', 'to infinity'],
      dramatic: ['THIS IS HOW IT ENDS'],
      wholesome: ['trust exercise complete!'],
      online: ['yeet era', 'caught in 4k being thrown'],
    },
    hard_landing: {
      all: ['ate that landing', 'stuck the landing. 10/10', 'ow. anyway', "i'm fine. i'm fine.", 'my spine said no'],
      dramatic: ["i've been GRAVELY injured"],
      online: ['that was a W landing ngl'],
      unbothered: ['meant to do that'],
    },
    floor: {
      all: ['the floor is my safe space', 'bottom of the screen gang', "it's cozy down here", 'grounded. literally.'],
    },

    // ---- rest ----
    sleep: {
      all: ['zzz… unsubscribe…', 'zzz… one more pop-up…', 'dreaming in 8-bit', 'recharging my aura. dnd',
        'zzz… accept all… NO', 'sleep mode: on'],
    },
    wake: {
      all: ["i'm up i'm up", 'was i asleep? no.', 'five more minutes', 'rise and slay', "wasn't sleeping. buffering"],
      wholesome: ['you’re back!! hi!!'],
    },

    // ---- food ----
    hungry: {
      all: ['hungry. find me a pop-up', 'my tummy is giving empty', 'i could eat a whole cookie banner',
        'feed me ads (jk) (unless)', 'fasting era (not by choice)'],
      dramatic: ["i'm WITHERING", 'tell the cookies i loved them'],
      wholesome: ['a snack would be nice 🥺'],
      unbothered: ['hungry. not in a dramatic way'],
    },
    fed: {
      all: ['snack secured', 'that hit different', "ok i'm full. for now", 'bussin fr'],
      wholesome: ['thank you!! 🥹'],
    },
    eat_start_cookie: {
      all: ['ooh. a cookie', 'is that… a cookie banner?', 'snack spotted', 'say less', "don't mind if i do",
        'cookie? in THIS economy?'],
    },
    eat_start_popup: {
      all: ['a pop-up? not on my watch', 'excuse me, this is MY screen', 'who invited you', 'absolutely not',
        'time to eat'],
    },
    ate_cookie: {
      all: ['ate. left crumbs. sorry', 'nom. cookie banner gone', 'consent? i ate it', "chef's kiss",
        'that was bussin', 'no cookies were accepted today', 'banner? i hardly know her'],
      unbothered: ['handled.'],
      online: ['ate and left (some) crumbs'],
    },
    ate_popup: {
      all: ['pop-up? never heard of her', "deleted. you're welcome", "and it's gone", 'your screen is free now',
        'that pop-up was mid'],
      dramatic: ['the villain has been DEFEATED'],
      wholesome: ['all better now 💕'],
    },
    ate_accept_all: { all: ['"accept all"? accept THIS', 'accept all? i decline all'] },
    ate_discount: { all: ['a discount? the audacity', 'i want 100% off pop-ups', 'sale ends never, babe'] },
    ate_newsletter: { all: ["your newsletter could've been a tweet", 'subscribe? unsubscribe.'] },
    spat: {
      all: ['fine. it was mid anyway', 'ptooey. happy now?', 'you wanted that?? ok', 'respectfully, why'],
      dramatic: ['after all i did for you'],
    },

    // ---- growing ----
    grew_adult: { all: ['glow up complete ✨', "i'm literally grown now", 'new me who dis'] },
    grew_legend: { all: ['final boss form unlocked', "crown? i've always had it", 'legend status. bow'] },
    tier_up: { all: ['my aura just leveled up', 'aura check: {tier}', '{tier} energy unlocked'] },

    // ---- where you are ----
    arrive_new: {
      all: ['new site who dis', 'ooh, {host}. fancy', 'never been here. vibe check', '{host}? first time? be gentle',
        'exploring {host} rn', 'uncharted territory'],
    },
    arrive_again: { all: ['oh, {host}. we meet again', 'back on {host} i see', '{host}. the usual?'] },
    arrive_regular: {
      all: ["{host} again? you're down bad", 'we live here now apparently', 'visit #{n}. are you ok',
        '{host} is your roman empire', 'this site pays rent in your head'],
    },
    site_linkedin: {
      all: ['networking? in this economy?', "thrilled to announce i'm a webling", 'agree? 👇',
        "open to work (eating pop-ups)", 'everyone here is "humbled"', 'endorse me for snacking'],
    },
    site_social: {
      all: ['doomscroll speedrun?', 'touch grass in 5… 4…', 'the algorithm knows too much', 'posting this? bold',
        'screen time is watching'],
    },
    site_reddit: {
      all: ['the comments are the real article', 'source: trust me bro', 'edit: thanks for the gold',
        'this thread is unhinged. love it'],
    },
    site_dev: {
      all: ['ship it or skip it', 'it works on my machine', 'tried turning it off and on?',
        'deploying on friday? brave', 'git push --force? icon'],
    },
    site_video: { all: ['one more video. sure', '"just one episode" again', 'skip intro gang', "i'll watch with you"] },
    site_music: { all: ['this song is my roman empire', 'add this to the vibe playlist', 'volume up, problems down'] },
    site_shopping: {
      all: ['add to cart = therapy', "girl math says it's free", 'do we NEED it though', 'want, not need. buy it',
        'free shipping is a lifestyle'],
    },
    site_news: {
      all: ['the news is a lot today', 'reading the headline counts, right?', "deep breaths. it's just news"],
    },
    site_wiki: { all: ['wiki rabbit hole incoming', '3 tabs deep already', 'citation needed (from me)'] },
    site_ai: {
      all: ['asking the ai? i’m the real intelligence', 'tell it webling said hi', 'prompt engineer era'],
    },
    site_work: {
      all: ["work mode? i'll be quiet. (i won't)", 'this meeting could be an email', 'productivity arc loading…',
        'looking busy. respect'],
    },
    site_mail: { all: ['inbox zero is a myth', '"per my last email"', 'unread: too many'] },
    site_search: { all: ['googling it? same', "search 'how to adult'", "trust the first result. or don't"] },
    site_learn: { all: ['studying? proud of you fr', 'brain gains', 'the owl is watching', 'big brain era'] },
    site_games: { all: ['one more game. sure', 'gg ez', 'touch grass after this match'] },
    site_food: { all: ['ordering food? get me something', 'delivery in 30? i’ll wait', 'this menu is giving hungry'] },
    site_travel: { all: ['trip? take me with you', 'expense it bestie', 'window seat or nothing', 'packing list: me'] },
    site_dating: { all: ['swipe right on yourself first', 'the red flags are flagging', 'rizz check'] },
    site_finance: { all: ['stonks?', 'buy high sell low, classic', 'number go up? number go down?'] },

    // ---- when ----
    time_late: {
      all: ["it's {time}. go to sleep bestie", 'why are we awake', 'sleep is free, you know'],
      wholesome: ['you need rest 🥺'],
      online: ['3am crew rise up'],
    },
    time_morning: { all: ['morning! coffee first', 'early bird era', 'rise and grind (gently)'] },
    time_monday: { all: ['mondays should be illegal', 'monday? already?'] },
    time_friday: { all: ["it's friday. why are we working", 'friday energy only'] },
    time_weekend: { all: ['weekend mode: on', "it's the weekend. touch grass"] },

    // ---- what you're doing ----
    doomscroll: {
      all: ['doomscrolling detected 🚨', 'slow down, speed racer', "my legs can't keep up",
        "we've scrolled a whole novel", 'touch grass check?', 'the scroll is infinite. you are not'],
    },
    reading_long: {
      all: ["{mins} min read? we're not reading all that", '{mins} minutes?? pack snacks', 'tl;dr please',
        'ok this is a whole novel'],
      wholesome: ['{mins} min read. you got this 💪'],
    },
    tab_back: {
      all: ["you're back 🥹", 'where were you??', 'i was NOT waiting. (i was)', '{mins} minutes gone. who is she',
        "missed you (don't make it weird)"],
      unbothered: ['oh. you.'],
    },
    copy: { all: ['ctrl c ctrl v speedrun', 'copying homework i see', 'plagiarism era (jk)'] },
    wiggle: { all: ['stop shaking the screen', "ok who's doing earthquakes", 'mouse is having a moment'] },

    // ---- other weblings ----
    ghost_join: { all: ['ooh, a visitor', 'hi new friend', 'another webling? on MY page?', "the gang's all here"] },
    crowd: { all: ['this page is POPPING', "{n} weblings here. it's a party", 'we should form a band'] },
    booped: { all: ['{other} booped me!', '{other} said hi (with violence)', 'boop received from {other}'] },
    boop_sent: { all: ['you booped {other}', '{other} has been booped', 'boop delivered'] },
    ghost_hi: { all: ['hi!', 'hey bestie', 'sup', 'o/'] },

    // ---- Webling Wrapped: a roast of the week, one event per verdict (see wrapped() below) ----
    wrapped_touch_grass: {
      all: ['only {n} pages all week? who are you', "you touched grass. i'm so proud", 'quiet week. i got bored'],
      online: ['{n} pages? are you okay? blink twice'],
    },
    wrapped_night_owl: {
      all: ['{n} visits after midnight. go to bed', 'the moon is tired of seeing you', 'sleep schedule? never heard of her'],
      wholesome: ['{n} late nights. please rest 🥺'],
      dramatic: ['{n} nights. the darkness knows your name'],
    },
    wrapped_doomscroller: {
      all: ['{n} doomscrolls. thumb of steel', 'the feed won. {n} times', 'you scrolled so far you found the end. jk'],
      chaotic: ['{n} doomscrolls?? speedrun any%'],
    },
    wrapped_pop_up_predator: {
      all: ['{n} pop-ups eaten. you are welcome', 'we ate {n} pop-ups. the internet fears us',
        'cookie banners fear this one trick: me'],
      unbothered: ['{n} pop-ups. light snack honestly'],
    },
    wrapped_add_to_cart: { all: ['{n}% shopping. your cart has a cart', 'add to cart is not a personality', "your bank called. it's worried"] },
    wrapped_chronically_online: { all: ['{n}% social. the algorithm owns you', 'touch grass speedrun: failed', 'you live here now'] },
    wrapped_thought_leader: { all: ['{n}% linkedin. thrilled to announce: help', 'agree? 👇 (please log off)', 'networked so hard you forgot to rest'] },
    wrapped_corporate: { all: ['{n}% work. per my last email: rest', 'corporate baddie arc', 'circling back to: you need a break'] },
    wrapped_dev_mode: { all: ['{n}% dev sites. works on my machine', 'git commit -m "send help"', 'stack overflow knows you by name'] },
    wrapped_one_more_episode: { all: ['{n}% video. "just one more" x 400', 'autoplay is not a hobby', 'skip intro gang, daily'] },
    wrapped_academic_weapon: { all: ['{n}% learning. academic weapon fr', 'brain so big it needs its own tab', 'the owl would be proud'] },
    wrapped_prompt_goblin: { all: ['{n}% ai. who does the thinking now', 'prompt goblin behavior', 'you asked the robot everything. respect'] },
    wrapped_news_junkie: { all: ['{n}% news. the news can wait, bestie', 'headline addict', 'you read everything except the room'] },
    wrapped_gamer: { all: ['{n}% games. gg, now go outside', 'one more match turned into a week', 'gamer era, no notes'] },
    wrapped_always_hungry: { all: ['{n}% food apps. me too, honestly', 'you ordered more than i ate', 'the delivery app misses you already'] },
    wrapped_wanderlust: { all: ['{n}% travel sites. take me with you', 'out of office energy all week', 'packing list: me. obviously'] },
    wrapped_rizz: { all: ['{n}% dating apps. the rizz is rizzing', 'swipe fatigue is real', 'red flags spotted: several'] },
    wrapped_stonks: { all: ['{n}% finance. number go up?', 'buy high, sell low, cry', 'refresh the chart one more time. i dare you'] },
    wrapped_explorer: { all: ['{n} new sites. the internet is your oyster', 'side quest: every website', 'explorer era. maps needed'] },
    wrapped_lowkey: {
      all: ['lowkey normal week. suspicious', 'no notes. weird flex but ok', 'balanced, as all things should be'],
      dramatic: ['a normal week?? who ARE you'],
    },
  };

  // Wrapped verdicts, by id. Site kinds that can define a week, and the verdict each gives.
  const VERDICTS = {
    touch_grass: 'offline icon', night_owl: '3am menace', doomscroller: 'doomscroll champion',
    pop_up_predator: 'pop-up predator', add_to_cart: 'add-to-cart era', chronically_online: 'chronically online',
    thought_leader: 'thought leader', corporate: 'corporate baddie', dev_mode: 'merge conflict era',
    one_more_episode: 'one more episode', academic_weapon: 'academic weapon', prompt_goblin: 'prompt goblin',
    news_junkie: 'news junkie', gamer: 'gamer era', always_hungry: 'always hungry', wanderlust: 'wanderlust era',
    rizz: 'rizz researcher', stonks: 'stonks enjoyer', explorer: 'internet explorer', lowkey: 'lowkey normal',
  };
  const KIND_VERDICT = {
    shopping: 'add_to_cart', social: 'chronically_online', reddit: 'chronically_online', linkedin: 'thought_leader',
    work: 'corporate', mail: 'corporate', dev: 'dev_mode', video: 'one_more_episode', music: 'one_more_episode',
    learn: 'academic_weapon', wiki: 'academic_weapon', ai: 'prompt_goblin', news: 'news_junkie', games: 'gamer',
    food: 'always_hungry', travel: 'wanderlust', dating: 'rizz', finance: 'stonks',
  };

  // A different one each day, the same all day.
  const MANTRAS = ['no thoughts, just vibes', 'romanticize your browser', 'protect your peace (and your screen)',
    'you are the main character today', 'be the pop-up blocker you wish to see', 'small pet, big aura',
    'decline all cookies, accept all compliments', "today's forecast: zero pop-ups", 'stay unbothered. stay moisturized',
    'touch grass, then come back', "don't accept all. ever.", 'every tab is a fresh start',
    "you're not behind. the internet is just fast", 'hydrate, then scroll', 'close one tab. any tab. you got this',
    'the algorithm doesn’t know you like i do', 'it’s giving productive (allegedly)', 'log off and be iconic'];

  // Hosts by kind, matched on the domain or any subdomain of it.
  const SITES = {
    linkedin: ['linkedin.com'],
    social: ['x.com', 'twitter.com', 'instagram.com', 'tiktok.com', 'facebook.com', 'threads.net', 'bsky.app', 'snapchat.com', 'pinterest.com'],
    reddit: ['reddit.com'],
    dev: ['github.com', 'gitlab.com', 'stackoverflow.com', 'npmjs.com', 'vercel.com', 'developer.mozilla.org', 'dev.to', 'codepen.io', 'leetcode.com'],
    video: ['youtube.com', 'twitch.tv', 'netflix.com', 'primevideo.com', 'hotstar.com', 'disneyplus.com', 'hulu.com', 'vimeo.com'],
    music: ['spotify.com', 'soundcloud.com', 'music.apple.com'],
    shopping: ['amazon.com', 'amazon.in', 'amazon.co.uk', 'amazon.de', 'flipkart.com', 'ebay.com', 'etsy.com', 'myntra.com', 'aliexpress.com', 'walmart.com', 'target.com', 'shein.com', 'temu.com', 'meesho.com'],
    news: ['nytimes.com', 'bbc.com', 'bbc.co.uk', 'cnn.com', 'theguardian.com', 'reuters.com', 'washingtonpost.com', 'ndtv.com', 'thehindu.com', 'indiatimes.com', 'bloomberg.com', 'wsj.com', 'ft.com', 'apnews.com', 'aljazeera.com'],
    wiki: ['wikipedia.org', 'fandom.com', 'wikihow.com'],
    ai: ['chatgpt.com', 'openai.com', 'claude.ai', 'anthropic.com', 'gemini.google.com', 'perplexity.ai', 'poe.com', 'character.ai', 'copilot.microsoft.com'],
    work: ['notion.so', 'figma.com', 'slack.com', 'atlassian.net', 'atlassian.com', 'trello.com', 'asana.com', 'linear.app', 'miro.com', 'zoom.us', 'teams.microsoft.com'],
    mail: ['mail.google.com', 'outlook.live.com', 'outlook.office.com', 'mail.yahoo.com', 'proton.me'],
    search: ['google.com', 'bing.com', 'duckduckgo.com'],
    learn: ['coursera.org', 'udemy.com', 'khanacademy.org', 'duolingo.com', 'edx.org'],
    games: ['chess.com', 'lichess.org', 'steampowered.com', 'roblox.com', 'epicgames.com', 'itch.io'],
    food: ['swiggy.com', 'zomato.com', 'doordash.com', 'ubereats.com', 'instacart.com', 'grubhub.com', 'blinkit.com', 'zeptonow.com'],
    travel: ['airbnb.com', 'booking.com', 'makemytrip.com', 'expedia.com', 'skyscanner.com', 'itilite.com'],
    dating: ['tinder.com', 'bumble.com', 'hinge.co'],
    finance: ['robinhood.com', 'zerodha.com', 'groww.in', 'coinbase.com', 'binance.com', 'tradingview.com'],
  };
  // More specific domains win (mail.google.com before google.com).
  const SITE_LIST = Object.entries(SITES)
    .flatMap(([kind, domains]) => domains.map((d) => [d, kind]))
    .sort((a, b) => b[0].length - a[0].length);

  const hash = (s) => {
    let h = 2166136261;
    for (const c of String(s)) h = Math.imul(h ^ c.codePointAt(0), 16777619);
    return h >>> 0;
  };

  const recent = new Map(); // event → the last few lines said, to avoid repeats

  const voice = {
    VIBES, VIBE_IDS, LINES, MANTRAS, SITES,

    vibeOf(pet) {
      return VIBES[pet?.vibe] ? pet.vibe : VIBE_IDS[hash(`${pet?.seed}:vibe`) % VIBE_IDS.length];
    },

    siteKind(host) {
      host = String(host || '').toLowerCase().replace(/^www\./, '');
      for (const [d, kind] of SITE_LIST) if (host === d || host.endsWith(`.${d}`)) return kind;
      return null;
    },

    fill(text, vars = {}) {
      return text.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '').toString());
    },

    // All the lines a pet with this vibe could say for event (its vibe's lines count twice).
    pool(event, vibe) {
      const e = LINES[event];
      if (!e) return [];
      const own = e[vibe] || [];
      return [...(e.all || []), ...own, ...own];
    },

    // A random line for event, avoiding the last few said for it. Null if there are none.
    line(event, vibe, vars) {
      const pool = voice.pool(event, vibe);
      if (!pool.length) return null;
      const last = recent.get(event) || [];
      const fresh = pool.filter((l) => !last.includes(l));
      const pick = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length || pool.length))];
      const keep = Math.max(0, Math.min(3, new Set(pool).size - 1));
      recent.set(event, keep ? [...last, pick].slice(-keep) : []);
      return voice.fill(pick, vars);
    },

    // The bare hostname in whatever someone typed ("https://www.LinkedIn.com/in/x" → "linkedin.com"),
    // or null if it isn't a website.
    hostOf(input) {
      const host = String(input ?? '').trim().toLowerCase()
        .replace(/^[a-z]+:\/\//, '').replace(/[/?#:].*$/, '').replace(/^www\./, '');
      return host.length <= 253 && /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(host) ? host : null;
    },

    // A take on a website, for the roast box and shareable roast links (/r/<host>). t picks the line
    // (any integer; it wraps), so a shared link always shows the take that was shared.
    roast(host, vibe, t = 0, vars = {}) {
      const kind = voice.siteKind(host);
      const event = kind ? `site_${kind}` : 'arrive_new';
      const lines = [...new Set(voice.pool(event, vibe))];
      t = ((Math.trunc(t) % lines.length) + lines.length) % lines.length;
      return { event, kind, t, text: voice.fill(lines[t], { ...vars, host }) };
    },

    VERDICTS,

    // Webling Wrapped: the verdict on a week (from pet.week / pet.lastWeek), and a roast of it in this vibe.
    // t picks the line like roast() does. n is the number the verdict is about.
    wrapped(w, vibe, t = 0) {
      const num = (k) => Math.max(0, Math.trunc(Number(w?.[k]) || 0));
      const visits = num('visits'), eaten = num('cookies') + num('popups');
      const kinds = Object.entries(w?.kinds || {}).filter(([k]) => SITES[k]).sort((a, b) => b[1] - a[1]);
      const top = kinds.length && visits ? { kind: kinds[0][0], share: Math.min(100, Math.round((kinds[0][1] / visits) * 100)) } : null;
      const [verdict, n] =
        visits < 15 ? ['touch_grass', visits]
          : num('late') >= 10 ? ['night_owl', num('late')]
            : num('doomscrolls') >= 5 ? ['doomscroller', num('doomscrolls')]
              : eaten >= 30 ? ['pop_up_predator', eaten]
                : top && top.share >= 35 && KIND_VERDICT[top.kind] ? [KIND_VERDICT[top.kind], top.share]
                  : num('sites') >= 20 ? ['explorer', num('sites')]
                    : ['lowkey', 0];
      const lines = [...new Set(voice.pool(`wrapped_${verdict}`, vibe))];
      t = ((Math.trunc(t) % lines.length) + lines.length) % lines.length;
      return { verdict, label: VERDICTS[verdict], t, n, top, eaten, text: voice.fill(lines[t], { n }) };
    },

    mantra(pet, date = new Date()) {
      const day = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      return MANTRAS[hash(`${pet?.seed}:${day}`) % MANTRAS.length];
    },
  };

  WL.voice = voice;
})();
