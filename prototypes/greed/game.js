const canvas = document.querySelector("#game-board");
const context = canvas.getContext("2d");
const scoreElement = document.querySelector("#score");
const timeLeftElement = document.querySelector("#time-left");
const timeBarElement = document.querySelector("#time-bar");
const starValueElement = document.querySelector("#star-value");
const riskChainElement = document.querySelector("#risk-chain");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlay-title");
const overlayText = document.querySelector("#overlay-text");
const restartButton = document.querySelector("#restart-button");

const arena = {
  width: canvas.width,
  height: canvas.height,
};

const tile = {
  width: 232,
  height: 116,
  depth: 34,
};

const player = {
  bob: 0,
};

const relativeCells = [
  { key: "left", gridX: -1, gridY: -1, label: "Left" },
  { key: "right", gridX: 0, gridY: -1, label: "Right" },
  { key: "super", gridX: 1, gridY: -1, label: "Super" },
  { key: "current", gridX: 0, gridY: 0, label: "You" },
];

const optionSides = ["left", "right"];
const gameDuration = 30;
const superStarChance = 0.28;

let score = 0;
let starRiskChain = 0;
let starCount = 0;
let step = 0;
let timeLeft = gameDuration;
let mustOfferStar = false;
let mustOfferSuperStar = false;
let gameState = "playing";
let options = [];
let pointer = { x: 0, y: 0, active: false };
let transition = null;
let cameraReturn = null;
let lastFrameTime = performance.now();

resetGame();
window.requestAnimationFrame(loop);

function resetGame() {
  score = 0;
  starRiskChain = 0;
  starCount = 0;
  step = 0;
  timeLeft = gameDuration;
  mustOfferStar = false;
  mustOfferSuperStar = false;
  gameState = "playing";
  transition = null;
  cameraReturn = null;
  overlay.hidden = true;
  generateOptions();
  updateStats();
  draw();
}

function loop(timestamp) {
  const deltaTime = Math.min((timestamp - lastFrameTime) / 1000, 0.04);
  lastFrameTime = timestamp;
  player.bob += deltaTime * 4;
  updateTimer(deltaTime);
  updateTransition(deltaTime);
  updateCameraReturn(deltaTime);
  draw();
  window.requestAnimationFrame(loop);
}

function updateTimer(deltaTime) {
  if (gameState !== "playing" && gameState !== "moving") {
    return;
  }

  timeLeft = Math.max(0, timeLeft - deltaTime);
  updateStats();

  if (timeLeft === 0) {
    finishByTime();
  }
}

function generateOptions() {
  const starSide = optionSides[Math.floor(Math.random() * optionSides.length)];
  const shouldOfferRandomStar = Math.random() < 0.34;
  const shouldOfferStar = mustOfferStar || shouldOfferRandomStar;
  const forceSuperStar = mustOfferSuperStar;
  const shouldOfferSuperStar =
    shouldOfferStar && (forceSuperStar || (getNextStarGameOverChance() >= 64 && Math.random() < superStarChance));

  if (shouldOfferSuperStar) {
    const normalStarSide = "right";
    options = [
      {
        side: "left",
        kind: "diamond",
      },
      {
        side: normalStarSide,
        kind: "star",
      },
      {
        side: "super",
        kind: "superstar",
      },
    ];

    if (forceSuperStar) {
      mustOfferSuperStar = false;
    }

    return;
  }

  options = optionSides.map((side) => ({
    side,
    kind: shouldOfferStar && side === starSide ? "star" : "diamond",
  }));
}

function chooseOption(side) {
  if (gameState !== "playing") {
    return;
  }

  const option = options.find((item) => item.side === side);

  if (!option) {
    return;
  }

  transition = {
    side,
    option,
    elapsed: 0,
    duration: 0.32,
  };
  gameState = "moving";
}

