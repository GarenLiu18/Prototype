const canvas = document.querySelector("#game-board");
const context = canvas.getContext("2d");
const discardButton = document.querySelector("#discard-button");
const cargoCountElement = document.querySelector("#cargo-count");
const speedValueElement = document.querySelector("#speed-value");
const boostValueElement = document.querySelector("#boost-value");

const world = {
  width: 960,
  height: 300,
  groundY: 236,
  distance: 0,
  speed: 210,
  boostSpeed: 100,
  boostTimer: 0,
  boostDuration: 1,
  slowSpeed: 90,
  slowTimer: 0,
  slowDuration: 1.6,
  elapsed: 0,
  lastTime: performance.now(),
};

const route = {
  baseSegmentDistance: 3600,
  timeLimit: 18,
};

const target = {
  station: 1,
  startDistance: 0,
  distance: getSegmentDistance(1),
  startTime: 0,
  timeLimit: route.timeLimit,
  requiredCargo: 5,
  resolved: false,
};

const delivery = {
  deliveredCargo: 0,
  good: 0,
  bad: 0,
  settlement: false,
  settlementReason: "",
  completedStops: [],
};

const clouds = [
  { x: 70, y: 62, width: 78, speed: 17 },
  { x: 560, y: 78, width: 96, speed: 14 },
  { x: 850, y: 66, width: 82, speed: 19 },
];

const rocks = Array.from({ length: 220 }, (_, index) => ({
  x: index * 24 + Math.random() * 15,
  depth: 9 + Math.random() * 17,
  width: 3 + Math.random() * 5,
}));

const cargoBlocks = createCargoBlocks();
const droppedBlocks = [];
const speedBumps = [];
let visibleCargoCount = cargoBlocks.length;

function setupCanvas() {
  const pixelRatio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * pixelRatio);
  canvas.height = Math.floor(rect.height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  world.width = rect.width;
  world.height = rect.height;
  world.groundY = Math.round(rect.height * 0.78);
}

function animate(time) {
  const delta = Math.min((time - world.lastTime) / 1000, 0.05);
  world.lastTime = time;

  if (delivery.settlement) {
    draw();
    window.requestAnimationFrame(animate);
    return;
  }

  world.elapsed += delta;
  world.distance += getCurrentSpeed() * delta;
  world.boostTimer = Math.max(0, world.boostTimer - delta);
  world.slowTimer = Math.max(0, world.slowTimer - delta);

  updateClouds(delta);
  updateDroppedBlocks(delta);
  updateCompletedStop(delta);
  updateSpeedBumps();
  updateDelivery();
  updateSpeedReadout();
  draw();
  window.requestAnimationFrame(animate);
}

function updateClouds(delta) {
  const boostMultiplier = 1 + getBoostRatio() * 1.8;

  clouds.forEach((cloud) => {
    cloud.x -= cloud.speed * boostMultiplier * delta;

    if (cloud.x + cloud.width < -20) {
      cloud.x = world.width + 40 + Math.random() * 160;
      cloud.y = 54 + Math.random() * 54;
    }
  });
}

function updateDroppedBlocks(delta) {
  for (let index = droppedBlocks.length - 1; index >= 0; index -= 1) {
    const block = droppedBlocks[index];

    block.x -= block.velocityX * delta;
    block.y += block.velocityY * delta;
    block.velocityY += 780 * delta;
    block.rotation += block.spin * delta;

    if (block.y > world.groundY - block.size) {
      block.y = world.groundY - block.size;
      block.velocityY *= -0.18;
      block.spin *= 0.72;
    }

    if (block.x < -40 || (block.y >= world.groundY - block.size && Math.abs(block.velocityY) < 6)) {
      droppedBlocks.splice(index, 1);
    }
  }
}

function updateCompletedStop(delta) {
  const truck = getTruckPosition();

  for (let index = delivery.completedStops.length - 1; index >= 0; index -= 1) {
    const stop = delivery.completedStops[index];
    const locationX = truck.x + (stop.distance - world.distance);

    stop.popupTimer = Math.max(0, stop.popupTimer - delta);

    if (locationX < -110) {
      delivery.completedStops.splice(index, 1);
    }
  }
}

function updateSpeedBumps() {
  const truck = getTruckPosition();

  speedBumps.forEach((bump) => {
    if (bump.triggered || world.distance < bump.distance) {
      return;
    }

    bump.triggered = true;
    world.slowTimer = world.slowDuration;
  });

  for (let index = speedBumps.length - 1; index >= 0; index -= 1) {
    const bumpX = truck.x + (speedBumps[index].distance - world.distance);

    if (bumpX < -120) {
      speedBumps.splice(index, 1);
    }
  }
}

