window.MOD = window.MOD || {};

MOD.CHARACTERS = [
    { id: 'runner', name: 'العدّاء', speed: 0.42, maxHp: 100, bonusDmg: 0 },
    { id: 'guardian', name: 'الحامي', speed: 0.35, maxHp: 140, bonusDmg: 0 },
    { id: 'sniper_pro', name: 'القناص', speed: 0.36, maxHp: 100, bonusDmg: 12 }
];

MOD.WEAPONS = [
    { id: 'ak', name: 'AK-47', ammo: 30, maxAmmo: 30, fireRate: 140, damage: 34, pellets: 1, spread: 0.012, color: 0xd97706, reloadTime: 1200 },
    { id: 'shotgun', name: 'شوتقن', ammo: 6, maxAmmo: 6, fireRate: 650, damage: 24, pellets: 6, spread: 0.12, color: 0x334155, reloadTime: 1500 },
    { id: 'sniper', name: 'قناص', ammo: 5, maxAmmo: 5, fireRate: 1100, damage: 110, pellets: 1, spread: 0.0, color: 0x16a34a, reloadTime: 1800 }
];

MOD.state = {
    scene: null,
    camera: null,
    renderer: null,
    weaponMesh: null,
    radarCtx: null,
    audioCtx: null,

    selectedChar: 0,
    currentWeapon: 0,
    hp: 100,
    maxHp: 100,
    glooWalls: 5,
    grenades: 3,
    bonusDmg: 0,
    kills: 0,
    speed: 0.35,

    velY: 0,
    isGrounded: true,
    yaw: 0,
    pitch: 0,
    isReloading: false,
    isScoped: false,
    isFiring: false,
    lastFireTime: 0,
    lastHurtSound: 0,
    lastDropTime: 0,

    moveInput: { x: 0, z: 0 },
    active: false,
    zoneRadius: 220,
    zoneMesh: null,

    obstacles: [],
    bots: [],
    bullets: [],
    grenadesList: [],
    explosions: [],
    airdrops: [],
    lootBoxes: []
};

MOD.initAudio = function () {
    const s = MOD.state;
    if (!s.audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) s.audioCtx = new Ctx();
    }
    if (s.audioCtx && s.audioCtx.state === 'suspended') {
        s.audioCtx.resume();
    }
};

MOD.playSound = function (type) {
    const ctx = MOD.state.audioCtx;
    if (!ctx) return;
    const now = ctx.currentTime;

    if (type.startsWith('shoot_')) {
        const dur = type === 'shoot_sniper' ? 0.35 : (type === 'shoot_shotgun' ? 0.25 : 0.12);
        const len = Math.floor(ctx.sampleRate * dur);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.35));
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(type === 'shoot_sniper' ? 900 : (type === 'shoot_shotgun' ? 1200 : 2200), now);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(type === 'shoot_sniper' ? 0.35 : 0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + dur);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        src.start(now);
    } else if (type === 'explosion') {
        const dur = 0.65;
        const len = Math.floor(ctx.sampleRate * dur);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.45));
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(550, now);
        filter.frequency.exponentialRampToValueAtTime(80, now + dur);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.45, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + dur);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        src.start(now);
    } else if (type === 'hit' || type === 'gloo' || type === 'pickup' || type === 'hurt' || type === 'win') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type === 'hurt' ? 'sawtooth' : 'triangle';

        if (type === 'hit') {
            osc.frequency.setValueAtTime(760, now);
            osc.frequency.exponentialRampToValueAtTime(280, now + 0.08);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(now); osc.stop(now + 0.08);
        } else if (type === 'gloo') {
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.exponentialRampToValueAtTime(640, now + 0.18);
            gain.gain.setValueAtTime(0.22, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(now); osc.stop(now + 0.18);
        } else if (type === 'pickup') {
            osc.frequency.setValueAtTime(520, now);
            osc.frequency.setValueAtTime(780, now + 0.07);
            gain.gain.setValueAtTime(0.16, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(now); osc.stop(now + 0.16);
        } else if (type === 'hurt') {
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(65, now + 0.14);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(now); osc.stop(now + 0.14);
        } else if (type === 'win') {
            [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.type = 'triangle';
                o.frequency.setValueAtTime(f, now + idx * 0.12);
                g.gain.setValueAtTime(0.2, now + idx * 0.12);
                g.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.12 + 0.25);
                o.connect(g); g.connect(ctx.destination);
                o.start(now + idx * 0.12); o.stop(now + idx * 0.12 + 0.25);
            });
        }
    }
};

