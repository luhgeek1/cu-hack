import * as THREE from "three";

export function mountSilverOrbit(host: HTMLDivElement): (() => void) | undefined {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  } catch { return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 50);
  camera.position.set(0, .15, 7.8);
  camera.lookAt(0, 0, 0);

  // Local studio softboxes give the silver real reflections without external HDR assets.
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x22252a);
  const panels: THREE.Mesh[] = [];
  const panel = (width: number, height: number, x: number, y: number, z: number, intensity: number) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(intensity), side: THREE.DoubleSide }));
    mesh.position.set(x, y, z);
    mesh.lookAt(0, 0, 0);
    studio.add(mesh);
    panels.push(mesh);
  };
  panel(3, 7, -4, 2, 3, 5);
  panel(2, 6, 4, 0, 2, 3);
  panel(6, 2, 0, 5, -1, 6);
  panel(1, 5, -1, 0, -5, 2);
  panel(5, 3, 1, 1, 6, 2.5);
  panel(5, 5, -5, -3, 5, .9);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(studio, .045);
  scene.environment = environment.texture;
  panels.forEach(mesh => { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); });
  pmrem.dispose();

  const silver = new THREE.MeshPhysicalMaterial({ color: 0xd7dade, metalness: 1, roughness: .23, clearcoat: .65, clearcoatRoughness: .18 });
  const polished = new THREE.MeshPhysicalMaterial({ color: 0xeef0f2, metalness: 1, roughness: .14, clearcoat: 1, clearcoatRoughness: .12 });
  const sculpture = new THREE.Group();
  scene.add(sculpture);

  // A substantial, rounded machined annulus, rather than a wireframe ring.
  const profile = new THREE.Shape();
  profile.absarc(0, 0, 1.22, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, .79, 0, Math.PI * 2, true);
  profile.holes.push(hole);
  const ringGeometry = new THREE.ExtrudeGeometry(profile, { depth: .25, bevelEnabled: true, bevelSegments: 6, steps: 1, bevelSize: .095, bevelThickness: .095, curveSegments: 96 });
  ringGeometry.center();
  const ring = new THREE.Mesh(ringGeometry, silver);
  sculpture.add(ring);

  const core = new THREE.Mesh(new THREE.SphereGeometry(.47, 48, 32), polished);
  core.position.set(.02, .04, .23);
  sculpture.add(core);
  const orbit = new THREE.Mesh(new THREE.TorusGeometry(1.62, .018, 10, 160), polished);
  orbit.rotation.set(1.1, -.35, -.4);
  sculpture.add(orbit);
  const satellite = new THREE.Mesh(new THREE.SphereGeometry(.105, 24, 16), polished);
  scene.add(satellite);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let visible = true;
  let lost = false;
  let elapsed = 0;
  let last = 0;
  let pointerX = 0;
  let pointerY = 0;
  let tiltX = 0;
  let tiltY = 0;
  const draw = () => {
    sculpture.rotation.set(.30 + Math.sin(elapsed * .3) * .10 + tiltY, -.42 + Math.sin(elapsed * .25) * .22 + tiltX, -.38 + Math.sin(elapsed * .2) * .06);
    sculpture.position.y = Math.sin(elapsed * .7) * .075 + .06;
    orbit.rotation.z = -.4 + elapsed * .055;
    satellite.position.set(Math.cos(elapsed * .22 + .6) * 1.55, Math.sin(elapsed * .22 + .6) * .8, .35);
    renderer.render(scene, camera);
  };
  const tick = (time: number) => {
    if (last && time - last < 1000 / 30) return;
    elapsed += last ? Math.min((time - last) / 1000, .1) : 0;
    last = time;
    tiltX += (pointerX - tiltX) * .045;
    tiltY += (pointerY - tiltY) * .045;
    draw();
  };
  const syncAnimation = () => {
    last = 0;
    renderer.setAnimationLoop(null);
    if (lost || document.hidden || !visible) return;
    draw();
    if (!reducedMotion.matches) renderer.setAnimationLoop(tick);
  };
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height || lost) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Keep the complete silhouette in frame, including on short phones.
    camera.position.z = Math.max(7.6, 7.1 / camera.aspect);
    camera.updateProjectionMatrix();
    draw();
  };
  const move = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || reducedMotion.matches) return;
    const rect = host.getBoundingClientRect();
    pointerX = ((event.clientX - rect.left) / rect.width - .5) * .24;
    pointerY = ((event.clientY - rect.top) / rect.height - .5) * .14;
  };
  const leave = () => { pointerX = 0; pointerY = 0; };
  const contextLost = (event: Event) => {
    event.preventDefault(); lost = true;
    renderer.setAnimationLoop(null);
    delete host.dataset.ready;
  };
  const contextRestored = () => { lost = false; resize(); syncAnimation(); host.dataset.ready = "true"; };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  const intersectionObserver = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; syncAnimation(); });
  intersectionObserver.observe(host);
  host.addEventListener("pointermove", move);
  host.addEventListener("pointerleave", leave);
  renderer.domElement.addEventListener("webglcontextlost", contextLost);
  renderer.domElement.addEventListener("webglcontextrestored", contextRestored);
  document.addEventListener("visibilitychange", syncAnimation);
  reducedMotion.addEventListener("change", syncAnimation);
  resize();
  syncAnimation();
  host.dataset.ready = "true";

  return () => {
    renderer.setAnimationLoop(null);
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    host.removeEventListener("pointermove", move);
    host.removeEventListener("pointerleave", leave);
    document.removeEventListener("visibilitychange", syncAnimation);
    reducedMotion.removeEventListener("change", syncAnimation);
    renderer.domElement.removeEventListener("webglcontextlost", contextLost);
    renderer.domElement.removeEventListener("webglcontextrestored", contextRestored);
    scene.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
    silver.dispose(); polished.dispose(); environment.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    delete host.dataset.ready;
  };
}
