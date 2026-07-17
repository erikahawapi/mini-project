const STATE_WORLD = 'exterior';
const STATE_ENTRANCE = 'entrance';
const STATE_FLOOR1_LOBBY = 'lobby';
const STATE_FLOOR1_COUNTER = 'counter';
const STATE_FLOOR1_STUDY = 'study1';
const STATE_FLOOR2_GALLERY = 'gallery';
const STATE_FLOOR2_STUDY = 'study2';

let currentState = STATE_WORLD;


let scene, camera, renderer, controls;
let raycaster, mouse;
let loadingManager;
let isCameraAnimating = false;


const worldGroup = new THREE.Group();
const floor1LobbyGroup = new THREE.Group();
const floor1StudyGroup = new THREE.Group();
const floor2Group = new THREE.Group();


let interactiveObjects = [];
let doorMeshes = [];
let hotspots = [];
let doorPosition = new THREE.Vector3(7.5, 2.2, 0);
const keys = { w: false, a: false, s: false, d: false };



const cameraViews = {
    [STATE_WORLD]: {
        position: { x: 0, y: 11, z: 25 },
        target: { x: 0, y: 3, z: 0 }
    },
    [STATE_ENTRANCE]: {
        position: { x: 5.61, y: 0.58, z: 3.71 },
        target: { x: 5.61, y: 0.53, z: 2.71 }
    },
    [STATE_FLOOR1_LOBBY]: {
        position: { x: 4.16, y: 0.45, z: -1.06 },
        target: { x: 5.15, y: 0.43, z: -1.04 }
    },
    [STATE_FLOOR1_COUNTER]: {
        position: { x: 2.76, y: 0.37, z: -1.39 },
        target: { x: 2.78, y: 0.30, z: -0.39 }
    },
    [STATE_FLOOR1_STUDY]: {
        position: { x: -1.18, y: 0.58, z: -0.74 },
        target: { x: -2.18, y: 0.51, z: -0.73 }
    },
    [STATE_FLOOR2_GALLERY]: {
        position: { x: -2.20, y: 1.39, z: 0.75 },
        target: { x: -1.21, y: 1.38, z: 0.79 }
    },
    [STATE_FLOOR2_STUDY]: {
        position: { x: -2.24, y: 1.57, z: -0.35 },
        target: { x: -3.23, y: 1.51, z: -0.44 }
    }
};


