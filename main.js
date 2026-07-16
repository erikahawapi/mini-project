// PRZS Virtual Tour - Core Logic

// Tour States
const STATE_WORLD = 'exterior';
const STATE_ENTRANCE = 'entrance';
const STATE_FLOOR1_LOBBY = 'lobby';
const STATE_FLOOR1_STUDY = 'study1';
const STATE_FLOOR2 = 'floor2';

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

// Raycast Targets
let interactiveObjects = [];

// Camera Positions Config
const cameraViews = {
    [STATE_WORLD]: {
        position: { x: 0, y: 11, z: 25 },
        target: { x: 0, y: 3, z: 0 }
    },
    [STATE_ENTRANCE]: {
        position: { x: 12, y: 2.2, z: 12 }, // Aligned with the side entrance door in the user's model
        target: { x: 14, y: 2.2, z: 0 }
    },
    [STATE_FLOOR1_LOBBY]: {
        position: { x: 0, y: 2, z: -2 },
        target: { x: 0, y: 2, z: -10 }
    },
    [STATE_FLOOR1_STUDY]: {
        position: { x: 0, y: 2, z: -25 },
        target: { x: 0, y: 2, z: -40 }
    },
    [STATE_FLOOR2]: {
        position: { x: 0, y: 10, z: -25 },
        target: { x: 0, y: 10, z: -40 }
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
    window.addEventListener('click', onDocumentClick);
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
                    
                    // Hook up interactive items by name prefix
                    if (child.name.startsWith('interactive_')) {
                        interactiveObjects.push(child);
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
        ease: "power2.inOut"
    });

    gsap.to(controls.target, {
        x: endTarget.x,
        y: endTarget.y,
        z: endTarget.z,
        duration: duration,
        ease: "power2.inOut",
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
    floor1LobbyGroup.visible = (currentState === STATE_FLOOR1_LOBBY);
    floor1StudyGroup.visible = (currentState === STATE_FLOOR1_STUDY || currentState === STATE_FLOOR2);
    floor2Group.visible = (currentState === STATE_FLOOR2);

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

    if (intersects.length > 0) {
        const clickedObj = intersects[0].object;
        handleObjectInteraction(clickedObj);
    }
}

// Core Interaction Router
function handleObjectInteraction(object) {
    console.log("Interacted with object:", object.name);
    const name = object.name.toLowerCase();

    // Check if clicked signboard
    if ((object.name === 'interactive_main_sign' || name.includes('sign') || name.includes('board')) && currentState === STATE_WORLD) {
        // Zoom to door focus
        const targetView = cameraViews[STATE_ENTRANCE];
        animateCamera(targetView.position, targetView.target, 2.5, () => {
            changeState(STATE_ENTRANCE);
        });
    } 
    // Check if clicked entrance door
    else if ((object.name === 'interactive_exterior_entrance' || name.includes('door') || name.includes('entrance') || name.includes('gate')) && (currentState === STATE_ENTRANCE || currentState === STATE_WORLD)) {
        // Enter lobby
        document.getElementById('loading-screen').classList.remove('hidden');
        document.getElementById('loading-progress').innerText = 'Opening entrance doors...';
        
        setTimeout(() => {
            document.getElementById('loading-screen').classList.add('hidden');
            
            const targetView = cameraViews[STATE_FLOOR1_LOBBY];
            animateCamera(targetView.position, targetView.target, 1.5, () => {
                changeState(STATE_FLOOR1_LOBBY);
            });
        }, 1200);
    }
}

// Update HTML Guide content
function updateUIContent() {
    const locDesc = document.getElementById('location-desc');
    const statusText = document.getElementById('status-text');

    switch (currentState) {
        case STATE_WORLD:
            locDesc.innerHTML = "We are standing at the main plaza outside the library. Click on the <strong>signboard</strong> (teal post) or the <strong>entrance door</strong> to approach the building.";
            statusText.innerText = "Exterior plaza view";
            break;
        case STATE_ENTRANCE:
            locDesc.innerHTML = "You have approached the side entrance. Click on the <strong>door</strong> to enter the library main lobby.";
            statusText.innerText = "Library entrance gates";
            break;
        case STATE_FLOOR1_LOBBY:
            locDesc.innerHTML = "Welcome to the First Floor Lobby. Here you see the reception counter and safety turnstiles. Choose <strong>1F: Study Section</strong> from the right HUD to explore further.";
            statusText.innerText = "1F Lobby area";
            break;
        case STATE_FLOOR1_STUDY:
            locDesc.innerHTML = "You have entered the first-floor quiet study section. Click on the <strong>Stairs Button</strong> or select <strong>2F: Reference Area</strong> on the navigator HUD to go upstairs.";
            statusText.innerText = "1F Study desks";
            break;
        case STATE_FLOOR2:
            locDesc.innerHTML = "You are now on the Second Floor reference and discussion area. You can look down the stair atrium or study near the windows.";
            statusText.innerText = "2F Reference spaces";
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

    // Start Tour Button Mousemove for Reactive Radial Glow & 3D Tilt Magnet
    startBtn.addEventListener('mousemove', (e) => {
        const rect = startBtn.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Update glow shader variables
        startBtn.style.setProperty('--mouse-x', `${x}px`);
        startBtn.style.setProperty('--mouse-y', `${y}px`);

        // Compute mouse distance from the center of the button (range -1 to 1)
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const percentX = (x - centerX) / centerX;
        const percentY = (y - centerY) / centerY;

        // Apply a subtle float and tilt towards the cursor direction
        const transX = percentX * 7;      // Slide up to 7px horizontally
        const transY = (percentY * 6) - 2; // Slide up to 6px vertically (offset by -2px base hover lift)
        const rotX = -percentY * 8;       // Rotate up to 8 degrees on X axis
        const rotY = percentX * 8;        // Rotate up to 8 degrees on Y axis

        startBtn.style.transform = `translate3d(${transX}px, ${transY}px, 0) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.03)`;
    });

    // Reset button transition when mouse leaves
    startBtn.addEventListener('mouseleave', () => {
        startBtn.style.transform = 'translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg) scale(1)';
    });

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
    const modalBody = document.getElementById('modal-body');
    
    modalClose.addEventListener('click', () => {
        infoModal.classList.add('hidden');
    });

    // Feature item clicks for info modal
    const featureHistory = document.getElementById('feature-history');
    const featureHours = document.getElementById('feature-hours');
    const featureContact = document.getElementById('feature-contact');

    if (featureHistory) {
        featureHistory.addEventListener('click', () => {
            modalBody.innerHTML = `
                <h2 style="margin-bottom: 15px; color: #00adb5;">About Raja Zarith Sofiah Library</h2>
                <img src="PRZS Image.jpg" alt="PRZS Building" style="width: 100%; border-radius: 8px; margin-bottom: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
                <p style="margin-bottom: 10px; text-align: center; font-size: 1.1em;"><strong>Raja Zarith Sofiah Library Building</strong></p>
                <p style="margin-bottom: 10px; line-height: 1.6; text-align: justify;">In line with Universiti Teknologi Malaysia’s development as a Research University, UTM Library services continue to be strengthened through the establishment of the Raja Zarith Sofiah Library (PRZS), which is designed as a research-focused library. The PRZS building was officially inaugurated on 30 September 2014 during a Proclamation Ceremony officiated by His Royal Highness Tunku Temenggong Johor, Tunku Idris Iskandar Ibni Sultan Ibrahim.</p>
                <p style="line-height: 1.6; text-align: justify;">Located at the southwestern part of the UTM campus, the library was specifically developed to support research activities and was named after UTM’s fourth Chancellor, Raja Zarith Sofiah. The building serves as a central hub for academic resources, research support, and knowledge development within the university community.</p>
            `;
            infoModal.classList.remove('hidden');
        });
    }

    if (featureHours) {
        featureHours.addEventListener('click', () => {
            modalBody.innerHTML = `
                <h2 style="margin-bottom: 15px; color: #00adb5;">Working Hours</h2>
                <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; border-left: 4px solid #00adb5;">
                    <p style="margin-bottom: 10px; font-size: 1.1em; line-height: 1.6;">Monday to Friday between <strong>8:00 AM and 6:00 PM</strong>.</p>
                    <p style="margin-bottom: 10px; line-height: 1.6;">The library is closed on weekends and public holidays.</p>
                    <p style="font-size: 0.9em; opacity: 0.8; line-height: 1.6;"><em>*These specific hours apply during the semester break</em></p>
                </div>
            `;
            infoModal.classList.remove('hidden');
        });
    }

    if (featureContact) {
        featureContact.addEventListener('click', () => {
            modalBody.innerHTML = `
                <h2 style="margin-bottom: 15px; color: #00adb5;">Contact Information</h2>
                <ul style="list-style: none; padding: 0; line-height: 2;">
                    <li><strong>🌐 Website:</strong> <a href="https://library.utm.my/" target="_blank" style="color: #00adb5; text-decoration: none;">https://library.utm.my/</a></li>
                    <li><strong>📍 Address:</strong> Pusat Pentadbiran Universiti Teknologi Malaysia, 80990 Skudai, Johor Darul Ta'zim</li>
                    <li><strong>📞 Phone:</strong> 07-553 0188</li>
                    <li><strong>✉️ Email:</strong> <a href="mailto:lib-enquiryjb@utm.my" style="color: #00adb5; text-decoration: none;">lib-enquiryjb@utm.my</a></li>
                </ul>
            `;
            infoModal.classList.remove('hidden');
        });
    }
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

    renderer.render(scene, camera);
}

// Run setup on load
window.onload = init;

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