function resolveChoice(option) {
  step += 1;

  if (option.kind === "diamond") {
    score += 1;
    starRiskChain = 0;
    mustOfferStar = starCount > 0;
  } else if (option.kind === "star") {
    const chance = getNextStarGameOverChance();

    if (starRiskChain >= 2 && Math.random() < chance / 100) {
      endGame(chance);
      updateStats();
      return;
    }

    starRiskChain += 1;
    starCount += 1;
    score += getStarValue(starRiskChain);
    mustOfferStar = true;

    if (getNextStarGameOverChance() >= 64) {
      mustOfferSuperStar = true;
    }
  } else if (option.kind === "superstar") {
    if (Math.random() < 0.9) {
      endGame(90);
      updateStats();
      return;
    }

    score *= 10;
    mustOfferStar = true;
    mustOfferSuperStar = false;
  }

  generateOptions();
  updateStats();
  gameState = "playing";
}

function updateTransition(deltaTime) {
  if (!transition) {
    return;
  }

  transition.elapsed += deltaTime;

  if (transition.elapsed < transition.duration) {
    return;
  }

  const option = transition.option;
  const cameraOffset = getTransitionCameraOffset();
  cameraReturn = {
    x: cameraOffset.x,
    y: cameraOffset.y,
    elapsed: 0,
    duration: 0.24,
  };
  transition = null;
  resolveChoice(option);
}

function updateCameraReturn(deltaTime) {
  if (!cameraReturn) {
    return;
  }

  cameraReturn.elapsed += deltaTime;

  if (cameraReturn.elapsed >= cameraReturn.duration) {
    cameraReturn = null;
  }
}

function endGame(chance) {
  gameState = "gameover";
  overlayTitle.textContent = "Game Over";
  overlayText.textContent = `You took ${starCount} stars and hit a ${chance}% GameOver risk. Final score: ${score}.`;
  overlay.hidden = false;
}

function finishByTime() {
  transition = null;
  gameState = "finished";
  overlayTitle.textContent = "Time Up";
  overlayText.textContent = `30 seconds are over. Final score: ${score}.`;
  updateStats();
  overlay.hidden = false;
}

function draw() {
  context.clearRect(0, 0, arena.width, arena.height);
  drawBackground();

  const camera = {
    x: arena.width / 2,
    y: arena.height / 2,
  };
  const cameraOffset = getCameraOffset();
  camera.x += cameraOffset.x;
  camera.y += cameraOffset.y;
  const boardOffset = getBoardOffset();

  drawBoard(camera, boardOffset);
  drawItems(camera, boardOffset);
  drawForwardStreaks(boardOffset);
  drawPlayer(camera);
  drawCenterMark();
}

function getCameraOffset() {
  if (transition) {
    return getTransitionCameraOffset();
  }

  if (cameraReturn) {
    const progress = easeOutCubic(cameraReturn.elapsed / cameraReturn.duration);
    return {
      x: cameraReturn.x * (1 - progress),
      y: cameraReturn.y * (1 - progress),
    };
  }

  return { x: 0, y: 0 };
}

function getTransitionCameraOffset() {
  const progress = transition ? easeOutCubic(transition.elapsed / transition.duration) : 1;
  const cell = relativeCells.find((item) => item.key === transition.side);
  const world = gridToWorld(cell.gridX, cell.gridY);
  const followStrength = 0.34;

  return {
    x: world.x * followStrength * progress,
    y: world.y * followStrength * progress,
  };
}

function getBoardOffset() {
  if (!transition) {
    return { x: 0, y: 0, progress: 1 };
  }

  const progress = easeOutCubic(transition.elapsed / transition.duration);
  const cell = relativeCells.find((item) => item.key === transition.side);
  const world = gridToWorld(cell.gridX, cell.gridY);

  return {
    x: -world.x * progress,
    y: -world.y * progress,
    progress,
  };
}

function drawBackground() {
  const gradient = context.createLinearGradient(0, 0, arena.width, arena.height);
  gradient.addColorStop(0, "#19130c");
  gradient.addColorStop(0.58, "#1f1b14");
  gradient.addColorStop(1, "#0d0b09");
  context.fillStyle = gradient;
  context.fillRect(0, 0, arena.width, arena.height);

  context.strokeStyle = "rgba(255, 247, 232, 0.04)";
  context.lineWidth = 1;

  for (let index = -arena.height; index < arena.width; index += 42) {
    context.beginPath();
    context.moveTo(index, arena.height);
    context.lineTo(index + arena.height, 0);
    context.stroke();
  }
}

