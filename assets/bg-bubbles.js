/* Background for page 3: light, glossy fizz bubbles (lemon, lime, clear) rising
   and wobbling behind the content — a nod to the droplets on the fruit.
   Translucent and kept off the foreground. Three.js. */
(function fizz(){
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.getElementById("drift");
  if(reduceMotion || !window.THREE || !canvas) return;
  const hero = canvas.parentElement;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.z = 30;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha:true, antialias:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // a soft glassy bubble: tinted rim, clear middle, two highlights
  function bubbleTexture(rgb){
    const S = 128, c = S/2;
    const cv = document.createElement("canvas"); cv.width = cv.height = S;
    const ctx = cv.getContext("2d");

    const rim = ctx.createRadialGradient(c, c, S*0.18, c, c, S*0.48);
    rim.addColorStop(0,    `rgba(${rgb},0.05)`);
    rim.addColorStop(0.72, `rgba(${rgb},0.18)`);
    rim.addColorStop(0.92, `rgba(${rgb},0.60)`);
    rim.addColorStop(1,    `rgba(${rgb},0)`);
    ctx.fillStyle = rim; ctx.fillRect(0, 0, S, S);

    const hi = ctx.createRadialGradient(S*0.34, S*0.32, 0, S*0.34, S*0.32, S*0.16);
    hi.addColorStop(0, "rgba(255,255,255,0.95)");
    hi.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hi; ctx.fillRect(0, 0, S, S);

    const lo = ctx.createRadialGradient(S*0.68, S*0.72, 0, S*0.68, S*0.72, S*0.09);
    lo.addColorStop(0, "rgba(255,255,255,0.45)");
    lo.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = lo; ctx.fillRect(0, 0, S, S);

    return new THREE.CanvasTexture(cv);
  }
  const textures = [
    bubbleTexture("250,196,20"),   // lemon
    bubbleTexture("128,178,20"),   // lime
    bubbleTexture("120,140,60")    // clear-ish olive tint
  ];

  const COUNT = 20;
  const bubbles = [];
  for(let i=0;i<COUNT;i++){
    const size = 1.3 + Math.pow(Math.random(), 1.8) * 3.6;          // mostly small, a few bigger
    const mat = new THREE.SpriteMaterial({
      map: textures[i % textures.length], transparent:true, depthWrite:false,
      opacity: 0.30 + Math.random()*0.22
    });
    const sp = new THREE.Sprite(mat);
    sp.userData = {
      nx: Math.random()*2 - 1,
      y: (Math.random() - 0.5) * 48,
      z: (Math.random() - 0.5) * 16,
      size,
      rise: 0.010 + size*0.0032 + Math.random()*0.004,              // bigger ones rise a touch faster
      wob: 0.5 + Math.random()*0.9,
      phase: Math.random()*Math.PI*2
    };
    scene.add(sp);
    bubbles.push(sp);
  }

  let halfW = 20, sizeK = 1;
  function resize(){
    const w = hero.clientWidth || window.innerWidth;
    const h = hero.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w/h; camera.updateProjectionMatrix();
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov/2)) * camera.position.z;
    halfW = halfH * camera.aspect;
    sizeK = Math.min(1, Math.max(0.45, camera.aspect/1.4));         // smaller on tall, narrow screens
    draw(0);
  }
  function place(sp, t){
    const d = sp.userData;
    sp.position.set(d.nx*halfW + Math.sin(t + d.phase)*d.wob, d.y, d.z);
    sp.scale.set(d.size*sizeK, d.size*sizeK, 1);
  }
  function draw(t){
    bubbles.forEach((sp)=>place(sp, t));
    renderer.render(scene, camera);
  }
  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("load", resize);

  let t = 0;
  function animate(){
    t += 0.012;
    bubbles.forEach((sp)=>{
      const d = sp.userData;
      d.y += d.rise;
      if(d.y > 26){ d.y = -26; d.nx = Math.random()*2 - 1; }
      place(sp, t);
    });
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
})();
