import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_EXTERIOR_DISTANCE,
  computeFitDistance,
  computeQuadViewports,
  dampValue,
  distanceToZoomPercent,
  getCameraPresetPose,
  hitTestQuadPane,
  zoomPercentToDistance,
} from './cameraMath';

test('computeQuadViewports splits desktop 1440x900 into 4 non-overlapping PANELCO views', () => {
  const rects = computeQuadViewports(1440, 900, 52, 0);
  assert.equal(rects.length, 4);

  const [right, left, front, rear] = rects;
  assert.equal(right.id, 'right');
  assert.equal(left.id, 'left');
  assert.equal(front.id, 'front');
  assert.equal(rear.id, 'rear');

  // Horizontal coverage equals full width
  assert.equal(right.width + left.width, 1440);
  assert.equal(front.width + rear.width, 1440);

  // Vertical coverage equals usable height below top inset
  assert.equal(right.height + front.height, 900 - 52);

  // WebGL bottom-left coordinates match CSS top-left coordinates inverted
  assert.equal(front.glY, 0);
  assert.equal(rear.glY, 0);
  assert.equal(right.glY, front.height);
  assert.equal(left.glY, rear.height);
  assert.equal(right.glY + right.height, 900 - 52);
});

test('computeQuadViewports handles odd mobile dimensions without gaps', () => {
  const rects = computeQuadViewports(390, 844, 48, 0);
  assert.equal(rects[0].width + rects[1].width, 390);
  assert.equal(rects[0].height + rects[2].height, 844 - 48);
  assert.ok(rects.every((r) => r.width > 0 && r.height > 0 && r.aspect > 0));
});

test('hitTestQuadPane accurately identifies all 4 quadrants and ignores header inset', () => {
  const rects = computeQuadViewports(1440, 900, 52, 0);
  assert.equal(hitTestQuadPane(100, 20, rects), null);
  assert.equal(hitTestQuadPane(200, 200, rects), 'right');
  assert.equal(hitTestQuadPane(1100, 200, rects), 'left');
  assert.equal(hitTestQuadPane(200, 700, rects), 'front');
  assert.equal(hitTestQuadPane(1100, 700, rects), 'rear');
});

test('computeFitDistance increases distance on narrow portrait viewports to prevent horizontal clipping', () => {
  const landscapeDist = computeFitDistance(4.74, 1.8, 30, 16 / 9, 1.3);
  const portraitDist = computeFitDistance(4.74, 1.8, 30, 390 / 844, 1.3);
  assert.ok(portraitDist > landscapeDist * 2.2);
});

test('getCameraPresetPose matches vehicle axes for all 4 elevations and interior spots', () => {
  const rightPose = getCameraPresetPose('right', 1.6, true);
  const leftPose = getCameraPresetPose('left', 1.6, true);
  const frontPose = getCameraPresetPose('front', 1.6, true);
  const rearPose = getCameraPresetPose('rear', 1.6, true);
  const cockpitPose = getCameraPresetPose('cockpit', 1.6, false);

  assert.ok(rightPose.position.x < 0, 'Right side camera sits on -X so +Z nose faces right');
  assert.ok(leftPose.position.x > 0, 'Left side camera sits on +X so +Z nose faces left');
  assert.ok(frontPose.position.z > 0, 'Front camera sits on +Z facing front fascia');
  assert.ok(rearPose.position.z < 0, 'Rear camera sits on -Z facing tailgate');
  assert.ok(
    Math.abs(cockpitPose.position.x) < 0.8 && cockpitPose.position.y > 1.0 && cockpitPose.position.y < 1.6,
    'Cockpit camera sits inside the cabin',
  );
});

test('zoomPercentToDistance and distanceToZoomPercent invert cleanly and respect limits', () => {
  const base = 6.0;
  const dist100 = zoomPercentToDistance(100, base, 1.25, 10.5);
  assert.equal(dist100, base);
  assert.equal(distanceToZoomPercent(dist100, base), 100);

  const dist200 = zoomPercentToDistance(200, base, 1.25, 10.5);
  assert.equal(dist200, 3.0);
  assert.equal(distanceToZoomPercent(dist200, base), 200);

  // Clamping boundaries
  assert.equal(zoomPercentToDistance(500, base, 1.25, 10.5), 1.25);
  assert.equal(zoomPercentToDistance(10, base, 1.25, 10.5), 10.5);
});

test('dampValue approaches target smoothly and monotonically without overshoot', () => {
  let val = 0;
  for (let i = 0; i < 60; i++) {
    const next = dampValue(val, 10, 8, 1 / 60);
    assert.ok(next >= val && next <= 10);
    val = next;
  }
  assert.ok(val > 9.9);
});

test('mobile 390x844 quad views fit without exceeding MAX_EXTERIOR_DISTANCE and cockpit clears seat backrest', () => {
  const mobileRects = computeQuadViewports(390, 844, 48, 0);
  for (const rect of mobileRects) {
    const pose = getCameraPresetPose(rect.id, rect.aspect, true);
    const dist = Math.hypot(
      pose.position.x - pose.target.x,
      pose.position.y - pose.target.y,
      pose.position.z - pose.target.z,
    );
    assert.ok(
      dist <= MAX_EXTERIOR_DISTANCE,
      `Mobile quad pane ${rect.id} distance (${dist.toFixed(2)}) must fit within MAX_EXTERIOR_DISTANCE (${MAX_EXTERIOR_DISTANCE})`,
    );
  }

  const cockpit = getCameraPresetPose('cockpit', 16 / 9, false);
  assert.ok(cockpit.position.z > 0, 'Cockpit camera must sit forward of the driver seat backrest');
});
