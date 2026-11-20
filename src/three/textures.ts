import * as THREE from 'three';

export interface InnovaTextureSet {
  tireBump: THREE.CanvasTexture;
  tireRoughness: THREE.CanvasTexture;
  paintMicroBump: THREE.CanvasTexture;
  leatherAlbedo: THREE.CanvasTexture;
  leatherBump: THREE.CanvasTexture;
  gaugeCluster: THREE.CanvasTexture;
  infotainment: THREE.CanvasTexture;
  brakeRotor: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  floorGradient: THREE.CanvasTexture;
  plateFront: THREE.CanvasTexture;
  plateRear: THREE.CanvasTexture;
  innovaBadge: THREE.CanvasTexture;
  liveryDark: {
    seal: THREE.CanvasTexture;
    script: THREE.CanvasTexture;
    wordmark: THREE.CanvasTexture;
  };
  liveryLight: {
    seal: THREE.CanvasTexture;
    script: THREE.CanvasTexture;
    wordmark: THREE.CanvasTexture;
  };
  dispose: () => void;
}

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function configureTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  isColor: boolean,
  repeat?: [number, number],
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = anisotropy;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  } else {
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
  }
  tex.needsUpdate = true;
  return tex;
}

function createTireTextures(anisotropy: number): {
  bump: THREE.CanvasTexture;
  roughness: THREE.CanvasTexture;
} {
  const [cBump, ctxB] = makeCanvas(512, 512);
  ctxB.fillStyle = '#909090';
  ctxB.fillRect(0, 0, 512, 512);

  // Longitudinal highway rain grooves
  ctxB.fillStyle = '#242424';
  const grooves = [110, 200, 312, 402];
  for (const gx of grooves) {
    ctxB.fillRect(gx - 12, 0, 24, 512);
  }

  // Angled shoulder and center tread blocks
  ctxB.strokeStyle = '#303030';
  ctxB.lineWidth = 8;
  for (let y = -64; y < 576; y += 42) {
    // Left shoulder sipes
    ctxB.beginPath();
    ctxB.moveTo(0, y);
    ctxB.lineTo(100, y + 22);
    ctxB.stroke();
    // Right shoulder sipes
    ctxB.beginPath();
    ctxB.moveTo(512, y + 18);
    ctxB.lineTo(412, y + 40);
    ctxB.stroke();
    // Center rib angled notches
    ctxB.beginPath();
    ctxB.moveTo(212, y + 10);
    ctxB.lineTo(300, y - 6);
    ctxB.stroke();
  }

  // Highlight raised blocks
  ctxB.fillStyle = 'rgba(255,255,255,0.12)';
  for (let y = 0; y < 512; y += 42) {
    ctxB.fillRect(128, y + 4, 56, 26);
    ctxB.fillRect(328, y + 14, 56, 26);
  }

  // Roughness map: rubber treads matte (0.82), grooves slightly darker/rougher
  const [cRough, ctxR] = makeCanvas(256, 256);
  ctxR.fillStyle = '#d4d4d4';
  ctxR.fillRect(0, 0, 256, 256);
  ctxR.fillStyle = '#ececec';
  for (const gx of [55, 100, 156, 201]) {
    ctxR.fillRect(gx - 6, 0, 12, 256);
  }

  return {
    bump: configureTexture(cBump, anisotropy, false, [1, 7]),
    roughness: configureTexture(cRough, anisotropy, false, [1, 7]),
  };
}

function createPaintMicroBump(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  const img = ctx.createImageData(256, 256);
  // Deterministic subtle metallic flake grain
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 120 + Math.floor(rand() * 24);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return configureTexture(canvas, anisotropy, false, [16, 16]);
}

