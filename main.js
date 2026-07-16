// PRZS Virtual Tour - Core Logic

// Tour States
const STATE_WORLD = 'exterior';
const STATE_ENTRANCE = 'entrance';
const STATE_FLOOR1_LOBBY = 'lobby';       // 1F: Hall
const STATE_FLOOR1_COUNTER = 'counter';   // 1F: Registration Counter
const STATE_FLOOR1_STUDY = 'study1';      // 1F: Study Section
const STATE_FLOOR2_GALLERY = 'gallery';   // 2F: Gallery
const STATE_FLOOR2_STUDY = 'study2';      // 2F: Study Section

let currentState = STATE_WORLD;

// Three.js Core Variables
let scene, camera, renderer, controls;
let raycaster, mouse;
let loadingManager;

// Groups for Visibility Toggling
const worldGroup = new THREE.Group();
const floor1LobbyGroup = new THREE.Group();
const floor1StudyGroup = new THREE.Group();
const floor2Group = new THREE.Group();

// Raycast Targets & Animated door references
let interactiveObjects = [];
let doorMeshes = [];
let doorPosition = new THREE.Vector3(7.5, 2.2, 0); // Default fallback coordinate for entrance proximity

// Camera Positions Config
const cameraViews = {
    [STATE_WORLD]: {
        position: { x: 0, y: 11, z: 25 },
        target: { x: 0, y: 3, z: 0 }
    },
    [STATE_ENTRANCE]: {
        position: { x: 7.5, y: 2.2, z: 9.5 }, // Zoomed in closer to the entrance wing
        target: { x: 7.5, y: 2.2, z: 0 }
    },
    [STATE_FLOOR1_LOBBY]: { // 1F: Hall
        position: { x: 0, y: 2, z: -2 },
        target: { x: 0, y: 2, z: -10 }
    },
    [STATE_FLOOR1_COUNTER]: { // 1F: Registration Counter
        position: { x: -6, y: 2, z: -6 },
        target: { x: -10, y: 2, z: -10 }
    },
    [STATE_FLOOR1_STUDY]: { // 1F: Study Section
        position: { x: 0, y: 2, z: -25 },
        target: { x: 0, y: 2, z: -40 }
    },
    [STATE_FLOOR2_GALLERY]: { // 2F: Gallery
        position: { x: 0, y: 10, z: -20 },
        target: { x: 0, y: 10, z: -32 }
    },
    [STATE_FLOOR2_STUDY]: { // 2F: Study Section
        position: { x: 0, y: 10, z: -35 },
        target: { x: 0, y: 10, z: -50 }
    }
};