function updateDelivery() {
  if (target.resolved) {
    return;
  }

  if (getTruckFrontDistance() >= target.distance) {
    resolveDelivery(world.elapsed - target.startTime <= target.timeLimit);
  }
}

function resolveDelivery(isOnTime) {
  target.resolved = true;

  if (visibleCargoCount < target.requiredCargo) {
    endSettlement("Cargo is not enough for this delivery.");
    updateStats();
    return;
  }

  visibleCargoCount -= target.requiredCargo;
  delivery.deliveredCargo += target.requiredCargo;

  if (isOnTime) {
    delivery.good += 1;
  } else {
    delivery.bad += 1;
  }

  delivery.completedStops.push({
    distance: target.distance,
    cargo: target.requiredCargo,
    result: isOnTime ? "good" : "bad",
    popupTimer: 1.2,
  });

  if (visibleCargoCount < target.requiredCargo) {
    endSettlement("Cargo is not enough for the next stop.");
    updateStats();
    return;
  }

  advanceTarget();
  updateStats();
}

function endSettlement(reason) {
  delivery.settlement = true;
  delivery.settlementReason = reason;
}

function advanceTarget() {
  const previousDistance = target.distance;
  const nextStation = target.station + 1;
  const nextSegmentDistance = getSegmentDistance(nextStation);

  target.station = nextStation;
  target.startDistance = previousDistance;
  target.distance = previousDistance + nextSegmentDistance;
  target.startTime = world.elapsed;
  target.timeLimit = route.timeLimit;
  target.requiredCargo = 5;
  target.resolved = false;
  addSpeedBump(target.startDistance, nextSegmentDistance);
}

function getSegmentDistance(station) {
  if (station === 1) {
    return route.baseSegmentDistance;
  }

  if (station === 2) {
    return 3860;
  }

  return 3910;
}

function addSpeedBump(startDistance, segmentDistance) {
  const bumpCount = Math.max(0, target.station - 1);

  for (let index = 0; index < bumpCount; index += 1) {
    const ratio = (index + 1) / (bumpCount + 1);

    speedBumps.push({
      distance: startDistance + segmentDistance * ratio,
      triggered: false,
    });
  }
}

function draw() {
  context.clearRect(0, 0, world.width, world.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, world.width, world.height);

  drawScore();
  drawMiniMap();
  drawNavigationChevrons();
  clouds.forEach(drawCloud);
  drawDeliveryLocation();
  drawGround();
  drawRoadTexture();
  drawSpeedBumps();

  const truck = getTruckPosition();
  drawTruck(truck.x, truck.y);
  drawDroppedBlocks();

  if (delivery.settlement) {
    drawSettlement();
  }
}

function getTruckPosition() {
  return {
    x: Math.min(178, world.width * 0.22),
    y: world.groundY - 58,
  };
}

function getTruckFrontDistance() {
  return world.distance + 245;
}

function drawScore() {
  context.fillStyle = "#575757";
  context.font = "bold 18px 'Courier New', monospace";
  context.textAlign = "right";
  context.textBaseline = "top";
  context.fillText(
    `DEL ${String(delivery.deliveredCargo).padStart(2, "0")}  👍${delivery.good} 👎${delivery.bad}`,
    world.width - 22,
    15,
  );
}

function drawMiniMap() {
  const remainingSeconds = Math.max(0, target.timeLimit - (world.elapsed - target.startTime));
  const segmentDistance = target.distance - target.startDistance;
  const segmentProgress = world.distance - target.startDistance;
  const progress = Math.min(Math.max(segmentProgress / segmentDistance, 0), 1);
  const distanceScale = Math.min(1, segmentDistance / 3910);
  const mapWidth = Math.min(world.width - 140, Math.round(300 + distanceScale * 240));
  const mapX = Math.max(88, Math.round((world.width - mapWidth) / 2));
  const mapY = 34;
  const endX = mapX + mapWidth;
  const truckX = mapX + mapWidth * progress;
  const expired = remainingSeconds <= 0 && !target.resolved;

  context.fillStyle = "#ffffff";
  context.fillRect(mapX - 10, mapY - 17, mapWidth + 20, 48);

  context.fillStyle = "#d6d6d6";
  context.fillRect(mapX, mapY + 12, mapWidth, 2);

  context.fillStyle = expired ? "#9a9a9a" : "#575757";
  context.fillRect(mapX, mapY + 12, Math.max(2, truckX - mapX), 2);

  drawMiniTruck(truckX - 8, mapY + 3);
  drawTargetMarker(endX, mapY);

  context.font = "bold 14px 'Courier New', monospace";
  context.textAlign = "center";
  context.textBaseline = "bottom";
  context.fillStyle = target.resolved ? "#575757" : "#7a7a7a";
  context.fillText(`${Math.ceil(remainingSeconds)}s`, endX, mapY - 3);

  context.font = "bold 11px 'Courier New', monospace";
  context.textAlign = "left";
  context.textBaseline = "top";
  context.fillStyle = "#8b8b8b";
  context.fillText(getTargetSpeedLabel(), mapX - 2, mapY + 20);
}

