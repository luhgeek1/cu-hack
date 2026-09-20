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

  // Solid minted coin: satin face, polished raised rims, and a reeded edge.
  const profile = new THREE.Shape();
  profile.absarc(0, 0, 1.22, 0, Math.PI * 2, false);
  const coinGeometry = new THREE.ExtrudeGeometry(profile, { depth: .22, bevelEnabled: true, bevelSegments: 5, steps: 1, bevelSize: .045, bevelThickness: .045, curveSegments: 96 });
  coinGeometry.center();
  sculpture.add(new THREE.Mesh(coinGeometry, silver));
  for (const side of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.15, .035, 12, 128), polished);
    rim.position.z = side * .158;
    sculpture.add(rim);
    const innerRim = new THREE.Mesh(new THREE.TorusGeometry(1.04, .008, 8, 128), polished);
    innerRim.position.z = side * .159;
    sculpture.add(innerRim);
  }
  const reeds = new THREE.InstancedMesh(new THREE.BoxGeometry(.023, .034, .20), polished, 100);
  const stamp = new THREE.Object3D();
  for (let i = 0; i < reeds.count; i++) {
    const angle = i / reeds.count * Math.PI * 2;
    stamp.position.set(Math.cos(angle) * 1.245, Math.sin(angle) * 1.245, 0);
    stamp.rotation.z = angle;
    stamp.updateMatrix();
    reeds.setMatrixAt(i, stamp.matrix);
  }
  reeds.instanceMatrix.needsUpdate = true;
  sculpture.add(reeds);

  // An actual beveled relief, including the open counter of the ruble symbol.
  const ruble = new THREE.Shape();
  ruble.moveTo(-.34, -.59);
  ruble.lineTo(-.34, -.33); ruble.lineTo(-.49, -.33);
  ruble.lineTo(-.49, -.20); ruble.lineTo(-.34, -.20);
  ruble.lineTo(-.34, -.05); ruble.lineTo(-.49, -.05);
  ruble.lineTo(-.49, .10); ruble.lineTo(-.34, .10);
  ruble.lineTo(-.34, .62); ruble.lineTo(.12, .62);
  ruble.bezierCurveTo(.66, .62, .66, -.05, .12, -.05);
  ruble.lineTo(-.12, -.05); ruble.lineTo(-.12, -.20);
  ruble.lineTo(.28, -.20); ruble.lineTo(.28, -.33);
  ruble.lineTo(-.12, -.33); ruble.lineTo(-.12, -.59);
  ruble.closePath();
  const counter = new THREE.Path();
  counter.moveTo(-.12, .12); counter.lineTo(.10, .12);
  counter.bezierCurveTo(.38, .12, .38, .43, .10, .43);
  counter.lineTo(-.12, .43); counter.closePath();
  ruble.holes.push(counter);
  const reliefMaterial = new THREE.MeshPhysicalMaterial({ color: 0x68717c, metalness: 1, roughness: .27, clearcoat: .6 });
  const reliefGeometry = new THREE.ExtrudeGeometry(ruble, { depth: .045, bevelEnabled: true, bevelSize: .018, bevelThickness: .018, bevelSegments: 3, curveSegments: 32 });
  for (const side of [-1, 1]) {
    const relief = new THREE.Mesh(reliefGeometry, reliefMaterial);
    relief.position.z = side * .158;
    relief.rotation.y = side === -1 ? Math.PI : 0;
    sculpture.add(relief);
  }
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
  let inertiaX = 0;
  let inertiaY = 0;
  let press = 0;
  let pressTarget = 0;
  let activePointer: number | null = null;
  let pointerLastX = 0;
  let pointerLastY = 0;
  let pointerTravel = 0;
  let hovering = false;
  const draw = () => {
    sculpture.rotation.set(.30 + Math.sin(elapsed * .3) * .10 + tiltY, -.42 + Math.sin(elapsed * .25) * .22 + tiltX, -.38 + Math.sin(elapsed * .2) * .06);
    sculpture.position.y = Math.sin(elapsed * .7) * .075 + .06 + press * .06;
    sculpture.position.z = press * .18;
    sculpture.scale.setScalar(1 + press * .045);
    orbit.rotation.z = -.4 + elapsed * .055 - tiltX * .18;
    satellite.position.set(Math.cos(elapsed * .22 + .6) * 1.55, Math.sin(elapsed * .22 + .6) * .8, .35);
    renderer.render(scene, camera);
  };
  const tick = (time: number) => {
    if (last && time - last < 1000 / 30) return;
    elapsed += last ? Math.min((time - last) / 1000, .1) : 0;
    last = time;
    if (activePointer === null) {
      pointerX = THREE.MathUtils.clamp(pointerX + inertiaX, -.95, .95);
      pointerY = THREE.MathUtils.clamp(pointerY + inertiaY, -.7, .7);
      inertiaX *= .9;
      inertiaY *= .9;
      if (!hovering && Math.abs(inertiaX) < .002 && Math.abs(inertiaY) < .002) {
        pointerX *= .94;
        pointerY *= .94;
      }
    }
    tiltX += (pointerX - tiltX) * .12;
    tiltY += (pointerY - tiltY) * .12;
    press += (pressTarget - press) * .16;
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
    camera.position.z = Math.max(6.7, 6.25 / camera.aspect);
    camera.updateProjectionMatrix();
    draw();
  };
  const isOverCoin = (event: PointerEvent) => {
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("button, input, a, select, textarea, [data-art-occluder]")
    ) return false;
    const rect = host.getBoundingClientRect();
    const x = (event.clientX - (rect.left + rect.width / 2)) / (rect.width * .44);
    const y = (event.clientY - (rect.top + rect.height / 2)) / (rect.height * .44);
    return x * x + y * y <= 1;
  };
  const move = (event: PointerEvent) => {
    if (reducedMotion.matches) return;
    const rect = host.getBoundingClientRect();
    if (activePointer === event.pointerId) {
      const dx = event.clientX - pointerLastX;
      const dy = event.clientY - pointerLastY;
      pointerLastX = event.clientX;
      pointerLastY = event.clientY;
      pointerTravel += Math.hypot(dx, dy);
      const turnX = (dx / rect.width) * 2.5;
      const turnY = (dy / rect.height) * 2;
      pointerX = THREE.MathUtils.clamp(pointerX + turnX, -.95, .95);
      pointerY = THREE.MathUtils.clamp(pointerY + turnY, -.7, .7);
      inertiaX = turnX * .72;
      inertiaY = turnY * .72;
      event.preventDefault();
      return;
    }
    if (event.pointerType === "mouse") {
      if (!isOverCoin(event)) {
        hovering = false;
        return;
      }
      hovering = true;
      inertiaX = 0;
      inertiaY = 0;
      pointerX = ((event.clientX - rect.left) / rect.width - .5) * .34;
      pointerY = ((event.clientY - rect.top) / rect.height - .5) * .2;
    }
  };
  const startInteraction = (event: PointerEvent) => {
    if (reducedMotion.matches || activePointer !== null || !isOverCoin(event)) return;
    activePointer = event.pointerId;
    pointerLastX = event.clientX;
    pointerLastY = event.clientY;
    pointerTravel = 0;
    inertiaX = 0;
    inertiaY = 0;
    pressTarget = 1;
    hovering = false;
    host.dataset.dragging = "true";
    host.setPointerCapture(event.pointerId);
  };
  const endInteraction = (event: PointerEvent) => {
    if (activePointer !== event.pointerId) return;
    if (pointerTravel < 8) {
      inertiaX += .075;
      inertiaY -= .025;
    }
    activePointer = null;
    pressTarget = 0;
    delete host.dataset.dragging;
    if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
  };
  const leave = () => {
    hovering = false;
    if (activePointer === null) {
      inertiaX = 0;
      inertiaY = 0;
    }
  };
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
  host.dataset.interactive = "true";
  window.addEventListener("pointerdown", startInteraction, true);
  window.addEventListener("pointermove", move, true);
  window.addEventListener("pointerup", endInteraction, true);
  window.addEventListener("pointercancel", endInteraction, true);
  host.addEventListener("lostpointercapture", endInteraction);
  window.addEventListener("pointerleave", leave);
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
    window.removeEventListener("pointerdown", startInteraction, true);
    window.removeEventListener("pointermove", move, true);
    window.removeEventListener("pointerup", endInteraction, true);
    window.removeEventListener("pointercancel", endInteraction, true);
    host.removeEventListener("lostpointercapture", endInteraction);
    window.removeEventListener("pointerleave", leave);
    document.removeEventListener("visibilitychange", syncAnimation);
    reducedMotion.removeEventListener("change", syncAnimation);
    renderer.domElement.removeEventListener("webglcontextlost", contextLost);
    renderer.domElement.removeEventListener("webglcontextrestored", contextRestored);
    scene.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
    reeds.dispose(); reliefMaterial.dispose();
    silver.dispose(); polished.dispose(); environment.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    delete host.dataset.ready;
    delete host.dataset.interactive;
    delete host.dataset.dragging;
  };
}
