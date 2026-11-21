window.MOD = window.MOD || {};

MOD.selectWeapon = function (index) {
    const s = MOD.state;
    if (s.isReloading || s.currentWeapon === index) return;
    s.currentWeapon = index;

    if (s.isScoped && MOD.toggleScope) MOD.toggleScope();

    const wpn = MOD.WEAPONS[index];
    if (s.weaponMesh) {
        s.weaponMesh.material.color.setHex(wpn.color);
        s.weaponMesh.scale.z = index === 2 ? 1.4 : (index === 1 ? 0.85 : 1.0);
    }

    document.querySelectorAll('.w-btn').forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
    });
    MOD.updateHUD();
};

MOD.toggleScope = function () {
    const s = MOD.state;
    if (!s.camera) return;
    s.isScoped = !s.isScoped;

    const scopeEl = document.getElementById('scope-overlay');
    const crossEl = document.getElementById('crosshair');

    if (s.isScoped) {
        s.camera.fov = s.currentWeapon === 2 ? 22 : 45;
        if (s.currentWeapon === 2) {
            scopeEl.style.display = 'block';
            crossEl.style.display = 'none';
            if (s.weaponMesh) s.weaponMesh.visible = false;
        }
    } else {
        s.camera.fov = 75;
        scopeEl.style.display = 'none';
        crossEl.style.display = 'block';
        if (s.weaponMesh) s.weaponMesh.visible = true;
    }
    s.camera.updateProjectionMatrix();
};

MOD.reload = function () {
    const s = MOD.state;
    const wpn = MOD.WEAPONS[s.currentWeapon];
    if (s.isReloading || wpn.ammo === wpn.maxAmmo) return;

    s.isReloading = true;
    if (s.isScoped) MOD.toggleScope();
    MOD.updateHUD();

    setTimeout(() => {
        wpn.ammo = wpn.maxAmmo;
        s.isReloading = false;
        MOD.updateHUD();
    }, wpn.reloadTime);
};