MOD.pickCharacter = function (index) {
    MOD.state.selectedChar = index;
    document.querySelectorAll('.char-card').forEach((card, i) => {
        card.classList.toggle('selected', i === index);
    });
};

MOD.pushFeed = function (text) {
    const feed = document.getElementById('event-feed');
    if (!feed) return;
    const item = document.createElement('div');
    item.className = 'feed-msg';
    item.innerText = text;
    feed.prepend(item);
    if (feed.children.length > 4) feed.removeChild(feed.lastChild);
    setTimeout(() => {
        if (item.parentNode) item.parentNode.removeChild(item);
    }, 3000);
};

MOD.showDamagePopup = function (dmg) {
    const el = document.getElementById('dmg-popup');
    if (!el) return;
    el.innerText = `-${Math.round(dmg)}`;
    el.style.opacity = 1;
    setTimeout(() => { el.style.opacity = 0; }, 220);
};

MOD.updateHUD = function () {
    const s = MOD.state;
    const wpn = MOD.WEAPONS[s.currentWeapon];
    document.getElementById('hp-fill').style.width = Math.max(0, (s.hp / s.maxHp) * 100) + '%';
    if (!s.isReloading) {
        document.getElementById('ui-ammo').innerText = `${wpn.ammo}/${wpn.maxAmmo}`;
    } else {
        document.getElementById('ui-ammo').innerText = 'تعبئة...';
    }
    document.getElementById('ui-gloo').innerText = s.glooWalls;
    document.getElementById('ui-grenade').innerText = s.grenades;
    document.getElementById('ui-alive').innerText = s.bots.length + 1;
    document.getElementById('ui-kills').innerText = s.kills;
    document.getElementById('ui-zone').innerText = Math.floor(s.zoneRadius) + 'm';
};

MOD.drawRadar = function () {
    const s = MOD.state;
    const ctx = s.radarCtx;
    if (!ctx || !s.camera) return;

    const size = 124;
    const center = size / 2;
    const scale = (size / 2) / 250;

    ctx.clearRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(center, 0); ctx.lineTo(center, size);
    ctx.moveTo(0, center); ctx.lineTo(size, center);
    ctx.stroke();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(center, center, Math.max(2, s.zoneRadius * scale), 0, Math.PI * 2);
    ctx.stroke();

    s.airdrops.forEach(d => {
        if (d.collected) return;
        const rx = center + (d.mesh.position.x - s.camera.position.x) * scale;
        const ry = center + (d.mesh.position.z - s.camera.position.z) * scale;
        if (Math.hypot(rx - center, ry - center) < size / 2 - 4) {
            ctx.fillStyle = '#ffb703';
            ctx.beginPath(); ctx.arc(rx, ry, 3.2, 0, Math.PI * 2); ctx.fill();
        }
    });

    s.bots.forEach(b => {
        const rx = center + (b.mesh.position.x - s.camera.position.x) * scale;
        const ry = center + (b.mesh.position.z - s.camera.position.z) * scale;
        if (Math.hypot(rx - center, ry - center) < size / 2 - 4) {
            ctx.fillStyle = '#ef4444';
            ctx.beginPath(); ctx.arc(rx, ry, 2.5, 0, Math.PI * 2); ctx.fill();
        }
    });

    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(-s.yaw);
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 4.5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-4.5, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
};

