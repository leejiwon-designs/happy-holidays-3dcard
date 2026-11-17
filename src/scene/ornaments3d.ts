import * as THREE from 'three';
import { createGouacheMaterial } from '../shaders/gouacheShaders';
import type { OrnamentId } from '../types/card';

function makeCapAndLoop(): THREE.Group {
  const capGroup = new THREE.Group();
  const goldMat = createGouacheMaterial({
    color: '#f2c854',
    shadowColor: '#bd8a28',
    rimColor: '#fffbe6',
    emissive: 0.14,
  });

  // Hanging wire loop right at pivot (0, 0, 0)
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.0085, 8, 16), goldMat);
  loop.position.set(0, -0.025, 0);
  capGroup.add(loop);

  // Scalloped gold ornament cap collar
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.046, 0.038, 12), goldMat);
  collar.position.set(0, -0.068, 0);
  capGroup.add(collar);

  return capGroup;
}

function addEyes(
  parent: THREE.Group,
  x: number,
  y: number,
  z: number,
  rx = 0.022,
  ry = 0.03,
  eyeHex = '#23283b'
) {
  const darkMat = createGouacheMaterial({
    color: eyeHex,
    shadowColor: '#191d2b',
    emissive: 0.14,
  });
  const whiteMat = createGouacheMaterial({
    color: '#ffffff',
    shadowColor: '#dce6f5',
    emissive: 0.16,
  });

  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), darkMat);
    eye.scale.set(rx, ry, rx * 0.72);
    eye.position.set(side * x, y, z);
    parent.add(eye);

    const shine = new THREE.Mesh(new THREE.SphereGeometry(rx * 0.42, 8, 8), whiteMat);
    shine.position.set(side * x - side * rx * 0.16, y + ry * 0.32, z + rx * 0.56);
    parent.add(shine);
  });
}

function buildEspressoMartini(): THREE.Group {
  const g = new THREE.Group();
  g.add(makeCapAndLoop());

  const glassMat = createGouacheMaterial({
    color: '#eef7fc',
    shadowColor: '#b7d4e6',
    rimColor: '#ffffff',
    emissive: 0.1,
    opacity: 0.86,
    transparent: true,
  });
  const goldMat = createGouacheMaterial({
    color: '#f2c854',
    shadowColor: '#bc8826',
    emissive: 0.14,
  });
  const coffeeMat = createGouacheMaterial({
    color: '#54301f',
    shadowColor: '#3a2015',
    emissive: 0.15,
  });
  const cremaMat = createGouacheMaterial({
    color: '#e5b887',
    shadowColor: '#bd8858',
    emissive: 0.12,
  });
  const beanMat = createGouacheMaterial({
    color: '#4a291a',
    shadowColor: '#321b11',
    emissive: 0.16,
  });

  // Coupe bowl
  const bowl = new THREE.Mesh(new THREE.ConeGeometry(0.185, 0.165, 22), glassMat);
  bowl.rotation.x = Math.PI;
  bowl.position.set(0, -0.22, 0);
  g.add(bowl);

  // Espresso liquid cone inside
  const liquid = new THREE.Mesh(new THREE.ConeGeometry(0.162, 0.125, 20), coffeeMat);
  liquid.rotation.x = Math.PI;
  liquid.position.set(0, -0.215, 0);
  g.add(liquid);

  // Frothy crema top disc
  const crema = new THREE.Mesh(new THREE.CylinderGeometry(0.162, 0.152, 0.022, 22), cremaMat);
  crema.position.set(0, -0.152, 0);
  g.add(crema);

  // Gold glass rim ring
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.184, 0.009, 8, 26), goldMat);
  rim.rotation.x = Math.PI * 0.5;
  rim.position.set(0, -0.138, 0);
  g.add(rim);

  // 3 classic espresso beans resting on top of the foam
  [
    [0, -0.136, 0.036, 0.3],
    [-0.038, -0.136, -0.026, -0.7],
    [0.038, -0.136, -0.026, 0.9],
  ].forEach(([bx, by, bz, rotY]) => {
    const bean = new THREE.Mesh(new THREE.SphereGeometry(0.021, 10, 8), beanMat);
    bean.scale.set(1.25, 0.6, 0.8);
    bean.position.set(bx, by, bz);
    bean.rotation.y = rotY;
    g.add(bean);
  });

  // Gold hanging wire arch connecting cap to coupe rim
  const hangerArc = new THREE.Mesh(
    new THREE.TorusGeometry(0.068, 0.006, 6, 16, Math.PI),
    goldMat
  );
  hangerArc.position.set(0, -0.138, 0);
  g.add(hangerArc);

  // Slim stem & foot
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.165, 10), glassMat);
  stem.position.set(0, -0.36, 0);
  g.add(stem);

  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.1, 0.018, 18), glassMat);
  foot.position.set(0, -0.442, 0);
  g.add(foot);

  return g;
}

function buildKirby(): THREE.Group {
  const g = new THREE.Group();
  g.add(makeCapAndLoop());

  const pinkMat = createGouacheMaterial({
    color: '#ff9ec2',
    shadowColor: '#db6c98',
    emissive: 0.1,
  });
  const cheekMat = createGouacheMaterial({
    color: '#ff6093',
    shadowColor: '#d94579',
    emissive: 0.1,
  });
  const shoeMat = createGouacheMaterial({
    color: '#d93860',
    shadowColor: '#9e2144',
    emissive: 0.1,
  });
  const blueIrisMat = createGouacheMaterial({
    color: '#3f7ee6',
    shadowColor: '#254a96',
    emissive: 0.14,
  });
  const smileMat = createGouacheMaterial({
    color: '#b8284e',
    shadowColor: '#7d1834',
    emissive: 0.12,
  });

  // Round puffball body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.168, 22, 18), pinkMat);
  body.position.set(0, -0.235, 0);
  g.add(body);

  // Raised waving arms
  [-1, 1].forEach((side) => {
    const arm = new THREE.Mesh(new THREE.SphereGeometry(0.056, 12, 10), pinkMat);
    arm.scale.set(1.22, 0.88, 0.85);
    arm.position.set(side * 0.168, -0.215, 0.02);
    arm.rotation.z = side * 0.48;
    g.add(arm);

    // Rosy oval cheeks
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), cheekMat);
    cheek.scale.set(1.25, 0.68, 0.4);
    cheek.position.set(side * 0.084, -0.242, 0.148);
    g.add(cheek);

    // Classic blue highlight dot inside bottom of Kirby eyes
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), blueIrisMat);
    iris.scale.set(1.0, 1.25, 0.55);
    iris.position.set(side * 0.048, -0.222, 0.162);
    g.add(iris);

    // Plump berry-red feet
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.068, 14, 12), shoeMat);
    shoe.scale.set(1.05, 0.64, 1.38);
    shoe.position.set(side * 0.09, -0.39, 0.036);
    shoe.rotation.y = side * -0.28;
    g.add(shoe);
  });

  addEyes(g, 0.048, -0.205, 0.155, 0.02, 0.036, '#1f2338');

  // Happy open mouth
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), smileMat);
  mouth.scale.set(1.0, 1.15, 0.55);
  mouth.position.set(0, -0.258, 0.158);
  g.add(mouth);

  return g;
}