function getTargetSpeedLabel() {
  return "210";
}

function drawMiniTruck(x, y) {
  context.fillStyle = "#575757";
  context.fillRect(Math.round(x), Math.round(y + 6), 16, 7);
  context.fillRect(Math.round(x + 10), Math.round(y + 1), 7, 12);
  context.fillRect(Math.round(x + 2), Math.round(y + 13), 4, 4);
  context.fillRect(Math.round(x + 12), Math.round(y + 13), 4, 4);
}

function drawTargetMarker(x, y) {
  context.fillStyle = "#575757";
  context.fillRect(Math.round(x - 1), Math.round(y - 1), 2, 20);
  context.fillRect(Math.round(x + 2), Math.round(y - 1), 13, 8);
}

function drawDeliveryLocation() {
  delivery.completedStops.forEach((stop) => {
    drawDeliveryStop(stop, false);
  });
  drawDeliveryStop(target, true);
}

function drawDeliveryStop(stop, isActive) {
  const truck = getTruckPosition();
  const locationX = truck.x + (stop.distance - world.distance);

  if (locationX < -80 || locationX > world.width + 80) {
    return;
  }

  const baseY = world.groundY;

  drawDeliveryTriggerLine(locationX, baseY);

  context.fillStyle = "#575757";
  context.fillRect(Math.round(locationX - 18), baseY - 38, 4, 38);
  context.fillRect(Math.round(locationX - 14), baseY - 38, 34, 20);
  context.fillRect(Math.round(locationX - 6), baseY - 48, 18, 10);
  context.fillRect(Math.round(locationX - 24), baseY - 6, 58, 6);

  context.fillStyle = "#ffffff";
  context.fillRect(Math.round(locationX - 7), baseY - 33, 8, 8);
  context.fillRect(Math.round(locationX + 5), baseY - 33, 8, 8);

  context.fillStyle = "#575757";
  context.font = "bold 13px 'Courier New', monospace";
  context.textAlign = "center";
  context.textBaseline = "bottom";

  if (isActive) {
    context.fillText(`x${stop.requiredCargo}`, locationX, baseY - 52);
    return;
  }

  drawDeliveredCargo(stop, locationX, baseY);
  drawDeliveryPopup(stop, locationX, baseY);
}

function drawDeliveryTriggerLine(x, baseY) {
  context.save();
  context.strokeStyle = "rgba(87, 87, 87, 0.32)";
  context.lineWidth = 2;
  context.setLineDash([7, 6]);
  context.beginPath();
  context.moveTo(Math.round(x) + 0.5, Math.max(72, baseY - 122));
  context.lineTo(Math.round(x) + 0.5, baseY + 20);
  context.stroke();
  context.restore();
}

function drawDeliveredCargo(stop, x, baseY) {
  const boxSize = 13;
  const boxes = Array.from({ length: stop.cargo }, (_, index) => ({
    x: x - 18 + index * 14,
    y: baseY - boxSize,
  }));

  boxes.forEach((box) => {
    drawBox(box.x, box.y, boxSize);
  });
}

function drawDeliveryPopup(stop, x, baseY) {
  if (!stop || stop.popupTimer <= 0) {
    return;
  }

  const progress = stop.popupTimer / 1.2;
  const y = baseY - 72 - Math.round((1 - progress) * 12);

  context.save();
  context.globalAlpha = Math.min(1, progress * 1.35);
  context.font = "bold 28px 'Segoe UI Emoji', 'Apple Color Emoji', sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(stop.result === "good" ? "👍" : "👎", x + 4, y);
  context.restore();
}

