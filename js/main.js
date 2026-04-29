// =====================
// Year in footer
// =====================
const yearElement = document.getElementById("year");
if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

// =====================
// Headshot upload
// =====================
const headshotImg = document.getElementById("headshot-img");
const headshotUpload = document.getElementById("headshot-upload");
const HEADSHOT_KEY = "teacherPortfolioHeadshot";

// Restore saved headshot
const savedHeadshot = localStorage.getItem(HEADSHOT_KEY);
if (savedHeadshot && headshotImg) {
  headshotImg.src = savedHeadshot;
}

if (headshotUpload && headshotImg) {
  headshotUpload.addEventListener("change", () => {
    const file = headshotUpload.files[0];
    if (!file || !file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      headshotImg.src = reader.result;
      try {
        localStorage.setItem(HEADSHOT_KEY, reader.result);
      } catch {
        // Storage full — photo shows this session but won't persist
      }
    });
    reader.readAsDataURL(file);
  });
}

// =====================
// Editable area — auto-save to localStorage
// =====================
const STORAGE_KEY = "teacherPortfolioPaneContent";

function getSavedContent() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveContent(next) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

const editableAreas = Array.from(document.querySelectorAll(".editable-area"));
const savedContent = getSavedContent();

editableAreas.forEach((area) => {
  const key = area.dataset.saveKey;
  if (!key) return;

  if (savedContent[key]) {
    area.innerHTML = savedContent[key];
  }

  area.addEventListener("input", () => {
    const latest = getSavedContent();
    latest[key] = area.innerHTML;
    saveContent(latest);
  });
});

// =====================
// Portfolio image upload
// =====================
const portfolioUploadInput = document.getElementById("portfolio-image-upload");
const portfolioImageGrid = document.getElementById("portfolio-image-grid");
const portfolioPrevButton = document.getElementById("portfolio-prev");
const portfolioNextButton = document.getElementById("portfolio-next");
const PORTFOLIO_IMAGES_KEY = "teacherPortfolioImages";
const PORTFOLIO_DB_NAME = "teacherPortfolioDB";
const PORTFOLIO_STORE = "portfolioImages";
const MAX_PORTFOLIO_IMAGES = 15;
const CAROUSEL_INTERVAL_MS = 5000;
let currentPortfolioIndex = 0;
let portfolioCarouselTimer = null;

function isPdfFile(file) {
  const name = typeof file.name === "string" ? file.name.toLowerCase() : "";
  return file.type === "application/pdf" || name.endsWith(".pdf");
}

function isAcceptedPortfolioFile(file) {
  return file.type.startsWith("image/") || isPdfFile(file);
}

function openPortfolioDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PORTFOLIO_DB_NAME, 1);

    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PORTFOLIO_STORE)) {
        db.createObjectStore(PORTFOLIO_STORE, { keyPath: "id", autoIncrement: true });
      }
    });

    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

function readAllPortfolioImages(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PORTFOLIO_STORE, "readonly");
    const store = tx.objectStore(PORTFOLIO_STORE);
    const request = store.getAll();

    request.addEventListener("success", () => {
      const records = Array.isArray(request.result) ? request.result : [];
      const normalized = records
        .map((item, index) => {
          const src = typeof item === "string" ? item : item.src;
          const type = item.type || (src && src.startsWith("data:application/pdf") ? "pdf" : "image");
          const name = item.name || `Artifact ${index + 1}`;
          const note = item.note || "";
          return { id: item.id, src, type, name, note };
        })
        .filter((item) => typeof item.src === "string" && item.src.length > 0)
        .sort((a, b) => a.id - b.id);
      resolve(normalized);
    });
    request.addEventListener("error", () => reject(request.error));
  });
}

function addPortfolioImage(db, src) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PORTFOLIO_STORE, "readwrite");
    const store = tx.objectStore(PORTFOLIO_STORE);
    const request = store.add(src);

    request.addEventListener("success", () => resolve());
    request.addEventListener("error", () => reject(request.error));
  });
}

function removePortfolioImage(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PORTFOLIO_STORE, "readwrite");
    const store = tx.objectStore(PORTFOLIO_STORE);
    const request = store.delete(id);

    request.addEventListener("success", () => resolve());
    request.addEventListener("error", () => reject(request.error));
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

async function migrateLegacyPortfolioImages(db) {
  let legacyImages;
  try {
    legacyImages = JSON.parse(localStorage.getItem(PORTFOLIO_IMAGES_KEY) || "[]");
  } catch {
    legacyImages = [];
  }

  if (!Array.isArray(legacyImages) || !legacyImages.length) return;

  for (const src of legacyImages.slice(0, MAX_PORTFOLIO_IMAGES)) {
    if (typeof src === "string" && src.startsWith("data:image")) {
      await addPortfolioImage(db, { src, type: "image", name: "Uploaded image" });
    }
  }

  localStorage.removeItem(PORTFOLIO_IMAGES_KEY);
}