function buildRubberDuck(): THREE.Group {
  const g = new THREE.Group();
  g.add(makeCapAndLoop());

  const duckMat = createGouacheMaterial({
    color: '#ffe047',
    shadowColor: '#e0a524',
    emissive: 0.1,
  });
  const billMat = createGouacheMaterial({
    color: '#ff8a33',
    shadowColor: '#cc5b18',
    emissive: 0.1,
  });
  const hatRedMat = createGouacheMaterial({
    color: '#d4333d',
    shadowColor: '#9c202b',
    emissive: 0.09,
  });
  const whiteMat = createGouacheMaterial({
    color: '#ffffff',
    shadowColor: '#dbe5f0',
    emissive: 0.1,
  });

  // Rounded duck body + upturned tail
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.145, 20, 16), duckMat);
  body.scale.set(0.95, 0.85, 1.24);
  body.position.set(0, -0.32, -0.01);
  g.add(body);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.11, 10), duckMat);
  tail.rotation.x = -0.95;
  tail.position.set(0, -0.26, -0.155);
  g.add(tail);

  // Cute wings
  [-1, 1].forEach((side) => {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.066, 12, 10), duckMat);
    wing.scale.set(0.45, 0.72, 1.2);
    wing.position.set(side * 0.128, -0.31, -0.01);
    wing.rotation.z = side * -0.18;
    g.add(wing);
  });

  // Duck head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 18, 16), duckMat);
  head.position.set(0, -0.185, 0.045);
  g.add(head);

  // Orange flat bill
  const bill = new THREE.Mesh(new THREE.SphereGeometry(0.056, 14, 10), billMat);
  bill.scale.set(1.25, 0.48, 1.15);
  bill.position.set(0, -0.198, 0.145);
  g.add(bill);

  addEyes(g, 0.048, -0.166, 0.132, 0.016, 0.018);

  // Mini festive Santa cap perched beside gold ornament cap
  const brim = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.018, 8, 16), whiteMat);
  brim.rotation.x = Math.PI * 0.5;
  brim.rotation.y = 0.25;
  brim.position.set(0.032, -0.098, 0.05);
  g.add(brim);

  const hatCone = new THREE.Mesh(new THREE.ConeGeometry(0.058, 0.11, 12), hatRedMat);
  hatCone.position.set(0.045, -0.055, 0.052);
  hatCone.rotation.z = -0.35;
  g.add(hatCone);

  const pom = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), whiteMat);
  pom.position.set(0.072, -0.008, 0.052);
  g.add(pom);

  return g;
}

function buildCinnamoroll(): THREE.Group {
  const g = new THREE.Group();
  g.add(makeCapAndLoop());

  const furMat = createGouacheMaterial({
    color: '#fffdf8',
    shadowColor: '#d9d9ee',
    emissive: 0.12,
  });
  const blueEyeMat = createGouacheMaterial({
    color: '#5faae8',
    shadowColor: '#3675b5',
    emissive: 0.14,
  });
  const pinkMat = createGouacheMaterial({
    color: '#ffb0ca',
    shadowColor: '#de789e',
    emissive: 0.12,
  });
  const bowMat = createGouacheMaterial({
    color: '#d63642',
    shadowColor: '#9e212e',
    emissive: 0.1,
  });

  // Round chubby Sanrio cloud head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 20, 16), furMat);
  head.scale.set(1.18, 0.92, 0.95);
  head.position.set(0, -0.195, 0.01);
  g.add(head);

  // Small plump puppy body
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.092, 16, 14), furMat);
  torso.scale.set(0.95, 1.0, 0.88);
  torso.position.set(0, -0.34, 0);
  g.add(torso);

  // Long floppy cloud ears sweeping left and right
  [-1, 1].forEach((side) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.078, 16, 12), furMat);
    ear.scale.set(1.95, 0.66, 0.55);
    ear.position.set(side * 0.21, -0.215, -0.01);
    ear.rotation.z = side * -0.45;
    g.add(ear);

    // Blue oval eyes
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), blueEyeMat);
    eye.scale.set(0.82, 1.15, 0.55);
    eye.position.set(side * 0.062, -0.19, 0.124);
    g.add(eye);

    // Soft pink blush
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), pinkMat);
    cheek.scale.set(1.2, 0.72, 0.45);
    cheek.position.set(side * 0.088, -0.218, 0.114);
    g.add(cheek);

    // Tiny paws
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), furMat);
    paw.position.set(side * 0.072, -0.365, 0.05);
    g.add(paw);
  });

  // Curled cinnamon-roll swirl tail on the back!
  const swirl = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.024, 10, 18, Math.PI * 1.65), furMat);
  swirl.position.set(0, -0.355, -0.092);
  g.add(swirl);

  // Tiny festive red bow near ear
  [-1, 1].forEach((side) => {
    const lobe = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.04, 8), bowMat);
    lobe.rotation.z = side * Math.PI * 0.5;
    lobe.position.set(0.075 + side * 0.018, -0.105, 0.06);
    g.add(lobe);
  });

  return g;
}

function buildLordFarquaad(): THREE.Group {
  const g = new THREE.Group();
  g.add(makeCapAndLoop());

  const hairMat = createGouacheMaterial({
    color: '#2b2833',
    shadowColor: '#1f1d27',
    rimColor: '#9894b8',
    emissive: 0.18,
  });
  const skinMat = createGouacheMaterial({
    color: '#f9ceb4',
    shadowColor: '#dc9c83',
    emissive: 0.1,
  });
  const capeMat = createGouacheMaterial({
    color: '#cf2935',
    shadowColor: '#961d28',
    emissive: 0.1,
  });
  const goldMat = createGouacheMaterial({
    color: '#f2c854',
    shadowColor: '#bd8a28',
    emissive: 0.16,
  });
  const whiteMat = createGouacheMaterial({
    color: '#fffbf2',
    shadowColor: '#ded5c8',
    emissive: 0.1,
  });

  // Royal crimson tunic & wide flared cloak
  const tunic = new THREE.Mesh(new THREE.ConeGeometry(0.145, 0.21, 14), capeMat);
  tunic.position.set(0, -0.355, 0);
  g.add(tunic);

  // Gold tunic center band & shoulder trim
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.14), goldMat);
  stripe.position.set(0, -0.365, 0.025);
  g.add(stripe);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.018, 8, 16), whiteMat);
  collar.rotation.x = Math.PI * 0.5;
  collar.position.set(0, -0.265, 0.01);
  g.add(collar);

  // Chiseled square-jawed Farquaad head
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.135, 0.145, 0.125), skinMat);
  face.position.set(0, -0.185, 0.012);
  g.add(face);

  // Bold Farquaad nose & chin cleft
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), skinMat);
  nose.scale.set(0.8, 1.1, 1.3);
  nose.position.set(0, -0.185, 0.082);
  g.add(nose);

  addEyes(g, 0.032, -0.165, 0.074, 0.013, 0.013);

  // Iconic sharp flared pageboy bob haircut
  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.168, 0.055, 0.155), hairMat);
  hairTop.position.set(0, -0.105, 0.002);
  g.add(hairTop);

  [-1, 1].forEach((side) => {
    const hairWing = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.165, 0.14), hairMat);
    hairWing.position.set(side * 0.088, -0.182, -0.004);
    hairWing.rotation.z = side * 0.18; // Classic Farquaad bob flare
    g.add(hairWing);
  });

  const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.175, 0.175, 0.055), hairMat);
  hairBack.position.set(0, -0.18, -0.052);
  g.add(hairBack);

  // Tiny regal golden crown on top of the bob
  const crownRing = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.038, 0.032, 10), goldMat);
  crownRing.position.set(0, -0.068, 0.025);
  g.add(crownRing);

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.032, 6), goldMat);
    spike.position.set(Math.cos(a) * 0.034, -0.044, 0.025 + Math.sin(a) * 0.034);
    g.add(spike);
  }

  return g;
}

