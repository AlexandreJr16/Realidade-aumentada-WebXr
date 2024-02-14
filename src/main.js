import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ARButton } from "three/examples/jsm/webxr/ARButton.js";
import "./style.css";

const URL_BASE = "http://localhost:3000/modelo3d/";

let container,
  camera,
  scene,
  renderer,
  controller,
  reticle,
  obj3d,
  modelSuported,
  modelBlob,
  apiUrl;
let hitTestSource = null,
  lastObject = null,
  hitTestSourceRequested = false,
  planeFound = false;

const objLoader = new GLTFLoader();

const getModelUrl = () => {
  const match = window.location.href.match(/\/(\d+)/);
  return match ? `${URL_BASE}${match[1]}` : "";
};

const loadModel = () => {
  fetch(apiUrl)
    .then((response) => response.json())
    .then((data) => {
      if (data.message) {
        modelSuported = false;
      } else {
        modelSuported = true;

        scene = new THREE.Scene();

        modelBlob = new Blob([
          new Uint8Array(data.modelo3D.modelBin.data).buffer,
        ]);
        objLoader.load(URL.createObjectURL(modelBlob), (gltf) => {
          obj3d = gltf.scene;
          scene.add(obj3d);
        });
      }
    })
    .catch((error) => {
      console.error("Error fetching model from the database", error);
    })
    .finally(() => initialize());
};

const initialize = () => {
  if ("xr" in navigator) {
    navigator.xr.isSessionSupported("immersive-ar").then((supported) => {
      if (!modelSuported) {
        document.getElementById("ar-not-supported").style.display = "none";
      } else if (supported) {
        document.getElementById("ar-not-supported").style.display = "none";
        document.getElementById("model-unsupported").style.display = "none";

        init();
        animate();
      }
    });
  }
};

const sessionStart = () => {
  planeFound = false;
  document.getElementById("tracking-prompt").style.display = "block";
};

const init = () => {
  createContainer();
  createScene();
  createCamera();
  createLight();
  createRenderer();
  createARButton();
  createController();
  createReticle();
  addEventListeners();
};

const createContainer = () => {
  container = document.createElement("div");
  document.body.appendChild(container);
};

const createScene = () => {
  scene = new THREE.Scene();
};

const createCamera = () => {
  camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.01,
    20
  );
};

const createLight = () => {
  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  light.position.set(0.5, 1, 0.25);
  scene.add(light);
};

const createRenderer = () => {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  container.appendChild(renderer.domElement);
  renderer.xr.addEventListener("sessionstart", sessionStart);
};

const createARButton = () => {
  document.body.appendChild(
    ARButton.createButton(renderer, {
      requiredFeatures: ["local", "hit-test", "dom-overlay"],
      domOverlay: { root: document.querySelector("#overlay") },
    })
  );
};

const createController = () => {
  controller = renderer.xr.getController(0);
  controller.addEventListener("select", onSelect);
  scene.add(controller);
};

const createReticle = () => {
  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial()
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);
};

const addEventListeners = () => {
  window.addEventListener("resize", onWindowResize);
};

const onSelect = () => {
  if (reticle.visible && obj3d) {
    if (lastObject) {
      scene.remove(lastObject);
      lastObject = null;
    }

    const flower = obj3d.children[0];
    const mesh = flower.clone();

    reticle.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
    const scale = 1;
    mesh.scale.set(scale, scale, scale);
    mesh.rotateX(Math.PI / 2);
    scene.add(mesh);

    const interval = setInterval(() => {
      mesh.scale.multiplyScalar(1.01);
    }, 16);
    setTimeout(() => {
      clearInterval(interval);
    }, 500);

    lastObject = mesh;
  }
};

const onWindowResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
};

const animate = () => {
  renderer.setAnimationLoop(render);
};

const render = (timestamp, frame) => {
  if (frame) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const session = renderer.xr.getSession();

    if (hitTestSourceRequested === false) {
      session.requestReferenceSpace("viewer").then(function (referenceSpace) {
        session
          .requestHitTestSource({ space: referenceSpace })
          .then(function (source) {
            hitTestSource = source;
          });
      });

      session.addEventListener("end", function () {
        hitTestSourceRequested = false;
        hitTestSource = null;
      });

      hitTestSourceRequested = true;
    }

    if (hitTestSource) {
      const hitTestResults = frame.getHitTestResults(hitTestSource);

      if (hitTestResults.length) {
        if (!planeFound) {
          planeFound = true;
          document.getElementById("tracking-prompt").style.display = "none";
          document.getElementById("instructions").style.display = "flex";
        }
        const hit = hitTestResults[0];

        if (hit) {
          const hitMatrix = new THREE.Matrix4().fromArray(
            hit.getPose(referenceSpace).transform.matrix
          );
          const hitNormal = new THREE.Vector3(0, 0, -1);

          hitNormal.applyMatrix4(hitMatrix);
        }

        reticle.visible = true;
        reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
      } else {
        reticle.visible = false;
      }
    }
  }

  renderer.render(scene, camera);
};

apiUrl = getModelUrl();
loadModel();
