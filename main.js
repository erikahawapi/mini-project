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


const worldGroup = new THREE.Group();
const floor1LobbyGroup = new THREE.Group();
const floor1StudyGroup = new THREE.Group();
const floor2Group = new THREE.Group();


let interactiveObjects = [];
let doorMeshes = [];
let doorPosition = new THREE.Vector3(7.5, 2.2, 0);


const cameraViews = {
    [STATE_WORLD]: {
        position: { x: 0, y: 11, z: 25 },
        target: { x: 0, y: 3, z: 0 }
    },
    [STATE_ENTRANCE]: {
        position: { x: 7.5, y: 2.2, z: 9.5 },
        target: { x: 7.5, y: 2.2, z: 0 }
    },
    [STATE_FLOOR1_LOBBY]: {
        position: { x: 0, y: 2, z: -2 },
        target: { x: 0, y: 2, z: -10 }
    },
    [STATE_FLOOR1_COUNTER]: {
        position: { x: -6, y: 2, z: -6 },
        target: { x: -10, y: 2, z: -10 }
    },
    [STATE_FLOOR1_STUDY]: {
        position: { x: 0, y: 2, z: -25 },
        target: { x: 0, y: 2, z: -40 }
    },
    [STATE_FLOOR2_GALLERY]: {
        position: { x: 0, y: 10, z: -20 },
        target: { x: 0, y: 10, z: -32 }
    },
    [STATE_FLOOR2_STUDY]: {
        position: { x: 0, y: 10, z: -35 },
        target: { x: 0, y: 10, z: -50 }
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


    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 2;
    controls.maxDistance = 100;
    controls.target.set(startView.target.x, startView.target.y, startView.target.z);
    controls.update();
    controls.enabled = false;


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


    window.addEventListener('resize', onWindowResize);
    

    window.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
    

    let isMouseDown = false;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;

    window.addEventListener('mousedown', (e) => {
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        isMouseDown = true;
        isDragging = false;
    });

    window.addEventListener('mouseup', (e) => {
        isMouseDown = false;
    });

    window.addEventListener('mousemove', (e) => {

        if (isMouseDown) {
            if (Math.abs(e.clientX - dragStartX) > 6 || Math.abs(e.clientY - dragStartY) > 6) {
                isDragging = true;
            }
        }



        if (document.getElementById('welcome-screen').classList.contains('hidden') &&
            document.getElementById('info-modal').classList.contains('hidden') &&
            document.getElementById('photos-modal').classList.contains('hidden')) {
            
            mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
            
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(scene.children, true);
            
            for (let i = 0; i < intersects.length; i++) {
                const hoveredObj = intersects[i].object;
                const interaction = findInteractiveAncestor(hoveredObj);
                
                if (interaction) {

                    if ((interaction.type === 'sign' && (currentState === STATE_WORLD || currentState === STATE_ENTRANCE)) ||
                        (interaction.type === 'door' && (currentState === STATE_ENTRANCE || currentState === STATE_WORLD))) {
                        document.body.style.cursor = 'pointer';
                        return;
                    }
                }
            }
        }
        document.body.style.cursor = 'default';
    });

    window.addEventListener('click', (e) => {
        if (!isDragging) {
            onDocumentClick(e);
        }
    });

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
        'assets/models/PRZS.glb',
        (gltf) => {
            const model = gltf.scene;
            
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    

                    if (child.material) {
                        const matName = child.material.name ? child.material.name.toLowerCase() : "";
                        const meshName = child.name ? child.name.toLowerCase() : "";
                        

                        if (matName.includes('glass') || matName.includes('window') || matName.includes('cermin') || 
                            matName.includes('blue') || matName.includes('cyan') || matName.includes('dark_glass') ||
                            meshName.includes('glass') || meshName.includes('window') || meshName.includes('cermin') || 
                            meshName.includes('window_pane') || meshName.includes('panel')) {
                            

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
                controls.target.set(cameraViews[STATE_WORLD].target.x, cameraViews[STATE_WORLD].target.y, cameraViews[STATE_WORLD].target.z);
                controls.update();
            }

            worldGroup.add(model);


            scene.updateMatrixWorld(true);
            if (doorMeshes.length > 0) {
                doorMeshes[0].getWorldPosition(doorPosition);
                console.log("Dynamically captured correct door coordinates:", doorPosition);
                

                cameraViews[STATE_ENTRANCE].position = { x: doorPosition.x, y: doorPosition.y + 0.2, z: doorPosition.z + 3.2 };
                cameraViews[STATE_ENTRANCE].target = { x: doorPosition.x, y: doorPosition.y + 0.2, z: doorPosition.z };
            }
        },
        undefined,
        (error) => {
            console.warn('Could not find assets/models/PRZS.glb. Loading visual placeholder scene.');
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
    controls.enabled = false;

    gsap.to(camera.position, {
        x: endPos.x,
        y: endPos.y,
        z: endPos.z,
        duration: duration,
        ease: "power2.inOut",
        onUpdate: () => {
            controls.update();
        }
    });

    gsap.to(controls.target, {
        x: endTarget.x,
        y: endTarget.y,
        z: endTarget.z,
        duration: duration,
        ease: "power2.inOut",
        onUpdate: () => {
            controls.update();
        },
        onComplete: () => {
            controls.enabled = true;
            controls.update();
            if (callback) callback();
        }
    });
}


function changeState(newState) {
    currentState = newState;
    

    worldGroup.visible = (currentState === STATE_WORLD || currentState === STATE_ENTRANCE);
    floor1LobbyGroup.visible = (currentState === STATE_FLOOR1_LOBBY || currentState === STATE_FLOOR1_COUNTER);
    floor1StudyGroup.visible = (currentState === STATE_FLOOR1_STUDY || currentState === STATE_FLOOR2_GALLERY || currentState === STATE_FLOOR2_STUDY);
    floor2Group.visible = (currentState === STATE_FLOOR2_GALLERY || currentState === STATE_FLOOR2_STUDY);


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


function onDocumentClick(event) {

    if (!document.getElementById('welcome-screen').classList.contains('hidden')) return;
    if (!document.getElementById('info-modal').classList.contains('hidden')) return;
    if (!document.getElementById('photos-modal').classList.contains('hidden')) return;


    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    

    const intersects = raycaster.intersectObjects(scene.children, true);


    for (let i = 0; i < intersects.length; i++) {
        const clickedObj = intersects[i].object;
        const interaction = findInteractiveAncestor(clickedObj);
        
        if (interaction) {
            handleObjectInteraction(clickedObj);
            break;
        }
    }
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
                                name.includes('sofia') || name.includes('sofea') || name.includes('library');
                                

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


function handleObjectInteraction(object) {
    const interaction = findInteractiveAncestor(object);
    if (!interaction) {
        console.log("Clicked object has no interactive ancestor:", object.name);
        return;
    }

    console.log("Interacted type:", interaction.type, "Matched object:", interaction.object.name);

    if (interaction.type === 'sign' && (currentState === STATE_WORLD || currentState === STATE_ENTRANCE)) {

        const targetView = cameraViews[STATE_ENTRANCE];

        animateCamera(targetView.position, targetView.target, 2.5, () => {
            changeState(STATE_ENTRANCE);
        });
    } 
    else if (interaction.type === 'door' && (currentState === STATE_ENTRANCE || currentState === STATE_WORLD)) {
        openDoorsAndEnter();
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
            locDesc.innerHTML = "Welcome to the 1F: Hall. Here you see the lobby structure and security turnstiles. Choose study areas or check in at the Registration Counter.";
            statusText.innerText = "1F: Hall";
            break;
        case STATE_FLOOR1_COUNTER:
            locDesc.innerHTML = "We are at the 1F: Registration Counter. Check in here for library guides and research desk assistance.";
            statusText.innerText = "1F: Registration Counter";
            break;
        case STATE_FLOOR1_STUDY:
            locDesc.innerHTML = "You have entered the 1F: Study Section. Find a bookshelf or click the stairs to go up to the 2F Gallery.";
            statusText.innerText = "1F: Study Section";
            break;
        case STATE_FLOOR2_GALLERY:
            locDesc.innerHTML = "Welcome to the 2F: Gallery. Examine local UTM archives, historical layouts, and gallery spaces.";
            statusText.innerText = "2F: Gallery";
            break;
        case STATE_FLOOR2_STUDY:
            locDesc.innerHTML = "You are now in the 2F: Study Section. Enjoy quiet reading rows and study tables by the glass windows.";
            statusText.innerText = "2F: Study Section";
            break;
    }
}


function setupUIEventListeners() {
    const startBtn = document.getElementById('start-btn');
    const welcomeScreen = document.getElementById('welcome-screen');
    const uiHud = document.getElementById('ui-hud');


    startBtn.addEventListener('click', () => {
        welcomeScreen.classList.add('hidden');
        uiHud.classList.remove('hidden');
        controls.enabled = true;
        

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


    if (controls && controls.enabled) {
        controls.update();
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
        
        const targetView = cameraViews[STATE_FLOOR1_LOBBY];
        animateCamera(targetView.position, targetView.target, 1.5, () => {
            changeState(STATE_FLOOR1_LOBBY);
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