// Import all necessary libraries to use with three.js and 3D file loading 
import * as THREE from 'https://cdn.jsdelivr.net/npm/three/+esm'
import { OrbitControls } from './three/OrbitControls.js'
import { GLTFLoader } from './three/gltfLoader.js'

// Create references to all HTML elements
const canvas = document.getElementById('canvas')
const labelForm = document.getElementById('labelForm')
const styleForm = document.getElementById('styleForm')
const styleBtn = document.getElementById('styleBtn')
const addLabelBtn = document.getElementById('addLabelBtn')
const displayTitle = document.getElementById('displayTitle')
const displayDescription = document.getElementById('displayDescription')
const displayWindow = document.getElementById('display')

const inputs = {
    borderColour: document.getElementById('borderColour'),
    borderWidth: document.getElementById('borderWidth'),
    labelSize: document.getElementById('labelSize'),
    bgColour: document.getElementById('bgColour'),
    labelTitle: document.getElementById('title'),
    labelDescription: document.getElementById('description')
}

// Global Application State
let size = 30; // Diameter of label
let presenting = false;
let enabled = true;
let isStyling = false;
let canAddLabel = true;
let glb; 

const meshes = [];
const labels = [];
let divs = [];
let editingIndex = undefined;

// Tracking variable for geometry face selections
let prev = { mesh: null, face: null };
const pointerDownPos = new THREE.Vector2();

// Three.js Scene Core Infrastructure Setup
const scene = new THREE.Scene()
scene.background = new THREE.Color('#002')

const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)

const ambientLight = new THREE.AmbientLight(0xffffff, 5) 
scene.add(ambientLight)

const dirLight = new THREE.DirectionalLight(0xffffff, 5) 
dirLight.position.set(10, -30, 40)
scene.add(dirLight)

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight)
camera.position.z = 3
scene.add(camera)

const controls = new OrbitControls(camera, renderer.domElement); 

// Global System Controller for OrbitControls
function toggleEnabled(isActive) {
    controls.enablePan = isActive;
    controls.enableRotate = isActive;
    controls.enableZoom = isActive;
    enabled = isActive;
}

// Robust Mobile & Desktop Input Form Focus Handlers
function lockControls() {
    toggleEnabled(false);
    canAddLabel = false;
}

function unlockControls() {
    toggleEnabled(true);
    canAddLabel = true;
}

// UI Container Event Interceptors
[labelForm, styleForm].forEach(form => {
    form.addEventListener('pointerdown', (e) => e.stopPropagation());
    form.addEventListener('pointerup', (e) => e.stopPropagation());
});

// Stop inputs and buttons from bleeding events out to OrbitControls
labelForm.querySelectorAll('input, textarea, button').forEach(el => {
    el.addEventListener('focus', lockControls);
    el.addEventListener('blur', unlockControls);
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
});

styleForm.querySelectorAll('input, button').forEach(el => {
    el.addEventListener('focus', lockControls);
    el.addEventListener('blur', unlockControls);
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
});

// Load the 3D File Assembly
const loader = new GLTFLoader();
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()

loader.load('test.glb', (model) => {
    glb = model;
    window.glb = glb;

    glb.scene.traverse((child) => {
        if (child.isMesh) {
            child.geometry = child.geometry.toNonIndexed();
            const count = child.geometry.attributes.position.count;
            const colours = new Float32Array(count * 3);
            for (let i = 0; i < count; i++) {
                colours[i * 3 + 0] = 1;
                colours[i * 3 + 1] = 1;
                colours[i * 3 + 2] = 1;
            }
            child.geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
            child.material = child.material.clone(); 
            child.material.vertexColors = true;
            meshes.push(child);
        }
    });
    scene.add(model.scene)
})

// Unified Animation Loop Integration
function animate() {
    requestAnimationFrame(animate)
    showDivs()
    renderer.render(scene, camera)
}

window.addEventListener('resize', () => { 
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight)
})

window.addEventListener('contextmenu', (e) => e.preventDefault())

// Central Pointer Tracking Events
window.addEventListener('pointerdown', (e) => {
    if (e.target !== canvas) return;
    pointerDownPos.set(e.clientX, e.clientY);
});

