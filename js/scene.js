import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createHabitat } from './habitat.js';
import { createRover } from './rover.js';
import { createSky } from './sky.js';
import { Rover } from './rover.js';
import * as dat from 'dat.gui';

export async function createScene(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB);  // Azul cielo claro

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(5, 5, 10);

  // Iluminación
  const ambientLight = new THREE.AmbientLight(0xadd8e6, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
  directionalLight.position.set(10, 20, 10);
  directionalLight.target.position.set(0, 0, 0);
  scene.add(directionalLight);
  scene.add(directionalLight.target);

  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 500;
  directionalLight.shadow.camera.left = -200;
  directionalLight.shadow.camera.right = 200;
  directionalLight.shadow.camera.top = 200;
  directionalLight.shadow.camera.bottom = -200;

  const hemisphereLight = new THREE.HemisphereLight(0xb1e1ff, 0xb97a20, 0.3);
  scene.add(hemisphereLight);

  // Cargar terreno GLTF
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync('./models/superficie.glb');
  const terrain = gltf.scene;
  terrain.scale.set(10, 10, 10);
  terrain.position.set(0, 0, 0);

  terrain.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.material && !(child.material instanceof THREE.MeshStandardMaterial) && !(child.material instanceof THREE.MeshPhysicalMaterial)) {
        child.material = new THREE.MeshStandardMaterial({
          map: child.material.map,
          color: child.material.color,
        });
        child.material.needsUpdate = true;
      }
    }
  });
  scene.add(terrain);

  const clickableObjects = [];

  // Hábitat con ajuste de posición para terreno grande
  const initialZones = [
    { type: 'Descanso', position: [0, 0, -0.5], size: {x:0.8, y:0.8, z:0.8}, color: 0x00ff00 },
    { type: 'Ejercicio', position: [0, 0, 0.5], size: {x:0.8, y:0.8, z:0.8}, color: 0xff0000 },
    { type: 'Soporte Vital', position: [0.5, 0, 0], size: {x:0.8, y:0.8, z:0.8}, color: 0x0000ff }
  ];
  
  // Hacer createHabitat asíncrono
  let habitat = await createHabitat('sphere', 1.5, 3, initialZones);
  habitat.position.set(0, 5, 0);
  scene.add(habitat);
  clickableObjects.push(habitat);
  habitat.children.forEach(child => clickableObjects.push(child));

  const rover = new Rover();
  const roverModel = await rover.loadModel(); 
  roverModel.position.set(10, 3, 10);
  scene.add(roverModel);
  clickableObjects.push(roverModel);

  createSky(scene);

  // UI con dat.gui
  const gui = new dat.GUI();
  const params = { shape: 'sphere', radius: 1.5, height: 3, crewSize: 4, missionDuration: 30, zones: initialZones };
  gui.add(params, 'shape', ['sphere', 'cylinder', 'inflatable']).name('Forma').onChange(updateHabitat);
  gui.add(params, 'radius', 1, 5, 0.1).name('Radio (m)').onChange(updateHabitat);
  gui.add(params, 'height', 2, 10, 0.1).name('Altura (m)').onChange(updateHabitat);
  gui.add(params, 'crewSize', 1, 10, 1).name('Tripulantes').onChange(checkRules);
  gui.add(params, 'missionDuration', 1, 365, 1).name('Duración (días)').onChange(checkRules);

  // Folder terreno
  const terrainFolder = gui.addFolder('Terreno');
  const scaleParams = { scaleX: 10, scaleY: 10, scaleZ: 10 };
  terrainFolder.add(scaleParams, 'scaleX', 1, 50, 1).name('Escala X').onChange(val => terrain.scale.x = val);
  terrainFolder.add(scaleParams, 'scaleY', 1, 50, 1).name('Escala Y').onChange(val => terrain.scale.y = val);
  terrainFolder.add(scaleParams, 'scaleZ', 1, 50, 1).name('Escala Z').onChange(val => terrain.scale.z = val);
  const rotParams = { rotX: 0, rotY: 0, rotZ: 0 };
  terrainFolder.add(rotParams, 'rotX', -Math.PI, Math.PI, 0.01).name('Rot X').onChange(val => terrain.rotation.x = val);
  terrainFolder.add(rotParams, 'rotY', -Math.PI, Math.PI, 0.01).name('Rot Y').onChange(val => terrain.rotation.y = val);
  terrainFolder.add(rotParams, 'rotZ', -Math.PI, Math.PI, 0.01).name('Rot Z').onChange(val => terrain.rotation.z = val);

  // Folder zonas
  const zonesFolder = gui.addFolder('Zonas Funcionales');
  function refreshZonesFolders() {
    // Limpiar folders viejos
    Object.keys(zonesFolder.__folders).forEach(key => {
      zonesFolder.removeFolder(zonesFolder.__folders[key]);
    });

    params.zones.forEach((zone, i) => {
      const zoneFolder = zonesFolder.addFolder(`${zone.type} #${i+1}`);
      zoneFolder.add(zone, 'type', ['Descanso', 'Ejercicio', 'Soporte Vital', 'Alimentos', 'Higiene']).onChange(updateHabitat);
      zoneFolder.add(zone.size, 'x', 0.5, params.radius, 0.1).name('Ancho').onChange(updateHabitat);
      zoneFolder.add(zone.size, 'y', 0.5, params.height, 0.1).name('Alto').onChange(updateHabitat);
      zoneFolder.add(zone.size, 'z', 0.5, params.radius, 0.1).name('Profundo').onChange(updateHabitat);
      zoneFolder.add(zone.position, '0', -params.radius, params.radius, 0.1).name('Pos X').onChange(updateHabitat);
      zoneFolder.add(zone.position, '1', 0, params.height, 0.1).name('Pos Y').onChange(updateHabitat);
      zoneFolder.add(zone.position, '2', -params.radius, params.radius, 0.1).name('Pos Z').onChange(updateHabitat);
    });
  }
  refreshZonesFolders();

  zonesFolder.add({ addZone: () => {
    params.zones.push({ type: 'Nueva', position: [0,0,0], size: {x:1,y:1,z:1}, color: 0xffffff });
    updateHabitat();
    refreshZonesFolders();
  }}, 'addZone').name('Añadir Zona');

  // Función updateHabitat asíncrona
  async function updateHabitat() {
    scene.remove(habitat);
    try {
      habitat = await createHabitat(params.shape, params.radius, params.height, params.zones);
      scene.add(habitat);
      
      // Actualizar clickableObjects
      clickableObjects.splice(0, clickableObjects.length, habitat);
      habitat.children.forEach(child => clickableObjects.push(child));
      
      checkRules();
      refreshZonesFolders();
    } catch (error) {
      console.error('Error actualizando hábitat:', error);
    }
  }

  function checkRules() {
    if (!habitat || !habitat.userData) return;
    
    const minVolumePerCrew = 25 * params.missionDuration / 30;
    const requiredVolume = params.crewSize * minVolumePerCrew;
    const status = habitat.userData.volume >= requiredVolume ? 'Verde: Adecuado' : 'Rojo: Insuficiente';
    habitat.userData.info = `Hábitat ${params.shape} con volumen total ${habitat.userData.volume.toFixed(2)} m³.\nEstado: ${status} (Requerido: ${requiredVolume.toFixed(2)} m³)`;
    
    // Actualizar color del hábitat principal
    if (habitat.children[0] && habitat.children[0].material) {
      habitat.children[0].material.color.set(status.startsWith('Verde') ? 0x00aaff : 0xff0000);
    }

    const minZoneVols = {
      'Descanso': 10 * params.crewSize,
      'Ejercicio': 5 * params.crewSize,
      'Soporte Vital': 15 * (params.missionDuration / 30),
      'Alimentos': 8 * params.crewSize,
      'Higiene': 4 * params.crewSize
    };
    
    habitat.children.slice(1).forEach((zone, i) => {
      if (zone.material && zone.userData) {
        const type = params.zones[i].type;
        const req = minZoneVols[type] || 0;
        const zStatus = zone.userData.volume >= req ? 'Verde: Adecuado' : 'Rojo: Insuficiente';
        zone.userData.info = `Zona: ${type}. Volumen: ${zone.userData.volume.toFixed(2)} m³.\nEstado: ${zStatus} (Requerido: ${req.toFixed(2)} m³)`;
        zone.material.color.set(zStatus.startsWith('Verde') ? params.zones[i].color : 0xff0000);
      }
    });
  }

  // Llamar checkRules inicialmente
  checkRules();

  return { scene, camera, clickableObjects, terrain };
}