// Initialize Application
function init() {
    // 1. Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);
    scene.fog = new THREE.FogExp2(0x0a0f1d, 0.015);

    // Add Groups to Scene
    scene.add(worldGroup);
    scene.add(floor1LobbyGroup);
    scene.add(floor1StudyGroup);
    scene.add(floor2Group);

    // 2. Camera setup
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    const startView = cameraViews[STATE_WORLD];
    camera.position.set(startView.position.x, startView.position.y, startView.position.z);

    // 3. Renderer setup
    const canvas = document.getElementById('three-canvas');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    // 4. Controls setup
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't allow camera under ground
    controls.minDistance = 2;
    controls.maxDistance = 100;
    controls.target.set(startView.target.x, startView.target.y, startView.target.z);
    controls.update();
    controls.enabled = false; // Disable controls until welcome screen is dismissed

    // Automatically manage door glow visibility by measuring camera proximity to the doors
    controls.addEventListener('change', () => {
        if (currentState === STATE_WORLD || currentState === STATE_ENTRANCE) {
            // Measure direct 3D distance between camera and doors
            const dist = camera.position.distanceTo(doorPosition);
            
            // If camera is close to the entrance (within 7.5 units), keep entrance mode active
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

    // 5. Lighting setup
    setupLighting();

    // Setup local canvas-based environment map for offline-safe, CORS-free reflections
    scene.environment = generateGradientEnvMap();

    // 6. Raycaster & Mouse setup
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // 7. Load Assets
    setupLoadingManager();
    load3DModels();

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    
    // Drag detection state machine to prevent camera panning from triggering accidental clicks
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
        // Only set isDragging if the mouse is pressed down (i.e. camera is being dragged)
        if (isMouseDown) {
            if (Math.abs(e.clientX - dragStartX) > 6 || Math.abs(e.clientY - dragStartY) > 6) {
                isDragging = true;
            }
        }

        // Raycast to update cursor icon for interactive 3D elements
        // Only run if welcome screen is closed and modals are hidden
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
                    // Sign is clickable in world view; doors are clickable in both world and entrance views
                    if ((interaction.type === 'sign' && currentState === STATE_WORLD) ||
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

    // Start Animation Loop
    animate();
}

// Set up lighting for the outdoor scene
function setupLighting() {
    // Ambient Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // Hemispherical Sky Light
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1d2a4a, 0.6);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    // Directional Light (Sun)
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

// Handle Loading Indicators
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

// Load glTF Models
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
                    
                    // Programmatically force glass/windows to be highly reflective cyan glass
                    if (child.material) {
                        const matName = child.material.name ? child.material.name.toLowerCase() : "";
                        const meshName = child.name ? child.name.toLowerCase() : "";
                        
                        // Capture windows, glass, cermin, and panels
                        if (matName.includes('glass') || matName.includes('window') || matName.includes('cermin') || 
                            matName.includes('blue') || matName.includes('cyan') || matName.includes('dark_glass') ||
                            meshName.includes('glass') || meshName.includes('window') || meshName.includes('cermin') || 
                            meshName.includes('window_pane') || meshName.includes('panel')) {
                            
                            // Override window properties to be gorgeous semi-transparent glossy cyan
                            child.material.color.setHex(0x00adb5); // PRZS Cyan/Teal
                            child.material.roughness = 0.02;      // Mirror smoothness
                            child.material.metalness = 0.95;     // Maximum metalness reflection
                            child.material.transparent = true;
                            child.material.opacity = 0.85;        // Elegant transparency
                            child.material.needsUpdate = true;
                        }
                    }
                    
                    // Store door meshes based on Blender outliner names (ignores spaces/underscores)
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
                        // Clone material so the door meshes can glow independently of other parts of the building
                        if (child.material) {
                            child.material = child.material.clone();
                        }
                        doorMeshes.push(child);
                    }
                }
            });

            // Scale the model directly to make it physically larger in the scene
            const scaleFactor = 2.2; // Adjust this number (e.g., 2.5 or 3.0) to change the model size
            model.scale.set(scaleFactor, scaleFactor, scaleFactor);

            // 1. Auto-center and ground the model at (0, 0, 0)
            const box = new THREE.Box3().setFromObject(model);
            const center = new THREE.Vector3();
            box.getCenter(center);
            const size = new THREE.Vector3();
            box.getSize(size);

            model.position.x = -center.x;
            model.position.z = -center.z;
            model.position.y = -box.min.y; // Ground lowest point to Y = 0

            // 2. Auto-fit camera zoom using the building's HEIGHT (size.y) to ignore the wide lawn
            // Multiplying size.y by 1.45 frames the height beautifully on the viewport
            let cameraDistance = size.y * 1.45;
            cameraDistance = Math.min(Math.max(cameraDistance, 12), 28);

            // Update default camera view for the Landing Page (STATE_WORLD)
            cameraViews[STATE_WORLD].position = { x: 0, y: size.y * 0.55, z: cameraDistance };
            cameraViews[STATE_WORLD].target = { x: 0, y: size.y * 0.35, z: 0 };

            // Apply starting view immediately if we are on the landing page
            if (currentState === STATE_WORLD) {
                camera.position.set(cameraViews[STATE_WORLD].position.x, cameraViews[STATE_WORLD].position.y, cameraViews[STATE_WORLD].position.z);
                controls.target.set(cameraViews[STATE_WORLD].target.x, cameraViews[STATE_WORLD].target.y, cameraViews[STATE_WORLD].target.z);
                controls.update();
            }

            worldGroup.add(model);

            // Force world matrix calculations to capture accurate coordinates after scaling and centering
            scene.updateMatrixWorld(true);
            if (doorMeshes.length > 0) {
                doorMeshes[0].getWorldPosition(doorPosition);
                console.log("Dynamically captured correct door coordinates:", doorPosition);
                
                // Dynamically update the Entrance state camera position closer to the door (3.2 units)
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

// Fallback visual scene if model does not exist yet (so it doesn't break out-of-the-box)
function createPlaceholderScene() {
    // 1. Ground Plane (Grass/Lawn)
    const groundGeo = new THREE.PlaneGeometry(80, 80);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1f3c1d, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    worldGroup.add(ground);

    // 2. Pathway/Road
    const pathGeo = new THREE.PlaneGeometry(8, 40);
    const pathMat = new THREE.MeshStandardMaterial({ color: 0x3d352b, roughness: 0.8 });
    const path = new THREE.Mesh(pathGeo, pathMat);
    path.rotation.x = -Math.PI / 2;
    path.position.set(13, 0.01, 20); // Aligned with the door pathway on the side
    path.receiveShadow = true;
    worldGroup.add(path);

    // 3. Main Library Building Box (PRZS Shape)
    const buildingGeo = new THREE.BoxGeometry(32, 12, 18);
    const buildingMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.5 });
    const building = new THREE.Mesh(buildingGeo, buildingMat);
    building.position.set(0, 6, 0);
    building.castShadow = true;
    building.receiveShadow = true;
    worldGroup.add(building);

    // 4. Windows (Front Glass Facade Mockup)
    const glassGeo = new THREE.PlaneGeometry(28, 9);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x005b66, roughness: 0.1, metalness: 0.9 });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.set(0, 6.5, 9.05); // Placed slightly on front wall face
    worldGroup.add(glass);

    // 5. Interactive Signboard Target (PRZS Library Name Sign)
    const signGeo = new THREE.BoxGeometry(6, 2.5, 0.4);
    const signMat = new THREE.MeshStandardMaterial({ color: 0x00adb5, roughness: 0.2 });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0, 1.25, 14);
    sign.castShadow = true;
    sign.name = 'interactive_main_sign';
    worldGroup.add(sign);
    interactiveObjects.push(sign);

    // Visual text placeholder label on signboard
    const labelGeo = new THREE.PlaneGeometry(5.6, 2);
    const labelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const label = new THREE.Mesh(labelGeo, labelMat);
    label.position.set(0, 1.25, 14.21);
    worldGroup.add(label);

    // 6. Interactive Door (Entrance on Right-hand Side)
    const doorGeo = new THREE.BoxGeometry(3, 4.5, 0.2);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x222831, metalness: 0.5, roughness: 0.3 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(13, 2.25, 9); // Aligned with pathway
    door.castShadow = true;
    door.name = 'interactive_exterior_entrance';
    worldGroup.add(door);
    interactiveObjects.push(door);

    // 7. Trees (Meaningful outdoor objects)
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

    // Trigger loader manager manually since we simulated it
    setTimeout(() => {
        document.getElementById('loading-screen').classList.add('hidden');
    }, 500);
}