function buildFrenchFries(): THREE.Group {
  const g = new THREE.Group();
  g.add(makeCapAndLoop());

  const cartonMat = createGouacheMaterial({
    color: '#d8323c',
    shadowColor: '#9e1f2a',
    emissive: 0.1,
  });
  const goldMat = createGouacheMaterial({
    color: '#f2c854',
    shadowColor: '#be8a28',
    emissive: 0.14,
  });
  const fryMat = createGouacheMaterial({
    color: '#ffe05c',
    shadowColor: '#dfa62c',
    emissive: 0.12,
  });

  // Tapered iconic red fry carton
  const carton = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.092, 0.21, 6), cartonMat);
  carton.scale.set(1.12, 1.0, 0.62);
  carton.position.set(0, -0.32, 0);
  g.add(carton);

  // Curved golden smile stripe across front of carton
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.011, 8, 16, Math.PI), goldMat);
  stripe.rotation.z = Math.PI;
  stripe.position.set(0, -0.295, 0.068);
  g.add(stripe);

  // 11 golden fries fanned out from inside the carton
  const frySpecs: Array<[number, number, number, number, number]> = [
    [-0.088, -0.175, 0.01, 0.16, 0.22],
    [-0.062, -0.155, -0.015, 0.2, 0.12],
    [-0.035, -0.14, 0.022, 0.22, 0.05],
    [-0.008, -0.135, -0.01, 0.23, -0.02],
    [0.02, -0.14, 0.018, 0.22, -0.06],
    [0.05, -0.152, -0.012, 0.21, -0.13],
    [0.082, -0.17, 0.01, 0.17, -0.23],
    [-0.048, -0.175, 0.038, 0.15, 0.1],
    [0.002, -0.168, 0.04, 0.16, 0.0],
    [0.045, -0.175, 0.036, 0.15, -0.12],
  ];

  frySpecs.forEach(([x, y, z, h, rz]) => {
    const fry = new THREE.Mesh(new THREE.BoxGeometry(0.026, h, 0.024), fryMat);
    fry.position.set(x, y, z);
    fry.rotation.z = rz;
    g.add(fry);
  });

  return g;
}

function buildKiwi(): THREE.Group {
  const g = new THREE.Group();
  g.add(makeCapAndLoop());

  const skinMat = createGouacheMaterial({
    color: '#916741',
    shadowColor: '#66432a',
    emissive: 0.1,
  });
  const greenMat = createGouacheMaterial({
    color: '#82dc48',
    shadowColor: '#56a62c',
    emissive: 0.1,
  });
  const coreMat = createGouacheMaterial({
    color: '#eef8bd',
    shadowColor: '#cfe089',
    emissive: 0.14,
  });
  const seedMat = createGouacheMaterial({
    color: '#2d2824',
    shadowColor: '#1f1c19',
    emissive: 0.15,
  });

  // Outer fuzzy-brown round kiwi slice
  const rind = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.072, 24), skinMat);
  rind.rotation.x = Math.PI * 0.5;
  rind.position.set(0, -0.255, 0);
  g.add(rind);

  // Vibrant emerald-green kiwi flesh on front & back
  const flesh = new THREE.Mesh(new THREE.CylinderGeometry(0.156, 0.156, 0.078, 24), greenMat);
  flesh.rotation.x = Math.PI * 0.5;
  flesh.position.set(0, -0.255, 0);
  g.add(flesh);

  // Pale cream-lime star core
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.084, 16), coreMat);
  core.rotation.x = Math.PI * 0.5;
  core.position.set(0, -0.255, 0);
  g.add(core);

  // Ring of 10 kiwi seeds on both front & back faces
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const sx = Math.cos(a) * 0.082;
    const sy = -0.255 + Math.sin(a) * 0.082;
    [-0.041, 0.041].forEach((sz) => {
      const seed = new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 6), seedMat);
      seed.scale.set(1.2, 0.75, 0.6);
      seed.rotation.z = a;
      seed.position.set(sx, sy, sz);
      g.add(seed);
    });
  }

  return g;
}

function buildEmpanada(): THREE.Group {
  const g = new THREE.Group();
  g.add(makeCapAndLoop());

  const crustMat = createGouacheMaterial({
    color: '#ebb054',
    shadowColor: '#bd772b',
    rimColor: '#fff5d9',
    emissive: 0.1,
  });
  const crimpMat = createGouacheMaterial({
    color: '#de953b',
    shadowColor: '#aa6422',
    emissive: 0.11,
  });

  // Plump half-moon crescent empanada body
  const halfMoon = new THREE.Mesh(
    new THREE.SphereGeometry(0.175, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
    crustMat
  );
  halfMoon.scale.set(1.12, 0.92, 0.56);
  halfMoon.rotation.z = Math.PI;
  halfMoon.position.set(0, -0.175, 0);
  g.add(halfMoon);

  // Flat sealed top fold edge
  const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.172, 0.172, 0.032, 20), crustMat);
  topCap.scale.set(1.12, 1.0, 0.54);
  topCap.position.set(0, -0.175, 0);
  g.add(topCap);

  // Braided rope crimps along the bottom half-moon arc
  const crimpCount = 11;
  for (let i = 0; i < crimpCount; i++) {
    const t = i / (crimpCount - 1);
    const angle = Math.PI + t * Math.PI;
    const cx = Math.cos(angle) * 0.188;
    const cy = -0.182 + Math.sin(angle) * 0.155;
    const bump = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), crimpMat);
    bump.scale.set(1.25, 0.85, 0.85);
    bump.rotation.z = angle + 0.55;
    bump.position.set(cx, cy, 0);
    g.add(bump);
  }

  return g;
}

function buildVolleyball(): THREE.Group {
  const g = new THREE.Group();
  g.add(makeCapAndLoop());

  const ballMat = createGouacheMaterial({
    color: '#faf7f0',
    shadowColor: '#d4ccc0',
    emissive: 0.1,
    patternType: 4, // Festive red/green/gold/white 18-panel weave
  });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.155, 22, 18), ballMat);
  ball.position.set(0, -0.24, 0);
  g.add(ball);

  return g;
}

