window.MOD = window.MOD || {};

MOD.state.timeOfDay = 0; // 0: نهار، 1: غروب، 2: ليل
MOD.state.lastEnvToggle = 0;

MOD.applyEnvironment = function (modeIndex) {
    const s = MOD.state;
    if (!s.scene) return;

    s.timeOfDay = modeIndex % 3;

    let skyHex = 0x87ceeb;
    let fogHex = 0x87ceeb;
    let fogDensity = 0.004;
    let label = '☀️ وقت النهار';

    if (s.timeOfDay === 1) {
        skyHex = 0xf97316;
        fogHex = 0xea580c;
        fogDensity = 0.0055;
        label = '🌅 وقت الغروب';
    } else if (s.timeOfDay === 2) {
        skyHex = 0x0b132b;
        fogHex = 0x1c2541;
        fogDensity = 0.0065;
        label = '🌙 وقت الليل';
    }

    s.scene.background = new THREE.Color(skyHex);
    s.scene.fog = new THREE.FogExp2(fogHex, fogDensity);

    s.scene.children.forEach(obj => {
        if (obj.isAmbientLight) {
            obj.intensity = s.timeOfDay === 2 ? 0.32 : (s.timeOfDay === 1 ? 0.52 : 0.65);
        }
        if (obj.isDirectionalLight) {
            obj.intensity = s.timeOfDay === 2 ? 0.35 : (s.timeOfDay === 1 ? 0.65 : 0.8);
            obj.color.setHex(s.timeOfDay === 1 ? 0xffedd5 : 0xffffff);
        }
    });

    if (s.active && MOD.pushFeed) {
        MOD.pushFeed(label);
    }
};

MOD.cycleEnvironment = function () {
    const s = MOD.state;
    const now = Date.now();
    if (now - s.lastEnvToggle < 300) return;
    s.lastEnvToggle = now;
    MOD.applyEnvironment(s.timeOfDay + 1);
};