function createLeatherTextures(anisotropy: number): {
  albedo: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
} {
  const [cCol, ctxC] = makeCanvas(256, 256);
  ctxC.fillStyle = '#262930';
  ctxC.fillRect(0, 0, 256, 256);

  // Perforated automotive seat micro-dots & soft grain
  for (let y = 8; y < 256; y += 16) {
    for (let x = 8; x < 256; x += 16) {
      const offset = (y / 16) % 2 === 0 ? 0 : 8;
      ctxC.fillStyle = '#181a1f';
      ctxC.beginPath();
      ctxC.arc((x + offset) % 256, y, 2.2, 0, Math.PI * 2);
      ctxC.fill();
    }
  }
  // Subtle quilted center seam lines
  ctxC.strokeStyle = '#383d47';
  ctxC.lineWidth = 2;
  ctxC.beginPath();
  ctxC.moveTo(0, 128);
  ctxC.lineTo(256, 128);
  ctxC.stroke();

  const [cBump, ctxB] = makeCanvas(256, 256);
  ctxB.fillStyle = '#9a9a9a';
  ctxB.fillRect(0, 0, 256, 256);
  for (let y = 8; y < 256; y += 16) {
    for (let x = 8; x < 256; x += 16) {
      const offset = (y / 16) % 2 === 0 ? 0 : 8;
      ctxB.fillStyle = '#383838';
      ctxB.beginPath();
      ctxB.arc((x + offset) % 256, y, 2.5, 0, Math.PI * 2);
      ctxB.fill();
    }
  }
  ctxB.strokeStyle = '#505050';
  ctxB.lineWidth = 3;
  ctxB.beginPath();
  ctxB.moveTo(0, 128);
  ctxB.lineTo(256, 128);
  ctxB.stroke();

  return {
    albedo: configureTexture(cCol, anisotropy, true, [4, 4]),
    bump: configureTexture(cBump, anisotropy, false, [4, 4]),
  };
}

function createGaugeClusterTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 256);
  ctx.fillStyle = '#090d14';
  ctx.fillRect(0, 0, 512, 256);

  const drawDial = (cx: number, cy: number, r: number, maxVal: number, labels: string[], needleAngle: number) => {
    // Outer Toyota Optitron luminous cyan-blue ring
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 8, 0, Math.PI * 2);
    ctx.stroke();

    // Ticks
    const startA = Math.PI * 0.78;
    const endA = Math.PI * 2.22;
    const count = labels.length - 1;
    for (let i = 0; i <= count * 2; i++) {
      const t = i / (count * 2);
      const a = startA + t * (endA - startA);
      const isMajor = i % 2 === 0;
      const inner = r - (isMajor ? 22 : 14);
      const outer = r - 7;
      ctx.strokeStyle = t > 0.82 && maxVal === 6 ? '#ef4444' : '#e2e8f0';
      ctx.lineWidth = isMajor ? 2.5 : 1.2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
      ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
      ctx.stroke();

      if (isMajor) {
        const labelR = r - 35;
        ctx.fillStyle = '#f8fafc';
        ctx.font = '600 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(labels[i / 2], cx + Math.cos(a) * labelR, cy + Math.sin(a) * labelR);
      }
    }

    // Needle
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(needleAngle) * (r - 20), cy + Math.sin(needleAngle) * (r - 20));
    ctx.stroke();

    // Hub
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fill();
  };

  // Left: Tachometer
  drawDial(118, 134, 84, 6, ['0', '1', '2', '3', '4', '5', '6'], Math.PI * 0.92);
  // Right: Speedometer
  drawDial(394, 134, 84, 220, ['0', '40', '80', '120', '160', '200'], Math.PI * 0.80);

  // Center TFT Multi-Information Display
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.fillRect(212, 52, 88, 156);
  ctx.strokeRect(212, 52, 88, 156);

  ctx.fillStyle = '#38bdf8';
  ctx.font = '700 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('INNOVA', 256, 78);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 28px monospace';
  ctx.fillText('P', 256, 122);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 11px monospace';
  ctx.fillText('ODO 12,480', 256, 154);
  ctx.fillStyle = '#22c55e';
  ctx.fillText('ECO READY', 256, 178);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText('28°C  F ████', 256, 198);

  return configureTexture(canvas, anisotropy, true);
}

function createInfotainmentTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 320);
  ctx.fillStyle = '#0b111c';
  ctx.fillRect(0, 0, 512, 320);

  // Top status bar
  ctx.fillStyle = '#141e30';
  ctx.fillRect(0, 0, 512, 38);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '600 16px sans-serif';
  ctx.fillText('10:42', 18, 25);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '500 13px sans-serif';
  ctx.fillText('AUTO CLIMATE  22.5°C', 280, 24);

  // Left card: Clean navigation map preview
  ctx.fillStyle = '#152236';
  ctx.fillRect(16, 52, 292, 206);
  ctx.strokeStyle = '#283d5e';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(16 + i * 58, 52);
    ctx.lineTo(16 + i * 58, 258);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(16, 52 + i * 42);
    ctx.lineTo(308, 52 + i * 42);
    ctx.stroke();
  }
  // Route path
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(74, 246);
  ctx.lineTo(148, 174);
  ctx.lineTo(222, 140);
  ctx.lineTo(276, 76);
  ctx.stroke();
  // Vehicle arrow
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.moveTo(148, 162);
  ctx.lineTo(138, 186);
  ctx.lineTo(158, 186);
  ctx.closePath();
  ctx.fill();

  // Right card: Media & Vehicle overview
  ctx.fillStyle = '#162032';
  ctx.fillRect(322, 52, 174, 98);
  ctx.fillStyle = '#38bdf8';
  ctx.font = '600 12px sans-serif';
  ctx.fillText('MEDIA AUDIO', 336, 76);
  ctx.fillStyle = '#f8fafc';
  ctx.font = '600 16px sans-serif';
  ctx.fillText('FM 98.7 MHz', 336, 106);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '400 12px sans-serif';
  ctx.fillText('Bluetooth Ready', 336, 130);

  ctx.fillStyle = '#162032';
  ctx.fillRect(322, 160, 174, 98);
  ctx.fillStyle = '#22c55e';
  ctx.font = '600 12px sans-serif';
  ctx.fillText('DRIVE MODE', 336, 184);
  ctx.fillStyle = '#f8fafc';
  ctx.font = '600 16px sans-serif';
  ctx.fillText('ECO / PWR', 336, 214);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '400 12px sans-serif';
  ctx.fillText('2.8L D-4D Diesel', 336, 238);

  // Bottom quick dock bar
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 272, 512, 48);
  const icons = ['HOME', 'NAV', 'AUDIO', 'PHONE', 'SETUP'];
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '600 13px sans-serif';
  ctx.textAlign = 'center';
  icons.forEach((lbl, idx) => {
    ctx.fillText(lbl, 52 + idx * 102, 301);
  });

  return configureTexture(canvas, anisotropy, true);
}

function createBrakeRotorTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = '#8b929a';
  ctx.fillRect(0, 0, 256, 256);
  const cx = 128;
  const cy = 128;

  for (let r = 36; r < 124; r += 3) {
    ctx.strokeStyle = r % 6 === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(20,24,30,0.20)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Hub bell
  ctx.fillStyle = '#474e57';
  ctx.beginPath();
  ctx.arc(cx, cy, 48, 0, Math.PI * 2);
  ctx.fill();

  return configureTexture(canvas, anisotropy, true);
}

function createContactShadowTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  ctx.clearRect(0, 0, 512, 512);

  // Soft rectangular/elliptical automotive underbody ambient occlusion shadow
  const grad = ctx.createRadialGradient(256, 256, 30, 256, 256, 240);
  grad.addColorStop(0.0, 'rgba(15, 23, 42, 0.58)');
  grad.addColorStop(0.45, 'rgba(15, 23, 42, 0.42)');
  grad.addColorStop(0.75, 'rgba(15, 23, 42, 0.14)');
  grad.addColorStop(1.0, 'rgba(15, 23, 42, 0.0)');

  ctx.save();
  ctx.translate(256, 256);
  ctx.scale(0.68, 1.0);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 240, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Four subtle wheel contact darkening ovals
  const wheels = [
    [-112, -135],
    [112, -135],
    [-112, 138],
    [112, 138],
  ];
  for (const [wx, wy] of wheels) {
    const wg = ctx.createRadialGradient(256 + wx, 256 + wy, 6, 256 + wx, 256 + wy, 48);
    wg.addColorStop(0, 'rgba(8, 12, 20, 0.65)');
    wg.addColorStop(1, 'rgba(8, 12, 20, 0.0)');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.arc(256 + wx, 256 + wy, 48, 0, Math.PI * 2);
    ctx.fill();
  }

  return configureTexture(canvas, anisotropy, true);
}

function createFloorGradientTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  const grad = ctx.createRadialGradient(256, 256, 30, 256, 256, 256);
  grad.addColorStop(0, '#f3f5f8');
  grad.addColorStop(0.55, '#e7ecf2');
  grad.addColorStop(1, '#dce2ea');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle architectural studio turntable ring
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.06)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(256, 256, 132, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(15, 23, 42, 0.035)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(256, 256, 178, 0, Math.PI * 2);
  ctx.stroke();

  return configureTexture(canvas, anisotropy, true);
}