function drawBoard(camera, boardOffset) {
  const visibleKeys = new Set(["current", ...options.map((option) => option.side)]);
  const cells = relativeCells
    .filter((cell) => visibleKeys.has(cell.key))
    .map((cell) => ({ ...cell, world: gridToWorld(cell.gridX, cell.gridY) }))
    .sort((a, b) => a.world.y - b.world.y);

  cells.forEach((cell) => drawTile(cell, camera, boardOffset));
}

function drawTile(cell, camera, boardOffset) {
  const world = gridToWorld(cell.gridX, cell.gridY);
  const isDroppingCurrent = transition && cell.key === "current";
  const dropProgress = isDroppingCurrent ? easeInCubic(boardOffset.progress) : 0;
  const tileOffset = isDroppingCurrent ? { x: 0, y: dropProgress * 180 } : boardOffset;
  const x = world.x + camera.x + tileOffset.x;
  const y = world.y + camera.y + tileOffset.y;
  const isOption = optionSides.includes(cell.key);
  const isHover =
    pointer.active && gameState === "playing" && isOption && isPointInDiamond(pointer.x, pointer.y, x, y);
  const halfWidth = tile.width / 2;
  const halfHeight = tile.height / 2;
  const lift = isHover && isOption && gameState === "playing" ? 10 : 0;
  const topY = y - lift;

  context.save();
  context.globalAlpha = isDroppingCurrent ? 1 - dropProgress * 0.82 : 1;
  context.fillStyle = cell.key === "current" ? "#647f50" : "#4d6848";
  drawDiamond(x, topY, halfWidth, halfHeight);
  context.fill();

  context.strokeStyle = getTileStroke(cell, isHover);
  context.lineWidth = cell.key === "current" || isHover ? 4 : 2;
  context.stroke();

  context.fillStyle = "#3d3328";
  context.beginPath();
  context.moveTo(x - halfWidth, topY);
  context.lineTo(x, topY + halfHeight);
  context.lineTo(x, topY + halfHeight + tile.depth);
  context.lineTo(x - halfWidth, topY + tile.depth);
  context.closePath();
  context.fill();

  context.fillStyle = "#2d2821";
  context.beginPath();
  context.moveTo(x + halfWidth, topY);
  context.lineTo(x, topY + halfHeight);
  context.lineTo(x, topY + halfHeight + tile.depth);
  context.lineTo(x + halfWidth, topY + tile.depth);
  context.closePath();
  context.fill();
  context.restore();
}

function getTileStroke(cell, isHover) {
  if (isHover && optionSides.includes(cell.key)) {
    return "#fff7e8";
  }

  if (cell.key === "current") {
    return "#f2b84b";
  }

  return "rgba(255, 247, 232, 0.32)";
}

function drawItems(camera, boardOffset) {
  options.forEach((option) => {
    const cell = relativeCells.find((item) => item.key === option.side);
    const world = gridToWorld(cell.gridX, cell.gridY);
    const x = world.x + camera.x + boardOffset.x;
    const y =
      world.y + camera.y + boardOffset.y - 48 + Math.sin(player.bob + (option.side === "left" ? 0 : 1)) * 5;
    drawKeyHint(x, world.y + camera.y + boardOffset.y + 19, option.side);

    if (option.kind === "superstar") {
      drawSuperStarItem(x, y, getStarScale() * 1.08);
      drawRiskLabel(x, y - 48, 90);
      return;
    }

    if (option.kind === "star") {
      drawStarItem(x, y, getStarScale());
      drawRiskLabel(x, y - 44, getNextStarGameOverChance());
      return;
    }

    drawDiamondItem(x, y);
  });
}

function drawDiamondItem(x, y) {
  context.save();
  context.translate(x, y);
  context.fillStyle = "#70d6ff";
  context.strokeStyle = "#fff7e8";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(0, -24);
  context.lineTo(22, 0);
  context.lineTo(0, 24);
  context.lineTo(-22, 0);
  context.closePath();
  context.fill();
  context.stroke();
  drawItemText("+1", 0, 46, "#fff7e8");
  context.restore();
}

function drawKeyHint(x, y, side) {
  const labels = {
    left: "←",
    right: "→",
    super: "↑",
  };
  const label = labels[side];

  if (!label) {
    return;
  }

  context.save();
  context.fillStyle = "rgba(255, 247, 232, 0.22)";
  context.strokeStyle = "rgba(16, 14, 11, 0.28)";
  context.lineWidth = 4;
  context.font = "900 46px Inter, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.strokeText(label, x, y);
  context.fillText(label, x, y);
  context.restore();
}

