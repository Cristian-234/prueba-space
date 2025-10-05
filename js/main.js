import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createScene } from './scene.js';
import { setupControls } from './controls.js';
import { Astronaut, AstronautController } from './astronaut.js';
import { Rover } from './rover.js'; // ← NUEVO IMPORT

async function init() {
    const canvas = document.querySelector('#bg');
    const renderer = new THREE.WebGLRenderer({ canvas });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const { scene, camera, clickableObjects, terrain } = await createScene(renderer);
    
    // Crear astronauta con modelo GLB
    const astronaut = new Astronaut();
    const astronautModel = await astronaut.loadModel();
    scene.add(astronautModel);
    clickableObjects.push(astronautModel);

    // Inicializar controlador del astronauta
    const astronautController = new AstronautController(astronaut, terrain, camera, scene);
    astronaut.setPosition(0, 10, 5);

    // NUEVO: Crear rover con movimiento automático
    const rover = new Rover();
    const roverModel = await rover.loadModel();
    roverModel.position.set(10, 3, 10);
    scene.add(roverModel);
    clickableObjects.push(roverModel);

    const orbitControls = setupControls(camera, renderer);

    // Detectar clicks (solo en modo libre)
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const infoBox = document.getElementById('infoBox');

    window.addEventListener('click', (event) => {
        if (astronautController.getCurrentCameraMode() !== 'free') return;
        
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(clickableObjects, true);

        if (intersects.length > 0) {
            const obj = intersects[0].object;
            let infoText = obj.userData.info || 'Sin información';
            if (obj.userData.volume) {
                infoText += `\nVolumen: ${obj.userData.volume.toFixed(2)} m³`;
            }
            showTemporaryInfo(infoText, 3000);
        }
    });

    function showTemporaryInfo(text, duration) {
        infoBox.style.background = 'rgba(0, 100, 0, 0.8)';
        infoBox.innerHTML = text;
        
        setTimeout(() => {
            updateInstructions();
        }, duration);
    }

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const updateInstructions = () => {
        const mode = astronautController.getCurrentCameraMode();
        const modeNames = {
            'follow': 'Seguimiento con Zoom',
            'free': 'Libre'
        };
        const modeName = modeNames[mode] || mode;
        
        let zoomInfo = { distance: '0', percentage: '0' };
        if (astronautController.getZoomInfo) {
            zoomInfo = astronautController.getZoomInfo();
        }
        
        infoBox.style.background = 'rgba(0, 0, 0, 0.7)';
        infoBox.innerHTML = `
            <strong>Modo: ${modeName}</strong><br>
            Zoom: ${zoomInfo.distance}m (${zoomInfo.percentage}%)<br>
            Rueda Mouse: Acercar/Alejar<br>
            WASD: Movimiento astronauta<br>
            Espacio: Saltar<br>
            C: Cambiar modo cámara
        `;
    };

    console.log("=== CONTROLES ===");
    console.log("WASD/Flechas: Movimiento del astronauta");
    console.log("Espacio: Saltar");
    console.log("Rueda del Mouse: Zoom (acercar/alejar)");
    console.log("C: Cambiar entre modo seguimiento y libre");

    const clock = new THREE.Clock();
    
    function animate() {
        requestAnimationFrame(animate);
        
        const delta = clock.getDelta();
        
        astronautController.update(delta);
        
        // NUEVO: Actualizar rover
        if (rover && rover.update) {
            rover.update(delta, terrain);
        }
        
        const useOrbit = astronautController.getUseOrbitControls();
        orbitControls.enabled = useOrbit;
        
        if (useOrbit) {
            orbitControls.update();
        }
        
        updateInstructions();
        
        renderer.render(scene, camera);
    }
    
    updateInstructions();
    animate();
}

init();