MOD.setupControls = function () {
    const s = MOD.state;

    window.addEventListener('keydown', e => {
        MOD.initAudio();
        if (e.code === 'KeyW') s.moveInput.z = 1;
        if (e.code === 'KeyS') s.moveInput.z = -1;
        if (e.code === 'KeyA') s.moveInput.x = -1;
        if (e.code === 'KeyD') s.moveInput.x = 1;
        if (e.code === 'Space' && s.isGrounded) { s.velY = 0.45; s.isGrounded = false; }
        if (e.code === 'KeyR' && MOD.reload) MOD.reload();
        if (e.code === 'KeyG' && MOD.deployGloo) MOD.deployGloo();
        if (e.code === 'KeyQ' && MOD.throwGrenade) MOD.throwGrenade();
        if (e.code === 'Digit1' && MOD.selectWeapon) MOD.selectWeapon(0);
        if (e.code === 'Digit2' && MOD.selectWeapon) MOD.selectWeapon(1);
        if (e.code === 'Digit3' && MOD.selectWeapon) MOD.selectWeapon(2);
    });

    window.addEventListener('keyup', e => {
        if (e.code === 'KeyW' || e.code === 'KeyS') s.moveInput.z = 0;
        if (e.code === 'KeyA' || e.code === 'KeyD') s.moveInput.x = 0;
    });

    window.addEventListener('mousemove', e => {
        if (s.renderer && document.pointerLockElement === s.renderer.domElement) {
            const sens = s.isScoped ? 0.0008 : 0.002;
            s.yaw -= e.movementX * sens;
            s.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, s.pitch - e.movementY * sens));
        }
    });

    window.addEventListener('mousedown', e => {
        if (!s.active) return;
        MOD.initAudio();
        if (e.button === 0) s.isFiring = true;
        if (e.button === 2 && MOD.toggleScope) MOD.toggleScope();
    });

    window.addEventListener('mouseup', e => {
        if (e.button === 0) s.isFiring = false;
    });

    window.addEventListener('contextmenu', e => e.preventDefault());

    const joyZone = document.getElementById('joy-area');
    const joyStick = document.getElementById('joy-stick');
    let joyTouchId = null;

    joyZone.addEventListener('touchstart', e => {
        MOD.initAudio();
        e.preventDefault();
        joyTouchId = e.changedTouches[0].identifier;
    });

    joyZone.addEventListener('touchmove', e => {
        e.preventDefault();
        for (let t of e.changedTouches) {
            if (t.identifier === joyTouchId) {
                const rect = joyZone.getBoundingClientRect();
                const dx = t.clientX - (rect.left + rect.width / 2);
                const dy = t.clientY - (rect.top + rect.height / 2);
                const dist = Math.min(34, Math.hypot(dx, dy));
                const ang = Math.atan2(dy, dx);
                joyStick.style.transform = `translate(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist}px)`;
                s.moveInput.x = (Math.cos(ang) * dist) / 34;
                s.moveInput.z = -(Math.sin(ang) * dist) / 34;
            }
        }
    });

    joyZone.addEventListener('touchend', () => {
        joyStick.style.transform = 'translate(0px, 0px)';
        s.moveInput = { x: 0, z: 0 };
        joyTouchId = null;
    });

    let lookId = null, lx = 0, ly = 0;
    window.addEventListener('touchstart', e => {
        MOD.initAudio();
        const t = e.changedTouches[0];
        if (!t.target.classList.contains('action-btn') && !t.target.closest('#joy-area') && t.clientX > window.innerWidth / 3) {
            lookId = t.identifier;
            lx = t.clientX;
            ly = t.clientY;
        }
    });

    window.addEventListener('touchmove', e => {
        for (let t of e.changedTouches) {
            if (t.identifier === lookId) {
                const sens = s.isScoped ? 0.002 : 0.005;
                s.yaw -= (t.clientX - lx) * sens;
                s.pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, s.pitch - (t.clientY - ly) * sens));
                lx = t.clientX;
                ly = t.clientY;
            }
        }
    });

    const btnShoot = document.getElementById('btn-shoot');
    btnShoot.addEventListener('touchstart', e => { MOD.initAudio(); e.preventDefault(); s.isFiring = true; });
    btnShoot.addEventListener('touchend', e => { e.preventDefault(); s.isFiring = false; });

    document.getElementById('btn-jump').addEventListener('touchstart', e => {
        MOD.initAudio(); e.preventDefault();
        if (s.isGrounded) { s.velY = 0.45; s.isGrounded = false; }
    });

    document.getElementById('btn-reload').addEventListener('touchstart', e => { MOD.initAudio(); e.preventDefault(); if (MOD.reload) MOD.reload(); });
    document.getElementById('btn-gloo').addEventListener('touchstart', e => { MOD.initAudio(); e.preventDefault(); if (MOD.deployGloo) MOD.deployGloo(); });
    document.getElementById('btn-grenade').addEventListener('touchstart', e => { MOD.initAudio(); e.preventDefault(); if (MOD.throwGrenade) MOD.throwGrenade(); });
    document.getElementById('btn-scope').addEventListener('touchstart', e => { MOD.initAudio(); e.preventDefault(); if (MOD.toggleScope) MOD.toggleScope(); });

    window.addEventListener('resize', () => {
        if (!s.camera || !s.renderer) return;
        s.camera.aspect = window.innerWidth / window.innerHeight;
        s.camera.updateProjectionMatrix();
        s.renderer.setSize(window.innerWidth, window.innerHeight);
    });
};