function buildCat(): THREE.Group {
  const g = new THREE.Group();
  g.add(makeCapAndLoop());

  const gingerMat = createGouacheMaterial({
    color: '#f6ad66',
    shadowColor: '#cb783b',
    emissive: 0.1,
  });
  const creamMat = createGouacheMaterial({
    color: '#fff8ec',
    shadowColor: '#e2d2be',
    emissive: 0.11,
  });
  const pinkMat = createGouacheMaterial({
    color: '#ff96ad',
    shadowColor: '#d96985',
    emissive: 0.12,
  });
  const collarMat = createGouacheMaterial({
    color: '#d4333d',
    shadowColor: '#9c202b',
    emissive: 0.1,
  });
  const bellMat = createGouacheMaterial({
    color: '#f2c854',
    shadowColor: '#be8828',
    emissive: 0.16,
  });

  // Plump sitting kitty torso
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 14), gingerMat);
  body.scale.set(0.95, 1.08, 0.92);
  body.position.set(0, -0.335, 0);
  g.add(body);

  const tummy = new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 12), creamMat);
  tummy.scale.set(0.92, 1.0, 0.55);
  tummy.position.set(0, -0.34, 0.068);
  g.add(tummy);

  // Round kitty head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 18, 16), gingerMat);
  head.scale.set(1.08, 0.94, 0.95);
  head.position.set(0, -0.195, 0.015);
  g.add(head);

  // Pointed cat ears + pink inner triangles
  [-1, 1].forEach((side) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.085, 6), gingerMat);
    ear.position.set(side * 0.072, -0.112, 0.012);
    ear.rotation.z = side * -0.26;
    g.add(ear);

    const innerEar = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.052, 6), pinkMat);
    innerEar.position.set(side * 0.072, -0.116, 0.032);
    innerEar.rotation.z = side * -0.26;
    g.add(innerEar);

    // Little paws
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), creamMat);
    paw.position.set(side * 0.052, -0.425, 0.06);
    g.add(paw);
  });

  // Cream muzzle & pink nose
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), creamMat);
  muzzle.scale.set(1.25, 0.8, 0.7);
  muzzle.position.set(0, -0.214, 0.098);
  g.add(muzzle);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), pinkMat);
  nose.position.set(0, -0.204, 0.122);
  g.add(nose);

  addEyes(g, 0.042, -0.184, 0.1, 0.015, 0.018);

  // Red collar + gold jingle bell
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.074, 0.015, 8, 18), collarMat);
  collar.rotation.x = Math.PI * 0.5;
  collar.position.set(0, -0.262, 0.012);
  g.add(collar);

  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), bellMat);
  bell.position.set(0, -0.275, 0.088);
  g.add(bell);

  // Curled cat tail
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.02, 8, 16, Math.PI * 1.1), gingerMat);
  tail.position.set(0.078, -0.34, -0.078);
  tail.rotation.y = 0.65;
  g.add(tail);

  return g;
}

function buildDog(): THREE.Group {
  const g = new THREE.Group();
  g.add(makeCapAndLoop());

  const goldenMat = createGouacheMaterial({
    color: '#ecc078',
    shadowColor: '#c38c46',
    emissive: 0.1,
  });
  const earMat = createGouacheMaterial({
    color: '#a86e3e',
    shadowColor: '#7b4d2b',
    emissive: 0.11,
  });
  const snoutMat = createGouacheMaterial({
    color: '#fff6e6',
    shadowColor: '#dfd0ba',
    emissive: 0.11,
  });
  const noseMat = createGouacheMaterial({
    color: '#2e2624',
    shadowColor: '#1f1918',
    emissive: 0.14,
  });
  const tongueMat = createGouacheMaterial({
    color: '#ff7b96',
    shadowColor: '#d1506b',
    emissive: 0.12,
  });
  const scarfMat = createGouacheMaterial({
    color: '#2d8254',
    shadowColor: '#1c5838',
    emissive: 0.1,
  });
  const goldMat = createGouacheMaterial({
    color: '#f2c854',
    shadowColor: '#be8a28',
    emissive: 0.15,
  });

  // Plump golden puppy body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.112, 18, 14), goldenMat);
  body.scale.set(0.95, 1.06, 0.94);
  body.position.set(0, -0.335, 0);
  g.add(body);

  // Friendly round puppy head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 18, 16), goldenMat);
  head.position.set(0, -0.195, 0.015);
  g.add(head);

  // Floppy drooping ears
  [-1, 1].forEach((side) => {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), earMat);
    ear.scale.set(0.65, 1.55, 0.8);
    ear.position.set(side * 0.102, -0.205, 0.006);
    ear.rotation.z = side * 0.28;
    g.add(ear);

    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), goldenMat);
    paw.position.set(side * 0.055, -0.422, 0.062);
    g.add(paw);
  });

  // Cream muzzle + button nose + happy pink tongue
  const snout = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 10), snoutMat);
  snout.scale.set(1.12, 0.85, 0.95);
  snout.position.set(0, -0.214, 0.095);
  g.add(snout);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), noseMat);
  nose.scale.set(1.25, 0.85, 0.85);
  nose.position.set(0, -0.198, 0.136);
  g.add(nose);

  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), tongueMat);
  tongue.scale.set(0.85, 1.25, 0.55);
  tongue.position.set(0, -0.238, 0.125);
  g.add(tongue);

  addEyes(g, 0.042, -0.175, 0.102, 0.016, 0.018);

  // Evergreen scarf + dangling scarf tail + gold star button
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.02, 8, 18), scarfMat);
  scarf.rotation.x = Math.PI * 0.5;
  scarf.position.set(0, -0.262, 0.012);
  g.add(scarf);

  const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.088, 0.016), scarfMat);
  scarfTail.position.set(0.045, -0.312, 0.086);
  scarfTail.rotation.z = -0.22;
  g.add(scarfTail);

  const starBtn = new THREE.Mesh(new THREE.OctahedronGeometry(0.018, 0), goldMat);
  starBtn.position.set(0.045, -0.285, 0.096);
  g.add(starBtn);

  // Wagging tail
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.075, 4, 8), goldenMat);
  tail.position.set(0, -0.355, -0.105);
  tail.rotation.x = -0.65;
  g.add(tail);

  return g;
}

function buildWallet(): THREE.Group {
  const g = new THREE.Group();
  g.add(makeCapAndLoop());

  const leatherMat = createGouacheMaterial({
    color: '#9c5f3c',
    shadowColor: '#693c24',
    emissive: 0.12,
  });
  const billMat = createGouacheMaterial({
    color: '#4ea868',
    shadowColor: '#2c7042',
    emissive: 0.12,
  });
  const cardMat = createGouacheMaterial({
    color: '#63b4e8',
    shadowColor: '#3776a8',
    emissive: 0.14,
  });
  const goldMat = createGouacheMaterial({
    color: '#f2c854',
    shadowColor: '#bd8a28',
    emissive: 0.16,
  });

  // Folded leather bifold shell
  const backPanel = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.21, 0.045), leatherMat);
  backPanel.position.set(0, -0.25, -0.02);
  g.add(backPanel);

  const frontPanel = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.21, 0.045), leatherMat);
  frontPanel.position.set(0, -0.25, 0.032);
  g.add(frontPanel);

  // Crisp green cash bill & blue card peeking cleanly out top slot
  const bill = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.015), billMat);
  bill.position.set(-0.015, -0.155, 0.005);
  bill.rotation.z = 0.08;
  g.add(bill);

  const card = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.11, 0.016), cardMat);
  card.position.set(0.055, -0.165, 0.015);
  card.rotation.z = -0.1;
  g.add(card);

  // Gold stitched corner emblem
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.028, 0.012), goldMat);
  badge.position.set(0.072, -0.3, 0.058);
  g.add(badge);

  return g;
}

