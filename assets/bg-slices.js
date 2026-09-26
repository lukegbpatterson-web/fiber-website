/* Background for page 2: a few soft, out-of-focus lemon and lime slices drifting
   slowly upward. Kept low-opacity and blurred (see theme-zest.css) so it stays
   behind the content. Three.js. */
(function citrusSlices(){
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = document.getElementById("drift");
  if(reduceMotion || !window.THREE || !canvas) return;
  const hero = canvas.parentElement;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.z = 30;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha:true, antialias:true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const FRUIT = {
    lemon:{ rind:"#E9B923", pith:"#FFF4BF", flesh:"#F7D84C", fleshLight:"#FBE97E" },
    lime: { rind:"#5C9A2B", pith:"#EAF5C4", flesh:"#A6D24E", fleshLight:"#C6E77C" }
  };

  // a flat, illustrated citrus wheel: rind, pith, juicy wedges
  function wheelTexture(c, segments){
    const S = 256, cx = S/2, r = S/2 - 4;
    const cv = document.createElement("canvas"); cv.width = cv.height = S;
    const ctx = cv.getContext("2d");
    const disc = (radius, fill)=>{ ctx.beginPath(); ctx.arc(cx, cx, radius, 0, Math.PI*2); ctx.fillStyle = fill; ctx.fill(); };

    disc(r, c.rind);
    disc(r*0.9, c.pith);

    const gap = 0.09, step = Math.PI*2/segments;
    for(let i=0;i<segments;i++){
      const a0 = i*step + gap, a1 = (i+1)*step - gap;
      const g = ctx.createRadialGradient(cx, cx, r*0.1, cx, cx, r*0.8);
      g.addColorStop(0, c.fleshLight); g.addColorStop(1, c.flesh);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos((a0+a1)/2)*r*0.09, cx + Math.sin((a0+a1)/2)*r*0.09);
      ctx.arc(cx, cx, r*0.8, a0, a1);
      ctx.closePath();
      ctx.fillStyle = g; ctx.strokeStyle = g; ctx.lineWidth = 8; ctx.lineJoin = "round";
      ctx.fill(); ctx.stroke();
    }
    disc(r*0.07, c.pith);
    return new THREE.CanvasTexture(cv);
  }
  const textures = {
    lemon: wheelTexture(FRUIT.lemon, 9),
    lime:  wheelTexture(FRUIT.lime, 8)
  };

  // nx is a position across the screen (-1..1) so slices scale with the viewport
  const SLICES = [
    { fruit:"lemon", nx:-0.86, y:-14, size:7.0, op:0.20, rise:0.0075, spin: 0.0012 },
    { fruit:"lime",  nx: 0.92, y:  6, size:7.0, op:0.17, rise:0.0060, spin:-0.0009 },
    { fruit:"lime",  nx:-0.55, y: 15, size:4.5, op:0.16, rise:0.0100, spin:-0.0016 },
    { fruit:"lemon", nx: 0.60, y:-18, size:5.0, op:0.18, rise:0.0085, spin: 0.0014 },
    { fruit:"lemon", nx: 0.05, y: 20, size:3.6, op:0.14, rise:0.0110, spin:-0.0012 },
    { fruit:"lime",  nx:-0.95, y:  1, size:3.8, op:0.15, rise:0.0090, spin: 0.0015 },
    { fruit:"lemon", nx: 0.98, y:-6,  size:4.0, op:0.16, rise:0.0095, spin:-0.0011 },
    { fruit:"lime",  nx: 0.25, y:-22, size:4.5, op:0.14, rise:0.0080, spin: 0.0010 }
  ];

  const sprites = SLICES.map((s, i)=>{
    const mat = new THREE.SpriteMaterial({
      map:textures[s.fruit], transparent:true, opacity:s.op, depthWrite:false
    });
    const sp = new THREE.Sprite(mat);
    sp.userData = { ...s, phase: i*1.7, rot: i*0.9 };
    scene.add(sp);
    return sp;
  });

  let halfW = 20, sizeK = 1;
  function resize(){
    const w = hero.clientWidth || window.innerWidth;
    const h = hero.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w/h; camera.updateProjectionMatrix();
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov/2)) * camera.position.z;
    halfW = halfH * camera.aspect;
    sizeK = Math.min(1, Math.max(0.4, camera.aspect/1.4)); // smaller slices on tall, narrow screens
    render();
  }
  function place(sp, t){
    const d = sp.userData;
    sp.position.set(d.nx*halfW + Math.sin(t + d.phase)*0.6, d.y, 0);
    sp.scale.set(d.size*sizeK, d.size*sizeK, 1);
    sp.material.rotation = d.rot;
  }
  function render(){
    sprites.forEach((sp)=>place(sp, 0));
    renderer.render(scene, camera);
  }
  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("load", resize);

  let t = 0;
  function animate(){
    t += 0.004;
    sprites.forEach((sp)=>{
      const d = sp.userData;
      d.y += d.rise;                                   // slow rise
      d.rot += d.spin;                                 // slow turn
      if(d.y > 24){ d.y = -24; d.nx = (Math.random()*2 - 1) * 0.95; }
      place(sp, t);
    });
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  animate();
})();