function drawNavigationChevrons() {
  context.strokeStyle = "#8a8a8a";
  context.lineWidth = 2;

  context.beginPath();
  context.moveTo(17, world.height * 0.43 - 16);
  context.lineTo(5, world.height * 0.43);
  context.lineTo(17, world.height * 0.43 + 16);
  context.stroke();

  context.beginPath();
  context.moveTo(world.width - 17, world.height * 0.43 - 16);
  context.lineTo(world.width - 5, world.height * 0.43);
  context.lineTo(world.width - 17, world.height * 0.43 + 16);
  context.stroke();
}

function drawCloud(cloud) {
  const x = Math.round(cloud.x);
  const y = Math.round(cloud.y);
  const unit = Math.max(2, Math.round(cloud.width / 40));

  context.strokeStyle = "#d6d6d6";
  context.lineWidth = unit;
  context.beginPath();
  context.moveTo(x, y + 20);
  context.lineTo(x + 6 * unit, y + 20);
  context.lineTo(x + 6 * unit, y + 16);
  context.lineTo(x + 12 * unit, y + 16);
  context.lineTo(x + 12 * unit, y + 10);
  context.lineTo(x + 19 * unit, y + 10);
  context.lineTo(x + 19 * unit, y + 5);
  context.lineTo(x + 27 * unit, y + 5);
  context.lineTo(x + 27 * unit, y + 9);
  context.lineTo(x + 35 * unit, y + 9);
  context.lineTo(x + 35 * unit, y + 14);
  context.lineTo(x + 43 * unit, y + 14);
  context.lineTo(x + 43 * unit, y + 20);
  context.lineTo(x + 52 * unit, y + 20);
  context.stroke();
}

function drawGround() {
  context.fillStyle = "#575757";
  context.fillRect(0, world.groundY, world.width, 2);
}

function drawRoadTexture() {
  const spacing = 24;
  const totalWidth = rocks.length * spacing;
  const offset = world.distance % spacing;

  rocks.forEach((rock) => {
    let x = rock.x - offset;

    while (x < -12) {
      x += totalWidth;
    }

    if (x > world.width + 12) {
      return;
    }

    context.fillStyle = "#575757";
    context.fillRect(
      Math.round(x),
      Math.round(world.groundY + rock.depth),
      Math.round(rock.width),
      2,
    );
  });
}

function drawSpeedBumps() {
  const truck = getTruckPosition();

  speedBumps.forEach((bump) => {
    const x = truck.x + (bump.distance - world.distance);

    if (x < -90 || x > world.width + 90) {
      return;
    }

    const baseY = world.groundY;
    context.fillStyle = "#575757";
    context.fillRect(Math.round(x - 34), baseY - 4, 68, 4);
    context.fillRect(Math.round(x - 28), baseY - 10, 12, 6);
    context.fillRect(Math.round(x - 6), baseY - 10, 12, 6);
    context.fillRect(Math.round(x + 16), baseY - 10, 12, 6);

    if (bump.triggered) {
      context.fillStyle = "#8b8b8b";
      context.fillRect(Math.round(x - 34), baseY - 4, 68, 2);
    }
  });
}

function drawTruck(x, y) {
  const bounce = Math.round(Math.sin(world.distance / 18) * 1.4);
  const boostProgress = getBoostRatio();
  const boostPush = Math.round(Math.sin(boostProgress * Math.PI) * 10);
  const wheelTurn = Math.floor(world.distance / 16) % 2;
  const truckX = x + boostPush;
  const truckY = y + bounce;

  drawBoostLines(truckX, truckY, boostProgress);
  drawTruckBody(truckX, truckY);
  drawCargoStack(truckX + 28, truckY);
  drawCargoRails(truckX + 18, truckY);
  drawWheels(truckX, truckY, wheelTurn);
}

function drawBoostLines(x, y, boostProgress) {
  if (boostProgress <= 0) {
    return;
  }

  const alpha = Math.min(0.9, boostProgress);
  const stretch = Math.round(18 * boostProgress);
  context.fillStyle = `rgba(87, 87, 87, ${alpha})`;
  context.fillRect(Math.round(x - 46 - stretch), Math.round(y + 23), 24 + stretch, 3);
  context.fillRect(Math.round(x - 68 - stretch), Math.round(y + 36), 34 + stretch, 3);
  context.fillRect(Math.round(x - 38 - stretch), Math.round(y + 49), 18 + stretch, 3);
}