function buildLaptop(): THREE.Group {
  const g = new THREE.Group();
  g.add(makeCapAndLoop());

  const silverMat = createGouacheMaterial({
    color: '#dce4ed',
    shadowColor: '#a6b5c7',
    emissive: 0.14,
  });
  const screenMat = createGouacheMaterial({
    color: '#6ec4d9',
    shadowColor: '#4389a6',
    emissive: 0.34,
  });
  const keyMat = createGouacheMaterial({
    color: '#343e4f',
    shadowColor: '#212836',
    emissive: 0.16,
  });
  const treeScreenMat = createGouacheMaterial({
    color: '#2e8855',
    shadowColor: '#1d5b3a',
    emissive: 0.25,
  });

  // Base keyboard deck
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.025, 0.2), silverMat);
  base.position.set(0, -0.34, 0.045);
  g.add(base);

  const keys = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.012, 0.12), keyMat);
  keys.position.set(0, -0.324, 0.02);
  g.add(keys);

  // Tilted open display lid
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.2, 0.02), silverMat);
  lid.position.set(0, -0.245, -0.06);
  lid.rotation.x = -0.24;
  g.add(lid);

  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.16, 0.014), screenMat);
  screen.position.set(0, -0.245, -0.05);
  screen.rotation.x = -0.24;
  g.add(screen);

  // Cute mini holiday tree silhouette on laptop screen!
  const miniTree = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.09, 6), treeScreenMat);
  miniTree.position.set(0, -0.245, -0.04);
  miniTree.rotation.x = -0.24;
  g.add(miniTree);

  return g;
}

function buildDaisy(): THREE.Group {
  const g = new THREE.Group();
  g.add(makeCapAndLoop());

  const petalMat = createGouacheMaterial({
    color: '#fffef9',
    shadowColor: '#dde3eb',
    emissive: 0.16,
  });
  const centerMat = createGouacheMaterial({
    color: '#ffd242',
    shadowColor: '#d99a22',
    emissive: 0.18,
  });
  const leafMat = createGouacheMaterial({
    color: '#3f965d',
    shadowColor: '#25663e',
    emissive: 0.12,
  });

  // Sunny center pollen dome
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.072, 16, 12), centerMat);
  center.scale.set(1, 1, 0.65);
  center.position.set(0, -0.24, 0.015);
  g.add(center);

  // 10 crisp white daisy petals radiating outward
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 8), petalMat);
    petal.scale.set(0.7, 1.75, 0.42);
    petal.position.set(Math.cos(a) * 0.115, -0.24 + Math.sin(a) * 0.115, 0);
    petal.rotation.z = a - Math.PI * 0.5;
    g.add(petal);
  }

  // Tiny green stem leaf tucked underneath
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), leafMat);
  leaf.scale.set(1.5, 0.65, 0.4);
  leaf.position.set(0.085, -0.34, -0.02);
  leaf.rotation.z = -0.45;
  g.add(leaf);

  return g;
}

function buildHamster(): THREE.Group {
  const g = new THREE.Group();
  g.add(makeCapAndLoop());

  const caramelMat = createGouacheMaterial({
    color: '#ebb075',
    shadowColor: '#c47e45',
    emissive: 0.12,
  });
  const creamMat = createGouacheMaterial({
    color: '#fff9ed',
    shadowColor: '#e5d8c2',
    emissive: 0.14,
  });
  const blushMat = createGouacheMaterial({
    color: '#ff8da8',
    shadowColor: '#d96280',
    emissive: 0.14,
  });

  // Plump rounded chubby hamster body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.145, 20, 16), caramelMat);
  body.scale.set(1.06, 1.08, 0.96);
  body.position.set(0, -0.265, 0);
  g.add(body);

  // Cream belly patch
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), creamMat);
  belly.scale.set(0.92, 0.98, 0.55);
  belly.position.set(0, -0.295, 0.088);
  g.add(belly);

  // Cute puffy cream stuffed cheeks
  [-1, 1].forEach((side) => {
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.056, 12, 10), creamMat);
    cheek.position.set(side * 0.072, -0.228, 0.105);
    g.add(cheek);

    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), caramelMat);
    ear.scale.set(1, 1, 0.55);
    ear.position.set(side * 0.088, -0.13, 0.02);
    g.add(ear);

    const innerEar = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), blushMat);
    innerEar.scale.set(1, 1, 0.45);
    innerEar.position.set(side * 0.088, -0.13, 0.036);
    g.add(innerEar);

    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), blushMat);
    paw.position.set(side * 0.055, -0.39, 0.08);
    g.add(paw);
  });

  addEyes(g, 0.046, -0.195, 0.128, 0.015, 0.016);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), blushMat);
  nose.position.set(0, -0.215, 0.148);
  g.add(nose);

  return g;
}

function buildFish(): THREE.Group {
  const g = new THREE.Group();
  g.add(makeCapAndLoop());

  const fishMat = createGouacheMaterial({
    color: '#ff8552',
    shadowColor: '#d4522e',
    accentColor: '#fff5e6',
    emissive: 0.14,
    patternType: 1, // Tropical clown stripes
  });
  const finMat = createGouacheMaterial({
    color: '#ffb485',
    shadowColor: '#e07d52',
    emissive: 0.14,
  });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.135, 18, 14), fishMat);
  body.scale.set(1.25, 0.85, 0.58);
  body.position.set(-0.02, -0.23, 0);
  g.add(body);

  // Fan tail fin
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.13, 6), finMat);
  tail.rotation.z = Math.PI * 0.5;
  tail.scale.set(1, 1, 0.42);
  tail.position.set(0.165, -0.23, 0);
  g.add(tail);

  // Dorsal fin
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.08, 6), finMat);
  dorsal.rotation.z = -0.35;
  dorsal.scale.set(1.2, 1, 0.4);
  dorsal.position.set(0.01, -0.125, 0);
  g.add(dorsal);

  addEyes(g, 0.0, -0.212, 0.072, 0.016, 0.016);
  const eyeLeft = g.children[g.children.length - 4] as THREE.Mesh;
  eyeLeft.position.set(-0.1, -0.212, 0.056);
  const eyeShine = g.children[g.children.length - 3] as THREE.Mesh;
  eyeShine.position.set(-0.105, -0.207, 0.068);
  const eyeRight = g.children[g.children.length - 2] as THREE.Mesh;
  eyeRight.position.set(-0.1, -0.212, -0.056);
  const eyeRightShine = g.children[g.children.length - 1] as THREE.Mesh;
  eyeRightShine.position.set(-0.105, -0.207, -0.068);

  return g;
}

