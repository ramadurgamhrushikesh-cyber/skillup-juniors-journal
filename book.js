(function () {
  const leavesEl = document.getElementById("leaves");
  const edgeLeft = document.getElementById("edge-left");
  const edgeRight = document.getElementById("edge-right");
  const status = document.getElementById("status");
  const countEl = document.getElementById("count");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  const hitPrev = document.getElementById("hit-prev");
  const hitNext = document.getElementById("hit-next");
  const book = document.getElementById("book");
  const modeOne = document.getElementById("mode-one");
  const modeTwo = document.getElementById("mode-two");
  const sheetEl = document.getElementById("sheet");
  const leftCanvas = document.getElementById("left-page");
  const rightCanvas = document.getElementById("right-page");
  const sheetFront = document.getElementById("sheet-front");
  const sheetBack = document.getElementById("sheet-back");

  const sources = [];
  let sheet = 0;
  let side = 0;
  let busy = false;
  let total = 0;
  let mode = "two";

  pdfjsLib.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.js";

  function halves() {
    return total * 2;
  }

  function cursor() {
    return sheet * 2 + side;
  }

  function drawHalf(canvas, page, which) {
    const face = canvas.parentElement;
    const ctx = canvas.getContext("2d");
    if (page == null || page < 0 || page >= total || !sources[page] || !sources[page].width) {
      face.classList.add("blank");
      ctx.clearRect(0, 0, canvas.width || 1, canvas.height || 1);
      return;
    }
    const src = sources[page];
    const sw = Math.floor(src.width / 2);
    const sh = src.height;
    face.classList.remove("blank");
    if (canvas.width !== sw || canvas.height !== sh) {
      canvas.width = sw;
      canvas.height = sh;
    }
    ctx.drawImage(src, which === "right" ? sw : 0, 0, sw, sh, 0, 0, sw, sh);
  }

  function paintBook() {
    if (mode === "two") {
      drawHalf(leftCanvas, sheet, "left");
      drawHalf(rightCanvas, sheet, "right");
    } else {
      drawHalf(leftCanvas, sheet, side === 0 ? "left" : "right");
    }
    sheetEl.classList.remove("on");
    sheetEl.style.transition = "none";
    sheetEl.style.transform = "";
  }

  function paintChrome() {
    if (!total) {
      countEl.textContent = "Page";
      return;
    }
    const atStart = mode === "two" ? sheet <= 0 : cursor() <= 0;
    const atEnd = mode === "two" ? sheet >= total - 1 : cursor() >= halves() - 1;
    if (mode === "two") countEl.textContent = "Pages " + (sheet * 2 + 1) + "–" + (sheet * 2 + 2) + " of " + halves();
    else countEl.textContent = "Page " + (cursor() + 1) + " of " + halves();
    prevBtn.disabled = atStart || busy;
    nextBtn.disabled = atEnd || busy;
    hitPrev.disabled = atStart || busy;
    hitNext.disabled = atEnd || busy;
    const depth = mode === "two" ? sheet : Math.floor(cursor() / 2);
    edgeLeft.style.width = depth * 6 + "px";
    edgeRight.style.width = Math.max(0, total - 1 - depth) * 6 + "px";
  }

  function settle(nextSheet, nextSide) {
    sheetEl.classList.remove("on");
    sheetEl.style.transition = "none";
    sheetEl.style.transform = "rotateY(0deg)";
    sheet = nextSheet;
    side = nextSide;
    busy = false;
    paintBook();
    paintChrome();
    status.textContent = "";
  }

  function flip(fromTransform, toTransform, done) {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      sheetEl.removeEventListener("transitionend", onEnd);
      done();
    };
    const onEnd = (event) => {
      if (event.propertyName !== "transform") return;
      finish();
    };
    sheetEl.classList.add("on");
    sheetEl.style.transition = "none";
    sheetEl.style.transform = fromTransform;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    void sheetEl.offsetWidth;
    sheetEl.style.transition = "";
    sheetEl.style.transform = toTransform;
    sheetEl.addEventListener("transitionend", onEnd);
    setTimeout(finish, 1100);
  }

  function turnTwo(dir) {
    const next = sheet + dir;
    if (next < 0 || next >= total) return;
    busy = true;
    paintChrome();
    if (dir > 0) {
      drawHalf(leftCanvas, sheet, "left");
      drawHalf(rightCanvas, next, "right");
      drawHalf(sheetFront, sheet, "right");
      drawHalf(sheetBack, next, "left");
      flip("rotateY(0deg)", "rotateY(-180deg)", () => settle(next, 0));
    } else {
      drawHalf(leftCanvas, next, "left");
      drawHalf(rightCanvas, sheet, "right");
      drawHalf(sheetFront, next, "right");
      drawHalf(sheetBack, sheet, "left");
      flip("rotateY(-180deg)", "rotateY(0deg)", () => settle(next, 0));
    }
  }

  function turnOne(dir) {
    const next = cursor() + dir;
    if (next < 0 || next >= halves()) return;
    const nextSheet = Math.floor(next / 2);
    const nextSide = next % 2;
    const nextWhich = nextSide === 0 ? "left" : "right";
    const currentWhich = side === 0 ? "left" : "right";
    const backFace = document.getElementById("sheet-back-face");
    busy = true;
    paintChrome();
    backFace.classList.add("blank");
    if (dir > 0) {
      drawHalf(leftCanvas, nextSheet, nextWhich);
      drawHalf(sheetFront, sheet, currentWhich);
      flip("rotateY(0deg)", "rotateY(-180deg)", () => {
        backFace.classList.remove("blank");
        settle(nextSheet, nextSide);
      });
    } else {
      drawHalf(leftCanvas, sheet, currentWhich);
      drawHalf(sheetFront, nextSheet, nextWhich);
      flip("rotateY(-180deg)", "rotateY(0deg)", () => {
        backFace.classList.remove("blank");
        settle(nextSheet, nextSide);
      });
    }
  }

  function turn(dir) {
    if (busy || !total) return;
    if (mode === "two") turnTwo(dir);
    else turnOne(dir);
  }

  function setMode(next) {
    if (busy || next === mode) return;
    mode = next;
    book.dataset.mode = mode;
    modeOne.setAttribute("aria-pressed", mode === "one" ? "true" : "false");
    modeTwo.setAttribute("aria-pressed", mode === "two" ? "true" : "false");
    if (mode === "two") side = 0;
    paintBook();
    paintChrome();
  }

  function buildSources(n) {
    total = n;
    for (let i = 0; i < n; i += 1) {
      const canvas = document.createElement("canvas");
      leavesEl.appendChild(canvas);
      sources.push(canvas);
    }
  }

  async function renderPage(pdf, number) {
    const page = await pdf.getPage(number);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 1500 / base.width });
    const canvas = sources[number - 1];
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport: viewport }).promise;
    if (!busy) paintBook();
  }

  async function openBook() {
    const pdf = await pdfjsLib.getDocument("./jne-vol-1.pdf").promise;
    buildSources(pdf.numPages);
    status.textContent = "Setting the pages…";
    await renderPage(pdf, 1);
    status.textContent = "Volume 1 is open.";
    paintChrome();
    for (let n = 2; n <= pdf.numPages; n += 1) await renderPage(pdf, n);
  }

  modeOne.addEventListener("click", () => setMode("one"));
  modeTwo.addEventListener("click", () => setMode("two"));
  prevBtn.addEventListener("click", () => turn(-1));
  nextBtn.addEventListener("click", () => turn(1));
  hitPrev.addEventListener("click", () => turn(-1));
  hitNext.addEventListener("click", () => turn(1));
  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") turn(1);
    if (event.key === "ArrowLeft") turn(-1);
  });

  openBook().catch((error) => {
    status.textContent = "The journal could not be opened.";
    console.error(error);
  });
})();