function createLicensePlateTexture(
  anisotropy: number,
  text: string,
  subtext: string,
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 160);
  ctx.fillStyle = '#161a22';
  ctx.fillRect(0, 0, 512, 160);

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 492, 140);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 66px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 74);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '600 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(subtext, 256, 126);

  return configureTexture(canvas, anisotropy, true);
}

function createInnovaBadgeTexture(anisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 128);
  ctx.clearRect(0, 0, 512, 128);
  const grad = ctx.createLinearGradient(0, 20, 0, 108);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.5, '#cbd5e1');
  grad.addColorStop(1, '#64748b');
  ctx.fillStyle = grad;
  ctx.font = '700 72px "Outfit", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('INNOVA', 16, 66);
  return configureTexture(canvas, anisotropy, true);
}

/**
 * Draws an initial green PANELCO III emblem placeholder immediately before the PNG logo finishes decoding.
 */
function drawFallbackPanelcoSeal(ctx: CanvasRenderingContext2D): void {
  const cx = 256;
  const cy = 256;
  ctx.clearRect(0, 0, 512, 512);

  // Authentic PANELCO III vibrant green outer ring
  ctx.fillStyle = '#008B3D';
  ctx.beginPath();
  ctx.arc(cx, cy, 244, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, 166, 0, Math.PI * 2);
  ctx.fill();

  // Central golden bulb silhouette
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(cx, cy - 14, 88, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#111827';
  ctx.font = '700 44px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PANELCO', cx, 52);
  ctx.fillText('III', cx, 462);
}

/**
 * Loads the official uploaded PANELCO 3 logo PNG, auto-crops any white margins,
 * applies a razor-crisp circular alpha mask so zero white box corners appear on the door,
 * and triggers an async re-render callback once loaded.
 */
function createPanelcoSealTexture(
  anisotropy: number,
  onAsyncUpdate?: () => void,
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 512);
  drawFallbackPanelcoSeal(ctx);
  const tex = configureTexture(canvas, anisotropy, true);

  if (typeof Image !== 'undefined') {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (w <= 0 || h <= 0) return;

        // Inspect source image to locate exact circular green ring bounds & remove white background
        const [tmpCanvas, tmpCtx] = makeCanvas(w, h);
        tmpCtx.drawImage(img, 0, 0, w, h);
        const { data } = tmpCtx.getImageData(0, 0, w, h);

        let minX = w;
        let maxX = 0;
        let minY = h;
        let maxY = 0;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];
            const isNearWhite = r > 238 && g > 238 && b > 238;
            if (a > 24 && !isNearWhite) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        const hasBounds = maxX > minX + 16 && maxY > minY + 16;
        const srcCx = hasBounds ? (minX + maxX) * 0.5 : w * 0.5;
        const srcCy = hasBounds ? (minY + maxY) * 0.5 : h * 0.5;
        const srcR = hasBounds
          ? Math.max(maxX - minX, maxY - minY) * 0.5 - 1.5
          : Math.min(w, h) * 0.46;

        ctx.clearRect(0, 0, 512, 512);
        ctx.save();
        ctx.beginPath();
        ctx.arc(256, 256, 246, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        ctx.drawImage(
          img,
          srcCx - srcR,
          srcCy - srcR,
          srcR * 2,
          srcR * 2,
          10,
          10,
          492,
          492,
        );
        ctx.restore();

        // Subtle crisp green rim to eliminate any sub-pixel white halo against dark paints
        ctx.strokeStyle = '#007A35';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(256, 256, 245, 0, Math.PI * 2);
        ctx.stroke();

        tex.needsUpdate = true;
        onAsyncUpdate?.();
      } catch {
        // Keep clean fallback seal if image read fails
      }
    };
    img.src = '/assets/aistudio/panelco_3_logo_7eeed0bf.png';
  }

  return tex;
}

/**
 * Brush-script tagline "Your delight . . . our success" in deep PANELCO forest green
 * matching the real vehicle side reference photo.
 */
