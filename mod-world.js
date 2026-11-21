window.MOD = window.MOD || {};

MOD.buildWorld = function () {
    const s = MOD.state;
    s.obstacles = [];
    s.lootBoxes = [];
    s.airdrops = [];
    s.zoneRadius = 220;

    const groundGeo = new THREE.PlaneGeometry(500, 500);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x3b7a57 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    s.scene.add(ground);

    const grid = new THREE.GridHelper(500, 50, 0x000000, 0x2e5e43);
    grid.position.y = 0.05;
    s.scene.add(grid);

    const zoneGeo = new THREE.CylinderGeometry(s.zoneRadius, s.zoneRadius, 60, 64, 1, true);
    const zoneMat = new THREE.MeshBasicMaterial({
        color: 0x0088ff, transparent: true, opacity: 0.25, side: THREE.DoubleSide
    });
    s.zoneMesh = new THREE.Mesh(zoneGeo, zoneMat);
    s.zoneMesh.position.y = 30;
    s.scene.add(s.zoneMesh);

    const buildingMat = new THREE.MeshLambertMaterial({ color: 0x7f8c8d });
    for (let i = 0; i < 45; i++) {
        const w = 8 + Math.random() * 12;
        const h = 6 + Math.random() * 15;
        const d = 8 + Math.random() * 12;
        const x = (Math.random() - 0.5) * 400;
        const z = (Math.random() - 0.5) * 400;

        if (Math.abs(x) < 20 && Math.abs(z) < 20) continue;

        const geo = new THREE.BoxGeometry(w, h, d);
        const mesh = new THREE.Mesh(geo, buildingMat);
        mesh.position.set(x, h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        s.scene.add(mesh);

        s.obstacles.push({ x, z, w: w / 2 + 1, d: d / 2 + 1, isGloo: false });
    }

    const lootGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const lootMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    for (let i = 0; i < 25; i++) {
        const box = new THREE.Mesh(lootGeo, lootMat);
        box.position.set((Math.random() - 0.5) * 350, 0.75, (Math.random() - 0.5) * 350);
        s.scene.add(box);
        s.lootBoxes.push(box);
    }
};

MOD.spawnAirdrop = function () {
    const s = MOD.state;
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * Math.max(20, s.zoneRadius * 0.65);
    const ax = Math.cos(angle) * dist;
    const az = Math.sin(angle) * dist;

    const group = new THREE.Group();

    const boxGeo = new THREE.BoxGeometry(2.6, 2.2, 2.6);
    const boxMat = new THREE.MeshLambertMaterial({ color: 0xd92626 });
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.position.y = 1.1;
    group.add(box);

    const chuteGeo = new THREE.ConeGeometry(3.8, 3.2, 16, 1, true);
    const chuteMat = new THREE.MeshBasicMaterial({
        color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.85
    });
    const chute = new THREE.Mesh(chuteGeo, chuteMat);
    chute.position.y = 6.5;
    group.add(chute);

    const beaconGeo = new THREE.CylinderGeometry(0.45, 0.45, 160, 12, 1, true);
    const beaconMat = new THREE.MeshBasicMaterial({
        color: 0xff2222, transparent: true, opacity: 0.22, side: THREE.DoubleSide
    });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.y = 80;
    group.add(beacon);

    group.position.set(ax, 75, az);
    s.scene.add(group);

    s.airdrops.push({
        mesh: group,
        chute: chute,
        landed: false,
        collected: false
    });

    s.lastDropTime = Date.now();
    MOD.pushFeed('✈️ تم إسقاط صندوق إمداد جوي!');
};

MOD.checkCollision = function (x, z, bulletDamage = 0) {
    const s = MOD.state;
    for (let i = s.obstacles.length - 1; i >= 0; i--) {
        const obs = s.obstacles[i];
        if (Math.abs(x - obs.x) < obs.w && Math.abs(z - obs.z) < obs.d) {
            if (obs.isGloo && bulletDamage > 0) {
                obs.hp -= bulletDamage;
                if (obs.hp <= 0) {
                    s.scene.remove(obs.mesh);
                    s.obstacles.splice(i, 1);
                }
            }
            return true;
        }
    }
    return false;
};

MOD.updateWorld = function () {
    const s = MOD.state;

    if (s.zoneRadius > 15) {
        s.zoneRadius -= 0.03;
        s.zoneMesh.scale.set(s.zoneRadius / 220, 1, s.zoneRadius / 220);
    }

    const distCenter = Math.hypot(s.camera.position.x, s.camera.position.z);
    if (distCenter > s.zoneRadius && MOD.hurtPlayer) {
        MOD.hurtPlayer(0.15);
    }

    if (Date.now() - s.lastDropTime > 30000 && s.airdrops.filter(a => !a.collected).length < 3) {
        MOD.spawnAirdrop();
    }

    for (let i = s.airdrops.length - 1; i >= 0; i--) {
        const drop = s.airdrops[i];
        if (drop.collected) continue;

        if (!drop.landed) {
            drop.mesh.position.y -= 0.28;
            if (drop.mesh.position.y <= 0) {
                drop.mesh.position.y = 0;
                drop.landed = true;
                if (drop.chute) drop.mesh.remove(drop.chute);
            }
        }

        const dDrop = Math.hypot(
            s.camera.position.x - drop.mesh.position.x,
            s.camera.position.z - drop.mesh.position.z
        );
        if (drop.landed && dDrop < 3.8) {
            drop.collected = true;
            s.scene.remove(drop.mesh);
            s.hp = s.maxHp;
            s.glooWalls += 3;
            s.grenades += 2;
            s.bonusDmg += 8;
            MOD.WEAPONS.forEach(w => { w.ammo = w.maxAmmo; });
            MOD.playSound('pickup');
            MOD.pushFeed('🎁 إمداد الإسقاط الجوي (+ضرر وذخيرة)!');
            MOD.updateHUD();
        }
    }

    for (let i = s.lootBoxes.length - 1; i >= 0; i--) {
        const box = s.lootBoxes[i];
        box.rotation.y += 0.05;
        if (s.camera.position.distanceTo(box.position) < 3) {
            s.hp = Math.min(s.maxHp, s.hp + 40);
            s.glooWalls += 2;
            s.grenades += 1;
            MOD.playSound('pickup');
            s.scene.remove(box);
            s.lootBoxes.splice(i, 1);
            MOD.updateHUD();
        }
    }
};