MOD.initScene = function () {
    const s = MOD.state;
    const ch = MOD.CHARACTERS[s.selectedChar];
    s.speed = ch.speed;
    s.maxHp = ch.maxHp;
    s.hp = ch.maxHp;
    s.bonusDmg = ch.bonusDmg;

    s.scene = new THREE.Scene();
    s.scene.background = new THREE.Color(0x87ceeb);
    s.scene.fog = new THREE.FogExp2(0x87ceeb, 0.004);

    s.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    s.camera.position.set(0, 3, 0);
    s.scene.add(s.camera);

    const gunGeo = new THREE.BoxGeometry(0.18, 0.22, 1.1);
    const gunMat = new THREE.MeshLambertMaterial({ color: MOD.WEAPONS[0].color });
    s.weaponMesh = new THREE.Mesh(gunGeo, gunMat);
    s.weaponMesh.position.set(0.45, -0.35, -0.8);
    s.camera.add(s.weaponMesh);

    s.renderer = new THREE.WebGLRenderer({ antialias: true });
    s.renderer.setSize(window.innerWidth, window.innerHeight);
    s.renderer.shadowMap.enabled = true;
    document.body.appendChild(s.renderer.domElement);

    s.radarCtx = document.getElementById('radar-canvas').getContext('2d');

    const amb = new THREE.AmbientLight(0xffffff, 0.65);
    s.scene.add(amb);

    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(100, 200, 100);
    dir.castShadow = true;
    s.scene.add(dir);

    if (MOD.buildWorld) MOD.buildWorld();
    if (MOD.spawnAirdrop) MOD.spawnAirdrop();
    MOD.setupControls();
    MOD.updateHUD();
    MOD.drawRadar();
};

MOD.start = function () {
    MOD.initAudio();
    document.getElementById('start-modal').classList.add('hidden');
    MOD.initScene();
    if (MOD.spawnBots) MOD.spawnBots(15);
    MOD.state.active = true;
    MOD.pushFeed(`👤 دخلت المعركة بشخصية ${MOD.CHARACTERS[MOD.state.selectedChar].name}`);
    MOD.loop();
};

MOD.endGame = function (won) {
    const s = MOD.state;
    s.active = false;
    if (s.isScoped && MOD.toggleScope) MOD.toggleScope();
    document.getElementById('end-modal').classList.remove('hidden');
    const heading = document.getElementById('end-heading');
    if (won) {
        MOD.playSound('win');
        heading.innerText = 'BOOYAH! انتصار!';
        heading.style.color = '#22c55e';
        document.getElementById('end-summary').innerText = `المركز: #1 | القتلى: ${s.kills}`;
    } else {
        heading.innerText = 'تم القضاء عليك!';
        heading.style.color = '#ef4444';
        document.getElementById('end-summary').innerText = `المركز: #${s.bots.length + 1} | القتلى: ${s.kills}`;
    }
};