function buildEiffelTower(): THREE.Group {
  const g = new THREE.Group();
  g.add(makeCapAndLoop());

  const bronzeMat = createGouacheMaterial({
    color: '#d4a348',
    shadowColor: '#8d6219',
    rimColor: '#fff0bd',
    emissive: 0.14,
  });
  const warmBrassMat = createGouacheMaterial({
    color: '#eec868',
    shadowColor: '#b5842a',
    emissive: 0.16,
  });
  const archMat = createGouacheMaterial({
    color: '#9e7020',
    shadowColor: '#66430d',
    emissive: 0.12,
  });

  const addStrut = (a: THREE.Vector3, b: THREE.Vector3, rTop: number, rBot: number, mat: THREE.Material) => {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, len, 6), mat);
    strut.position.addVectors(a, b).multiplyScalar(0.5);
    strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    g.add(strut);
  };

  // Four curved corner legs rising through 1st, 2nd, and summit tiers
  const corners: Array<[number, number]> = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  corners.forEach(([sx, sz]) => {
    const p0 = new THREE.Vector3(sx * 0.115, -0.45, sz * 0.115);
    const p1 = new THREE.Vector3(sx * 0.068, -0.34, sz * 0.068);
    const p2 = new THREE.Vector3(sx * 0.036, -0.225, sz * 0.036);
    const p3 = new THREE.Vector3(sx * 0.015, -0.118, sz * 0.015);
    addStrut(p0, p1, 0.016, 0.024, bronzeMat);
    addStrut(p1, p2, 0.012, 0.016, bronzeMat);
    addStrut(p2, p3, 0.008, 0.012, bronzeMat);

    // Subtle shoe pad at each base pier
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.014, 0.044), archMat);
    pad.position.set(p0.x, -0.452, p0.z);
    g.add(pad);
  });

  // Iconic decorative Parisian semicircular arches along all four base sides
  const archOffsets: Array<{ pos: [number, number, number]; rotY: number }> = [
    { pos: [0, -0.435, 0.088], rotY: 0 },
    { pos: [0, -0.435, -0.088], rotY: 0 },
    { pos: [0.088, -0.435, 0], rotY: Math.PI * 0.5 },
    { pos: [-0.088, -0.435, 0], rotY: Math.PI * 0.5 },
  ];
  archOffsets.forEach(({ pos, rotY }) => {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.011, 7, 14, Math.PI), archMat);
    arch.position.set(pos[0], pos[1], pos[2]);
    arch.rotation.y = rotY;
    g.add(arch);
  });

  // 1st observation terrace deck
  const deck1 = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.022, 0.165), bronzeMat);
  deck1.position.set(0, -0.34, 0);
  g.add(deck1);
  const deck1Trim = new THREE.Mesh(new THREE.BoxGeometry(0.178, 0.009, 0.178), warmBrassMat);
  deck1Trim.position.set(0, -0.332, 0);
  g.add(deck1Trim);

  // 2nd observation terrace deck
  const deck2 = new THREE.Mesh(new THREE.BoxGeometry(0.098, 0.018, 0.098), bronzeMat);
  deck2.position.set(0, -0.225, 0);
  g.add(deck2);
  const deck2Trim = new THREE.Mesh(new THREE.BoxGeometry(0.108, 0.008, 0.108), warmBrassMat);
  deck2Trim.position.set(0, -0.218, 0);
  g.add(deck2Trim);

  // Summit gallery platform & spire needle connecting cleanly to ornament cap
  const summit = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.016, 12), warmBrassMat);
  summit.position.set(0, -0.118, 0);
  g.add(summit);

  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.014, 0.044, 8), warmBrassMat);
  spire.position.set(0, -0.092, 0);
  g.add(spire);

  return g;
}

function buildMistletoe(): THREE.Group {
  const g = new THREE.Group();
  g.add(makeCapAndLoop());

  const leafMat = createGouacheMaterial({
    color: '#469662',
    shadowColor: '#27613d',
    emissive: 0.12,
  });
  const bowMat = createGouacheMaterial({
    color: '#d6333e',
    shadowColor: '#9c1f29',
    emissive: 0.12,
  });
  const berryMat = createGouacheMaterial({
    color: '#fffef8',
    shadowColor: '#d9e3eb',
    emissive: 0.24,
  });

  // Paired sage-green mistletoe leaves fanning downward
  [
    { x: -0.072, y: -0.24, rz: 0.45 },
    { x: 0.072, y: -0.24, rz: -0.45 },
    { x: -0.04, y: -0.29, rz: 0.18 },
    { x: 0.04, y: -0.29, rz: -0.18 },
  ].forEach(({ x, y, rz }) => {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.054, 12, 10), leafMat);
    leaf.scale.set(0.62, 1.55, 0.38);
    leaf.position.set(x, y, 0);
    leaf.rotation.z = rz;
    g.add(leaf);
  });

  // Crimson satin bow at stem top
  [-1, 1].forEach((side) => {
    const lobe = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.06, 8), bowMat);
    lobe.rotation.z = side * Math.PI * 0.5;
    lobe.position.set(side * 0.038, -0.125, 0.02);
    g.add(lobe);
  });

  // Three luminous pearly white mistletoe berries
  [
    [0, -0.245, 0.035],
    [-0.028, -0.275, 0.032],
    [0.028, -0.275, 0.032],
  ].forEach(([bx, by, bz]) => {
    const berry = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), berryMat);
    berry.position.set(bx, by, bz);
    g.add(berry);
  });

  return g;
}

function buildTequilaBottle(): THREE.Group {
  const g = new THREE.Group();
  g.add(makeCapAndLoop());

  const bottleMat = createGouacheMaterial({
    color: '#88c996',
    shadowColor: '#48825a',
    rimColor: '#effef2',
    emissive: 0.14,
  });
  const corkMat = createGouacheMaterial({
    color: '#c9935b',
    shadowColor: '#8c5e34',
    emissive: 0.12,
  });
  const labelMat = createGouacheMaterial({
    color: '#fff9ec',
    shadowColor: '#dfd3bc',
    emissive: 0.16,
  });
  const redRibbonMat = createGouacheMaterial({
    color: '#d4333d',
    shadowColor: '#981f2a',
    emissive: 0.12,
  });
  const limeMat = createGouacheMaterial({
    color: '#80db48',
    shadowColor: '#4e9c27',
    emissive: 0.14,
  });

  // Rounded artisanal bottle body + shoulder + neck
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.095, 0.18, 16), bottleMat);
  body.position.set(0, -0.33, 0);
  g.add(body);

  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.092, 16, 12), bottleMat);
  shoulder.scale.set(1, 0.65, 1);
  shoulder.position.set(0, -0.24, 0);
  g.add(shoulder);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.1, 12), bottleMat);
  neck.position.set(0, -0.155, 0);
  g.add(neck);

  const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.028, 0.04, 12), corkMat);
  cork.position.set(0, -0.1, 0);
  g.add(cork);

  // Cream label + crimson festive agave band
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.096, 0.096, 0.11, 16, 1, true, -0.9, 1.8), labelMat);
  label.position.set(0, -0.33, 0);
  g.add(label);

  const band = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.01, 6, 16), redRibbonMat);
  band.rotation.x = Math.PI * 0.5;
  band.position.set(0, -0.175, 0);
  g.add(band);

  // Tiny cheerful lime wedge tucked onto the bottle shoulder!
  const lime = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.018, 12, 1, false, 0, Math.PI), limeMat);
  lime.position.set(0.068, -0.2, 0.04);
  lime.rotation.z = -0.5;
  g.add(lime);

  return g;
}

