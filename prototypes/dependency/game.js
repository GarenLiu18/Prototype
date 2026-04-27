const canvas = document.querySelector("#game-board");
const context = canvas.getContext("2d");
const timeElement = document.querySelector("#survival-time");
const killsElement = document.querySelector("#kills");
const dependencyStateElement = document.querySelector("#dependency-state");
const dropRateElement = document.querySelector("#drop-rate");
const overlay = document.querySelector("#overlay");
const overlayTitle = document.querySelector("#overlay-title");
const overlayText = document.querySelector("#overlay-text");
const startButton = document.querySelector("#start-button");
const pauseButton = document.querySelector("#pause-button");
const restartButton = document.querySelector("#restart-button");

const arena = {
  width: canvas.width,
  height: canvas.height,
};

const playerStart = {
  x: arena.width / 2,
  y: arena.height / 2,
  radius: 14,
  speed: 245,
};

const inputMap = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};

const heldDirections = new Set();
const bullets = [];
const enemies = [];
const stars = [];
const sparks = [];

const starBuffDuration = 7;
const baseShotInterval = 0.22;
const empoweredShotInterval = 0.08;
const bulletSpeed = 347;
const empoweredBulletSpeed = 413;
const minWindowScale = 0.38;

let player;
let kills;
let killsSinceLastStar;
let elapsedSeconds;
let buffTimer;
let withdrawalSeconds;
let windowShrinkSeconds;
let hasConsumedStar;
let spawnTimer;
let shotTimer;
let animationFrame = null;
let lastFrameTime = 0;
let gameState = "ready";

resetGame();

function resetGame() {
  player = { ...playerStart };
  bullets.length = 0;
  enemies.length = 0;
  stars.length = 0;
  sparks.length = 0;
  kills = 0;
  killsSinceLastStar = 0;
  elapsedSeconds = 0;
  buffTimer = 0;
  withdrawalSeconds = 0;
  windowShrinkSeconds = 0;
  hasConsumedStar = false;
  spawnTimer = 0;
  shotTimer = 0;
  lastFrameTime = 0;
  updateStats();
  setState("ready");
  draw();
  showOverlay("Dependency", "Stars make you powerful. The absence after them makes you weaker.");
}

function startGame() {
  if (gameState === "running") {
    return;
  }

  if (gameState === "gameover") {
    resetGame();
  }

  setState("running");
  hideOverlay();
  lastFrameTime = performance.now();
  animationFrame = window.requestAnimationFrame(loop);
}

function pauseGame() {
  if (gameState !== "running") {
    return;
  }

  window.cancelAnimationFrame(animationFrame);
  animationFrame = null;
  setState("paused");
  showOverlay("Paused", "Press Space or Start to continue.");
}

function restartGame() {
  window.cancelAnimationFrame(animationFrame);
  animationFrame = null;
  resetGame();
}

function loop(timestamp) {
  const deltaTime = Math.min((timestamp - lastFrameTime) / 1000, 0.035);
  lastFrameTime = timestamp;

  update(deltaTime);
  draw();

  if (gameState === "running") {
    animationFrame = window.requestAnimationFrame(loop);
  }
}

function update(deltaTime) {
  elapsedSeconds += deltaTime;
  updateDependency(deltaTime);
  spawnTimer -= deltaTime;
  shotTimer -= deltaTime;

  movePlayer(deltaTime);
  spawnEnemies();
  updateEnemies(deltaTime);
  fireWeapon();
  updateBullets(deltaTime);
  collectStars(deltaTime);
  updateSparks(deltaTime);
  checkPlayerCollision();
  updateStats();
}

function updateDependency(deltaTime) {
  if (buffTimer > 0) {
    buffTimer = Math.max(0, buffTimer - deltaTime);
    return;
  }

  if (hasConsumedStar) {
    withdrawalSeconds += deltaTime;
    windowShrinkSeconds += deltaTime;
  }
}

function movePlayer(deltaTime) {
  const direction = getMovementVector();
  const speed = getCurrentSpeed();
  const playWindow = getCurrentPlayWindow();
  player.x += direction.x * speed * deltaTime;
  player.y += direction.y * speed * deltaTime;
  player.x = clamp(player.x, playWindow.left + player.radius, playWindow.right - player.radius);
  player.y = clamp(player.y, playWindow.top + player.radius, playWindow.bottom - player.radius);
}

function getMovementVector() {
  const x = Number(heldDirections.has("right")) - Number(heldDirections.has("left"));
  const y = Number(heldDirections.has("down")) - Number(heldDirections.has("up"));

  if (x === 0 && y === 0) {
    return { x: 0, y: 0 };
  }

  const length = Math.hypot(x, y);
  return { x: x / length, y: y / length };
}

