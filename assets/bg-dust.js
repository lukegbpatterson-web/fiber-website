/* Background for the main (sage) page: drifting lemon/lime-tinted dust. Three.js. */
(function citrusDrift(){
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.getElementById("drift");
  if(reduceMotion || !window.THREE || !canvas) return;
  const hero = canvas.parentElement;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.z = 30;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha:true, antialias:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const COUNT = 60;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(COUNT*3);
  const speed = new Float32Array(COUNT);
  const sway = new Float32Array(COUNT);
  for(let i=0;i<COUNT;i++){
    positions[i*3]   = (Math.random()-0.5)*70;
    positions[i*3+1] = (Math.random()-0.5)*50;
    positions[i*3+2] = (Math.random()-0.5)*20;
    speed[i] = 0.5 + Math.random()*0.8;
    sway[i] = Math.random()*Math.PI*2;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(positions,3));

  // soft round sprite, warm lemon-lime tint so it reads as citrus dust
  function makeSprite(color){
    const c = document.createElement("canvas"); c.width=c.height=64;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0, `rgba(${color},0.9)`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle=g; ctx.fillRect(0,0,64,64);
    return new THREE.CanvasTexture(c);
  }
  const lemonSprite = makeSprite("228,194,79");
  const limeSprite = makeSprite("147,174,83");

  const points = [lemonSprite, limeSprite].map((sprite)=>{
    const mat = new THREE.PointsMaterial({
      size:1.6, map:sprite, transparent:true, depthWrite:false,
      blending:THREE.NormalBlending, opacity:0.5
    });
    const p = new THREE.Points(geo, mat);
    scene.add(p);
    return p;
  });

  function resize(){
    const w = hero.clientWidth || window.innerWidth;
    const h = hero.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w/h; camera.updateProjectionMatrix();
    renderer.render(scene, camera); // paint one frame immediately, even if rAF is throttled
  }
  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("load", resize);

  const pos = geo.attributes.position.array;
  let t = 0;
  function animate(){
    t += 0.005;
    for(let i=0;i<COUNT;i++){
      pos[i*3+1] += speed[i]*0.018;                 // gentle rise
      pos[i*3]   += Math.sin(t + sway[i])*0.01;     // lateral sway
      if(pos[i*3+1] > 26){ pos[i*3+1] = -26; pos[i*3] = (Math.random()-0.5)*70; }
    }
    geo.attributes.position.needsUpdate = true;
    points.forEach((p,idx)=>{ p.rotation.z = Math.sin(t*0.2 + idx)*0.03; });
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
})();
