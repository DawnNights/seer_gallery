// gallery.js
const INDEX_PATH = 'index.json'; // 相对于站点根。也可以改成 /path/index.json

// utils
function el(tag, cls){ const e = document.createElement(tag); if(cls) e.className = cls; return e; }
function qs(sel){ return document.querySelector(sel); }

let galleryIndex = null;
let currentAlbum = null;
let currentPhotoIndex = 0;

async function loadIndex(){
  try{
    const resp = await fetch(INDEX_PATH, {cache: "no-cache"});
    if(!resp.ok) throw new Error('无法加载 index.json: ' + resp.status);
    galleryIndex = await resp.json();
  }catch(e){
    console.error(e);
    galleryIndex = { albums: [] };
    const main = qs('#app');
    main.innerHTML = `<p style="color:#c33">加载 index.json 失败，确认它在仓库根目录并已提交（或路径修改为正确位置）。</p>`;
  }
}

function makeAlbumCard(album){
  const card = el('article','album-card');
  const img = el('img','album-thumb');
  img.alt = album.name;
  // 使用第一张图作为缩略（若无图则使用占位）
  if(album.images && album.images.length){
    img.src = album.path + album.images[0];
  } else {
    img.style.height = '120px';
    img.style.background = '#ddd';
  }
  const body = el('div','album-body');
  const title = el('h3','album-title'); title.textContent = album.name;
  const meta = el('div','album-meta'); meta.textContent = `${album.images ? album.images.length : 0} 张`;
  body.appendChild(title); body.appendChild(meta);
  card.appendChild(img); card.appendChild(body);
  card.addEventListener('click', ()=> openAlbum(album.name));
  return card;
}

function renderIndex(){
  const main = qs('#app');
  main.innerHTML = '';
  const header = el('div','section-title');
  const h = el('h2'); h.textContent = '相册';
  header.appendChild(h);
  main.appendChild(header);

  const grid = el('div','grid album-grid');
  (galleryIndex.albums || []).forEach(album => {
    grid.appendChild(makeAlbumCard(album));
  });
  main.appendChild(grid);
}

function renderAlbum(albumName){
  const main = qs('#app');
  const album = (galleryIndex.albums || []).find(a=>a.name===albumName);
  if(!album) { main.innerHTML = '<p>相册不存在</p>'; return; }
  currentAlbum = album;

  main.innerHTML = '';
  const controls = el('div','controls');
  const back = el('button','btn'); back.textContent = '← 返回相册';
  back.onclick = ()=> { location.hash = ''; renderIndex(); };
  const title = el('h2'); title.textContent = album.name;
  controls.appendChild(back);
  controls.appendChild(title);
  main.appendChild(controls);

  const grid = el('div','grid photos-grid');
  (album.images || []).forEach((imgname, idx) => {
    const cell = el('div','photo-item');
    const img = el('img');
    img.src = album.path + imgname;
    img.alt = `${album.name} / ${imgname}`;
    img.loading = 'lazy';
    img.addEventListener('click', ()=> openLightbox(idx));
    cell.appendChild(img);
    grid.appendChild(cell);
  });
  main.appendChild(grid);
}

// 路由：用 hash #/albumName
function handleHash(){
  const h = location.hash.replace(/^#\/?/, '');
  if(!h) { renderIndex(); return; }
  // decodeURIComponent 支持空格等
  const name = decodeURIComponent(h);
  renderAlbum(name);
}

function openAlbum(name){
  location.hash = encodeURIComponent(name);
  // handleHash 会触发 renderAlbum
}

function openLightbox(photoIdx){
  currentPhotoIndex = photoIdx;
  showLightbox();
}

function showLightbox(){
  const lb = qs('#lightbox');
  const imgEl = qs('#lbImg');
  const caption = qs('#lbCaption');
  if(!currentAlbum || !currentAlbum.images || currentAlbum.images.length===0) return;
  const imgPath = currentAlbum.path + currentAlbum.images[currentPhotoIndex];
  imgEl.src = imgPath;
  caption.textContent = `${currentAlbum.name} — ${currentPhotoIndex+1}/${currentAlbum.images.length}`;
  lb.classList.remove('hidden');
  lb.focus();
}

function closeLightbox(){
  qs('#lightbox').classList.add('hidden');
  qs('#lbImg').src = '';
}

function nextPhoto(){
  if(!currentAlbum) return;
  currentPhotoIndex = (currentPhotoIndex + 1) % currentAlbum.images.length;
  showLightbox();
}
function prevPhoto(){
  if(!currentAlbum) return;
  currentPhotoIndex = (currentPhotoIndex - 1 + currentAlbum.images.length) % currentAlbum.images.length;
  showLightbox();
}

function wireLightbox(){
  qs('#lbClose').addEventListener('click', closeLightbox);
  qs('#lbNext').addEventListener('click', nextPhoto);
  qs('#lbPrev').addEventListener('click', prevPhoto);
  window.addEventListener('keydown', (e)=>{
    const lb = qs('#lightbox');
    if(lb.classList.contains('hidden')) return;
    if(e.key === 'Escape') closeLightbox();
    if(e.key === 'ArrowRight') nextPhoto();
    if(e.key === 'ArrowLeft') prevPhoto();
  });
  // 点击遮罩关闭
  qs('#lightbox').addEventListener('click', (e)=>{
    if(e.target.id === 'lightbox') closeLightbox();
  });
}

async function boot(){
  await loadIndex();
  await Promise.resolve(); // 保证异步先后
  wireLightbox();
  window.addEventListener('hashchange', handleHash);
  handleHash();
}

boot();