function spawnEnemies() {
  const pressure = Math.min(elapsedSeconds / 90, 1);
  const interval = Math.max(0.09, 0.62 - pressure * 0.49);

  while (spawnTimer <= 0) {
    enemies.push(createEnemy());
    spawnTimer += interval;

    if (elapsedSeconds > 24 && Math.random() < 0.45) {
      enemies.push(createEnemy());
    }

    if (elapsedSeconds > 58 && Math.random() < 0.35) {
      enemies.push(createEnemy());
    }
  }
}

function createEnemy() {
  const side = Math.floor(Math.random() * 4);
  const margin = 42;
  let x;
  let y;

  if (side === 0) {
    x = Math.random() * arena.width;
    y = -margin;
  } else if (side === 1) {
    x = arena.width + margin;
    y = Math.random() * arena.height;
  } else if (side === 2) {
    x = Math.random() * arena.width;
    y = arena.height + margin;
  } else {
    x = -margin;
    y = Math.random() * arena.height;
  }

  const agePressure = Math.min(elapsedSeconds / 150, 1);
  return {
    x,
    y,
    radius: 13,
    speed: 70 + agePressure * 42 + Math.random() * 18,
    angle: 0,
  };
}

function updateEnemies(deltaTime) {
  enemies.forEach((enemy) => {
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    enemy.x += Math.cos(angle) * enemy.speed * deltaTime;
    enemy.y += Math.sin(angle) * enemy.speed * deltaTime;
    enemy.angle += deltaTime * 2.8;
  });
}

function fireWeapon() {
  if (shotTimer > 0 || enemies.length === 0) {
    return;
  }

  if (isEmpowered()) {
    fireRadialBurst();
    shotTimer = empoweredShotInterval;
    return;
  }

  fireAtNearestEnemy();
  shotTimer = getCurrentShotInterval();
}

function fireAtNearestEnemy() {
  const target = enemies.reduce((nearest, enemy) => {
    const distance = getDistanceSquared(player, enemy);
    return distance < nearest.distance ? { enemy, distance } : nearest;
  }, { enemy: null, distance: Infinity }).enemy;

  if (!target) {
    return;
  }

  const angle = Math.atan2(target.y - player.y, target.x - player.x);
  bullets.push({
    x: player.x,
    y: player.y,
    radius: 4,
    velocityX: Math.cos(angle) * bulletSpeed,
    velocityY: Math.sin(angle) * bulletSpeed,
  });
}

function fireRadialBurst() {
  const bulletCount = 14;

  for (let index = 0; index < bulletCount; index += 1) {
    const angle = (Math.PI * 2 * index) / bulletCount + elapsedSeconds * 1.8;
    bullets.push({
      x: player.x,
      y: player.y,
      radius: 4.8,
      velocityX: Math.cos(angle) * empoweredBulletSpeed,
      velocityY: Math.sin(angle) * empoweredBulletSpeed,
    });
  }
}

function updateBullets(deltaTime) {
  for (let index = bullets.length - 1; index >= 0; index -= 1) {
    const bullet = bullets[index];
    bullet.x += bullet.velocityX * deltaTime;
    bullet.y += bullet.velocityY * deltaTime;

    if (isOutsideArena(bullet, 28)) {
      bullets.splice(index, 1);
      continue;
    }

    const enemyIndex = enemies.findIndex(
      (enemy) => getDistanceSquared(bullet, enemy) < (bullet.radius + enemy.radius) ** 2,
    );

    if (enemyIndex !== -1) {
      const [enemy] = enemies.splice(enemyIndex, 1);
      bullets.splice(index, 1);
      kills += 1;
      killsSinceLastStar += 1;
      maybeDropStar(enemy.x, enemy.y);
      createSparks(enemy.x, enemy.y);
    }
  }
}

function maybeDropStar(x, y) {
  if (killsSinceLastStar < getStarKillRequirement()) {
    return;
  }

  if (Math.random() > getStarDropChance()) {
    return;
  }

  killsSinceLastStar = 0;
  stars.push({
    x,
    y,
    radius: 11,
    spin: Math.random() * Math.PI * 2,
    life: 13,
  });
}

function collectStars(deltaTime) {
  for (let index = stars.length - 1; index >= 0; index -= 1) {
    const star = stars[index];
    star.life -= deltaTime;
    star.spin += deltaTime * 4.8;

    if (star.life <= 0) {
      stars.splice(index, 1);
      continue;
    }

    if (getDistanceSquared(player, star) < (player.radius + star.radius + 6) ** 2) {
      stars.splice(index, 1);
      activateStarBuff();
    }
  }
}