function buildFilmSlate(): THREE.Group {
  const g = new THREE.Group();
  g.add(makeCapAndLoop());

  const charcoalMat = createGouacheMaterial({
    color: '#343c4e',
    shadowColor: '#202634',
    rimColor: '#9fb0cc',
    emissive: 0.22,
    rimStrength: 0.45,
  });
  const stripeMat = createGouacheMaterial({
    color: '#ffffff',
    shadowColor: '#e2e9f2',
    emissive: 0.34,
  });
  const chalkMat = createGouacheMaterial({
    color: '#ffffff',
    shadowColor: '#dbe4f0',
    emissive: 0.32,
  });
  const brassMat = createGouacheMaterial({
    color: '#f5cd58',
    shadowColor: '#bd8a28',
    emissive: 0.2,
  });

  // Thin brass suspension stem bridging top loop down to hinged slate
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.125, 8), brassMat);
  stem.position.set(0, -0.135, 0);
  g.add(stem);

  const slatePivot = new THREE.Group();
  slatePivot.position.set(0, -0.195, 0);
  slatePivot.rotation.z = -0.05;
  slatePivot.scale.setScalar(1.16);
  g.add(slatePivot);

  // Main slate chalkboard body
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.168, 0.034), charcoalMat);
  board.position.set(0, -0.105, 0);
  slatePivot.add(board);

  // Lower fixed clapper header bar + crisp angled white stripes on front & back
  const fixedBar = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.036, 0.038), charcoalMat);
  fixedBar.position.set(0, -0.008, 0);
  slatePivot.add(fixedBar);

  [-0.082, -0.015, 0.052].forEach((sx) => {
    const barStripe = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.038, 0.041), stripeMat);
    barStripe.position.set(sx, -0.008, 0);
    barStripe.rotation.z = -0.4;
    slatePivot.add(barStripe);
  });

  // Chalk rule lines on both faces so front and back views stay crisp
  [-1, 1].forEach((sideZ) => {
    const zPos = sideZ * 0.0185;
    [-0.068, -0.106, -0.144].forEach((ly, idx) => {
      const w = idx === 2 ? 0.145 : 0.195;
      const line = new THREE.Mesh(new THREE.BoxGeometry(w, 0.008, 0.004), chalkMat);
      line.position.set(idx === 2 ? -0.025 : 0, ly, zPos);
      slatePivot.add(line);
    });
    [-0.035, 0.035].forEach((vx) => {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.034, 0.004), chalkMat);
      tick.position.set(vx, -0.087, zPos);
      slatePivot.add(tick);
    });
  });

  // Hinged upper clapper arm tilted playfully open
  const clapperArm = new THREE.Group();
  clapperArm.position.set(-0.122, 0.012, 0);
  clapperArm.rotation.z = 0.28;
  slatePivot.add(clapperArm);

  const upperBar = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.034, 0.038), charcoalMat);
  upperBar.position.set(0.122, 0.016, 0);
  clapperArm.add(upperBar);

  [0.042, 0.108, 0.174].forEach((sx) => {
    const barStripe = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.036, 0.041), stripeMat);
    barStripe.position.set(sx, 0.016, 0);
    barStripe.rotation.z = 0.4;
    clapperArm.add(barStripe);
  });

  // Brass corner hinge gusset & rivet pin
  const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.046, 10), brassMat);
  rivet.rotation.x = Math.PI * 0.5;
  rivet.position.set(-0.108, 0.004, 0);
  slatePivot.add(rivet);

  return g;
}

function buildHoneyBee(): THREE.Group {
  const g = new THREE.Group();
  g.add(makeCapAndLoop());

  const yellowMat = createGouacheMaterial({
    color: '#ffda47',
    shadowColor: '#dba121',
    emissive: 0.14,
  });
  const stripeMat = createGouacheMaterial({
    color: '#4a3228',
    shadowColor: '#2e1e18',
    emissive: 0.16,
  });
  const wingMat = createGouacheMaterial({
    color: '#f5fbff',
    shadowColor: '#cce2f2',
    emissive: 0.25,
    opacity: 0.82,
    transparent: true,
  });

  // Plump oval bee body + brown bands
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.125, 18, 14), yellowMat);
  body.scale.set(1.18, 0.92, 0.92);
  body.position.set(0, -0.255, 0);
  g.add(body);

  [-0.03, 0.04].forEach((bx) => {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.114, 0.024, 8, 18), stripeMat);
    band.rotation.y = Math.PI * 0.5;
    band.position.set(bx, -0.255, 0);
    g.add(band);
  });

  // Translucent pearly wings perched on top
  [-1, 1].forEach((side) => {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.068, 12, 10), wingMat);
    wing.scale.set(0.85, 0.35, 1.45);
    wing.position.set(0.02, -0.155, side * 0.075);
    wing.rotation.x = side * 0.42;
    g.add(wing);

    const ant = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.055, 4, 6), stripeMat);
    ant.position.set(-0.12, -0.16, side * 0.03);
    ant.rotation.z = 0.45;
    g.add(ant);
  });

  addEyes(g, 0.0, -0.235, 0.078, 0.015, 0.016);
  const eyeL = g.children[g.children.length - 4] as THREE.Mesh;
  eyeL.position.set(-0.118, -0.235, 0.042);
  const eyeLShine = g.children[g.children.length - 3] as THREE.Mesh;
  eyeLShine.position.set(-0.125, -0.23, 0.052);
  const eyeR = g.children[g.children.length - 2] as THREE.Mesh;
  eyeR.position.set(-0.118, -0.235, -0.042);
  const eyeRShine = g.children[g.children.length - 1] as THREE.Mesh;
  eyeRShine.position.set(-0.125, -0.23, -0.052);

  return g;
}

function buildAcrylicPaint(): THREE.Group {
  const g = new THREE.Group();
  g.add(makeCapAndLoop());

  const pinkMat = createGouacheMaterial({
    color: '#ffb5d0',
    shadowColor: '#e080a5',
    rimColor: '#fff5f9',
    emissive: 0.14,
  });
  const labelMat = createGouacheMaterial({
    color: '#fffef9',
    shadowColor: '#e0d7e2',
    emissive: 0.18,
  });
  const capMat = createGouacheMaterial({
    color: '#f5f2f7',
    shadowColor: '#ccc7d4',
    emissive: 0.14,
  });
  const goldMat = createGouacheMaterial({
    color: '#f2c854',
    shadowColor: '#be8a28',
    emissive: 0.16,
  });

  // Tapered baby-pink paint tube body (wider flat crimp top, narrowing down to nozzle!)
  const crimp = new THREE.Mesh(new THREE.BoxGeometry(0.175, 0.035, 0.028), pinkMat);
  crimp.position.set(0, -0.105, 0);
  g.add(crimp);

  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.05, 0.24, 16), pinkMat);
  tube.scale.set(1.0, 1.0, 0.68);
  tube.position.set(0, -0.225, 0);
  g.add(tube);

  // White studio label wrap + gold stripe
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.062, 0.11, 16), labelMat);
  label.scale.set(1.03, 1.0, 0.72);
  label.position.set(0, -0.22, 0);
  g.add(label);

  const band = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.018, 0.095), goldMat);
  band.position.set(0, -0.185, 0);
  g.add(band);

  // Ribbed white screw cap + cute little baby-pink paint swirl dollop beside cap!
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 0.055, 12), capMat);
  cap.position.set(0, -0.365, 0);
  g.add(cap);

  const dollop = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 10), pinkMat);
  dollop.scale.set(1.15, 0.75, 1.15);
  dollop.position.set(0.068, -0.365, 0.045);
  g.add(dollop);

  return g;
}