// Camera transition using GSAP
function animateCamera(endPos, endTarget, duration = 2.2, callback = null) {
    controls.enabled = false;

    gsap.to(camera.position, {
        x: endPos.x,
        y: endPos.y,
        z: endPos.z,
        duration: duration,
        ease: "power2.inOut",
        onUpdate: () => {
            controls.update(); // Synchronize controls with camera position on every frame
        }
    });

    gsap.to(controls.target, {
        x: endTarget.x,
        y: endTarget.y,
        z: endTarget.z,
        duration: duration,
        ease: "power2.inOut",
        onUpdate: () => {
            controls.update(); // Synchronize controls target on every frame
        },
        onComplete: () => {
            controls.enabled = true;
            controls.update();
            if (callback) callback();
        }
    });
}

// Update Location State and Manage Visibilities
function changeState(newState) {
    currentState = newState;
    
    // Toggle floor layer visibilities to optimize rendering
    worldGroup.visible = (currentState === STATE_WORLD || currentState === STATE_ENTRANCE);
    floor1LobbyGroup.visible = (currentState === STATE_FLOOR1_LOBBY || currentState === STATE_FLOOR1_COUNTER);
    floor1StudyGroup.visible = (currentState === STATE_FLOOR1_STUDY || currentState === STATE_FLOOR2_GALLERY || currentState === STATE_FLOOR2_STUDY);
    floor2Group.visible = (currentState === STATE_FLOOR2_GALLERY || currentState === STATE_FLOOR2_STUDY);

    // Configure door emissive glow based on entrance state
    doorMeshes.forEach(door => {
        if (door.material) {
            if (currentState === STATE_ENTRANCE) {
                // Set to beautiful library cyan/teal glow
                door.material.emissive.setHex(0x00adb5);
            } else {
                // Turn off glow (black emissive)
                door.material.emissive.setHex(0x000000);
                door.material.emissiveIntensity = 0.0;
            }
        }
    });

    // Update active state in floor HUD
    const buttons = document.querySelectorAll('.floor-btn');
    buttons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-floor') === currentState) {
            btn.classList.add('active');
        }
    });

    // Update Panel Descriptions & Status text based on current room
    updateUIContent();
}