function renderPortfolioImages(images, db) {
  if (!portfolioImageGrid) return;

  portfolioImageGrid.innerHTML = "";
  if (currentPortfolioIndex >= images.length) {
    currentPortfolioIndex = Math.max(images.length - 1, 0);
  }

  if (portfolioPrevButton) {
    portfolioPrevButton.disabled = images.length <= 1;
  }
  if (portfolioNextButton) {
    portfolioNextButton.disabled = images.length <= 1;
  }

  if (!images.length) {
    const emptyState = document.createElement("p");
    emptyState.className = "portfolio-image-empty";
    emptyState.textContent = "No artifacts uploaded yet.";
    portfolioImageGrid.appendChild(emptyState);
    return;
  }

  images.forEach((item, index) => {
    if (index !== currentPortfolioIndex) return;

    const card = document.createElement("div");
    card.className = "portfolio-image-card";

    if (item.type === "pdf") {
      const fileCard = document.createElement("div");
      fileCard.className = "portfolio-file-card";

      const badge = document.createElement("span");
      badge.className = "portfolio-file-badge";
      badge.textContent = "PDF";

      const name = document.createElement("p");
      name.className = "portfolio-file-name";
      name.textContent = item.name || `Portfolio document ${index + 1}`;

      const openLink = document.createElement("a");
      openLink.className = "portfolio-file-link";
      openLink.href = item.src;
      openLink.target = "_blank";
      openLink.rel = "noopener noreferrer";
      openLink.textContent = "Open PDF";

      const pdfPreview = document.createElement("iframe");
      pdfPreview.className = "portfolio-pdf-preview";
      pdfPreview.src = item.src;
      pdfPreview.title = item.name || `Portfolio PDF ${index + 1}`;

      fileCard.appendChild(badge);
      fileCard.appendChild(name);
      fileCard.appendChild(pdfPreview);
      fileCard.appendChild(openLink);
      card.appendChild(fileCard);
    } else {
      const image = document.createElement("img");
      image.src = item.src;
      image.alt = `Portfolio upload ${index + 1}`;
      card.appendChild(image);
    }

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "portfolio-image-remove";
    removeButton.setAttribute("aria-label", `Remove artifact ${index + 1}`);
    removeButton.textContent = "x";

    removeButton.addEventListener("click", async () => {
      await removePortfolioImage(db, item.id);
      const latest = await readAllPortfolioImages(db);
      renderPortfolioImages(latest, db);
    });

    card.appendChild(removeButton);
    portfolioImageGrid.appendChild(card);
  });
}

function stopPortfolioCarousel() {
  if (portfolioCarouselTimer) {
    clearInterval(portfolioCarouselTimer);
    portfolioCarouselTimer = null;
  }
}

function startPortfolioCarousel(db) {
  stopPortfolioCarousel();
  portfolioCarouselTimer = setInterval(async () => {
    const latest = await readAllPortfolioImages(db);
    if (latest.length <= 1) return;
    currentPortfolioIndex = (currentPortfolioIndex + 1) % latest.length;
    renderPortfolioImages(latest, db);
  }, CAROUSEL_INTERVAL_MS);
}

if (portfolioUploadInput && portfolioImageGrid) {
  (async () => {
    try {
      const db = await openPortfolioDb();
      await migrateLegacyPortfolioImages(db);
      const savedImages = await readAllPortfolioImages(db);
      renderPortfolioImages(savedImages, db);
      startPortfolioCarousel(db);

      if (portfolioPrevButton) {
        portfolioPrevButton.addEventListener("click", async () => {
          const latest = await readAllPortfolioImages(db);
          if (!latest.length) return;
          currentPortfolioIndex = (currentPortfolioIndex - 1 + latest.length) % latest.length;
          renderPortfolioImages(latest, db);
          startPortfolioCarousel(db);
        });
      }

      if (portfolioNextButton) {
        portfolioNextButton.addEventListener("click", async () => {
          const latest = await readAllPortfolioImages(db);
          if (!latest.length) return;
          currentPortfolioIndex = (currentPortfolioIndex + 1) % latest.length;
          renderPortfolioImages(latest, db);
          startPortfolioCarousel(db);
        });
      }

      portfolioUploadInput.addEventListener("change", async () => {
        const files = Array.from(portfolioUploadInput.files || []).filter((file) => isAcceptedPortfolioFile(file));
        if (!files.length) {
          portfolioUploadInput.value = "";
          return;
        }

        const current = await readAllPortfolioImages(db);
        const remainingSlots = MAX_PORTFOLIO_IMAGES - current.length;

        if (remainingSlots <= 0) {
          renderPortfolioImages(current, db);
          portfolioUploadInput.value = "";
          return;
        }

        const filesToAdd = files.slice(0, remainingSlots);

        try {
          for (const file of filesToAdd) {
            const src = await readFileAsDataUrl(file);
            const type = isPdfFile(file) ? "pdf" : "image";
            await addPortfolioImage(db, { src, type, name: file.name, note: "" });
          }
        } catch {
          portfolioUploadInput.value = "";
          return;
        }

        const latest = await readAllPortfolioImages(db);
        if (latest.length) {
          currentPortfolioIndex = latest.length - 1;
        }
        renderPortfolioImages(latest, db);
        startPortfolioCarousel(db);
        portfolioUploadInput.value = "";
      });
    } catch {
      // If IndexedDB is unavailable, keep the UI stable.
      renderPortfolioImages([], null);
    }
  })();
}

