(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const root = document.documentElement;
  const reader = $("reader");
  const defaults = { width: 800, gap: 12, theme: "dark" };
  const storage = {
    get(key) {
      try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 비공개 모드에서도 읽기는 가능합니다. */ }
    }
  };
  const saved = storage.get("webtoon:settings") || {};
  const settings = {
    width: [640, 800, 1054].includes(saved.width) ? saved.width : defaults.width,
    gap: Number.isInteger(saved.gap) && saved.gap >= 4 && saved.gap <= 40 ? saved.gap : defaults.gap,
    theme: saved.theme === "light" ? "light" : "dark"
  };
  const episodes = window.WEBTOON_EPISODES || [];
  let episode;
  let pages = [];
  let resumePosition;
  let scrollFrame = 0;
  let saveTimer;
  let lastPosition = null;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scrollBehavior = reducedMotion ? "instant" : "smooth";
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  function applySettings() {
    root.dataset.theme = settings.theme;
    root.style.setProperty("--reader-width", `${settings.width}px`);
    root.style.setProperty("--image-gap", `${settings.gap}px`);
    $("reader-width").value = String(settings.width);
    $("image-gap").value = String(settings.gap);
    $("gap-value").textContent = `${settings.gap}px`;
    $("theme-toggle").setAttribute("aria-label", settings.theme === "dark" ? "밝은 화면으로 변경" : "어두운 화면으로 변경");
    document.querySelector('meta[name="theme-color"]').content = settings.theme === "dark" ? "#171918" : "#f4f4ef";
    storage.set("webtoon:settings", settings);
    requestUpdate();
  }

  // 각 경로 조각을 인코딩하여 폴더명의 공백, 한글, %를 보존합니다.
  function imageURL(folder, file) {
    return `./${folder.split("/").map(encodeURIComponent).join("/")}/${encodeURIComponent(file)}`;
  }

  function createPage(image, index) {
    const figure = document.createElement("figure");
    figure.className = "comic-page";
    figure.id = `page-${index + 1}`;
    const img = document.createElement("img");
    img.alt = `${Number(episode.id)}화 ${episode.title} — ${index + 1}번째 이미지`;
    if (image.width && image.height) { img.width = image.width; img.height = image.height; }
    img.loading = index < 2 ? "eager" : "lazy";
    img.decoding = "async";
    if (index === 0) img.fetchPriority = "high";
    const error = document.createElement("div");
    error.className = "image-error";
    error.hidden = true;
    error.setAttribute("role", "alert");
    const message = document.createElement("span");
    message.textContent = `${index + 1}번째 이미지를 불러오지 못했어요.`;
    const retry = document.createElement("button");
    retry.textContent = "다시 불러오기";
    retry.addEventListener("click", () => {
      error.hidden = true;
      img.hidden = false;
      img.src = imageURL(episode.folder, image.file);
    });
    error.append(message, retry);
    img.addEventListener("error", () => { img.hidden = true; error.hidden = false; requestUpdate(); });
    img.addEventListener("load", requestUpdate);
    img.src = imageURL(episode.folder, image.file);
    figure.append(img, error);
    return figure;
  }

  function loadEpisode(id, resetScroll = false) {
    clearTimeout(saveTimer);
    episode = episodes.find((item) => item.id === id) || episodes[episodes.length - 1];
    if (!episode) {
      reader.textContent = "아직 등록된 회차가 없어요. episodes.js에 이미지를 추가해 주세요.";
      return;
    }
    lastPosition = null;
    const number = Number(episode.id);
    document.title = `${number}화 · ${episode.title} — 나의 웹툰`;
    $("header-episode").textContent = `${episode.id} / ${episode.title}`;
    $("episode-title").textContent = episode.title;
    $("episode-badge").textContent = `EPISODE ${episode.id}`;
    $("page-total").textContent = `${episode.images.length}장의 이야기`;
    $("position-total").textContent = ` / ${episode.images.length}`;
    $("end-eyebrow").textContent = `EPISODE ${episode.id} · END`;
    $("end-description").textContent = `${number}화를 모두 읽었어요. 함께해 주셔서 고마워요.`;
    $("episode-select").value = episode.id;
    pages = episode.images.map(createPage);
    reader.replaceChildren(...pages);
    const position = storage.get(`webtoon:position:${episode.id}`);
    resumePosition = position && Number.isInteger(position.page) && position.page >= 0 && position.page < pages.length
      ? { page: position.page, fraction: Math.max(0, Math.min(1, Number(position.fraction) || 0)) } : null;
    $("resume-bar").hidden = !resumePosition || (resumePosition.page === 0 && resumePosition.fraction < 0.1);
    if (resumePosition) $("resume-text").textContent = `${resumePosition.page + 1}번째 이미지까지 읽었어요.`;
    if (resetScroll) window.scrollTo({ top: 0, behavior: "instant" });
    requestUpdate();
  }

  function updatePosition() {
    scrollFrame = 0;
    if (!pages.length) return;
    // 뷰포트 상단 근처를 기준으로 현재 이미지와 이미지 안의 위치를 기록합니다.
    const marker = Math.min(window.innerHeight * 0.3, 220);
    let index = 0;
    for (let i = 0; i < pages.length; i++) {
      if (pages[i].getBoundingClientRect().top <= marker) index = i;
      else break;
    }
    const rect = pages[index].getBoundingClientRect();
    const first = pages[0].getBoundingClientRect();
    const last = pages[pages.length - 1].getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, (window.innerHeight - first.top) / Math.max(1, last.bottom - first.top)));
    $("current-page").textContent = String(index + 1);
    $("reading-fill").style.width = `${progress * 100}%`;
    if (first.top < marker) {
      lastPosition = { page: index, fraction: Math.max(0, Math.min(1, (marker - rect.top) / Math.max(1, rect.height))) };
      clearTimeout(saveTimer);
      saveTimer = setTimeout(savePosition, 200);
    }
  }

  function savePosition() {
    if (episode && lastPosition) storage.set(`webtoon:position:${episode.id}`, lastPosition);
  }
  function requestUpdate() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updatePosition);
  }

  $("settings-open").addEventListener("click", () => $("settings-dialog").showModal());
  $("settings-close").addEventListener("click", () => $("settings-dialog").close());
  $("settings-dialog").addEventListener("click", (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.target === event.currentTarget && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) event.currentTarget.close();
  });
  $("theme-toggle").addEventListener("click", () => { settings.theme = settings.theme === "dark" ? "light" : "dark"; applySettings(); });
  $("reader-width").addEventListener("change", (event) => { settings.width = Number(event.target.value); applySettings(); });
  $("image-gap").addEventListener("input", (event) => { settings.gap = Number(event.target.value); applySettings(); });
  $("settings-reset").addEventListener("click", () => { Object.assign(settings, defaults); applySettings(); $("status-message").textContent = "보기 설정을 기본값으로 되돌렸어요."; });
  $("resume-button").addEventListener("click", () => {
    if (!resumePosition) return;
    $("resume-bar").hidden = true;
    const rect = pages[resumePosition.page].getBoundingClientRect();
    const marker = Math.min(window.innerHeight * 0.3, 220);
    window.scrollTo({ top: window.scrollY + rect.top + rect.height * resumePosition.fraction - marker, behavior: scrollBehavior });
  });
  $("resume-dismiss").addEventListener("click", () => { $("resume-bar").hidden = true; });
  $("back-to-top").addEventListener("click", () => window.scrollTo({ top: 0, behavior: scrollBehavior }));
  $("restart-button").addEventListener("click", () => pages[0]?.scrollIntoView({ behavior: scrollBehavior, block: "start" }));
  episodes.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = `${Number(item.id)}화 · ${item.title}`;
    $("episode-select").append(option);
  });
  $("episode-select").addEventListener("change", (event) => {
    savePosition();
    const url = new URL(window.location.href);
    url.searchParams.set("episode", event.target.value);
    history.replaceState(null, "", url);
    loadEpisode(event.target.value, true);
  });
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate, { passive: true });
  window.addEventListener("pagehide", savePosition);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") savePosition(); });
  applySettings();
  loadEpisode(new URLSearchParams(window.location.search).get("episode"));
})();