// Handle Raycast Interactions (Clicks on 3D elements)
function onDocumentClick(event) {
    // Only raycast if welcome screen is closed and modals are hidden
    if (!document.getElementById('welcome-screen').classList.contains('hidden')) return;
    if (!document.getElementById('info-modal').classList.contains('hidden')) return;
    if (!document.getElementById('photos-modal').classList.contains('hidden')) return;

    // Calculate mouse position in normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    
    // Raycast against all meshes in the scene so clicking works even if they lack prefixes
    const intersects = raycaster.intersectObjects(scene.children, true);

    // Search the intersections list for the first interactive object
    for (let i = 0; i < intersects.length; i++) {
        const clickedObj = intersects[i].object;
        const interaction = findInteractiveAncestor(clickedObj);
        if (interaction) {
            handleObjectInteraction(clickedObj);
            break; // Stop at the first interactive object
        }
    }
}

// Helper to recursively find matching interactive ancestor name in the 3D hierarchy using exact Blender outliner names
function findInteractiveAncestor(object) {
    let current = object;
    while (current) {
        if (current.name) {
            const name = current.name.toLowerCase();
            
            // Get world position for height-based character filters
            const worldPos = new THREE.Vector3();
            current.getWorldPosition(worldPos);

            // Broad check for signboard or lettering keywords (including all words of the library name)
            const isNamedSign = name.includes('building') || name.includes('sign') || name.includes('board') || 
                                name.includes('letter') || name.includes('text') || name.includes('title') || 
                                name.includes('name') || name.includes('label') || name.includes('perpustakaan') || 
                                name.includes('raja') || name.includes('zarith') || name.includes('sofiah') || 
                                name.includes('sofia') || name.includes('sofea') || name.includes('library');
                                
            // Check for single character nodes (e.g. 'j.001', 'z.002') or curves/fonts at the top of the building
            const isLetterMesh = /^[a-z](?:\.\d+)?$/.test(name) || name.includes('curve') || name.includes('font');
            const isSignAtTop = isLetterMesh && worldPos.y > 9.0;

            if (isNamedSign || isSignAtTop) {
                return { type: 'sign', object: current };
            }
            
            // Match door node names (immune to space/underscore replacement)
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

// Core Interaction Router
function handleObjectInteraction(object) {
    const interaction = findInteractiveAncestor(object);
    if (!interaction) {
        console.log("Clicked object has no interactive ancestor:", object.name);
        return;
    }

    console.log("Interacted type:", interaction.type, "Matched object:", interaction.object.name);

    if (interaction.type === 'sign' && currentState === STATE_WORLD) {
        // Fly camera directly in front of the door using the dynamically configured Entrance camera views (closer zoom at 3.2 units)
        const targetView = cameraViews[STATE_ENTRANCE];

        animateCamera(targetView.position, targetView.target, 2.5, () => {
            changeState(STATE_ENTRANCE);
        });
    } 
    else if (interaction.type === 'door' && (currentState === STATE_ENTRANCE || currentState === STATE_WORLD)) {
        openDoorsAndEnter();
    }
}

// Update HTML Guide content
function updateUIContent() {
    const locDesc = document.getElementById('location-desc');
    const statusText = document.getElementById('status-text');

    switch (currentState) {
        case STATE_WORLD:
            locDesc.innerHTML = "We are standing outside the library. Click on the <strong>main building sign</strong> at the top to approach the entrance.";
            statusText.innerText = "Exterior Building active";
            break;
        case STATE_ENTRANCE:
            locDesc.innerHTML = "You have approached the side entrance. Click on the <strong>door</strong> to enter the library hall.";
            statusText.innerText = "Entrance Gates active";
            break;
        case STATE_FLOOR1_LOBBY:
            locDesc.innerHTML = "Welcome to the 1F: Hall. Here you see the lobby structure and security turnstiles. Choose study areas or check in at the Registration Counter.";
            statusText.innerText = "1F: Hall active";
            break;
        case STATE_FLOOR1_COUNTER:
            locDesc.innerHTML = "We are at the 1F: Registration Counter. Check in here for library guides and research desk assistance.";
            statusText.innerText = "1F: Registration Counter active";
            break;
        case STATE_FLOOR1_STUDY:
            locDesc.innerHTML = "You have entered the 1F: Study Section. Find a bookshelf or click the stairs to go up to the 2F Gallery.";
            statusText.innerText = "1F: Study Section active";
            break;
        case STATE_FLOOR2_GALLERY:
            locDesc.innerHTML = "Welcome to the 2F: Gallery. Examine local UTM archives, historical layouts, and gallery spaces.";
            statusText.innerText = "2F: Gallery active";
            break;
        case STATE_FLOOR2_STUDY:
            locDesc.innerHTML = "You are now in the 2F: Study Section. Enjoy quiet reading rows and study tables by the glass windows.";
            statusText.innerText = "2F: Study Section active";
            break;
    }
}

// Setup Event Handlers for HUD Buttons
function setupUIEventListeners() {
    const startBtn = document.getElementById('start-btn');
    const welcomeScreen = document.getElementById('welcome-screen');
    const uiHud = document.getElementById('ui-hud');

    // Start Tour Button Click
    startBtn.addEventListener('click', () => {
        welcomeScreen.classList.add('hidden');
        uiHud.classList.remove('hidden');
        controls.enabled = true; // Unlock camera control
        
        // Initial soft entry camera pan
        const worldView = cameraViews[STATE_WORLD];
        animateCamera(worldView.position, worldView.target, 2.0);
    });

    // Add magnetic 3D hover & coordinates tracking to start button
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

    // Floor Navigator Button Clicks
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

    // Photo Gallery Modal Handlers
    const galleryBtn = document.getElementById('photo-gallery-btn');
    const photosModal = document.getElementById('photos-modal');
    const photosClose = document.getElementById('photos-close');

    galleryBtn.addEventListener('click', () => {
        photosModal.classList.remove('hidden');
    });

    photosClose.addEventListener('click', () => {
        photosModal.classList.add('hidden');
    });

    // Info Modal Close
    const infoModal = document.getElementById('info-modal');
    const modalClose = document.getElementById('modal-close');
    modalClose.addEventListener('click', () => {
        infoModal.classList.add('hidden');
    });
}

// Resize event
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Animation Render loop
function animate() {
    requestAnimationFrame(animate);

    // Required update for camera control damping
    if (controls && controls.enabled) {
        controls.update();
    }

    // Pulsate the doors' emissive glow if active in STATE_ENTRANCE
    if (currentState === STATE_ENTRANCE && doorMeshes.length > 0) {
        const pulse = 0.35 + 0.35 * Math.sin(Date.now() * 0.003); // Range 0.0 to 0.7 intensity
        doorMeshes.forEach(door => {
            if (door.material) {
                door.material.emissiveIntensity = pulse;
            }
        });
    }

    renderer.render(scene, camera);
}

// Run setup on load
window.onload = init;

// Open entrance doors sliding animation and transition inside
function openDoorsAndEnter() {

    if (doorMeshes.length >= 2) {
        // Sort door meshes by their local X coordinates to correctly identify left and right doors
        doorMeshes.sort((a, b) => a.position.x - b.position.x);
        
        const leftDoor = doorMeshes[0];
        const rightDoor = doorMeshes[1];

        // Animate door leaves sliding open
        gsap.to(leftDoor.position, {
            x: leftDoor.position.x - 1.6,
            duration: 1.5,
            ease: "power2.inOut"
        });

        gsap.to(rightDoor.rotation, {
            y: rightDoor.rotation.y - 1.57, // Swing open 90 degrees outward
            duration: 1.5,
            ease: "power2.inOut",
            onComplete: () => {
                enterLobbyTransition();
            }
        });
    } else if (doorMeshes.length === 1) {
        const door = doorMeshes[0];
        const lowerName = door.name.toLowerCase();
        
        // If it's the right door, swing open. If left door, slide open.
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
        // Fallback if no door meshes were found in the GLB
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

// Generate local canvas gradient texture for reflections
function generateGradientEnvMap() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    // Sky to Ground Gradient representing sky blue, horizon haze, and ground details
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#56ccf2');   // Bright sky blue
    gradient.addColorStop(0.35, '#a1c4fd'); // Soft blue haze
    gradient.addColorStop(0.48, '#ffffff'); // Bright horizon glow
    gradient.addColorStop(0.55, '#2c3e50'); // Dark horizon/ground transition
    gradient.addColorStop(1, '#0f2027');   // Deep ground/shadow tone
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    return texture;
}