// =====================
// Resume preview + download
// =====================
const resumePreview = document.getElementById("resume-preview");
const resumeDownloadLink = document.getElementById("resume-download-link");
const resumeUploadInput = document.getElementById("resume-upload");
const resumeStatus = document.getElementById("resume-status");
const RESUME_PDF_KEY = "teacherResumePdf";
const DEFAULT_RESUME_URL = "assets/resume.pdf";

function setResumeSource(src, message) {
  if (resumePreview) {
    resumePreview.src = src;
  }

  if (resumeDownloadLink) {
    resumeDownloadLink.href = src;
  }

  if (resumeStatus) {
    resumeStatus.textContent = message;
  }
}

async function initializeResumePreview() {
  if (!resumePreview || !resumeDownloadLink) return;

  const savedResume = localStorage.getItem(RESUME_PDF_KEY);
  if (savedResume) {
    setResumeSource(savedResume, "Using uploaded resume PDF.");
    return;
  }

  try {
    const response = await fetch(DEFAULT_RESUME_URL, { method: "HEAD" });
    if (response.ok) {
      setResumeSource(DEFAULT_RESUME_URL, "Showing default resume PDF.");
      return;
    }
  } catch {
    // Continue to fallback text below.
  }

  if (resumePreview) {
    resumePreview.removeAttribute("src");
  }
  if (resumeDownloadLink) {
    resumeDownloadLink.href = "#";
  }
  if (resumeStatus) {
    resumeStatus.textContent = "No resume PDF found yet. Upload a PDF to enable preview and download.";
  }
}

if (resumeUploadInput) {
  resumeUploadInput.addEventListener("change", async () => {
    const file = resumeUploadInput.files && resumeUploadInput.files[0];
    if (!file) return;

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      if (resumeStatus) {
        resumeStatus.textContent = "Please upload a PDF file.";
      }
      resumeUploadInput.value = "";
      return;
    }

    try {
      const src = await readFileAsDataUrl(file);
      localStorage.setItem(RESUME_PDF_KEY, src);
      setResumeSource(src, "Resume uploaded. Preview and download are ready.");
    } catch {
      if (resumeStatus) {
        resumeStatus.textContent = "Upload failed. Try a smaller PDF and upload again.";
      }
    }

    resumeUploadInput.value = "";
  });
}

initializeResumePreview();

// =====================
// Home resume modal preview + download
// =====================
const homeResumeTrigger = document.getElementById("resume-preview-trigger");
const homeResumeModal = document.getElementById("resume-preview-modal");
const homeResumePreview = document.getElementById("home-resume-preview");
const homeResumeYes = document.getElementById("resume-download-yes");
const homeResumeNo = document.getElementById("resume-download-no");

function getResumeSourceForHome() {
  const savedResume = localStorage.getItem(RESUME_PDF_KEY);
  if (savedResume) return savedResume;
  return DEFAULT_RESUME_URL;
}

function openHomeResumeModal() {
  if (!homeResumeModal || !homeResumePreview) return;
  const src = getResumeSourceForHome();
  homeResumePreview.src = src;
  homeResumeModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeHomeResumeModal() {
  if (!homeResumeModal || !homeResumePreview) return;
  homeResumeModal.hidden = true;
  homeResumePreview.removeAttribute("src");
  document.body.style.overflow = "";
}

function downloadResumeFromHome() {
  const src = getResumeSourceForHome();
  if (!src || src === "#") {
    closeHomeResumeModal();
    return;
  }

  const link = document.createElement("a");
  link.href = src;
  link.download = "Melissa-Walter-Resume.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  closeHomeResumeModal();
}

if (homeResumeTrigger) {
  homeResumeTrigger.addEventListener("click", (event) => {
    event.preventDefault();
    openHomeResumeModal();
  });
}

if (homeResumeModal) {
  homeResumeModal.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof Element && target.getAttribute("data-close-resume-modal") === "true") {
      closeHomeResumeModal();
    }
  });
}

if (homeResumeYes) {
  homeResumeYes.addEventListener("click", downloadResumeFromHome);
}

if (homeResumeNo) {
  homeResumeNo.addEventListener("click", closeHomeResumeModal);
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && homeResumeModal && !homeResumeModal.hidden) {
    closeHomeResumeModal();
  }
});

