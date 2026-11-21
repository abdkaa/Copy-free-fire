window.MOD = window.MOD || {};

MOD.state.armor = 0;
MOD.state.maxArmor = 100;
MOD.state.medkits = 2;
MOD.state.armorPickups = [];

MOD.spawnArmorPickups = function (count = 16) {
    const s = MOD.state;
    s.armorPickups = [];

    const vestGeo = new THREE.BoxGeometry(1.4, 1.4, 0.9);
    const vestMat = new THREE.MeshLambertMaterial({ color: 0x38bdf8 });

    const medGeo = new THREE.BoxGeometry(1.2, 0.7, 1.2);
    const medMat = new THREE.MeshLambertMaterial({ color: 0xf43f5e });

    for (let i = 0; i < count; i++) {
        const isArmor = i % 2 === 0;
        const mesh = new THREE.Mesh(isArmor ? vestGeo : medGeo, isArmor ? vestMat : medMat);
        mesh.position.set(
            (Math.random() - 0.5) * 340,
            isArmor ? 0.8 : 0.45,
            (Math.random() - 0.5) * 340
        );
        s.scene.add(mesh);
        s.armorPickups.push({ mesh: mesh, type: isArmor ? 'armor' : 'medkit' });
    }
};

MOD.useMedkit = function () {
    const s = MOD.state;
    if (!s.active) return;
    if (s.medkits <= 0 || s.hp >= s.maxHp) return;

    s.medkits--;
    s.hp = Math.min(s.maxHp, s.hp + 50);
    MOD.playSound('pickup');
    MOD.pushFeed('🩺 استخدمت حزمة إسعاف (+50 صحة)');
    if (MOD.updateHUD) MOD.updateHUD();
};

MOD.absorbDamage = function (rawDamage) {
    const s = MOD.state;
    if (s.armor <= 0) return rawDamage;

    const absorbed = Math.min(s.armor, rawDamage * 0.65);
    s.armor = Math.max(0, s.armor - absorbed);
    return Math.max(1, rawDamage - absorbed);
};

MOD.updateArmorSystem = function () {
    const s = MOD.state;
    if (!s.active || !s.camera) return;

    for (let i = s.armorPickups.length - 1; i >= 0; i--) {
        const item = s.armorPickups[i];
        item.mesh.rotation.y += 0.04;

        if (s.camera.position.distanceTo(item.mesh.position) < 3.2) {
            if (item.type === 'armor') {
                s.armor = Math.min(s.maxArmor, s.armor + 50);
                MOD.pushFeed('🛡️ التقطت درعاً (+50 درع)');
            } else {
                s.medkits += 1;
                MOD.pushFeed('➕ التقطت حزمة إسعاف');
            }
            MOD.playSound('pickup');
            s.scene.remove(item.mesh);
            s.armorPickups.splice(i, 1);
            if (MOD.updateHUD) MOD.updateHUD();
        }
    }

    const gearEl = document.getElementById('gear-info');
    if (gearEl) {
        const wpn = MOD.WEAPONS[s.currentWeapon];
        const ammoText = s.isReloading ? 'تعبئة...' : `${wpn.ammo}/${wpn.maxAmmo}`;
        gearEl.innerHTML = `ذخيرة: <span id="ui-ammo">${ammoText}</span> | درع: <span style="color:#38bdf8">${Math.round(s.armor)}</span> | إسعاف: <span style="color:#fb7185">${s.medkits}</span> | ثلج: <span id="ui-gloo">${s.glooWalls}</span> | قنبلة: <span id="ui-grenade">${s.grenades}</span>`;
    }
};