window.addEventListener('pointerup', (e) => {
    // Stop label placement if user interacts with menus, existing labels, or UI overlays
    if (e.target !== canvas || !enabled || !canAddLabel || presenting) return;
    
    const distance = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
    if (distance > 5) return; // Action classified as a 3D view drag manipulation

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1; 
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1; 

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(meshes, true);

    if (intersects.length > 0) { 
        const intersect = intersects[0];
        
        const label = {
            position: new THREE.Object3D().position.copy(intersect.point),
            title: '',
            description: ''
        };

        labels.push(label);
        editingIndex = labels.length - 1; 
        
        showDivs();
        
        inputs.labelTitle.value = label.title;
        inputs.labelDescription.value = label.description;
        addLabelBtn.textContent = 'Add Label';

        requestAnimationFrame(() => {
            labelForm.style.display = 'flex';
            lockControls();
        });
    }
});

window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return; // Skip face highlighting on mobile touch configurations
    if (meshes.length == 0 || !enabled || presenting) return;
    if (!e.isPrimary) return;

    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(meshes, true);

    if (prev.mesh && prev.face && 
        (intersects.length == 0 || prev.mesh != intersects[0].object || prev.face != intersects[0].face || !canAddLabel)
    ) {
        const geom = prev.mesh.geometry;
        const col = geom.attributes.color;
        [prev.face.a, prev.face.b, prev.face.c].forEach(i => col.setXYZ(i, 1, 1, 1));
        col.needsUpdate = true;
        prev.mesh = null;
        prev.face = null;
    }

    if (intersects.length > 0 && canAddLabel) {
        const { object: mesh, face } = intersects[0];
        const geom = mesh.geometry;
        const col = geom.attributes.color;
        [face.a, face.b, face.c].forEach(i => col.setXYZ(i, 1, 0, 0)); 
        col.needsUpdate = true;
        prev.mesh = mesh;
        prev.face = face;
    }
});

// Dynamic Rendering & Layout Mapping for Screen Spaces
function showDivs() {
    // Clean up extra nodes if markers are cleared or deleted
    while (divs.length > labels.length) {
        const discardedDiv = divs.pop();
        discardedDiv.remove();
    }

    labels.forEach((label, index) => {
        const obstructed = isObstructed(label.position);
        let div = divs[index];

        if (!div) {
            div = document.createElement('div');
            div.classList.add('label');
            div.style.position = 'absolute';
            div.style.zIndex = '2';
            document.body.appendChild(div);
            divs[index] = div;

            // Unified, cross-platform pointer action listener
            div.addEventListener('pointerup', (e) => {
                e.stopPropagation(); // Avoid dropping background tags
                
                if (presenting) {
                    displayInfo(index);
                } else {
                    editingIndex = index;
                    inputs.labelTitle.value = labels[index].title;
                    inputs.labelDescription.value = labels[index].description;
                    addLabelBtn.textContent = 'Edit Label';
                    
                    requestAnimationFrame(() => {
                        labelForm.style.display = 'flex';
                        lockControls();
                    });
                }
            });

            // Restrict hover triggers to physical desktop mouse configurations
            div.addEventListener('pointerover', (e) => {
                if (e.pointerType !== 'mouse') return;
                canAddLabel = false;
            });
            div.addEventListener('pointerout', (e) => {
                if (e.pointerType !== 'mouse') return;
                canAddLabel = true;
            });
        }

        div.textContent = index + 1;
        div.style.display = obstructed ? 'none' : 'flex';

        if (!obstructed) {
            const pos = label.position.clone().project(camera);
            const x = (pos.x * 0.5 + 0.5) * window.innerWidth - size / 2;
            const y = (-pos.y * 0.5 + 0.5) * window.innerHeight - size / 2;
            div.style.left = `${x}px`;
            div.style.top = `${y}px`;
        }
    });
}

function isObstructed(obj) {
    const dir = obj.clone().sub(camera.position).normalize();
    raycaster.set(camera.position, dir);

    const intersects = raycaster.intersectObjects(scene.children, true);
    if (intersects.length == 0) return true;

    const dist = intersects[0].distance;
    const objDist = camera.position.distanceTo(obj);

    return (dist < objDist - 0.001);
}

