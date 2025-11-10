const main = document.getElementById('main');
const title = document.getElementById('title');
const backBtn = document.getElementById('backBtn');
const footerTip = document.getElementById('footer-tip');

let rootData = null;
let currentAlbum = null;
let albumStack = [];

let secretUnlocked = false;
let clickCount = 0;
const totalClicks = 5;

// === 今日推荐设置 ===
const RECOMMEND_VERSION = 20251110; // 修改此值刷新浮窗
const RECOMMEND_PATH = "https://gcore.jsdelivr.net/gh/DawnNights/seer_gallery@main/R18/沧岚/"; // 推荐相册路径

async function init() {
  const res = await fetch('index.json');
  rootData = await res.json();
  renderAlbumList(rootData.albums, '我的画廊');
  checkRecommend();
}

function el(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

function makeAlbumCard(album) {
  const card = el('div', 'card fade-in');
  const img = el('img');
  img.src = album.images?.length
    ? album.path + album.images[0]
    : 'https://via.placeholder.com/400x300?text=No+Image';
  const name = el('div', 'card-title');
  name.textContent = album.name;
  card.append(img, name);
  card.onclick = () => openAlbum(album);
  return card;
}

function makeImageCard(src) {
  const card = el('div', 'card fade-in');
  const img = el('img');
  img.src = src;
  card.append(img);
  card.onclick = () => showViewer(src);
  return card;
}

function renderAlbumList(albums, heading) {
  main.innerHTML = '';
  title.textContent = heading;
  currentAlbum = null;
  backBtn.style.display = 'none';

  const grid = el('div', 'grid');
  albums
    .filter(alb => secretUnlocked || alb.name !== 'R18')
    .forEach(alb => grid.append(makeAlbumCard(alb)));
  main.append(grid);
}

function openAlbum(album, pushToStack = true) {
  if (pushToStack && currentAlbum) albumStack.push(currentAlbum);
  currentAlbum = album;
  main.innerHTML = '';
  title.textContent = album.name;
  backBtn.style.display = 'inline-block';

  if (album.subalbums?.length) {
    const subTitle = el('h2');
    subTitle.textContent = '子相册';
    main.append(subTitle);
    const subGrid = el('div', 'grid');
    album.subalbums
      .filter(sa => secretUnlocked || sa.name !== 'R18')
      .forEach(sa => subGrid.append(makeAlbumCard(sa)));
    main.append(subGrid);
  }

  if (album.images?.length) {
    const imgTitle = el('h2');
    imgTitle.textContent = '图片';
    main.append(imgTitle);
    const imgGrid = el('div', 'grid');
    album.images.forEach(img => imgGrid.append(makeImageCard(album.path + img)));
    main.append(imgGrid);
  }
}

function goBack() {
  if (albumStack.length === 0) {
    renderAlbumList(rootData.albums, '我的画廊');
    currentAlbum = null;
    backBtn.style.display = 'none';
  } else {
    const prev = albumStack.pop();
    openAlbum(prev, false);
  }
}
backBtn.onclick = goBack;

// === 图片查看器 ===
let currentImages = [];
let currentIndex = 0;

function showViewer(src) {
  const viewer = document.getElementById('viewer');
  const viewerImg = document.getElementById('viewer-img');
  viewer.style.display = 'flex';
  viewerImg.src = src;

  currentImages = (currentAlbum?.images || []).map(img => currentAlbum.path + img);
  currentIndex = currentImages.indexOf(src);

  const prevBtn = viewer.querySelector('.prev');
  const nextBtn = viewer.querySelector('.next');

  function showImageAt(index) {
    if (currentImages.length === 0) return;
    if (index < 0) index = currentImages.length - 1;
    if (index >= currentImages.length) index = 0;
    currentIndex = index;
    viewerImg.src = currentImages[currentIndex];
  }

  prevBtn.onclick = (e) => { e.stopPropagation(); showImageAt(currentIndex - 1); };
  nextBtn.onclick = (e) => { e.stopPropagation(); showImageAt(currentIndex + 1); };
  viewer.onclick = (e) => { if (e.target === viewer) closeViewer(); };
  document.onkeydown = (e) => {
    if (e.key === 'ArrowLeft') showImageAt(currentIndex - 1);
    if (e.key === 'ArrowRight') showImageAt(currentIndex + 1);
    if (e.key === 'Escape') closeViewer();
  };

  let startX = 0;
  viewer.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; });
  viewer.addEventListener('touchend', (e) => {
    const endX = e.changedTouches[0].clientX;
    if (endX - startX > 50) showImageAt(currentIndex - 1);
    if (startX - endX > 50) showImageAt(currentIndex + 1);
  });

  function closeViewer() {
    viewer.style.display = 'none';
    document.onkeydown = null;
  }
}

// === 隐藏相册解锁 ===
title.addEventListener('click', () => {
  if (secretUnlocked) return;
  clickCount++;
  const remaining = totalClicks - clickCount;
  if (remaining > 0) {
    footerTip.textContent = `点击左上角标题 ${remaining} 次，会有好事发生`;
  } else {
    secretUnlocked = true;
    footerTip.textContent = "🎉 隐藏相册已解锁！";
    renderAlbumList(rootData.albums, '我的画廊');
  }
});

// === 今日推荐浮窗 ===
function checkRecommend() {
  const saved = localStorage.getItem("recommendVersion");
  if (saved == RECOMMEND_VERSION) return;

  localStorage.setItem("recommendVersion", RECOMMEND_VERSION);
  const album = findAlbumByPath(rootData.albums, RECOMMEND_PATH);
  if (!album || !album.images?.length) return;

  const overlay = document.getElementById('recommend-overlay');
  const imgEl = document.getElementById('recommend-img');
  const captionEl = document.getElementById('recommend-caption');

  imgEl.src = album.path + album.images[0];
  captionEl.textContent = "来自相册：" + getAlbumPathName(rootData.albums, RECOMMEND_PATH).join(" / ");
  overlay.style.display = 'flex';

  imgEl.onclick = () => {
    overlay.style.display = 'none';
    openAlbumByPath(RECOMMEND_PATH);
  };
  overlay.onclick = (e) => { if (e.target === overlay) overlay.style.display = 'none'; };
}

// === 工具函数 ===
function findAlbumByPath(albums, path) {
  for (const album of albums) {
    if (album.path === path) return album;
    if (album.subalbums?.length) {
      const found = findAlbumByPath(album.subalbums, path);
      if (found) return found;
    }
  }
  return null;
}

function getAlbumPathName(albums, path, chain = []) {
  for (const album of albums) {
    const newChain = [...chain, album.name];
    if (album.path === path) return newChain;
    if (album.subalbums?.length) {
      const found = getAlbumPathName(album.subalbums, path, newChain);
      if (found.length) return found;
    }
  }
  return [];
}

function openAlbumByPath(path) {
  const album = findAlbumByPath(rootData.albums, path);
  if (album) openAlbum(album);
}

init();