function init() {

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.015);


    scene.add(worldGroup);
    scene.add(floor1LobbyGroup);
    scene.add(floor1StudyGroup);
    scene.add(floor2Group);


    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    const startView = cameraViews[STATE_WORLD];
    camera.position.set(startView.position.x, startView.position.y, startView.position.z);


    const canvas = document.getElementById('three-canvas');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;


    class DragControls {
        constructor(camera, domElement) {
            this.camera = camera;
            this.domElement = domElement;
            this.isLocked = true;
            this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
            this.isDragging = false;
            this.previousMousePosition = { x: 0, y: 0 };
            this.listeners = { change: [], lock: [], unlock: [] };
            
            this.domElement.addEventListener('mousedown', (e) => {
                if (e.button === 0 && document.getElementById('welcome-screen').classList.contains('hidden')) {
                    this.isDragging = true;
                    this.previousMousePosition = { x: e.clientX, y: e.clientY };
                }
            });
            
            window.addEventListener('mouseup', (e) => {
                if (e.button === 0) {
                    this.isDragging = false;
                }
            });
            
            window.addEventListener('mousemove', (e) => {
                if (this.isDragging && this.isLocked) {
                    const movementX = e.clientX - this.previousMousePosition.x;
                    const movementY = e.clientY - this.previousMousePosition.y;

                    this.euler.setFromQuaternion(this.camera.quaternion);
                    this.euler.y -= movementX * 0.002;
                    this.euler.x -= movementY * 0.002;
                    this.euler.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.euler.x));
                    this.camera.quaternion.setFromEuler(this.euler);

                    this.previousMousePosition = { x: e.clientX, y: e.clientY };
                    this.dispatchEvent({ type: 'change' });
                }
            });
            
            this.vec = new THREE.Vector3();
        }
        
        addEventListener(type, listener) {
            if (!this.listeners[type]) this.listeners[type] = [];
            this.listeners[type].push(listener);
        }
        
        dispatchEvent(event) {
            if (this.listeners[event.type]) {
                for (let l of this.listeners[event.type]) l(event);
            }
        }
        
        lock() { this.isLocked = true; this.dispatchEvent({ type: 'lock' }); }
        unlock() { this.isLocked = false; this.dispatchEvent({ type: 'unlock' }); }
        
        moveForward(distance) {
            this.vec.setFromMatrixColumn(this.camera.matrix, 0);
            this.vec.crossVectors(this.camera.up, this.vec);
            this.camera.position.addScaledVector(this.vec, distance);
        }
        
        moveRight(distance) {
            this.vec.setFromMatrixColumn(this.camera.matrix, 0);
            this.camera.position.addScaledVector(this.vec, distance);
        }
    }

    controls = new DragControls(camera, renderer.domElement);

    const dummyTarget = new THREE.Vector3(startView.target.x, startView.target.y, startView.target.z);
    camera.lookAt(dummyTarget);


    controls.addEventListener('change', () => {
        if (currentState === STATE_WORLD || currentState === STATE_ENTRANCE) {

            const dist = camera.position.distanceTo(doorPosition);


            const isClose = dist < 7.5;

            if (isClose) {
                if (currentState !== STATE_ENTRANCE) {
                    changeState(STATE_ENTRANCE);
                }
            } else {
                if (currentState === STATE_ENTRANCE) {
                    changeState(STATE_WORLD);
                }
            }
        }
    });


    setupLighting();


    scene.environment = generateGradientEnvMap();


    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();


    setupLoadingManager();
    load3DModels();

    window.addEventListener('keydown', (e) => {
        if (isCameraAnimating) return;
        const key = e.key.toLowerCase();
        if (keys.hasOwnProperty(key)) keys[key] = true;
    });
    window.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if (keys.hasOwnProperty(key)) keys[key] = false;
    });


    window.addEventListener('resize', onWindowResize);


    window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    let clickStartX = 0;
    let clickStartY = 0;

    window.addEventListener('mousemove', (e) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    window.addEventListener('mousedown', (e) => {
        if (isCameraAnimating) return;
        if (e.button === 0 && document.getElementById('welcome-screen').classList.contains('hidden') &&
            document.getElementById('info-modal').classList.contains('hidden') &&
            document.getElementById('photos-modal').classList.contains('hidden')) {
            if (!controls.isLocked) controls.lock();
        }
        if (e.button === 0 && controls.isLocked) {
            clickStartX = e.clientX;
            clickStartY = e.clientY;
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (e.button === 0 && controls.isLocked) {
            const dist = Math.hypot(e.clientX - clickStartX, e.clientY - clickStartY);
            if (dist < 5) {
                if (document.getElementById('welcome-screen').classList.contains('hidden') &&
                    document.getElementById('info-modal').classList.contains('hidden') &&
                    document.getElementById('photos-modal').classList.contains('hidden')) {
                    performInteraction(e);
                }
            }
        }
    });

    function performInteraction(e) {
        if (e) {
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
        } else {
            raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        }

        const hotspotIntersects = raycaster.intersectObjects(hotspots, false);
        if (hotspotIntersects.length > 0) {
            handleObjectInteraction({ userData: hotspotIntersects[0].object.userData });
            return;
        }

        const intersects = raycaster.intersectObjects(scene.children, true);
        for (let i = 0; i < intersects.length; i++) {
            const clickedObj = intersects[i].object;
            const interaction = findInteractiveAncestor(clickedObj);
            if (interaction && (interaction.type === 'door' || interaction.type === 'sign')) {
                handleObjectInteraction(clickedObj);
                break;
            }
        }
    }

    window.addEventListener('keydown', (e) => {
        if (e.key === 'c' || e.key === 'C') {
            const pos = camera.position;
            const tgt = new THREE.Vector3();
            camera.getWorldDirection(tgt);
            tgt.add(pos);
            const coordStr = `position: { x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}, z: ${pos.z.toFixed(2)} },\ntarget: { x: ${tgt.x.toFixed(2)}, y: ${tgt.y.toFixed(2)}, z: ${tgt.z.toFixed(2)} }`;
            alert("Camera coordinates copied to clipboard:\n\n" + coordStr);
            navigator.clipboard.writeText(coordStr);
            console.log("Camera Coordinates:", coordStr);
        }
    });

    function createHotspot(position, type, group) {
        const geo = new THREE.SphereGeometry(0.03, 16, 16);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00adb5, transparent: true, opacity: 0.8 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(position);
        mesh.userData = { type: type, isHotspot: true };
        group.add(mesh);
        hotspots.push(mesh);
    }

    createHotspot(new THREE.Vector3(2.80, 0.40, -0.39), 'counter', scene);
    createHotspot(new THREE.Vector3(5.16, 0.52, -1.06), 'hall', scene);
    createHotspot(new THREE.Vector3(-2.16, 0.39, -0.69), 'study1', scene);
    createHotspot(new THREE.Vector3(-1.20, 1.38, 0.75), 'gallery', scene);
    createHotspot(new THREE.Vector3(-3.21, 1.50, -0.59), 'study2', scene);

    setupUIEventListeners();


    animate();
}


function setupLighting() {

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);


    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1d2a4a, 0.6);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);


    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(30, 40, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 150;

    const d = 30;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;

    scene.add(dirLight);
}


