window.MOD = window.MOD || {};

MOD.state.vehicles = [];
MOD.state.drivingVehicle = null;
MOD.state.lastVehicleToggle = 0;

MOD.spawnVehicles = function (count = 4) {
    const s = MOD.state;
    s.vehicles = [];
    s.drivingVehicle = null;

    const bodyGeo = new THREE.BoxGeometry(2.6, 1.3, 4.8);
    const cabinGeo = new THREE.BoxGeometry(2.2, 1.0, 2.2);
    const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.4, 12);
    wheelGeo.rotateZ(Math.PI / 2);

    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xf59e0b });
    const cabinMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });

    for (let i = 0; i < count; i++) {
        const car = new THREE.Group();

        const chassis = new THREE.Mesh(bodyGeo, bodyMat);
        chassis.position.y = 0.9;
        chassis.castShadow = true;
        car.add(chassis);

        const roof = new THREE.Mesh(cabinGeo, cabinMat);
        roof.position.set(0, 1.9, -0.3);
        car.add(roof);

        const wheelOffsets = [
            [-1.35, 0.55, 1.5],
            [1.35, 0.55, 1.5],
            [-1.35, 0.55, -1.5],
            [1.35, 0.55, -1.5]
        ];
        wheelOffsets.forEach(([wx, wy, wz]) => {
            const w = new THREE.Mesh(wheelGeo, wheelMat);
            w.position.set(wx, wy, wz);
            car.add(w);
        });

        let vx = (Math.random() - 0.5) * 260;
        let vz = (Math.random() - 0.5) * 260;
        if (Math.hypot(vx, vz) < 25) {
            vx = 35;
            vz = 35;
        }

        car.position.set(vx, 0, vz);
        car.rotation.y = Math.random() * Math.PI * 2;
        s.scene.add(car);

        s.vehicles.push({
            id: i + 1,
            mesh: car,
            speed: 0,
            maxSpeed: 0.95
        });
    }
};

MOD.toggleVehicle = function () {
    const s = MOD.state;
    if (!s.active || !s.camera) return;

    const now = Date.now();
    if (now - s.lastVehicleToggle < 350) return;
    s.lastVehicleToggle = now;

    if (s.drivingVehicle) {
        const car = s.drivingVehicle;
        car.speed = 0;
        s.drivingVehicle = null;
        s.camera.position.set(car.mesh.position.x + 3.2, 3, car.mesh.position.z);
        MOD.pushFeed('🚶 نزلت من المركبة');
        return;
    }

    let nearest = null;
    let bestDist = 7.5;
    s.vehicles.forEach(v => {
        const d = Math.hypot(s.camera.position.x - v.mesh.position.x, s.camera.position.z - v.mesh.position.z);
        if (d < bestDist) {
            bestDist = d;
            nearest = v;
        }
    });

    if (nearest) {
        s.drivingVehicle = nearest;
        MOD.pushFeed(`🚗 ركبت المركبة #${nearest.id} (زر F أو المركبة للنزول)`);
    }
};

MOD.updateVehicles = function () {
    const s = MOD.state;
    if (!s.vehicles || s.vehicles.length === 0) return;

    const car = s.drivingVehicle;
    if (!car) return;

    const targetSpeed = s.moveInput.z * car.maxSpeed;
    car.speed += (targetSpeed - car.speed) * 0.12;

    if (Math.abs(car.speed) > 0.02) {
        const turnDir = car.speed >= 0 ? 1 : -1;
        car.mesh.rotation.y -= s.moveInput.x * 0.045 * turnDir;
    }

    const forwardX = Math.sin(car.mesh.rotation.y);
    const forwardZ = Math.cos(car.mesh.rotation.y);
    const nextX = car.mesh.position.x + forwardX * car.speed;
    const nextZ = car.mesh.position.z + forwardZ * car.speed;

    const hitX = MOD.checkCollision ? MOD.checkCollision(nextX, car.mesh.position.z, 0) : false;
    const hitZ = MOD.checkCollision ? MOD.checkCollision(car.mesh.position.x, nextZ, 0) : false;

    if (!hitX) car.mesh.position.x = nextX;
    if (!hitZ) car.mesh.position.z = nextZ;

    s.camera.position.x = car.mesh.position.x - forwardX * 1.2;
    s.camera.position.z = car.mesh.position.z - forwardZ * 1.2;
    s.camera.position.y = 3.6;

    // صدم الأعداء بالمركبة
    for (let i = s.bots.length - 1; i >= 0; i--) {
        const bot = s.bots[i];
        const d = Math.hypot(bot.mesh.position.x - car.mesh.position.x, bot.mesh.position.z - car.mesh.position.z);
        if (d < 3.4 && Math.abs(car.speed) > 0.35) {
            s.scene.remove(bot.mesh);
            s.bots.splice(i, 1);
            s.kills++;
            MOD.playSound('hit');
            MOD.pushFeed(`🚗 صدمت الخصم #${bot.id} بالمركبة!`);
            MOD.updateHUD();
            if (s.bots.length === 0) MOD.endGame(true);
        }
    }
};