function drawStarItem(x, y, scale) {
  const outerRadius = 25 * scale;
  const innerRadius = 11 * scale;

  context.save();
  context.translate(x, y);
  context.rotate(Math.sin(player.bob) * 0.12);
  context.fillStyle = "#f2b84b";
  context.strokeStyle = "#fff7e8";
  context.lineWidth = 3;
  context.beginPath();

  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = (Math.PI * 2 * index) / 10 - Math.PI / 2;
    const pointX = Math.cos(angle) * radius;
    const pointY = Math.sin(angle) * radius;

    if (index === 0) {
      context.moveTo(pointX, pointY);
    } else {
      context.lineTo(pointX, pointY);
    }
  }

  context.closePath();
  context.fill();
  context.stroke();
  context.rotate(-Math.sin(player.bob) * 0.12);
  drawItemText(`+${getStarValue(starRiskChain + 1)}`, 0, 34 + outerRadius, "#fff7e8");
  context.restore();
}

function drawSuperStarItem(x, y, scale) {
  const outerRadius = 28 * scale;
  const innerRadius = 12 * scale;
  const glowRadius = 52 * scale;

  context.save();
  context.translate(x, y);

  const glow = context.createRadialGradient(0, 0, outerRadius * 0.4, 0, 0, glowRadius);
  glow.addColorStop(0, "rgba(255, 246, 176, 0.92)");
  glow.addColorStop(0.42, "rgba(242, 184, 75, 0.34)");
  glow.addColorStop(1, "rgba(242, 184, 75, 0)");
  context.fillStyle = glow;
  context.beginPath();
  context.arc(0, 0, glowRadius, 0, Math.PI * 2);
  context.fill();

  context.rotate(player.bob * 0.55);
  context.fillStyle = "#fff176";
  context.strokeStyle = "#ffffff";
  context.lineWidth = 4;
  context.beginPath();

  for (let index = 0; index < 10; index += 1) {
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    const angle = (Math.PI * 2 * index) / 10 - Math.PI / 2;
    const pointX = Math.cos(angle) * radius;
    const pointY = Math.sin(angle) * radius;

    if (index === 0) {
      context.moveTo(pointX, pointY);
    } else {
      context.lineTo(pointX, pointY);
    }
  }

  context.closePath();
  context.fill();
  context.stroke();
  context.rotate(-player.bob * 0.55);
  drawItemText("x10", 0, 40 + outerRadius, "#fff7e8");
  context.restore();
}

function drawRiskLabel(x, y, chance) {
  context.save();
  context.translate(x, y);
  context.fillStyle = "rgba(16, 14, 11, 0.78)";
  context.strokeStyle = chance === 0 ? "rgba(255, 247, 232, 0.34)" : "#dc5f48";
  context.lineWidth = 2;
  roundRect(-76, -18, 152, 32, 8);
  context.fill();
  context.stroke();
  drawItemText(`${chance}% GameOver`, 0, 5, chance === 0 ? "#fff7e8" : "#ffd2c9", 18);
  context.restore();
}