MOD.spawnBullet = function (origin, dir, isPlayer, damage) {
    const s = MOD.state;
    const geo = new THREE.SphereGeometry(0.18, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: isPlayer ? 0xffff00 : 0xff0000 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(origin);
    s.scene.add(mesh);

    s.bullets.push({
        mesh: mesh,
        dir: dir.clone().normalize(),
        speed: 4.2,
        isPlayer: isPlayer,
        damage: damage,
        life: 65
    });
};

MOD.fireWeapon = function () {
    const s = MOD.state;
    if (!s.active || s.isReloading) return;

    const wpn = MOD.WEAPONS[s.currentWeapon];
    const now = Date.now();
    if (now - s.lastFireTime < wpn.fireRate) return;

    if (wpn.ammo <= 0) {
        MOD.reload();
        return;
    }

    wpn.ammo--;
    s.lastFireTime = now;
    MOD.playSound('shoot_' + wpn.id);
    MOD.updateHUD();

    if (s.weaponMesh) {
        s.weaponMesh.position.z = -0.65;
        setTimeout(() => { if (s.weaponMesh) s.weaponMesh.position.z = -0.8; }, 80);
    }

    const baseDir = new THREE.Vector3();
    s.camera.getWorldDirection(baseDir);
    const origin = s.camera.position.clone().add(baseDir.clone().multiplyScalar(1.5));
    const totalDamage = wpn.damage + s.bonusDmg;

    for (let i = 0; i < wpn.pellets; i++) {
        const d = baseDir.clone();
        d.x += (Math.random() - 0.5) * wpn.spread;
        d.y += (Math.random() - 0.5) * wpn.spread;
        d.z += (Math.random() - 0.5) * wpn.spread;
        MOD.spawnBullet(origin, d, true, totalDamage);
    }
};

MOD.deployGloo = function () {
    const s = MOD.state;
    if (!s.active || s.glooWalls <= 0) return;

    s.glooWalls--;
    MOD.playSound('gloo');
    MOD.updateHUD();

    const dir = new THREE.Vector3(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
    const pos = s.camera.position.clone().add(dir.multiplyScalar(4.5));

    const geo = new THREE.BoxGeometry(5, 3.8, 0.6);
    const mat = new THREE.MeshLambertMaterial({ color: 0x00d2ff, transparent: true, opacity: 0.85 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, 1.9, pos.z);
    mesh.rotation.y = s.yaw;
    s.scene.add(mesh);

    s.obstacles.push({ x: pos.x, z: pos.z, w: 2.6, d: 2.6, isGloo: true, hp: 150, mesh: mesh });
};

MOD.throwGrenade = function () {
    const s = MOD.state;
    if (!s.active || s.grenades <= 0) return;

    s.grenades--;
    MOD.updateHUD();

    const dir = new THREE.Vector3();
    s.camera.getWorldDirection(dir);

    const geo = new THREE.SphereGeometry(0.28, 12, 12);
    const mat = new THREE.MeshLambertMaterial({ color: 0x228b22 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(s.camera.position).add(dir.clone().multiplyScalar(1.4));
    s.scene.add(mesh);

    const vel = dir.clone().multiplyScalar(1.05);
    vel.y += 0.28;

    s.grenadesList.push({ mesh: mesh, vel: vel, timer: 95 });
};

MOD.explodeAt = function (pos) {
    const s = MOD.state;
    MOD.playSound('explosion');

    const geo = new THREE.SphereGeometry(1.2, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.85 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    s.scene.add(mesh);
    s.explosions.push({ mesh: mesh, scale: 1, alpha: 0.85 });

    const radius = 12;
    for (let j = s.bots.length - 1; j >= 0; j--) {
        const bot = s.bots[j];
        const bPos = bot.mesh.position.clone().add(new THREE.Vector3(0, 2, 0));
        const dist = bPos.distanceTo(pos);
        if (dist < radius) {
            const dmg = Math.max(25, Math.round(125 * (1 - dist / radius)));
            bot.hp -= dmg;
            MOD.showDamagePopup(dmg);
            if (bot.hp <= 0) {
                s.scene.remove(bot.mesh);
                s.bots.splice(j, 1);
                s.kills++;
                MOD.pushFeed(`💀 قضيت على خصم #${bot.id} بقنبلة!`);
                MOD.updateHUD();
                if (s.bots.length === 0) MOD.endGame(true);
            }
        }
    }

    const pDist = s.camera.position.distanceTo(pos);
    if (pDist < radius * 0.75) {
        MOD.hurtPlayer(Math.round(45 * (1 - pDist / (radius * 0.75))));
    }
};

MOD.hurtPlayer = function (amount) {
    const s = MOD.state;
    if (!s.active) return;

    s.hp -= amount;
    const flash = document.getElementById('hurt-flash');
    if (flash) {
        flash.style.opacity = 1;
        setTimeout(() => { flash.style.opacity = 0; }, 150);
    }

    const now = Date.now();
    if (now - s.lastHurtSound > 350) {
        MOD.playSound('hurt');
        s.lastHurtSound = now;
    }

    if (s.hp <= 0) {
        s.hp = 0;
        MOD.endGame(false);
    }
    MOD.updateHUD();
};

MOD.updateCombat = function () {
    const s = MOD.state;
    if (s.isFiring) MOD.fireWeapon();

    for (let i = s.bullets.length - 1; i >= 0; i--) {
        const b = s.bullets[i];
        b.mesh.position.add(b.dir.clone().multiplyScalar(b.speed));
        b.life--;

        const hitWall = MOD.checkCollision ? MOD.checkCollision(b.mesh.position.x, b.mesh.position.z, b.damage) : false;
        if (hitWall || b.life <= 0) {
            s.scene.remove(b.mesh);
            s.bullets.splice(i, 1);
            continue;
        }

        if (b.isPlayer) {
            for (let j = s.bots.length - 1; j >= 0; j--) {
                const bot = s.bots[j];
                const bCenter = bot.mesh.position.clone().add(new THREE.Vector3(0, 2, 0));
                if (b.mesh.position.distanceTo(bCenter) < 1.8) {
                    bot.hp -= b.damage;
                    MOD.playSound('hit');
                    MOD.showDamagePopup(b.damage);
                    s.scene.remove(b.mesh);
                    s.bullets.splice(i, 1);
                    if (bot.hp <= 0) {
                        s.scene.remove(bot.mesh);
                        s.bots.splice(j, 1);
                        s.kills++;
                        MOD.pushFeed(`🎯 قضيت على خصم #${bot.id}`);
                        MOD.updateHUD();
                        if (s.bots.length === 0) MOD.endGame(true);
                    }
                    break;
                }
            }
        } else {
            if (b.mesh.position.distanceTo(s.camera.position) < 1.5) {
                MOD.hurtPlayer(b.damage);
                s.scene.remove(b.mesh);
                s.bullets.splice(i, 1);
            }
        }
    }

    for (let i = s.grenadesList.length - 1; i >= 0; i--) {
        const g = s.grenadesList[i];
        g.vel.y -= 0.025;
        g.mesh.position.add(g.vel);
        g.mesh.rotation.x += 0.12;
        g.mesh.rotation.y += 0.12;

        if (g.mesh.position.y < 0.28) {
            g.mesh.position.y = 0.28;
            g.vel.x *= 0.65;
            g.vel.z *= 0.65;
            g.vel.y = Math.abs(g.vel.y) * 0.35;
        }

        g.timer--;
        if (g.timer <= 0) {
            const p = g.mesh.position.clone();
            s.scene.remove(g.mesh);
            s.grenadesList.splice(i, 1);
            MOD.explodeAt(p);
        }
    }

    for (let i = s.explosions.length - 1; i >= 0; i--) {
        const ex = s.explosions[i];
        ex.scale += 1.1;
        ex.alpha -= 0.08;
        ex.mesh.scale.setScalar(ex.scale);
        ex.mesh.material.opacity = Math.max(0, ex.alpha);
        if (ex.alpha <= 0) {
            s.scene.remove(ex.mesh);
            s.explosions.splice(i, 1);
        }
    }
};