function setupLoadingManager() {
    const loadingScreen = document.getElementById('loading-screen');
    const loadingProgress = document.getElementById('loading-progress');

    loadingManager = new THREE.LoadingManager();

    loadingManager.onStart = function (url, itemsLoaded, itemsTotal) {
        loadingScreen.classList.remove('hidden');
    };

    loadingManager.onProgress = function (url, itemsLoaded, itemsTotal) {
        const progress = Math.round((itemsLoaded / itemsTotal) * 100);
        loadingProgress.innerText = progress + '% loaded';
    };

    loadingManager.onLoad = function () {
        loadingScreen.classList.add('hidden');
        console.log('All 3D assets loaded successfully!');
    };

    loadingManager.onError = function (url) {
        console.error('Error loading asset:', url);
    };
}


function load3DModels() {
    const loader = new THREE.GLTFLoader(loadingManager);

    loader.load(
        '../assets/models/PRZS.glb',
        (gltf) => {
            const model = gltf.scene;

            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;


                    if (child.material) {
                        const matName = child.material.name ? child.material.name.toLowerCase() : "";
                        const meshName = child.name ? child.name.toLowerCase() : "";
                        
                        const isFloor = matName.includes('material.192') || 
                                        matName.includes('material.226') || 
                                        matName.includes('material.004') || 
                                        matName.includes('material.005') || 
                                        matName.includes('material.001') || 
                                        matName.includes('material.006') || 
                                        matName.includes('material_14') || 
                                        meshName.includes('mesh_input');
                        
                        if (isFloor) {
                            child.material = child.material.clone();
                            child.material.color.setHex(0xffffff);
                            if (child.material.map) {
                                child.material.map = null;
                            }
                            child.material.roughness = 0.8;
                            child.material.metalness = 0.0;
                            child.material.needsUpdate = true;
                        } else if (
                            matName.includes('glass') || matName.includes('window') || matName.includes('cermin') || 
                            matName.includes('blue') || matName.includes('cyan') || matName.includes('dark_glass') ||
                            matName.includes('material.020') || matName.includes('material.022') || 
                            matName.includes('material.023') || matName.includes('material.024') || 
                            matName.includes('material.019') ||
                            meshName.includes('glass') || meshName.includes('window') || meshName.includes('cermin') || 
                            meshName.includes('window_pane') || meshName.includes('panel')
                        ) {
                            child.material = child.material.clone();
                            child.material.color.setHex(0x00adb5);
                            child.material.roughness = 0.02;
                            child.material.metalness = 0.95;
                            child.material.transparent = true;
                            child.material.opacity = 0.85;
                            child.material.needsUpdate = true;
                        }
                    }


                    let currentObj = child;
                    let isDoorLeaf = false;
                    while (currentObj) {
                        if (currentObj.name) {
                            const cName = currentObj.name.toLowerCase();
                            if ((cName.includes('left') || cName.includes('right')) &&
                                cName.includes('entrance') &&
                                cName.includes('door')) {
                                isDoorLeaf = true;
                                break;
                            }
                        }
                        currentObj = currentObj.parent;
                    }

                    if (isDoorLeaf) {

                        if (child.material) {
                            child.material = child.material.clone();
                        }
                        doorMeshes.push(child);
                    }
                }
            });


            const scaleFactor = 2.2;
            model.scale.set(scaleFactor, scaleFactor, scaleFactor);


            const box = new THREE.Box3().setFromObject(model);
            const center = new THREE.Vector3();
            box.getCenter(center);
            const size = new THREE.Vector3();
            box.getSize(size);

            model.position.x = -center.x;
            model.position.z = -center.z;
            model.position.y = -box.min.y;



            let cameraDistance = size.y * 1.45;
            cameraDistance = Math.min(Math.max(cameraDistance, 12), 28);


            cameraViews[STATE_WORLD].position = { x: 0, y: size.y * 0.55, z: cameraDistance };
            cameraViews[STATE_WORLD].target = { x: 0, y: size.y * 0.35, z: 0 };


            if (currentState === STATE_WORLD) {
                camera.position.set(cameraViews[STATE_WORLD].position.x, cameraViews[STATE_WORLD].position.y, cameraViews[STATE_WORLD].position.z);

                const dummyTarget = new THREE.Vector3(cameraViews[STATE_WORLD].target.x, cameraViews[STATE_WORLD].target.y, cameraViews[STATE_WORLD].target.z);
                camera.lookAt(dummyTarget);
            }

            worldGroup.add(model);


            scene.updateMatrixWorld(true);
            if (doorMeshes.length > 0) {
                doorMeshes[0].getWorldPosition(doorPosition);
                console.log("Dynamically captured correct door coordinates:", doorPosition);

            }
        },
        undefined,
        (error) => {
            console.warn('Could not find assets/models/FULL PRZS.glb. Loading visual placeholder scene.');
            createPlaceholderScene();
        }
    );
}