function activateStarBuff() {
  hasConsumedStar = true;
  buffTimer = starBuffDuration;
  withdrawalSeconds = 0;
  killsSinceLastStar = 0;
  shotTimer = 0;
  const playWindow = getCurrentPlayWindow();
  player.x = clamp(player.x, playWindow.left + player.radius, playWindow.right - player.radius);
  player.y = clamp(player.y, playWindow.top + player.radius, playWindow.bottom - player.radius);
  createSparks(player.x, player.y);
}

function updateSparks(deltaTime) {
  for (let index = sparks.length - 1; index >= 0; index -= 1) {
    const spark = sparks[index];
    spark.life -= deltaTime;
    spark.x += spark.velocityX * deltaTime;
    spark.y += spark.velocityY * deltaTime;

    if (spark.life <= 0) {
      sparks.splice(index, 1);
    }
  }
}

function checkPlayerCollision() {
  const hit = enemies.some(
    (enemy) => getDistanceSquared(player, enemy) < (player.radius + enemy.radius * 0.82) ** 2,
  );

  if (hit) {
    endGame();
  }
}

function endGame() {
  window.cancelAnimationFrame(animationFrame);
  animationFrame = null;
  setState("gameover");
  showOverlay("Collapsed", `You survived ${formatTime(elapsedSeconds)} and cleared ${kills} enemies.`);
}

function updateStats() {
  timeElement.textContent = formatTime(elapsedSeconds);
  killsElement.textContent = kills;
  dependencyStateElement.textContent = getDependencyLabel();
  dropRateElement.textContent = `${Math.round(getStarDropChance() * 100)}%`;
}

function getDependencyLabel() {
  if (isEmpowered()) {
    return `Star ${Math.ceil(buffTimer)}s`;
  }

  if (!hasConsumedStar) {
    return "Stable";
  }

  if (withdrawalSeconds < 6) {
    return "Stable";
  }

  if (withdrawalSeconds < 18) {
    return "Fading";
  }

  return "Dependent";
}

function getStarDropChance() {
  if (killsSinceLastStar < getStarKillRequirement()) {
    return 0;
  }

  const surplusKills = Math.max(killsSinceLastStar - getStarKillRequirement(), 0);
  const killBonus = surplusKills * 0.018;
  const timePenalty = elapsedSeconds * 0.0018;
  return clamp(0.08 + killBonus - timePenalty, 0.025, 0.32);
}

function getStarKillRequirement() {
  if (!hasConsumedStar || isEmpowered()) {
    return 14;
  }

  if (withdrawalSeconds < 6) {
    return 18;
  }

  if (withdrawalSeconds < 18) {
    return 24;
  }

  return 32;
}

function isEmpowered() {
  return buffTimer > 0;
}

function getCurrentSpeed() {
  if (isEmpowered()) {
    return player.speed * 1.28;
  }

  const penalty = Math.min(withdrawalSeconds * 0.012, 0.62);
  return player.speed * (1 - penalty);
}

function getCurrentShotInterval() {
  const penalty = Math.min(withdrawalSeconds * 0.013, 0.78);
  return baseShotInterval * (1 + penalty * 3.2);
}

function getCurrentPlayWindow() {
  const scale = getCurrentWindowScale();
  const width = arena.width * scale;
  const height = arena.height * scale;
  const left = (arena.width - width) / 2;
  const top = (arena.height - height) / 2;

  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  };
}

function getCurrentWindowScale() {
  if (!hasConsumedStar) {
    return 1;
  }

  return Math.max(minWindowScale, 1 - windowShrinkSeconds * 0.009);
}

function draw() {
  context.clearRect(0, 0, arena.width, arena.height);
  drawBackground();
  drawPlayWindow();
  sparks.forEach(drawSpark);
  stars.forEach(drawStar);
  bullets.forEach(drawBullet);
  enemies.forEach(drawEnemy);
  drawPlayer();
}

function drawBackground() {
  context.fillStyle = "#090b10";
  context.fillRect(0, 0, arena.width, arena.height);

  context.strokeStyle = "rgba(255, 255, 255, 0.045)";
  context.lineWidth = 1;

  for (let x = 0; x <= arena.width; x += 48) {
    context.beginPath();
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, arena.height);
    context.stroke();
  }

  for (let y = 0; y <= arena.height; y += 48) {
    context.beginPath();
    context.moveTo(0, y + 0.5);
    context.lineTo(arena.width, y + 0.5);
    context.stroke();
  }
}