function drawCargoRails(x, y) {
  context.fillStyle = "#575757";
  context.fillRect(x, y + 34, 178, 7);
  context.fillRect(x, y + 8, 5, 33);
  context.fillRect(x + 173, y + 20, 5, 21);
}

function drawCargoStack(x, y) {
  cargoBlocks.slice(0, visibleCargoCount).forEach((block) => {
    drawBox(x + block.x, y + block.y, block.size);
  });
}

function drawTruckBody(x, y) {
  context.fillStyle = "#575757";
  context.fillRect(x + 18, y + 39, 214, 14);
  context.fillRect(x + 191, y + 18, 42, 35);
  context.fillRect(x + 202, y + 7, 24, 14);
  context.fillRect(x + 231, y + 34, 14, 12);

  context.fillStyle = "#ffffff";
  context.fillRect(x + 207, y + 12, 12, 8);
  context.fillRect(x + 212, y + 28, 15, 7);

  context.fillStyle = "#575757";
  context.fillRect(x + 189, y + 24, 8, 8);
  context.fillRect(x + 20, y + 54, 35, 5);
  context.fillRect(x + 183, y + 54, 34, 5);
  context.fillRect(x + 239, y + 45, 7, 8);
}

function drawWheels(x, y, wheelTurn) {
  drawWheel(x + 43, y + 58, wheelTurn);
  drawWheel(x + 207, y + 58, wheelTurn);
}

function drawWheel(x, y, turn) {
  context.fillStyle = "#575757";
  context.fillRect(x - 10, y - 10, 20, 20);
  context.fillStyle = "#ffffff";
  context.fillRect(x - 5, y - 5, 10, 10);
  context.fillStyle = "#575757";

  if (turn === 0) {
    context.fillRect(x - 8, y - 1, 16, 2);
    context.fillRect(x - 1, y - 8, 2, 16);
  } else {
    context.fillRect(x - 6, y - 6, 12, 2);
    context.fillRect(x - 6, y + 4, 12, 2);
    context.fillRect(x - 6, y - 6, 2, 12);
    context.fillRect(x + 4, y - 6, 2, 12);
  }
}

function drawBox(x, y, size) {
  const left = Math.round(x);
  const top = Math.round(y);

  context.fillStyle = "#ffffff";
  context.fillRect(left, top, size, size);
  context.fillStyle = "#575757";
  context.fillRect(left, top, size, 2);
  context.fillRect(left, top + size - 2, size, 2);
  context.fillRect(left, top, 2, size);
  context.fillRect(left + size - 2, top, 2, size);
  context.fillRect(left + Math.floor(size / 2) - 1, top + 2, 2, size - 4);
  context.fillRect(left + 2, top + Math.floor(size / 2) - 1, size - 4, 2);
}

function drawDroppedBlocks() {
  droppedBlocks.forEach((block) => {
    context.save();
    context.translate(Math.round(block.x + block.size / 2), Math.round(block.y + block.size / 2));
    context.rotate(block.rotation);
    drawBox(-block.size / 2, -block.size / 2, block.size);
    context.restore();
  });
}

function drawSettlement() {
  const panelWidth = Math.min(460, world.width - 40);
  const panelX = (world.width - panelWidth) / 2;
  const panelY = Math.max(78, world.height * 0.25);
  const panelHeight = 172;

  context.fillStyle = "rgba(255, 255, 255, 0.92)";
  context.fillRect(panelX, panelY, panelWidth, panelHeight);
  context.strokeStyle = "#575757";
  context.lineWidth = 2;
  context.strokeRect(panelX, panelY, panelWidth, panelHeight);

  context.fillStyle = "#575757";
  context.fillRect(panelX, panelY, panelWidth, 8);
  context.fillRect(panelX + 18, panelY + 48, panelWidth - 36, 2);
  context.fillRect(panelX + 18, panelY + 128, panelWidth - 36, 2);

  context.fillStyle = "#575757";
  context.textAlign = "center";
  context.textBaseline = "top";
  context.font = "bold 22px 'Courier New', monospace";
  context.fillText("DELIVERY REPORT", world.width / 2, panelY + 18);

  context.font = "bold 12px 'Courier New', monospace";
  context.fillStyle = "#8b8b8b";
  context.fillText(getSettlementSummary(), world.width / 2, panelY + 56);

  drawReportStat(panelX + 42, panelY + 82, "CARGO SENT", String(delivery.deliveredCargo));
  drawReportStat(panelX + panelWidth / 2 - 38, panelY + 82, "PRAISE", String(delivery.good));
  drawReportStat(panelX + panelWidth - 118, panelY + 82, "BLAME", String(delivery.bad));

  context.fillStyle = "#575757";
  context.font = "bold 13px 'Courier New', monospace";
  context.textAlign = "center";
  context.fillText("Route closed. Trade-offs recorded.", world.width / 2, panelY + 140);
}