function createPlaceholderScene() {

    const groundGeo = new THREE.PlaneGeometry(80, 80);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1f3c1d, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    worldGroup.add(ground);


    const pathGeo = new THREE.PlaneGeometry(8, 40);
    const pathMat = new THREE.MeshStandardMaterial({ color: 0x3d352b, roughness: 0.8 });
    const path = new THREE.Mesh(pathGeo, pathMat);
    path.rotation.x = -Math.PI / 2;
    path.position.set(13, 0.01, 20);
    path.receiveShadow = true;
    worldGroup.add(path);


    const buildingGeo = new THREE.BoxGeometry(32, 12, 18);
    const buildingMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.5 });
    const building = new THREE.Mesh(buildingGeo, buildingMat);
    building.position.set(0, 6, 0);
    building.castShadow = true;
    building.receiveShadow = true;
    worldGroup.add(building);


    const glassGeo = new THREE.PlaneGeometry(28, 9);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x005b66, roughness: 0.1, metalness: 0.9 });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(0, 6.5, 9.05);
    worldGroup.add(glass);


    const signGeo = new THREE.BoxGeometry(6, 2.5, 0.4);
    const signMat = new THREE.MeshStandardMaterial({ color: 0x00adb5, roughness: 0.2 });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0, 1.25, 14);
    sign.castShadow = true;
    sign.name = 'interactive_main_sign';
    worldGroup.add(sign);
    interactiveObjects.push(sign);


    const labelGeo = new THREE.PlaneGeometry(5.6, 2);
    const labelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const label = new THREE.Mesh(labelGeo, labelMat);
    label.position.set(0, 1.25, 14.21);
    worldGroup.add(label);


    const doorGeo = new THREE.BoxGeometry(3, 4.5, 0.2);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x222831, metalness: 0.5, roughness: 0.3 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(13, 2.25, 9);
    door.castShadow = true;
    door.name = 'interactive_exterior_entrance';
    worldGroup.add(door);
    interactiveObjects.push(door);


    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 3);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 });
    const leavesGeo = new THREE.SphereGeometry(1.5, 8, 8);
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x2e8b57 });

    for (let i = 0; i < 6; i++) {
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.5;
        trunk.castShadow = true;

        const leaves = new THREE.Mesh(leavesGeo, leavesMat);
        leaves.position.y = 3.5;
        leaves.castShadow = true;

        tree.add(trunk);
        tree.add(leaves);

        tree.position.set(-14 + (i * 4), 0, 14);
        worldGroup.add(tree);
    }


    setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');
    }, 500);
}


function animateCamera(endPos, endTarget, duration = 2.2, callback = null) {
    if (controls.isLocked) controls.unlock();
    isCameraAnimating = true;

    gsap.to(camera.position, {
        x: endPos.x,
        y: endPos.y,
        z: endPos.z,
        duration: duration,
        ease: "power2.inOut"
    });

    let dummyTarget = new THREE.Vector3();
    camera.getWorldDirection(dummyTarget);
    dummyTarget.add(camera.position);

    gsap.to(dummyTarget, {
        x: endTarget.x,
        y: endTarget.y,
        z: endTarget.z,
        duration: duration,
        ease: "power2.inOut",
        onUpdate: () => {
            camera.lookAt(dummyTarget);
        },
        onComplete: () => {
            isCameraAnimating = false;
            if (callback) callback();
        }
    });
}


function changeState(newState) {
    currentState = newState;


    worldGroup.visible = true;
    floor1LobbyGroup.visible = true;
    floor1StudyGroup.visible = true;
    floor2Group.visible = true;


    doorMeshes.forEach(door => {
        if (door.material) {
            if (currentState === STATE_ENTRANCE) {

                door.material.emissive.setHex(0x00adb5);
            } else {

                door.material.emissive.setHex(0x000000);
                door.material.emissiveIntensity = 0.0;
            }
        }
    });


    const buttons = document.querySelectorAll('.floor-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active');
        const floorAttr = btn.getAttribute('data-floor');
        if (floorAttr === currentState ||
            (floorAttr === 'exterior' && (currentState === STATE_WORLD || currentState === STATE_ENTRANCE))) {
            btn.classList.add('active');
        }
    });


    updateUIContent();
}





function findInteractiveAncestor(object) {
    let current = object;
    while (current) {
        if (current.name) {
            const name = current.name.toLowerCase();


            const worldPos = new THREE.Vector3();
            current.getWorldPosition(worldPos);


            const isNamedSign = name.includes('building') || name.includes('sign') || name.includes('board') ||
                name.includes('letter') || name.includes('text') || name.includes('title') ||
                name.includes('name') || name.includes('label') || name.includes('perpustakaan') ||
                name.includes('raja') || name.includes('zarith') || name.includes('sofiah') ||
                name.includes('sofia') || name.includes('sofea') || name.includes('library') ||
                name.includes('glass') || name.includes('window') || name.includes('wall') || name.includes('facade');


            const isLetterMesh = /^[a-z](?:\.\d+)?$/.test(name) || name.includes('curve') || name.includes('font');
            const isSignAtTop = isLetterMesh && worldPos.y > 9.0;

            if (isNamedSign || isSignAtTop) {
                return { type: 'sign', object: current };
            }

            const isDoor = (name.includes('left') || name.includes('right')) &&
                name.includes('entrance') &&
                name.includes('door');
            if (isDoor) {
                return { type: 'door', object: current };
            }
        }
        current = current.parent;
    }
    return null;
}


