window.MOD = window.MOD || {};

MOD.spawnBots = function (count) {
    const s = MOD.state;
    s.bots = [];

    const bodyGeo = new THREE.CylinderGeometry(0.8, 0.8, 3, 16);
    const headGeo = new THREE.SphereGeometry(0.6, 16, 16);

    for (let i = 0; i < count; i++) {
        const group = new THREE.Group();
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x8e44ad });
        const headMat = new THREE.MeshLambertMaterial({ color: 0xffccaa });

        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 1.5;
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 3.4;

        group.add(body);
        group.add(head);

        let bx = (Math.random() - 0.5) * 350;
        let bz = (Math.random() - 0.5) * 350;
        if (Math.hypot(bx, bz) < 25) {
            bx = 45;
            bz = 45;
        }

        group.position.set(bx, 0, bz);
        s.scene.add(group);

        s.bots.push({
            id: i + 1,
            mesh: group,
            hp: 100,
            speed: 0.16 + Math.random() * 0.08,
            dirX: Math.random() - 0.5,
            dirZ: Math.random() - 0.5,
            lastShot: 0
        });
    }
};

MOD.updateBots = function () {
    const s = MOD.state;
    const now = Date.now();

    s.bots.forEach(bot => {
        const dist = bot.mesh.position.distanceTo(s.camera.position);

        if (dist < 65) {
            bot.mesh.lookAt(s.camera.position.x, 0, s.camera.position.z);
            if (now - bot.lastShot > 1200 && MOD.spawnBullet) {
                bot.lastShot = now;
                const origin = bot.mesh.position.clone().add(new THREE.Vector3(0, 2.5, 0));
                const dir = new THREE.Vector3().subVectors(s.camera.position, origin);
                MOD.spawnBullet(origin, dir, false, 10);
            }
        } else {
            if (Math.hypot(bot.mesh.position.x, bot.mesh.position.z) > s.zoneRadius - 10) {
                bot.dirX = -bot.mesh.position.x;
                bot.dirZ = -bot.mesh.position.z;
            } else if (Math.random() < 0.02) {
                bot.dirX = Math.random() - 0.5;
                bot.dirZ = Math.random() - 0.5;
            }

            const moveVec = new THREE.Vector2(bot.dirX, bot.dirZ).normalize();
            const bx = bot.mesh.position.x + moveVec.x * bot.speed;
            const bz = bot.mesh.position.z + moveVec.y * bot.speed;

            const blocked = MOD.checkCollision ? MOD.checkCollision(bx, bz, 0) : false;
            if (!blocked) {
                bot.mesh.position.x = bx;
                bot.mesh.position.z = bz;
            }
        }
    });
};

MOD.loop = function () {
    const s = MOD.state;
    if (!s.active) return;
    requestAnimationFrame(MOD.loop);

    s.camera.rotation.order = 'YXZ';
    s.camera.rotation.y = s.yaw;
    s.camera.rotation.x = s.pitch;

    const forward = new THREE.Vector3(-Math.sin(s.yaw), 0, -Math.cos(s.yaw));
    const right = new THREE.Vector3(Math.cos(s.yaw), 0, -Math.sin(s.yaw));

    const moveSpeed = s.isScoped ? s.speed * 0.5 : s.speed;
    const nextX = s.camera.position.x + (forward.x * s.moveInput.z + right.x * s.moveInput.x) * moveSpeed;
    const nextZ = s.camera.position.z + (forward.z * s.moveInput.z + right.z * s.moveInput.x) * moveSpeed;

    const hitX = MOD.checkCollision ? MOD.checkCollision(nextX, s.camera.position.z, 0) : false;
    const hitZ = MOD.checkCollision ? MOD.checkCollision(s.camera.position.x, nextZ, 0) : false;

    if (!hitX) s.camera.position.x = nextX;
    if (!hitZ) s.camera.position.z = nextZ;

    s.camera.position.y += s.velY;
    if (s.camera.position.y > 3) {
        s.velY -= 0.025;
    } else {
        s.camera.position.y = 3;
        s.velY = 0;
        s.isGrounded = true;
    }

    if (MOD.updateWorld) MOD.updateWorld();
    if (MOD.updateCombat) MOD.updateCombat();
    MOD.updateBots();

    if (MOD.drawRadar) MOD.drawRadar();
    if (MOD.updateHUD) MOD.updateHUD();

    s.renderer.render(s.scene, s.camera);
};
