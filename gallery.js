// === gallery.js ===

// === Cusdis 配置 ===
const CUSDIS_APP_ID = "0a430d73-5f2b-4da9-963f-e3b6991dfbab"; // ← 换成你自己的
const SITE_URL = "https://dawnnights.github.io/seer_gallery/";


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

const commentWrapper = document.getElementById('comment-wrapper');
const commentThread = document.getElementById('cusdis_thread');
const commentHome = commentWrapper.parentNode;
let commentExpanded = false;
let currentCommentAlbum = null;
let cusdisLoaded = false;

// === 今日推荐设置 ===
const RECOMMEND_VERSION = 251215;
const RECOMMEND_PATH = "https://gcore.jsdelivr.net/gh/DawnNights/seer_gallery@main/R18/奥菲利娅/这个赫尔卡星人就是逊了(代发)/";

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
  renderCommentsForAlbum(null);

  const grid = el('div', 'grid');
  albums
    .filter(alb => secretUnlocked || alb.name !== 'R18')
    .forEach(alb => grid.append(makeAlbumCard(alb)));
  main.append(grid);

  window.scrollTo({ top: 0, behavior: 'smooth' });
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

  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderCommentsForAlbum(album);
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
    resetTransform();
  }

  prevBtn.onclick = (e) => { e.stopPropagation(); showImageAt(currentIndex - 1); };
  nextBtn.onclick = (e) => { e.stopPropagation(); showImageAt(currentIndex + 1); };
  viewer.onclick = (e) => { if (e.target === viewer) closeViewer(); };
  document.onkeydown = (e) => {
    if (e.key === 'ArrowLeft') showImageAt(currentIndex - 1);
    if (e.key === 'ArrowRight') showImageAt(currentIndex + 1);
    if (e.key === 'Escape') closeViewer();
  };

  // === ✅ 新增缩放与拖动逻辑 ===
  let scale = 1, lastScale = 1, startDistance = 0;
  let isDragging = false, startX = 0, startY = 0, translateX = 0, translateY = 0;
  let lastTranslateX = 0, lastTranslateY = 0;
  let lastTap = 0;

  // 滚轮缩放
  viewerImg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    scale = Math.min(Math.max(scale + delta, 0.5), 5);
    applyTransform();
  });

  // 鼠标拖动
  viewerImg.addEventListener('mousedown', e => {
    if (scale <= 1) return;
    isDragging = true;
    startX = e.clientX - lastTranslateX;
    startY = e.clientY - lastTranslateY;
    viewerImg.style.cursor = 'grabbing';
  });
  document.addEventListener('mousemove', e => {
    if (!isDragging) return;
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    applyTransform();
  });
  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      lastTranslateX = translateX;
      lastTranslateY = translateY;
      viewerImg.style.cursor = 'grab';
    }
  });

  // 触摸缩放与拖动
  viewerImg.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      startDistance = getDistance(e.touches);
      lastScale = scale;
    } else if (e.touches.length === 1 && scale > 1) {
      isDragging = true;
      startX = e.touches[0].clientX - lastTranslateX;
      startY = e.touches[0].clientY - lastTranslateY;
    }

    // 双击放大/还原
    const now = Date.now();
    if (now - lastTap < 300 && e.touches.length === 1) {
      scale = scale > 1 ? 1 : 2;
      resetPosition();
      applyTransform();
    }
    lastTap = now;
  });

  viewerImg.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const newDistance = getDistance(e.touches);
      scale = Math.min(Math.max(lastScale * (newDistance / startDistance), 0.5), 5);
      applyTransform();
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      translateX = e.touches[0].clientX - startX;
      translateY = e.touches[0].clientY - startY;
      applyTransform();
    }
  });

  viewerImg.addEventListener('touchend', e => {
    if (isDragging) {
      isDragging = false;
      lastTranslateX = translateX;
      lastTranslateY = translateY;
    }
    if (scale < 1) scale = 1;
    applyTransform();
  });

  function getDistance(touches) {
    const [t1, t2] = touches;
    const dx = t2.pageX - t1.pageX;
    const dy = t2.pageY - t1.pageY;
    return Math.hypot(dx, dy);
  }

  function applyTransform() {
    viewerImg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
  }

  function resetTransform() {
    scale = 1;
    lastScale = 1;
    translateX = 0;
    translateY = 0;
    lastTranslateX = 0;
    lastTranslateY = 0;
    applyTransform();
  }

  function resetPosition() {
    translateX = 0;
    translateY = 0;
    lastTranslateX = 0;
    lastTranslateY = 0;
  }

  function closeViewer() {
    viewer.style.display = 'none';
    document.onkeydown = null;
    resetTransform();
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
  captionEl.textContent = "点击图片前往相册：" + getAlbumPathName(rootData.albums, RECOMMEND_PATH).join(" / ");
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

function renderCommentsForAlbum(album) {
  // 首页：隐藏评论区
  if (!album) {
    resetCommentState();
    commentWrapper.style.display = 'none';
    commentHome.appendChild(commentWrapper);
    return;
  }

  // === 切换相册，强制重置 ===
  resetCommentState();
  currentCommentAlbum = album;

  // 插入到 main 顶部
  const anchor = ensureCommentAnchor();
  anchor.appendChild(commentWrapper);
  commentWrapper.style.display = 'block';

  // 构建 UI（只一次）
  if (!commentWrapper.classList.contains('collapsible')) {
    buildCommentCollapseUI();
  }
}


function buildCommentCollapseUI() {
  commentWrapper.classList.add('collapsible');

  const toggle = document.createElement('div');
  toggle.className = 'comment-toggle';

  const title = document.createElement('div');
  title.textContent = '💬 评论区';

  const action = document.createElement('span');
  action.textContent = '展开';

  toggle.append(title, action);

  const body = document.createElement('div');
  body.className = 'comment-body collapsed';
  body.appendChild(commentThread);

  commentWrapper.replaceChildren(toggle, body);

  toggle.onclick = () => {
    commentExpanded = !commentExpanded;

    body.classList.toggle('expanded', commentExpanded);
    body.classList.toggle('collapsed', !commentExpanded);
    action.textContent = commentExpanded ? '收起' : '展开';

    // 只在“当前相册 + 第一次展开”时加载
    if (commentExpanded && !cusdisLoaded && currentCommentAlbum) {
      loadCusdisForAlbum(currentCommentAlbum);
      cusdisLoaded = true;
    }
  };
}

function resetCommentState() {
  commentExpanded = false;
  cusdisLoaded = false;
  currentCommentAlbum = null;

  const body = commentWrapper.querySelector('.comment-body');
  const action = commentWrapper.querySelector('.comment-toggle span');

  if (body) {
    body.classList.remove('expanded');
    body.classList.add('collapsed');
  }

  if (action) {
    action.textContent = '展开';
  }

  // ⚠️ 关键：清空旧评论
  commentThread.innerHTML = '';
}

function loadCusdisForAlbum(album) {
  commentThread.innerHTML = '';

  commentThread.setAttribute('data-host', 'https://cusdis.com');
  commentThread.setAttribute('data-app-id', CUSDIS_APP_ID);
  commentThread.setAttribute('data-page-id', album.path);
  commentThread.setAttribute('data-page-title', album.name);
  commentThread.setAttribute('data-lang', 'zh-cn');
  commentThread.setAttribute(
    'data-page-url',
    SITE_URL + '#/' + encodeURIComponent(album.path)
  );

  window.CUSDIS && window.CUSDIS.renderTo(commentThread);
}


let pendingAlbum = null;

function prepareCusdis(album) {
  pendingAlbum = album;
  document.querySelector('.comment-body')?.classList.add('collapsed');
  document.querySelector('.comment-toggle span').textContent = '展开';
}

function loadCusdis() {
  if (!pendingAlbum) return;

  const album = pendingAlbum;

  commentThread.innerHTML = '';

  commentThread.setAttribute('data-host', 'https://cusdis.com');
  commentThread.setAttribute('data-app-id', CUSDIS_APP_ID);
  commentThread.setAttribute('data-page-id', album.path);
  commentThread.setAttribute('data-page-title', album.name);
  commentThread.setAttribute('data-lang', 'zh-cn');
  commentThread.setAttribute(
    'data-page-url',
    SITE_URL + '#/' + encodeURIComponent(album.path)
  );

  window.CUSDIS && window.CUSDIS.renderTo(commentThread);
}




function ensureCommentAnchor() {
  let anchor = document.getElementById('comment-anchor');
  if (!anchor) {
    anchor = document.createElement('div');
    anchor.id = 'comment-anchor';
    main.prepend(anchor);
  }
  return anchor;
}


init();
