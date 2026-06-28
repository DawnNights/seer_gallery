// ============================================
// 醉星河的画廊 — gallery.js
// 纯前端 SPA，WebView 兼容，无 alert/confirm
// ============================================

(() => {
  'use strict';

  // ===== Constants =====
  const CDN_BASE = 'https://gh-proxy.org/https:/raw.githubusercontent.com/DawnNights/seer_gallery/refs/heads/main/';
  const CUSDIS_APP_ID = '0a430d73-5f2b-4da9-963f-e3b6991dfbab';
  const SITE_URL = 'https://dawnnights.github.io/seer_gallery/';

  // ===== State =====
  let allWorks = [];
  let allTags = {};
  let activeTag = null;
  let searchQuery = '';
  let currentWork = null;       // 当前打开的详情页作品
  let r18Unlocked = false;
  let r18ClickCount = 0;
  let modalResolve = null;      // modal promise resolver

  // Viewer state
  let vWork = null;
  let vImages = [];
  let vIndex = 0;

  // ===== DOM =====
  const $ = id => document.getElementById(id);
  const main = $('main');
  const titleEl = $('title');
  const backBtn = $('backBtn');
  const searchInput = $('searchInput');
  const tagCloud = $('tagCloud');
  const r18Badge = $('r18Badge');
  const footerTip = $('footerTip');

  // Viewer
  const viewer = $('viewer');
  const vImg = $('vImg');
  const vPrev = $('vPrev');
  const vNext = $('vNext');
  const vClose = $('vClose');
  const vCounter = $('vCounter');

  // Video
  const videoOverlay = $('videoOverlay');
  const videoPlayer = $('videoPlayer');

  // Modal
  const modal = $('modal');
  const modalMsg = $('modalMsg');
  const modalButtons = $('modalButtons');

  // ==========================================
  //  Modal System (replaces alert/confirm)
  // ==========================================
  /** 显示确认弹窗，返回 Promise<boolean> */
  function showConfirm(msg) {
    return new Promise(resolve => {
      modalResolve = resolve;
      modalMsg.textContent = msg;
      modalButtons.innerHTML = `
        <button class="modal-btn modal-cancel" id="modalCancel">取消</button>
        <button class="modal-btn modal-confirm" id="modalConfirm">确定</button>
      `;
      modal.style.display = 'flex';
      $('modalConfirm').onclick = () => { modal.style.display = 'none'; resolve(true); };
      $('modalCancel').onclick = () => { modal.style.display = 'none'; resolve(false); };
      modal.onclick = (e) => { if (e.target === modal) { modal.style.display = 'none'; resolve(false); } };
    });
  }

  /** 显示提示弹窗，返回 Promise<void> */
  function showAlert(msg) {
    return new Promise(resolve => {
      modalMsg.textContent = msg;
      modalButtons.innerHTML = `<button class="modal-btn modal-confirm" id="modalOk">确定</button>`;
      modal.style.display = 'flex';
      $('modalOk').onclick = () => { modal.style.display = 'none'; resolve(); };
      modal.onclick = (e) => { if (e.target === modal) { modal.style.display = 'none'; resolve(); } };
    });
  }

  // ==========================================
  //  R18 系统
  // ==========================================
  function initR18() {
    r18Unlocked = localStorage.getItem('r18Unlocked') === 'true';
    r18Badge.style.display = r18Unlocked ? 'inline-flex' : 'none';
    updateFooterTip();
  }

  function updateFooterTip() {
    if (!currentWork) {
      footerTip.style.display = 'block';
      if (r18Unlocked) {
        footerTip.textContent = 'R18 模式已开启，点击右上角 R18 可关闭';
      } else if (r18ClickCount >= 5) {
        footerTip.textContent = '点击左上角标题可解锁 R18 内容';
      } else {
        const n = 5 - r18ClickCount;
        footerTip.textContent = `点击左上角标题 ${n} 次，会有好事发生`;
      }
    } else {
      footerTip.style.display = 'none';
    }
  }

  async function onTitleClick() {
    if (r18Unlocked) return;
    r18ClickCount++;
    updateFooterTip();
    if (r18ClickCount >= 5) {
      const ok = await showConfirm('是否年满 18 周岁？确认后将解锁 R18 内容。');
      if (ok) {
        r18Unlocked = true;
        localStorage.setItem('r18Unlocked', 'true');
        r18Badge.style.display = 'inline-flex';
        updateFooterTip();
        render();
      } else {
        r18ClickCount = 0;
        updateFooterTip();
      }
    }
  }

  async function onR18BadgeClick() {
    const ok = await showConfirm('是否关闭 R18 模式？');
    if (ok) {
      r18Unlocked = false;
      localStorage.removeItem('r18Unlocked');
      r18Badge.style.display = 'none';
      r18ClickCount = 0;
      updateFooterTip();
      render();
    }
  }

  // ==========================================
  //  URL Helpers
  // ==========================================
  function photoUrl(id) { return CDN_BASE + '/gallery/' + id + '.jpg'; }
  function albumImgUrl(id, file) { return CDN_BASE + '/gallery/' + id + '/' + file; }
  function videoUrl(id) { return CDN_BASE + '/gallery/' + id + '.mp4'; }
  function videoCoverUrl(id) { return CDN_BASE + '/gallery/' + id + '.webp'; }

  function coverUrl(work) {
    if (work.type === 'photo') return photoUrl(work.id);
    if (work.type === 'album') return albumImgUrl(work.id, work.cover || work.files?.[0]);
    if (work.type === 'video') return videoCoverUrl(work.id);
    return ''; // novel 没有图片封面
  }

  function novelUrl(id) { return CDN_BASE + '/gallery/' + id + '.txt'; }

  function formatDate(ts) {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function formatWords(n) {
    if (!n) return '';
    if (n < 10000) return n + ' 字';
    return (n / 10000).toFixed(n % 10000 === 0 ? 0 : 1) + ' 万字';
  }

  // ==========================================
  //  Init
  // ==========================================
  async function init() {
    try {
      const res = await fetch('index.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      allWorks = data.works || [];
      allTags = data.tags || {};
    } catch (e) {
      main.innerHTML = '<p style="padding:60px;text-align:center;color:#999;">加载失败，请刷新重试</p>';
      return;
    }
    initR18();
    render();
  }

  // ==========================================
  //  Render Dispatch
  // ==========================================
  function render() {
    if (currentWork) {
      showDetail(currentWork);
    } else {
      renderGrid();
    }
  }

  // ==========================================
  //  Grid View
  // ==========================================
  function renderGrid() {
    currentWork = null;
    main.innerHTML = '';
    titleEl.textContent = '醉星河的画廊';
    backBtn.style.display = 'none';
    tagCloud.style.display = '';
    searchInput.style.display = '';
    updateFooterTip();
    renderTagCloud();

    const filtered = getFilteredWorks();
    if (filtered.length === 0) {
      main.innerHTML = '<p style="padding:40px;text-align:center;color:#999;">没有匹配的作品</p>';
      return;
    }
    const grid = el('div', 'grid');
    filtered.forEach(w => grid.appendChild(createCard(w)));
    main.appendChild(grid);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function getFilteredWorks() {
    let list = allWorks;
    // R18 过滤
    if (!r18Unlocked) {
      list = list.filter(w => !(w.tags || []).includes('R18'));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(w =>
        w.title.toLowerCase().includes(q) ||
        (w.tags || []).some(t => t.toLowerCase().includes(q))
      );
    }
    if (activeTag) {
      list = list.filter(w => (w.tags || []).includes(activeTag));
    }
    return list;
  }

  function createCard(work) {
    const card = el('div', 'card fade-in');

    if (work.type === 'novel') {
      const tc = el('div', 'text-cover');
      tc.textContent = work.title;
      card.appendChild(tc);
    } else {
      const img = el('img');
      img.src = coverUrl(work);
      card.appendChild(img);
    }

    // Type badge
    const badge = el('span', 'type-badge');
    if (work.type === 'album') badge.textContent = work.files?.length + 'P';
    else if (work.type === 'video') badge.textContent = '🎬';
    else if (work.type === 'novel') badge.textContent = formatWords(work.words);

    card.appendChild(badge);

    // R18 badge
    if ((work.tags || []).includes('R18')) {
      const r = el('span', 'r18-card-badge');
      r.textContent = 'R18';
      card.appendChild(r);
    }

    // Tag chips
    if (work.tags?.length) {
      const row = el('div', 'card-chips');
      work.tags.forEach(t => {
        if (t === 'R18') return;
        const chip = el('span', 'chip');
        chip.textContent = t;
        chip.onclick = (e) => { e.stopPropagation(); activeTag = t; render(); };
        row.appendChild(chip);
      });
      if (row.children.length) card.appendChild(row);
    }

    const titleDiv = el('div', 'card-title');
    titleDiv.textContent = work.title;
    card.appendChild(titleDiv);

    card.onclick = () => showDetail(work);
    return card;
  }

  // ===== Tag Cloud (折叠式) =====
  function renderTagCloud() {
    tagCloud.innerHTML = '';
    const list = getFilteredWorks();
    const counts = {};
    list.forEach(w => (w.tags || []).forEach(t => { if (t !== 'R18') counts[t] = (counts[t] || 0) + 1; }));
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    // 切换按钮
    const toggle = el('span', 'tag tag-toggle');
    toggle.textContent = '🏷️ 标签';
    if (activeTag) toggle.textContent += ' · 已筛选';
    tagCloud.appendChild(toggle);

    // 清除筛选（有 activeTag 时始终显示）
    if (activeTag) {
      const clear = el('button', 'tag tag-clear');
      clear.textContent = '✕ 清除';
      clear.onclick = () => { activeTag = null; render(); };
      tagCloud.appendChild(clear);
    }

    // 标签列表容器（可折叠）
    const body = el('div', 'tag-body collapsed');
    let expanded = false;

    sorted.forEach(([t, c]) => {
      const span = el('span', 'tag');
      if (t === activeTag) span.classList.add('active');
      span.textContent = `${t} ×${c}`;
      span.onclick = () => { activeTag = (activeTag === t) ? null : t; render(); };
      body.appendChild(span);
    });

    tagCloud.appendChild(body);

    toggle.onclick = () => {
      expanded = !expanded;
      body.classList.toggle('expanded', expanded);
      body.classList.toggle('collapsed', !expanded);
      toggle.textContent = expanded ? '▼ 收起标签' : '🏷️ 标签';
      if (activeTag) toggle.textContent += ' · 已筛选';
    };
  }

  // ==========================================
  //  Detail View — 所有作品共用
  // ==========================================
  function showDetail(work) {
    currentWork = work;
    main.innerHTML = '';
    titleEl.textContent = work.title;
    backBtn.style.display = 'inline-block';
    tagCloud.style.display = 'none';
    searchInput.style.display = 'none';
    footerTip.style.display = 'none';

    // ---- Meta ----
    const meta = el('div', 'detail-meta');
    const h1 = el('h1', 'detail-title');
    h1.textContent = work.title;
    meta.appendChild(h1);

    const sub = el('div', 'detail-subtitle');
    sub.innerHTML = `<span>作者：${work.author || 'DawnNights'}</span><span class="detail-date">更新：${formatDate(work.date) || '未知'}</span>`;
    if (work.type === 'novel' && work.words) {
      const ws = el('span', 'detail-words');
      ws.textContent = formatWords(work.words);
      sub.appendChild(ws);
    }
    meta.appendChild(sub);

    if (work.tags?.length) {
      const tagRow = el('div', 'detail-tags');
      work.tags.forEach(t => {
        if (t === 'R18') return;
        const chip = el('span', 'tag');
        chip.textContent = t;
        chip.onclick = () => { activeTag = t; goBack(); };
        tagRow.appendChild(chip);
      });
      meta.appendChild(tagRow);
    }
    main.appendChild(meta);

    // ---- 内容区域 ----
    const content = el('div', 'detail-content');

    if (work.type === 'photo') {
      const img = el('img', 'detail-photo');
      img.src = photoUrl(work.id);
      img.loading = 'lazy';
      img.onclick = () => openViewer(work);
      content.appendChild(img);

    } else if (work.type === 'album') {
      const strip = el('div', 'album-strip');
      (work.files || []).forEach((f, i) => {
        const img = el('img', 'strip-img');
        img.src = albumImgUrl(work.id, f);
        img.onclick = () => openViewer(work, i);
        strip.appendChild(img);
      });
      content.appendChild(strip);

    } else if (work.type === 'video') {
      const wrapper = el('div', 'video-cover-wrapper');
      wrapper.onclick = () => openVideo(work);
      const cover = el('img', 'video-cover-img');
      cover.src = videoCoverUrl(work.id);
      cover.onerror = function() { this.style.display = 'none'; };
      const playBtn = el('div', 'video-play-btn');
      playBtn.innerHTML = '▶';
      wrapper.append(cover, playBtn);
      content.appendChild(wrapper);

    } else if (work.type === 'novel') {
      const reader = el('div', 'novel-reader');
      const status = el('div', 'novel-status');
      status.textContent = '⏳ 加载中…';
      reader.appendChild(status);
      content.appendChild(reader);
      loadNovelContent(work, reader, status);
    }

    main.appendChild(content);

    // ---- 评论区 ----
    const commentSection = renderCommentUI(work);
    main.appendChild(commentSection);

    history.pushState({page: 'detail'}, '');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==========================================
  //  Image Viewer (Fullscreen)
  // ==========================================
  function openViewer(work, index) {
    vWork = work;

    if (work.type === 'album') {
      vImages = work.files || [];
      vIndex = index || 0;
      vPrev.style.display = '';
      vNext.style.display = '';
    } else {
      vImages = [work.id];
      vIndex = 0;
      vPrev.style.display = 'none';
      vNext.style.display = 'none';
    }

    showViewerImage();
    viewer.classList.add('active');
    document.body.style.overflow = 'hidden';
    history.pushState({page: 'viewer'}, '');
    // 确保底层详情页内容完全不可见
    main.style.display = 'none';

    resetViewerTransform();
  }

  function showViewerImage() {
    if (vIndex < 0) vIndex = vImages.length - 1;
    if (vIndex >= vImages.length) vIndex = 0;
    vImg.src = vWork.type === 'album'
      ? albumImgUrl(vWork.id, vImages[vIndex])
      : photoUrl(vImages[vIndex]);
    vCounter.textContent = vImages.length > 1 ? `${vIndex + 1}/${vImages.length}` : '';
    resetViewerTransform();
  }

  function closeViewer() {
    viewer.classList.remove('active');
    document.body.style.overflow = '';
    // 恢复详情页内容
    main.style.display = '';
  }

  vClose.onclick = closeViewer;
  viewer.onclick = (e) => { if (e.target === viewer) closeViewer(); };
  vPrev.onclick = (e) => { e.stopPropagation(); vIndex--; showViewerImage(); };
  vNext.onclick = (e) => { e.stopPropagation(); vIndex++; showViewerImage(); };

  document.addEventListener('keydown', e => {
    if (!viewer.classList.contains('active')) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { vIndex--; showViewerImage(); e.preventDefault(); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { vIndex++; showViewerImage(); e.preventDefault(); }
    else if (e.key === 'Escape') closeViewer();
  });

  // ---- Zoom / Drag ----
  let vScale = 1, vLastScale = 1, vStartDist = 0;
  let vDragging = false, vStartX = 0, vStartY = 0, vTransX = 0, vTransY = 0;
  let vLastTransX = 0, vLastTransY = 0, vLastTap = 0;

  function resetViewerTransform() {
    vScale = 1; vLastScale = 1; vTransX = 0; vTransY = 0;
    vLastTransX = 0; vLastTransY = 0;
    vImg.style.transform = '';
    vImg.style.cursor = 'grab';
  }

  vImg.addEventListener('wheel', e => {
    e.preventDefault();
    vScale = Math.min(Math.max(vScale - e.deltaY * 0.001, 0.5), 5);
    applyViewerTransform();
  });

  vImg.addEventListener('mousedown', e => {
    if (vScale <= 1) return;
    vDragging = true;
    vStartX = e.clientX - vLastTransX;
    vStartY = e.clientY - vLastTransY;
    vImg.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', e => {
    if (!vDragging) return;
    vTransX = e.clientX - vStartX;
    vTransY = e.clientY - vStartY;
    applyViewerTransform();
  });

  document.addEventListener('mouseup', () => {
    if (vDragging) { vDragging = false; vLastTransX = vTransX; vLastTransY = vTransY; vImg.style.cursor = 'grab'; }
  });

  vImg.addEventListener('touchstart', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      vStartDist = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
      vLastScale = vScale;
    } else if (e.touches.length === 1 && vScale > 1) {
      vDragging = true;
      vStartX = e.touches[0].clientX - vLastTransX;
      vStartY = e.touches[0].clientY - vLastTransY;
    }
    const now = Date.now();
    if (now - vLastTap < 300 && e.touches.length === 1) {
      vScale = vScale > 1 ? 1 : 2.5;
      vTransX = 0; vTransY = 0; vLastTransX = 0; vLastTransY = 0;
      applyViewerTransform();
    }
    vLastTap = now;
  });

  vImg.addEventListener('touchmove', e => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const d = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
      vScale = Math.min(Math.max(vLastScale * (d / vStartDist), 0.5), 5);
      applyViewerTransform();
    } else if (e.touches.length === 1 && vDragging && vScale > 1) {
      vTransX = e.touches[0].clientX - vStartX;
      vTransY = e.touches[0].clientY - vStartY;
      applyViewerTransform();
    }
  });

  vImg.addEventListener('touchend', () => {
    if (vDragging) { vDragging = false; vLastTransX = vTransX; vLastTransY = vTransY; }
    if (vScale < 1) { vScale = 1; applyViewerTransform(); }
  });

  function applyViewerTransform() {
    vImg.style.transform = `translate(${vTransX}px,${vTransY}px) scale(${vScale})`;
  }

  // ==========================================
  //  Video Player (Overlay)
  // ==========================================
  function openVideo(work) {
    videoPlayer.src = videoUrl(work.id);
    videoOverlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    videoPlayer.play().catch(() => {});

    const closeBtn = videoOverlay.querySelector('.v-close-video');
    closeBtn.onclick = closeVideo;
  }

  function closeVideo() {
    videoPlayer.pause();
    videoPlayer.src = '';
    videoOverlay.style.display = 'none';
    document.body.style.overflow = '';
  }

  videoOverlay.onclick = (e) => { if (e.target === videoOverlay) closeVideo(); };

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && videoOverlay.style.display === 'flex') closeVideo();
  });

  // ==========================================
  //  Novel
  // ==========================================
  let novelProgressTimer = null;

  function startNovelProgressTracking(id) {
    stopNovelProgressTracking();
    const key = 'novel_progress_' + id;
    novelProgressTimer = setInterval(() => {
      const pos = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      // 读到 90% 以上视为读完，清除进度
      if (maxScroll > 0 && pos / maxScroll > 0.9) {
        localStorage.removeItem(key);
        return;
      }
      if (pos > 100) {
        localStorage.setItem(key, pos);
      }
    }, 1500);
  }

  function stopNovelProgressTracking() {
    if (novelProgressTimer) {
      clearInterval(novelProgressTimer);
      novelProgressTimer = null;
    }
  }

  function restoreNovelProgress(id, delay) {
    setTimeout(() => {
      const saved = localStorage.getItem('novel_progress_' + id);
      if (saved) {
        const pos = parseInt(saved, 10);
        if (pos > 0) {
          window.scrollTo({ top: pos, behavior: 'instant' });

          // 显示"回到顶部"按钮
          const topBtn = el('div', 'novel-top-btn');
          topBtn.textContent = '↑ 回到顶部';
          // 检查是否已存在
          if (!document.getElementById('novelTopBtn')) {
            topBtn.id = 'novelTopBtn';
            topBtn.onclick = () => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              localStorage.removeItem('novel_progress_' + id);
              topBtn.remove();
            };
            document.body.appendChild(topBtn);
          }
        }
      }
    }, delay || 300);
  }

  function loadNovelContent(work, readerEl, statusEl) {
    const url = novelUrl(work.id);
    statusEl.textContent = '⏳ 加载中…';
    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(text => {
        statusEl.remove();
        const contentDiv = el('div', 'novel-content');
        contentDiv.textContent = text;
        readerEl.appendChild(contentDiv);
        // 恢复阅读进度
        restoreNovelProgress(work.id, 100);
        // 开始跟踪滚动
        startNovelProgressTracking(work.id);
      })
      .catch(() => {
        statusEl.textContent = '❌ 加载失败';
        statusEl.className = 'novel-status novel-error';
      });
  }

  // ==========================================
  //  Comments (Cusdis)
  // ==========================================
  function renderCommentUI(work) {
    const section = el('div', 'comment-section');
    const title = el('div', 'comment-title');
    title.textContent = '💬 评论区';
    section.appendChild(title);

    const thread = document.createElement('div');
    thread.className = 'cusdis-thread';
    section.appendChild(thread);

    // 立即加载 Cusdis（非折叠，直接展示）
    loadCusdis(thread, work);

    return section;
  }

  function loadCusdis(threadEl, work) {
    threadEl.innerHTML = '';
    threadEl.setAttribute('data-host', 'https://cusdis.com');
    threadEl.setAttribute('data-app-id', CUSDIS_APP_ID);
    threadEl.setAttribute('data-page-id', work.type + '_' + work.id);
    threadEl.setAttribute('data-page-title', work.title);
    threadEl.setAttribute('data-lang', 'zh-cn');
    threadEl.setAttribute('data-page-url', SITE_URL + '#/work/' + encodeURIComponent(work.id));
    if (window.CUSDIS) window.CUSDIS.renderTo(threadEl);

    // Cusdis 通过 srcdoc 渲染（同源），直接用 ResizeObserver 自适应高度
    const checkIframe = setInterval(() => {
      const iframe = threadEl.querySelector('iframe');
      if (!iframe) return;
      clearInterval(checkIframe);

      const ro = new ResizeObserver(() => {
        try {
          const body = iframe.contentDocument?.body;
          if (body) {
            iframe.style.height = body.scrollHeight + 'px';
            iframe.style.overflow = 'hidden';
          }
        } catch (_) {}
      });
      // 等 Cusdis 渲染完再观察
      setTimeout(() => {
        try {
          const body = iframe.contentDocument?.body;
          if (body) ro.observe(body);
        } catch (_) {}
      }, 500);
    }, 100);
  }

  // Cusdis iframe 自适应高度

  // ==========================================
  //  Navigation
  // ==========================================
  function goBack() {
    if (currentWork) {
      stopNovelProgressTracking();
      const topBtn = document.getElementById('novelTopBtn');
      if (topBtn) topBtn.remove();
      currentWork = null;
      render();
    }
  }
  backBtn.onclick = goBack;

  // ==========================================
  //  History / Back Button (Mobile Browser)
  // ==========================================
  window.addEventListener('popstate', () => {
    // 视频播放中 → 关闭视频
    if (videoOverlay.style.display === 'flex') {
      closeVideo();
      return;
    }
    // 大图模式 → 退出大图
    if (viewer.classList.contains('active')) {
      closeViewer();
      return;
    }
    // 作品详情页 → 返回主页
    if (currentWork) {
      currentWork = null;
      render();
      return;
    }
    // 主页 → 让浏览器默认处理（退出）
  });

  // ==========================================
  //  Events
  // ==========================================
  titleEl.onclick = onTitleClick;
  r18Badge.onclick = onR18BadgeClick;

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim();
    if (!currentWork) renderGrid();
  });

  // ==========================================
  //  Utility
  // ==========================================
  function el(tag, cls) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  // ==========================================
  //  Boot
  // ==========================================
  init();

})();