function showInfoPopup(title, description) {
    if (controls.isLocked) controls.unlock();
    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = `
        <div style="padding: 15px;">
            <h2 style="color: #00ffff; font-family: 'Space Grotesk', sans-serif; font-size: 1.8rem; margin-bottom: 15px; border-bottom: 2px solid rgba(0, 255, 255, 0.2); padding-bottom: 10px;">
                ${title}
            </h2>
            <p style="font-size: 1.05rem; line-height: 1.7; color: #e0e0e0; font-family: 'Outfit', sans-serif;">
                ${description}
            </p>
        </div>
    `;
    document.getElementById('info-modal').classList.remove('hidden');
}

function handleObjectInteraction(object) {
    let interaction = null;
    if (object.userData && object.userData.isHotspot) {
        interaction = { type: object.userData.type, object: object };
    } else {
        interaction = findInteractiveAncestor(object);
    }

    if (!interaction) {
        console.log("Clicked object has no interactive ancestor:", object.name || "hotspot");
        return;
    }

    console.log("Interacted type:", interaction.type, "Matched object:", interaction.object.name);

    if (interaction.type === 'sign' && (currentState === STATE_WORLD || currentState === STATE_ENTRANCE)) {
        changeState(STATE_ENTRANCE);
        const view = cameraViews[STATE_ENTRANCE];
        animateCamera(view.position, view.target, 2.0);
    }
    else if (interaction.type === 'door' && (currentState === STATE_ENTRANCE || currentState === STATE_WORLD)) {
        openDoorsAndEnter();
    }
    else if (interaction.type === 'hall') {
        showInfoPopup('Hall at Level 1', 'The Level 1 Hall serves as a venue for various events, including seminars, talks, workshops, exhibitions, and academic programs organized by the library and the university.');
    }
    else if (interaction.type === 'counter') {
        showInfoPopup('Registration Counter', 'The Registration Counter is your first stop for library services, inquiries, and borrowing information.');
    }
    else if (interaction.type === 'study1') {
        showInfoPopup('Study Section at Level 1', 'The Level 1 Study Section provides a comfortable and collaborative learning environment where students can study, discuss assignments, work on group projects, or access library resources.');
    }
    else if (interaction.type === 'gallery') {
        showInfoPopup('Gallery at Level 2', 'The Level 2 Gallery showcases exhibitions, displays, and special collections that highlight the university’s achievements, history, and valuable academic resources.');
    }
    else if (interaction.type === 'study2') {
        showInfoPopup('Study Section at Level 2', 'The Level 2 Study Section offers a quiet and peaceful environment for individual study and focused learning. It is ideal for students who require minimal distractions while reading or completing academic work.');
    }
}


function updateUIContent() {
    const locDesc = document.getElementById('location-desc');
    const statusText = document.getElementById('status-text');

    switch (currentState) {
        case STATE_WORLD:
            locDesc.innerHTML = "We are standing outside the library. Click on the <strong>building sign</strong> at the top to approach the entrance.";
            statusText.innerText = "Exterior Building";
            break;
        case STATE_ENTRANCE:
            locDesc.innerHTML = "You have approached the side entrance. Click on the <strong>door</strong> to enter the library hall.";
            statusText.innerText = "Exterior Building";
            break;
        case STATE_FLOOR1_LOBBY:
            locDesc.innerHTML = "Welcome to the <strong>Hall</strong>, an open space for events.";
            statusText.innerText = "1F: Hall";
            break;
        case STATE_FLOOR1_COUNTER:
            locDesc.innerHTML = "We are at the <strong>Registration Counter</strong>. Check in here before entering the library.";
            statusText.innerText = "1F: Registration Counter";
            break;
        case STATE_FLOOR1_STUDY:
            locDesc.innerHTML = "You have entered the <strong>Study Section</strong>, a place to sit comfortably and focus on your work.";
            statusText.innerText = "1F: Study Section";
            break;
        case STATE_FLOOR2_GALLERY:
            locDesc.innerHTML = "Welcome to the <strong>Gallery</strong>. Examine local UTM archives and history.";
            statusText.innerText = "2F: Gallery";
            break;
        case STATE_FLOOR2_STUDY:
            locDesc.innerHTML = "You are now in the <strong>Study Section</strong>. Enjoy study tables by the glass window.";
            statusText.innerText = "2F: Study Section";
            break;
    }
}