// Active Stylesheet Extraction Engine
const sheet = document.styleSheets[0]
let rule;
for (let r of sheet.cssRules) {
    if (r.selectorText == '.label') {
        rule = r;
        break;
    }
}

function addStyling() {
    size = Number(inputs.labelSize.value) * 2;
    
    if (rule) {
        rule.style.backgroundColor = inputs.bgColour.value;
        rule.style.border = inputs.borderWidth.value + 'px solid ' + inputs.borderColour.value;
        rule.style.width = rule.style.height = size + 'px';
    }

    displayWindow.style.backgroundColor = inputs.borderColour.value;
    displayDescription.style.backgroundColor = displayTitle.style.backgroundColor = inputs.bgColour.value;
    displayWindow.style.border = `${inputs.borderWidth.value}px solid ${inputs.borderColour.value}`;
}

function toggleStyling() {
    isStyling = !isStyling;

    if (isStyling) {
        if (rule) {
            inputs.bgColour.value = toHex(rule.style.backgroundColor);
            const border = rule.style.border.split(' ');
            if (border.length >= 3) {
                inputs.borderColour.value = toHex(border[2] + (border[3] || ''));
                inputs.borderWidth.value = Number(border[0].replace('px', ''));
            }
            inputs.labelSize.value = Number(rule.style.width.replace('px', '')) / 2;
        }
        styleForm.style.display = 'flex';
        lockControls();
    } else {
        styleForm.style.display = 'none';
        unlockControls();
    }
}

function wipeForm() { 
    labelForm.style.display = 'none';
    labelForm.querySelectorAll('input, textarea').forEach(el => { el.value = ''; });
    addLabelBtn.textContent = 'Add Label';
    unlockControls();
}

// Assign Interface Event Hook Targets
styleBtn.addEventListener('pointerup', (e) => {
    e.stopPropagation();
    toggleStyling();
});

document.getElementById('addStyleBtn').addEventListener('pointerup', (e) => {
    e.stopPropagation();
    addStyling();
    toggleStyling();
});

document.getElementById('closeLabel').addEventListener('pointerup', (e) => {
    e.stopPropagation();
    wipeForm();
});

addLabelBtn.addEventListener('pointerup', (e) => {
    e.stopPropagation();
    if (editingIndex !== undefined && labels[editingIndex]) {
        labels[editingIndex].title = inputs.labelTitle.value;
        labels[editingIndex].description = inputs.labelDescription.value;
    }
    wipeForm();
});

function toHex(value) {
    if (!value) return "#ffffff";
    const el = document.createElement("div");
    el.style.color = value;
    document.body.appendChild(el);
    const computed = getComputedStyle(el).color;
    document.body.removeChild(el);

    const match = computed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return "#ffffff";

    const [_, r, g, b] = match.map(Number);
    return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
}

// Clean Label Deletion Controller Routine
function deleteLabel() {
    if (editingIndex === undefined || editingIndex < 0 || editingIndex >= labels.length) return;

    // Flush the tracking DOM elements entirely
    divs.forEach(div => div.remove());
    divs = [];

    // Process array splicing cleanups
    labels.splice(editingIndex, 1);
    editingIndex = undefined;

    wipeForm();
    showDivs(); // Force a structural synchronous recalculation check pass
}

document.getElementById('deleteLabelBtn').addEventListener('pointerup', (e) => {
    e.stopPropagation();
    deleteLabel();
});

// Presentation Mode Routine Configurations
function present() {
    presenting = true;
    styleBtn.style.display = 'none';
    labelForm.style.display = 'none';
    document.getElementById('presentBtn').style.display = 'none';
    unlockControls(); 
}

function displayInfo(index) {
    if (!labels[index]) return;
    displayTitle.textContent = labels[index].title;
    displayDescription.textContent = labels[index].description;
    
    requestAnimationFrame(() => {
        displayWindow.style.display = 'flex';
    });
}

document.getElementById('closeDisplay').addEventListener('pointerup', (e) => {
    e.stopPropagation();
    displayWindow.style.display = 'none';
    displayTitle.textContent = '';
    displayDescription.textContent = '';
});

document.getElementById('presentBtn').addEventListener('pointerup', (e) => {
    e.stopPropagation();
    present();
});

// Start Applications Logic Pipelines
animate();