function drawReportStat(x, y, label, value) {
  context.fillStyle = "#f7f7f7";
  context.fillRect(x, y, 76, 34);
  context.strokeStyle = "#d6d6d6";
  context.lineWidth = 2;
  context.strokeRect(x, y, 76, 34);

  context.fillStyle = "#8b8b8b";
  context.font = "bold 9px 'Courier New', monospace";
  context.textAlign = "center";
  context.textBaseline = "top";
  context.fillText(label, x + 38, y + 5);

  context.fillStyle = "#575757";
  context.font = "bold 17px 'Courier New', monospace";
  context.fillText(value, x + 38, y + 17);
}

function getSettlementSummary() {
  if (delivery.settlementReason.includes("next stop")) {
    return "Cargo is below the next stop requirement.";
  }

  return "Cargo ran out before this delivery could be made.";
}

function discardCargo() {
  if (visibleCargoCount <= 0 || delivery.settlement) {
    return;
  }

  const removedBlock = cargoBlocks[visibleCargoCount - 1];
  const truck = getTruckPosition();
  const cargoX = truck.x + 28;
  const cargoY = truck.y + Math.round(Math.sin(world.distance / 18) * 1.4);

  visibleCargoCount -= 1;
  world.boostTimer = world.boostDuration;
  droppedBlocks.push({
    x: cargoX + removedBlock.x,
    y: cargoY + removedBlock.y,
    size: removedBlock.size,
    velocityX: world.speed * 0.82,
    velocityY: -35,
    rotation: 0,
    spin: visibleCargoCount % 2 === 0 ? 3 : -3,
  });

  updateStats();
}

function updateStats() {
  cargoCountElement.textContent = visibleCargoCount;
  updateSpeedReadout();
  discardButton.disabled = visibleCargoCount === 0 || delivery.settlement;
}

function getCurrentSpeed() {
  return Math.max(80, world.speed + world.boostSpeed * getBoostRatio() - world.slowSpeed * getSlowRatio());
}

function updateSpeedReadout() {
  speedValueElement.textContent = Math.round(world.speed);

  const boostSpeed = Math.round(world.boostSpeed * getBoostRatio());
  const slowSpeed = Math.round(world.slowSpeed * getSlowRatio());

  if (boostSpeed > 0) {
    boostValueElement.textContent = `+${boostSpeed} boost`;
    boostValueElement.className = "is-boost";
    boostValueElement.style.transform = `scale(${1 + getBoostRatio() * 0.55})`;
    return;
  }

  if (slowSpeed > 0) {
    boostValueElement.textContent = `-${slowSpeed} slow`;
    boostValueElement.className = "is-slow";
    boostValueElement.style.transform = `scale(${1 + getSlowRatio() * 0.55})`;
    return;
  }

  boostValueElement.textContent = "+0 boost";
  boostValueElement.className = "";
  boostValueElement.style.transform = "scale(1)";
}

function getBoostRatio() {
  return Math.min(Math.max(world.boostTimer / world.boostDuration, 0), 1);
}

function getSlowRatio() {
  return Math.min(Math.max(world.slowTimer / world.slowDuration, 0), 1);
}

function createCargoBlocks() {
  const rows = [12, 11, 10, 8, 6, 3];
  const blockSize = 12;
  const gap = 2;
  const widestRow = Math.max(...rows);

  return rows.flatMap((count, rowIndex) => {
    const rowWidth = count * blockSize + (count - 1) * gap;
    const inset = Math.round((widestRow * blockSize + (widestRow - 1) * gap - rowWidth) / 2);
    const y = 18 - rowIndex * (blockSize + gap);

    return Array.from({ length: count }, (_, index) => ({
      x: inset + index * (blockSize + gap),
      y,
      size: blockSize,
    }));
  });
}

window.addEventListener("resize", setupCanvas);
document.addEventListener("keydown", (event) => {
  if (event.code !== "Space" && event.code !== "KeyD") {
    return;
  }

  event.preventDefault();
  discardCargo();
});

discardButton.addEventListener("click", discardCargo);
setupCanvas();
addSpeedBump(target.startDistance, getSegmentDistance(target.station));
updateStats();
window.requestAnimationFrame(animate);