function drawPlayWindow() {
  const playWindow = getCurrentPlayWindow();

  if (playWindow.width >= arena.width) {
    return;
  }

  context.fillStyle = "rgba(2, 4, 8, 0.62)";
  context.fillRect(0, 0, arena.width, playWindow.top);
  context.fillRect(0, playWindow.bottom, arena.width, arena.height - playWindow.bottom);
  context.fillRect(0, playWindow.top, playWindow.left, playWindow.height);
  context.fillRect(playWindow.right, playWindow.top, arena.width - playWindow.right, playWindow.height);

  context.strokeStyle = `rgba(248, 214, 109, ${0.45 + Math.min(withdrawalSeconds / 38, 0.42)})`;
  context.lineWidth = 3;
  context.strokeRect(
    playWindow.left + 1.5,
    playWindow.top + 1.5,
    playWindow.width - 3,
    playWindow.height - 3,
  );
}

function drawPlayer() {
  context.fillStyle = isEmpowered() ? "#f8d66d" : "#6ee7b7";
  context.beginPath();
  context.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = isEmpowered() ? "rgba(255, 255, 255, 0.98)" : "rgba(242, 245, 248, 0.92)";
  context.lineWidth = 3;
  context.stroke();

  if (withdrawalSeconds > 6 && !isEmpowered()) {
    context.strokeStyle = `rgba(251, 113, 133, ${Math.min(withdrawalSeconds / 34, 0.7)})`;
    context.lineWidth = 2;
    context.beginPath();
    context.arc(player.x, player.y, player.radius + 7, 0, Math.PI * 2);
    context.stroke();
  }
}

function drawEnemy(enemy) {
  context.save();
  context.translate(enemy.x, enemy.y);
  context.rotate(enemy.angle);
  context.fillStyle = "#fb7185";
  context.strokeStyle = "rgba(255, 255, 255, 0.78)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(0, -enemy.radius);
  context.lineTo(enemy.radius, 0);
  context.lineTo(0, enemy.radius);
  context.lineTo(-enemy.radius, 0);
  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
}

function drawBullet(bullet) {
  context.fillStyle = isEmpowered() ? "#ffffff" : "#f8d66d";
  context.beginPath();
  context.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
  context.fill();
}

function drawStar(star) {
  const points = 5;
  context.save();
  context.translate(star.x, star.y);
  context.rotate(star.spin);
  context.fillStyle = "#f8d66d";
  context.strokeStyle = "rgba(255, 255, 255, 0.88)";
  context.lineWidth = 2;
  context.beginPath();

  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? star.radius : star.radius * 0.48;
    const angle = (Math.PI * index) / points - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.closePath();
  context.fill();
  context.stroke();
  context.restore();
}

function drawSpark(spark) {
  context.globalAlpha = Math.max(spark.life / 0.34, 0);
  context.fillStyle = "#7dd3fc";
  context.beginPath();
  context.arc(spark.x, spark.y, 3, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;
}

function createSparks(x, y) {
  for (let index = 0; index < 8; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 70 + Math.random() * 90;
    sparks.push({
      x,
      y,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed,
      life: 0.24 + Math.random() * 0.1,
    });
  }
}

function isOutsideArena(entity, margin) {
  return (
    entity.x < -margin ||
    entity.y < -margin ||
    entity.x > arena.width + margin ||
    entity.y > arena.height + margin
  );
}

function getDistanceSquared(first, second) {
  return (first.x - second.x) ** 2 + (first.y - second.y) ** 2;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatTime(seconds) {
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function setState(nextState) {
  gameState = nextState;
}

function showOverlay(title, text) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.hidden = false;
}

function hideOverlay() {
  overlay.hidden = true;
}

document.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();

    if (gameState === "running") {
      pauseGame();
    } else {
      startGame();
    }
    return;
  }

  const direction = inputMap[event.code];

  if (direction) {
    event.preventDefault();
    heldDirections.add(direction);

    if (gameState === "ready") {
      startGame();
    }
  }
});

document.addEventListener("keyup", (event) => {
  const direction = inputMap[event.code];

  if (direction) {
    heldDirections.delete(direction);
  }
});

document.querySelectorAll("[data-direction]").forEach((button) => {
  const direction = button.dataset.direction;
  const press = (event) => {
    event.preventDefault();
    heldDirections.add(direction);

    if (gameState === "ready") {
      startGame();
    }
  };
  const release = () => heldDirections.delete(direction);

  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
});

startButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", pauseGame);
restartButton.addEventListener("click", restartGame);

if (new URLSearchParams(window.location.search).get("play") === "1") {
  startGame();
}