function setupUIEventListeners() {
    const bgMusic = document.getElementById('bg-music');
    if (bgMusic) {
        bgMusic.volume = 0.5;
        let playPromise = bgMusic.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                const startAudio = () => {
                    bgMusic.play();
                    document.removeEventListener('click', startAudio);
                };
                document.addEventListener('click', startAudio);
            });
        }
    }

    const startBtn = document.getElementById('start-btn');
    const welcomeScreen = document.getElementById('welcome-screen');
    const uiHud = document.getElementById('ui-hud');


    startBtn.addEventListener('click', () => {
        welcomeScreen.classList.add('hidden');
        uiHud.classList.remove('hidden');
        controls.lock();

        const worldView = cameraViews[STATE_WORLD];
        animateCamera(worldView.position, worldView.target, 2.0);
    });


    if (startBtn) {
        startBtn.addEventListener('mousemove', (e) => {
            const rect = startBtn.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            startBtn.style.setProperty('--mouse-x', `${x}px`);
            startBtn.style.setProperty('--mouse-y', `${y}px`);

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const percentX = (x - centerX) / centerX;
            const percentY = (y - centerY) / centerY;

            const transX = percentX * 7;
            const transY = percentY * 6;
            const rotX = -percentY * 8;
            const rotY = percentX * 8;

            startBtn.style.transform = `translate3d(${transX}px, calc(${transY}px - 2px), 0) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.03)`;
        });

        startBtn.addEventListener('mouseleave', () => {
            startBtn.style.transform = 'translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) scale(1)';
        });
    }


    const musicToggleBtn = document.getElementById('music-toggle-btn');
    if (musicToggleBtn) {
        musicToggleBtn.addEventListener('click', () => {
            const bgMusic = document.getElementById('bg-music');
            if (bgMusic) {
                if (bgMusic.paused) {
                    bgMusic.play();
                    musicToggleBtn.innerText = '🔊 Music On';
                } else {
                    bgMusic.pause();
                    musicToggleBtn.innerText = '🔇 Music Off';
                }
            }
        });
    }

    const historyBtn = document.getElementById('feature-history');
    const hoursBtn = document.getElementById('feature-hours');
    const contactBtn = document.getElementById('feature-contact');
    const infoModal = document.getElementById('info-modal');
    const modalBody = document.getElementById('modal-body');

    if (historyBtn) {
        historyBtn.addEventListener('click', () => {
            modalBody.innerHTML = `
                <div style="padding: 10px;">
                    <h2 style="color: #00adb5; font-family: 'Space Grotesk', sans-serif; font-size: 1.7rem; margin-bottom: 15px; border-bottom: 2px solid rgba(0, 173, 181, 0.2); padding-bottom: 8px;">About Raja Zarith Sofiah Library</h2>
                    <img src="PRZS%20Image.jpg" alt="Raja Zarith Sofiah Library Building" style="width: 100%; height: auto; max-height: 480px; object-fit: cover; border-radius: 8px; margin-top: 15px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.1);">
                    <p style="text-align: center; font-size: 0.85rem; color: #a0a0a0; margin-bottom: 20px; font-weight: bold; font-family: 'Space Grotesk', sans-serif;">Raja Zarith Sofiah Library Building</p>
                    <p style="font-size: 1rem; line-height: 1.7; color: #e0e0e0; text-align: justify; margin-bottom: 15px;">
                        In line with Universiti Teknologi Malaysia’s development as a Research University, UTM Library services continue to be strengthened through the establishment of the Raja Zarith Sofiah Library (PRZS), which is designed as a research-focused library. The PRZS building was officially inaugurated on 30 September 2014 during a Proclamation Ceremony officiated by His Royal Highness Tunku Temenggong Johor, Tunku Idris Iskandar Ibni Sultan Ibrahim.
                    </p>
                    <p style="font-size: 1rem; line-height: 1.7; color: #e0e0e0; text-align: justify;">
                        Located at the southwestern part of the UTM campus, the library was specifically developed to support research activities and was named after UTM’s fourth Chancellor, Raja Zarith Sofiah. The building serves as a central hub for academic resources, research support, and knowledge development within the university community.
                    </p>
                </div>
            `;
            infoModal.classList.remove('hidden');
        });
    }

    if (hoursBtn) {
        hoursBtn.addEventListener('click', () => {
            modalBody.innerHTML = `
                <div style="padding: 10px;">
                    <h2 style="color: #00adb5; font-family: 'Space Grotesk', sans-serif; font-size: 1.7rem; margin-bottom: 20px; border-bottom: 2px solid rgba(0, 173, 181, 0.2); padding-bottom: 8px;">Working Hours</h2>
                    <div style="background: rgba(255, 255, 255, 0.03); border-left: 4px solid #00adb5; padding: 20px 24px; border-radius: 0 8px 8px 0; border-top: 1px solid rgba(255,255,255,0.02); border-right: 1px solid rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.02); line-height: 1.8;">
                        <p style="font-size: 1.05rem; color: #ffffff; margin-bottom: 12px; font-family: 'Space Grotesk', sans-serif;">
                            Monday to Friday between <strong>8:00 AM and 6:00 PM.</strong>
                        </p>
                        <p style="font-size: 1.05rem; color: #e0e0e0; margin-bottom: 12px; font-family: 'Space Grotesk', sans-serif;">
                            The library is closed on weekends and public holidays.
                        </p>
                        <p style="font-size: 0.95rem; color: #a0a0a0; font-style: italic; margin-bottom: 0; font-family: 'Space Grotesk', sans-serif;">
                            *These specific hours apply during the semester break
                        </p>
                    </div>
                </div>
            `;
            infoModal.classList.remove('hidden');
        });
    }

    if (contactBtn) {
        contactBtn.addEventListener('click', () => {
            modalBody.innerHTML = `
                <div style="padding: 10px;">
                    <h2 style="color: #00adb5; font-family: 'Space Grotesk', sans-serif; font-size: 1.7rem; margin-bottom: 20px; border-bottom: 2px solid rgba(0, 173, 181, 0.2); padding-bottom: 8px;">Contact Information</h2>
                    <div style="font-size: 1.05rem; color: #e0e0e0; display: flex; flex-direction: column; gap: 15px; font-family: 'Space Grotesk', sans-serif; line-height: 1.6;">
                        <div style="display: flex; align-items: flex-start; gap: 10px;">
                            <span style="font-size: 1.2rem; min-width: 25px;">🌐</span>
                            <span><strong>Website:</strong> <a href="https://library.utm.my/" target="_blank" style="color: #00adb5; text-decoration: none;">https://library.utm.my/</a></span>
                        </div>
                        <div style="display: flex; align-items: flex-start; gap: 10px;">
                            <span style="font-size: 1.2rem; min-width: 25px;">📍</span>
                            <span><strong>Address:</strong> Pusat Pentadbiran Universiti Teknologi Malaysia, 80990 Skudai, Johor Darul Ta'zim</span>
                        </div>
                        <div style="display: flex; align-items: flex-start; gap: 10px;">
                            <span style="font-size: 1.2rem; min-width: 25px;">📞</span>
                            <span><strong>Phone:</strong> 07-553 0188</span>
                        </div>
                        <div style="display: flex; align-items: flex-start; gap: 10px;">
                            <span style="font-size: 1.2rem; min-width: 25px;">✉️</span>
                            <span><strong>Email:</strong> <a href="mailto:lib-enquiryjb@utm.my" style="color: #00adb5; text-decoration: none;">lib-enquiryjb@utm.my</a></span>
                        </div>
                    </div>
                </div>
            `;
            infoModal.classList.remove('hidden');
        });
    }


    const floorButtons = document.querySelectorAll('.floor-btn');
    floorButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const floor = e.target.getAttribute('data-floor');
            if (floor === currentState) return;

            const view = cameraViews[floor];
            if (view) {
                animateCamera(view.position, view.target, 2.0, () => {
                    changeState(floor);
                });
            }
        });
    });


    const galleryBtn = document.getElementById('photo-gallery-btn');
    const photosModal = document.getElementById('photos-modal');
    const photosClose = document.getElementById('photos-close');

    galleryBtn.addEventListener('click', () => {
        updateReferencePhotosUI();
        photosModal.classList.remove('hidden');
    });

    photosClose.addEventListener('click', () => {
        photosModal.classList.add('hidden');
    });


    const modalClose = document.getElementById('modal-close');
    modalClose.addEventListener('click', () => {
        infoModal.classList.add('hidden');
    });
}


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}