function createPanelcoScriptTexture(
  anisotropy: number,
  ink: 'dark' | 'light',
  onAsyncUpdate?: () => void,
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(2048, 280);

  const renderText = () => {
    ctx.clearRect(0, 0, 2048, 280);
    ctx.font = '400 132px "Kaushan Script", "Brush Script MT", "Segoe Script", Georgia, cursive';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Exact deep forest-green vinyl color from the real PANELCO III vehicle side photo
    const fillHex = ink === 'dark' ? '#15572C' : '#34D399';
    const strokeHex = ink === 'dark' ? '#0C381C' : '#064E3B';

    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = strokeHex;
    ctx.strokeText('Your delight . . . our success', 1024, 146);

    ctx.fillStyle = fillHex;
    ctx.fillText('Your delight . . . our success', 1024, 146);
  };

  renderText();
  const tex = configureTexture(canvas, anisotropy, true);

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    document.fonts.ready.then(() => {
      renderText();
      tex.needsUpdate = true;
      onAsyncUpdate?.();
    });
  }

  return tex;
}

/**
 * Bold hood & tailgate wordmark "PANELCO III" in the official PANELCO 3 logo green.
 */
function createPanelcoWordmarkTexture(
  anisotropy: number,
  ink: 'dark' | 'light',
  onAsyncUpdate?: () => void,
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(1024, 256);

  const renderText = () => {
    ctx.clearRect(0, 0, 1024, 256);
    ctx.font = '700 128px "Outfit", "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Matches the signature green ring of the official PANELCO 3 logo (#008B3D) under studio key light
    const fillHex = ink === 'dark' ? '#007A33' : '#22C55E';
    const strokeHex = ink === 'dark' ? '#06381A' : '#052E16';

    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = strokeHex;
    ctx.strokeText('PANELCO III', 512, 134);

    ctx.fillStyle = fillHex;
    ctx.fillText('PANELCO III', 512, 134);
  };

  renderText();
  const tex = configureTexture(canvas, anisotropy, true);

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    document.fonts.ready.then(() => {
      renderText();
      tex.needsUpdate = true;
      onAsyncUpdate?.();
    });
  }

  return tex;
}

export function createInnovaTextures(
  maxAnisotropy: number,
  onAsyncTextureUpdate?: () => void,
): InnovaTextureSet {
  const aniso = Math.min(maxAnisotropy || 4, 16);
  const tire = createTireTextures(aniso);
  const paintMicroBump = createPaintMicroBump(aniso);
  const leather = createLeatherTextures(aniso);
  const gaugeCluster = createGaugeClusterTexture(aniso);
  const infotainment = createInfotainmentTexture(aniso);
  const brakeRotor = createBrakeRotorTexture(aniso);
  const contactShadow = createContactShadowTexture(aniso);
  const floorGradient = createFloorGradientTexture(aniso);
  const plateFront = createLicensePlateTexture(aniso, 'INNOVA', 'AN140 · 2.8 V');
  const plateRear = createLicensePlateTexture(aniso, 'INNOVA', 'PANELCO III');
  const innovaBadge = createInnovaBadgeTexture(aniso);

  // Full-color official PANELCO 3 circular logo works vibrantly on both light and dark paint finishes
  const officialSeal = createPanelcoSealTexture(aniso, onAsyncTextureUpdate);

  const liveryDark = {
    seal: officialSeal,
    script: createPanelcoScriptTexture(aniso, 'dark', onAsyncTextureUpdate),
    wordmark: createPanelcoWordmarkTexture(aniso, 'dark', onAsyncTextureUpdate),
  };
  const liveryLight = {
    seal: officialSeal,
    script: createPanelcoScriptTexture(aniso, 'light', onAsyncTextureUpdate),
    wordmark: createPanelcoWordmarkTexture(aniso, 'light', onAsyncTextureUpdate),
  };

  const all: THREE.Texture[] = [
    tire.bump,
    tire.roughness,
    paintMicroBump,
    leather.albedo,
    leather.bump,
    gaugeCluster,
    infotainment,
    brakeRotor,
    contactShadow,
    floorGradient,
    plateFront,
    plateRear,
    innovaBadge,
    officialSeal,
    liveryDark.script,
    liveryDark.wordmark,
    liveryLight.script,
    liveryLight.wordmark,
  ];

  return {
    tireBump: tire.bump,
    tireRoughness: tire.roughness,
    paintMicroBump,
    leatherAlbedo: leather.albedo,
    leatherBump: leather.bump,
    gaugeCluster,
    infotainment,
    brakeRotor,
    contactShadow,
    floorGradient,
    plateFront,
    plateRear,
    innovaBadge,
    liveryDark,
    liveryLight,
    dispose: () => {
      for (const tex of all) {
        tex.dispose();
      }
    },
  };
}
