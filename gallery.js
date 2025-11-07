const main = document.getElementById('main');
const title = document.getElementById('title');
const backBtn = document.getElementById('backBtn');

let albumStack = [];
let currentAlbum = null;
let rootData = null;

async function init() {
  const res = await fetch('index.json');
  rootData = await res.json();
  renderAlbumList(rootData.albums, '我的画廊');
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
  backBtn.style.display = albumStack.length ? 'inline-block' : 'none';

  const grid = el('div', 'grid');
  albums.forEach(alb => grid.append(makeAlbumCard(alb)));
  main.append(grid);
}

function openAlbum(album) {
  albumStack.push(currentAlbum);
  currentAlbum = album;
  main.innerHTML = '';
  title.textContent = album.name;
  backBtn.style.display = 'inline-block';

  if (album.subalbums && album.subalbums.length) {
    const subTitle = el('h2');
    subTitle.textContent = '子相册';
    main.append(subTitle);
    const subGrid = el('div', 'grid');
    album.subalbums.forEach(sa => subGrid.append(makeAlbumCard(sa)));
    main.append(subGrid);
  }

  if (album.images && album.images.length) {
    const imgTitle = el('h2');
    imgTitle.textContent = '图片';
    main.append(imgTitle);
    const imgGrid = el('div', 'grid');
    album.images.forEach(img => {
      imgGrid.append(makeImageCard(album.path + img));
    });
    main.append(imgGrid);
  }
}

function goBack() {
  const prev = albumStack.pop();
  if (!prev) {
    renderAlbumList(rootData.albums, '我的画廊');
    currentAlbum = null;
  } else {
    currentAlbum = prev;
    openAlbum(prev);
  }
}

let currentImages = [];
let currentIndex = 0;

function showViewer(src) {
  const viewer = document.getElementById('viewer');
  const viewerImg = document.getElementById('viewer-img');
  viewer.style.display = 'flex';
  viewerImg.src = src;

  // 当前相册的所有图片
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

  viewer.onclick = (e) => {
    if (e.target === viewer) closeViewer();
  };

  document.onkeydown = (e) => {
    if (e.key === 'ArrowLeft') showImageAt(currentIndex - 1);
    if (e.key === 'ArrowRight') showImageAt(currentIndex + 1);
    if (e.key === 'Escape') closeViewer();
  };

  // 触摸滑动支持
  let startX = 0;
  viewer.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
  });
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

backBtn.onclick = goBack;
init();