function animate() {
    requestAnimationFrame(animate);


    if (controls && controls.isLocked) {
        const moveSpeed = 0.05;
        const oldY = camera.position.y;

        if (keys.w) controls.moveForward(moveSpeed);
        if (keys.s) controls.moveForward(-moveSpeed);
        if (keys.a) controls.moveRight(-moveSpeed);
        if (keys.d) controls.moveRight(moveSpeed);

        camera.position.y = oldY;

        raycaster.setFromCamera(mouse, camera);
        const hotspotIntersects = raycaster.intersectObjects(hotspots, false);
        let showPrompt = false;

        hotspots.forEach(h => h.material.color.setHex(0x00adb5));

        if (hotspotIntersects.length > 0) {
            const hoveredHotspot = hotspotIntersects[0].object;
            showPrompt = true;

            if (showPrompt) {
                hoveredHotspot.material.color.setHex(0xff0000);
            }
        } else {
            const intersects = raycaster.intersectObjects(scene.children, true);
            for (let i = 0; i < intersects.length; i++) {
                const hoveredObj = intersects[i].object;
                const interaction = findInteractiveAncestor(hoveredObj);
                if (interaction) {
                    let isClickable = false;
                    if (interaction.type === 'sign' && (currentState === STATE_WORLD || currentState === STATE_ENTRANCE)) isClickable = true;
                    if (interaction.type === 'door' && (currentState === STATE_ENTRANCE || currentState === STATE_WORLD)) isClickable = true;

                    if (isClickable) {
                        showPrompt = true;
                        break;
                    }
                }
            }
        }

        if (showPrompt) {
            document.getElementById('interact-prompt').classList.remove('hidden');
        } else {
            document.getElementById('interact-prompt').classList.add('hidden');
        }
    } else {
        const promptEl = document.getElementById('interact-prompt');
        if (promptEl) promptEl.classList.add('hidden');
    }


    if (currentState === STATE_ENTRANCE && doorMeshes.length > 0) {
        const pulse = 0.35 + 0.35 * Math.sin(Date.now() * 0.003);
        doorMeshes.forEach(door => {
            if (door.material) {
                door.material.emissiveIntensity = pulse;
            }
        });
    }

    renderer.render(scene, camera);
}