function buildPizzaSlice(): THREE.Group {
  const g = new THREE.Group();
  g.add(makeCapAndLoop());

  const cheeseMat = createGouacheMaterial({
    color: '#ffe05c',
    shadowColor: '#d99a24',
    rimColor: '#fff8cf',
    emissive: 0.18,
  });
  const crustMat = createGouacheMaterial({
    color: '#d98a3b',
    shadowColor: '#9c561d',
    rimColor: '#f2b878',
    emissive: 0.14,
  });
  const pepperoniMat = createGouacheMaterial({
    color: '#cc2934',
    shadowColor: '#87131c',
    emissive: 0.16,
  });
  const basilMat = createGouacheMaterial({
    color: '#2c8252',
    shadowColor: '#195434',
    emissive: 0.12,
  });

  // Cheesy triangular wedge pointing downward
  const sliceShape = new THREE.Shape();
  sliceShape.moveTo(-0.145, 0.12);
  sliceShape.lineTo(0.145, 0.12);
  sliceShape.lineTo(0, -0.175);
  sliceShape.closePath();

  const sliceGeo = new THREE.ExtrudeGeometry(sliceShape, {
    depth: 0.036,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 2,
  });
  sliceGeo.translate(0, 0, -0.018);

  const slice = new THREE.Mesh(sliceGeo, cheeseMat);
  slice.position.set(0, -0.26, 0);
  g.add(slice);

  // Plump golden pizza crust rim along the top edge
  const crust = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 12), crustMat);
  crust.rotation.z = Math.PI * 0.5;
  crust.position.set(0, -0.132, 0);
  g.add(crust);

  // Pepperoni discs on both front and back faces
  const pepSpots: Array<[number, number, number]> = [
    [-0.05, -0.195, 0.032],
    [0.055, -0.22, 0.03],
    [-0.008, -0.295, 0.028],
  ];
  pepSpots.forEach(([px, py, pr]) => {
    [-1, 1].forEach((sz) => {
      const pep = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr, 0.008, 12), pepperoniMat);
      pep.rotation.x = Math.PI * 0.5;
      pep.position.set(px, py, sz * 0.024);
      g.add(pep);
    });
  });

  // Tiny fresh basil leaf accent
  const basil = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), basilMat);
  basil.scale.set(1.3, 0.65, 0.45);
  basil.position.set(0.018, -0.185, 0.026);
  basil.rotation.z = 0.45;
  g.add(basil);

  return g;
}

function buildBanana(): THREE.Group {
  const g = new THREE.Group();
  g.add(makeCapAndLoop());

  const peelMat = createGouacheMaterial({
    color: '#ffe247',
    shadowColor: '#cfa21b',
    rimColor: '#fff9cc',
    emissive: 0.2,
  });
  const stemMat = createGouacheMaterial({
    color: '#78512c',
    shadowColor: '#4a3017',
    emissive: 0.1,
  });

  // Smooth crescent banana curve constructed from overlapping plump spheres/tubes
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.085, -0.11, 0),
    new THREE.Vector3(-0.11, -0.23, 0.01),
    new THREE.Vector3(-0.02, -0.345, 0),
    new THREE.Vector3(0.115, -0.385, -0.01),
  ]);
  const bananaTube = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, 0.046, 12, false), peelMat);
  g.add(bananaTube);

  // Tapered end tips & dark woody stem / blossom tip
  const topCone = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.075, 10), peelMat);
  topCone.position.set(-0.078, -0.082, 0);
  topCone.rotation.z = -0.38;
  g.add(topCone);

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, 0.055, 8), stemMat);
  stem.position.set(-0.068, -0.052, 0);
  stem.rotation.z = -0.32;
  g.add(stem);

  const tipCone = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.065, 10), peelMat);
  tipCone.position.set(0.142, -0.388, -0.012);
  tipCone.rotation.z = -1.52;
  g.add(tipCone);

  const nub = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), stemMat);
  nub.position.set(0.172, -0.388, -0.014);
  g.add(nub);

  return g;
}

export function createOrnamentMesh(ornamentId: OrnamentId): THREE.Group {
  let group: THREE.Group;
  switch (ornamentId) {
    case 'espresso-martini':
      group = buildEspressoMartini();
      break;
    case 'kirby':
      group = buildKirby();
      break;
    case 'rubber-duck':
      group = buildRubberDuck();
      break;
    case 'cinnamoroll':
      group = buildCinnamoroll();
      break;
    case 'lord-farquaad':
      group = buildLordFarquaad();
      break;
    case 'french-fries':
      group = buildFrenchFries();
      break;
    case 'kiwi':
      group = buildKiwi();
      break;
    case 'empanada':
      group = buildEmpanada();
      break;
    case 'volleyball':
      group = buildVolleyball();
      break;
    case 'cat':
      group = buildCat();
      break;
    case 'dog':
      group = buildDog();
      break;
    case 'wallet':
      group = buildWallet();
      break;
    case 'laptop':
      group = buildLaptop();
      break;
    case 'daisy':
      group = buildDaisy();
      break;
    case 'hamster':
      group = buildHamster();
      break;
    case 'fish':
      group = buildFish();
      break;
    case 'eiffel-tower':
      group = buildEiffelTower();
      break;
    case 'mistletoe':
      group = buildMistletoe();
      break;
    case 'tequila-bottle':
      group = buildTequilaBottle();
      break;
    case 'film-slate':
      group = buildFilmSlate();
      break;
    case 'honey-bee':
      group = buildHoneyBee();
      break;
    case 'acrylic-paint':
      group = buildAcrylicPaint();
      break;
    case 'pizza-slice':
      group = buildPizzaSlice();
      break;
    case 'banana':
      group = buildBanana();
      break;
  }

  // Measure built ornament bounds cleanly so its resting bottom sits flush at y = 0 on tree ledges
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const scaleFactor = 0.78;
  group.scale.setScalar(scaleFactor);
  group.position.y = -box.min.y * scaleFactor;

  const wrapper = new THREE.Group();
  wrapper.add(group);

  const height = Math.max(0.2, (box.max.y - box.min.y) * scaleFactor);

  // Invisible generous hit sphere centered over the perched ornament body
  const hitMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  const hitSphere = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), hitMat);
  hitSphere.position.set(0, height * 0.5, 0);
  hitSphere.userData.isOrnamentHit = true;
  wrapper.add(hitSphere);

  wrapper.userData.ornamentId = ornamentId;
  return wrapper;
}