function drawItemText(text, x, y, color, fontSize = 22) {
  context.fillStyle = color;
  context.font = `900 ${fontSize}px Inter, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, x, y);
}

function drawPlayer(camera) {
  const x = camera.x;
  const baseY = camera.y;
  const radius = 25;
  const y = baseY - 36 + Math.sin(player.bob) * 4;

  context.fillStyle = "rgba(0, 0, 0, 0.3)";
  context.beginPath();
  context.ellipse(x, baseY + 18, 28, 11, 0, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#dc5f48";
  context.strokeStyle = "#fff7e8";
  context.lineWidth = 4;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  context.fillStyle = "#fff7e8";
  context.beginPath();
  context.arc(x + radius * 0.32, y - radius * 0.28, Math.max(4, radius * 0.15), 0, Math.PI * 2);
  context.fill();
}

function drawForwardStreaks(boardOffset) {
  if (!transition) {
    return;
  }

  const alpha = Math.sin(boardOffset.progress * Math.PI) * 0.32;
  const direction = transition.side === "left" ? -1 : 1;

  context.save();
  context.strokeStyle = `rgba(255, 247, 232, ${alpha})`;
  context.lineWidth = 3;
  context.lineCap = "round";

  for (let index = 0; index < 5; index += 1) {
    const y = arena.height / 2 + 92 + index * 20;
    const x = arena.width / 2 - direction * (92 + index * 22);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x - direction * 58, y + 18);
    context.stroke();
  }

  context.restore();
}

function drawCenterMark() {
  context.strokeStyle = "rgba(255, 247, 232, 0.16)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(arena.width / 2 - 14, arena.height / 2);
  context.lineTo(arena.width / 2 + 14, arena.height / 2);
  context.moveTo(arena.width / 2, arena.height / 2 - 14);
  context.lineTo(arena.width / 2, arena.height / 2 + 14);
  context.stroke();
}

function drawDiamond(x, y, halfWidth, halfHeight) {
  context.beginPath();
  context.moveTo(x, y - halfHeight);
  context.lineTo(x + halfWidth, y);
  context.lineTo(x, y + halfHeight);
  context.lineTo(x - halfWidth, y);
  context.closePath();
}

function roundRect(x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function gridToWorld(gridX, gridY) {
  return {
    x: (gridX - gridY) * (tile.width / 2),
    y: (gridX + gridY) * (tile.height / 2),
  };
}

function getClickedSide(clientX, clientY) {
  if (gameState !== "playing") {
    return null;
  }

  const rect = canvas.getBoundingClientRect();
  const scaleX = arena.width / rect.width;
  const scaleY = arena.height / rect.height;
  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;

  return options.find((option) => {
    const cell = relativeCells.find((item) => item.key === option.side);
    const world = gridToWorld(cell.gridX, cell.gridY);
    return isPointInDiamond(x, y, world.x + arena.width / 2, world.y + arena.height / 2);
  })?.side;
}

function updatePointer(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = (clientX - rect.left) * (arena.width / rect.width);
  pointer.y = (clientY - rect.top) * (arena.height / rect.height);
  pointer.active = true;
}

function isPointInDiamond(pointX, pointY, centerX, centerY) {
  return Math.abs(pointX - centerX) / (tile.width / 2) + Math.abs(pointY - centerY) / (tile.height / 2) <= 1;
}

function getStarValue(count) {
  return 2 ** Math.max(0, count - 1);
}

function getNextStarGameOverChance() {
  if (starRiskChain === 0) {
    return 0;
  }

  if (starRiskChain <= 6) {
    return 2 ** starRiskChain;
  }

  return Math.min(100, 64 + (starRiskChain - 6) * 5);
}

function getStarScale() {
  return 1 + Math.min(starRiskChain, 8) * 0.16;
}

function easeOutCubic(value) {
  const clamped = Math.max(0, Math.min(value, 1));
  return 1 - (1 - clamped) ** 3;
}

function easeInCubic(value) {
  const clamped = Math.max(0, Math.min(value, 1));
  return clamped ** 3;
}

function updateStats() {
  scoreElement.textContent = score;
  timeLeftElement.textContent = timeLeft.toFixed(1);
  timeBarElement.style.transform = `scaleX(${Math.max(0, timeLeft / gameDuration)})`;
  starValueElement.textContent = getStarValue(starRiskChain + 1);
  riskChainElement.textContent = starRiskChain;
}

canvas.addEventListener("pointermove", (event) => {
  updatePointer(event.clientX, event.clientY);
});

canvas.addEventListener("pointerleave", () => {
  pointer.active = false;
});

canvas.addEventListener("click", (event) => {
  const side = getClickedSide(event.clientX, event.clientY);

  if (side) {
    chooseOption(side);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.code === "Enter" && gameState !== "playing" && gameState !== "moving") {
    event.preventDefault();
    resetGame();
    return;
  }

  if (event.code === "ArrowLeft" || event.code === "KeyA") {
    event.preventDefault();
    chooseOption("left");
  }

  if (event.code === "ArrowRight" || event.code === "KeyD") {
    event.preventDefault();
    chooseOption("right");
  }

  if (event.code === "ArrowUp" || event.code === "KeyW") {
    event.preventDefault();
    chooseOption("super");
  }
});

restartButton.addEventListener("click", resetGame);