window.onload = init;


function openDoorsAndEnter() {

    if (doorMeshes.length >= 2) {

        doorMeshes.sort((a, b) => a.position.x - b.position.x);

        const leftDoor = doorMeshes[0];
        const rightDoor = doorMeshes[1];


        gsap.to(leftDoor.position, {
            x: leftDoor.position.x - 1.6,
            duration: 1.5,
            ease: "power2.inOut"
        });

        gsap.to(rightDoor.rotation, {
            y: rightDoor.rotation.y - 1.57,
            duration: 1.5,
            ease: "power2.inOut",
            onComplete: () => {
                enterLobbyTransition();
            }
        });
    } else if (doorMeshes.length === 1) {
        const door = doorMeshes[0];
        const lowerName = door.name.toLowerCase();


        if (lowerName.includes('right')) {
            gsap.to(door.rotation, {
                y: door.rotation.y - 1.57,
                duration: 1.5,
                ease: "power2.inOut",
                onComplete: () => {
                    enterLobbyTransition();
                }
            });
        } else {
            gsap.to(door.position, {
                x: door.position.x - 1.6,
                duration: 1.5,
                ease: "power2.inOut",
                onComplete: () => {
                    enterLobbyTransition();
                }
            });
        }
    } else {

        enterLobbyTransition();
    }
}

function enterLobbyTransition() {
    document.getElementById('loading-screen').classList.remove('hidden');
    document.getElementById('loading-progress').innerText = 'Entering main lobby...';

    setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');

        const targetView = cameraViews[STATE_FLOOR2_GALLERY];
        animateCamera(targetView.position, targetView.target, 1.5, () => {
            changeState(STATE_FLOOR2_GALLERY);
        });
    }, 1200);
}


function generateGradientEnvMap() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');


    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#56ccf2');
    gradient.addColorStop(0.35, '#a1c4fd');
    gradient.addColorStop(0.48, '#ffffff');
    gradient.addColorStop(0.55, '#2c3e50');
    gradient.addColorStop(1, '#0f2027');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    return texture;
}

function updateReferencePhotosUI() {
    const grid = document.querySelector('.photos-grid');
    if (!grid) return;

    let photos = [];

    if (currentState === STATE_WORLD || currentState === STATE_ENTRANCE) {
        photos = [
            {
                src: '../assets/reference/exterior building.jpg',
                title: 'Exterior Facade',
                caption: 'Main Building Exterior Facade showing modern glass architectures.'
            },
            {
                src: '../assets/reference/entrance building.png',
                title: 'Entrance Facade',
                caption: 'Close up of the entrance facade showing concrete canopy structures.'
            },
            {
                src: '../assets/reference/entrance door.png',
                title: 'Entrance Doors',
                caption: 'Double glass doors acting as the entrance to the library lobby.'
            }
        ];
    } else if (currentState === STATE_FLOOR1_LOBBY || currentState === STATE_FLOOR1_COUNTER || currentState === STATE_FLOOR1_STUDY) {
        photos = [
            {
                src: '../assets/reference/hall.jpg',
                title: '1F: Lobby Hall',
                caption: 'Main lobby hall area on the first floor showing open space.'
            },
            {
                src: '../assets/reference/entrance.jpg',
                title: '1F: Entrance',
                caption: 'View of the primary entrance doors from the inside of the hall.'
            },
            {
                src: '../assets/reference/registration counter.jpg',
                title: '1F: Registration Counter',
                caption: 'The main library registration and enquiry counter on the first floor.'
            }
        ];
    } else if (currentState === STATE_FLOOR2_GALLERY || currentState === STATE_FLOOR2_STUDY) {
        photos = [
            {
                src: '../assets/reference/gallery entrance.jpg',
                title: '2F: Gallery Entrance',
                caption: 'Entrance to the second-floor gallery showcasing historical records.'
            },
            {
                src: '../assets/reference/gallery interior.jpg',
                title: '2F: Gallery Interior',
                caption: 'Interior view of the second-floor gallery layout and display panels.'
            },
            {
                src: '../assets/reference/study section.jpg',
                title: '2F: Study Section',
                caption: 'Quiet reading and study section on the second floor near the glass windows.'
            }
        ];
    }

    grid.innerHTML = photos.map(photo => `
        <div class="photo-card">
            <img src="${encodeURI(photo.src)}" alt="${photo.title}" class="reference-img">
            <div class="photo-title">${photo.title}</div>
            <p class="photo-caption">${photo.caption}</p>
        </div>
    `).join('');
}
