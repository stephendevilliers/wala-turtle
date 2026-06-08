import "./style.css";
import "./components/wala-turtle";
import watchpostLogo from "./assets/watchpost-logo.webp";

console.log(
  "[main] Custom element defined:",
  customElements.get("wala-turtle"),
);

function createApp(): void {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) return;

  const header = createHeader();
  const main = createMain();
  const footer = createFooter();

  app.appendChild(header);
  app.appendChild(main);
  app.appendChild(footer);
}

function createHeader(): HTMLElement {
  const header = document.createElement("header");
  header.className = "header";

  const logo = document.createElement("div");
  logo.className = "header__logo";
  logo.innerHTML = `
    <svg class="header__logo-icon" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="8" fill="#8ABE55"/>
      <path d="M10 12h20v4H10zM10 20h14v4H10zM10 28h18v4H10z" fill="white"/>
    </svg>
    <span class="header__title">Wala Animation Demo</span>
  `;

  const badge = document.createElement("span");
  badge.className = "header__badge";
  badge.textContent = "Preview";

  header.appendChild(logo);
  header.appendChild(badge);

  return header;
}

function createMain(): HTMLElement {
  const main = document.createElement("main");
  main.className = "main";

  const title = document.createElement("h1");
  title.className = "section-title";
  title.textContent = "Animation Preview";

  const subtitle = document.createElement("p");
  subtitle.className = "section-subtitle";
  subtitle.textContent =
    "Interactive demonstration of the custom animation component";

  const turtle = document.createElement("wala-turtle");
  turtle.setAttribute("asset-path", "/assets");
  turtle.setAttribute("walk-speed", "45");
  turtle.setAttribute("width", "240px");
  turtle.setAttribute("starting-top-position", "400");
  turtle.setAttribute("z-index", "1");
  document.body.appendChild(turtle);

  const spacer = document.createElement("div");
  spacer.className = "demo-spacer";

  const container = document.createElement("div");
  container.className = "demo-container";

  const controls = createControls(turtle);
  const docs = createDocs();

  container.appendChild(controls);
  container.appendChild(docs);

  main.appendChild(title);
  main.appendChild(subtitle);
  main.appendChild(spacer);
  main.appendChild(container);

  return main;
}

function createControls(turtle: HTMLElement): HTMLElement {
  const controls = document.createElement("section");
  controls.className = "controls";

  const title = document.createElement("h2");
  title.className = "controls__title";
  title.textContent = "Live props";

  const grid = document.createElement("div");
  grid.className = "controls__grid";

  const widthField = document.createElement("label");
  widthField.className = "controls__field";
  widthField.innerHTML = "<span>Width (px)</span>";
  const widthInput = document.createElement("input");
  widthInput.type = "number";
  widthInput.min = "50";
  widthInput.max = "800";
  widthInput.value = "240";
  const WIDTH_MAX = 480;
  widthInput.addEventListener("input", () => {
    const value = Number(widthInput.value);
    if (!Number.isNaN(value) && value > 0) {
      turtle.setAttribute("width", `${value}px`);
    }
    widthInput.classList.toggle("controls__input--over", value > WIDTH_MAX);
  });
  widthField.appendChild(widthInput);

  const speedField = document.createElement("label");
  speedField.className = "controls__field";
  speedField.innerHTML = "<span>Walk speed</span>";
  const speedInput = document.createElement("input");
  speedInput.type = "number";
  speedInput.min = "10";
  speedInput.max = "300";
  speedInput.value = "45";
  const SPEED_MAX = 150;
  speedInput.addEventListener("input", () => {
    const value = Number(speedInput.value);
    if (!Number.isNaN(value) && value > 0) {
      turtle.setAttribute("walk-speed", String(value));
    }
    speedInput.classList.toggle("controls__input--over", value > SPEED_MAX);
  });
  speedField.appendChild(speedInput);

  const dodgeField = document.createElement("label");
  dodgeField.className = "controls__field";
  dodgeField.innerHTML = "<span>Dodge proximity (px)</span>";
  const dodgeInput = document.createElement("input");
  dodgeInput.type = "number";
  dodgeInput.min = "50";
  dodgeInput.max = "500";
  dodgeInput.value = "150";
  dodgeInput.addEventListener("input", () => {
    const value = Number(dodgeInput.value);
    if (!Number.isNaN(value) && value > 0) {
      turtle.setAttribute("dodge-proximity", String(value));
    }
  });
  dodgeField.appendChild(dodgeInput);

  const topField = document.createElement("label");
  topField.className = "controls__field";
  topField.innerHTML = "<span>Top position (px)</span>";
  const topInput = document.createElement("input");
  topInput.type = "number";
  topInput.min = "0";
  topInput.max = "2000";
  topInput.value = "400";
  topInput.addEventListener("input", () => {
    const value = Number(topInput.value);
    if (!Number.isNaN(value) && value >= 0) {
      turtle.setAttribute("starting-top-position", String(value));
    }
  });
  topField.appendChild(topInput);

  const zIndexField = document.createElement("label");
  zIndexField.className = "controls__field";
  zIndexField.innerHTML = "<span>Z-index</span>";
  const zIndexInput = document.createElement("input");
  zIndexInput.type = "number";
  zIndexInput.value = "1";
  zIndexInput.addEventListener("input", () => {
    const value = Number(zIndexInput.value);
    if (!Number.isNaN(value)) {
      turtle.setAttribute("z-index", String(value));
    }
  });
  zIndexField.appendChild(zIndexInput);

  const positionField = document.createElement("label");
  positionField.className = "controls__field";
  positionField.innerHTML = "<span>Position</span>";
  const positionSelect = document.createElement("select");
  for (const value of ["fixed", "absolute"]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    positionSelect.appendChild(option);
  }
  positionSelect.value = "fixed";
  positionSelect.addEventListener("change", () => {
    turtle.setAttribute("position", positionSelect.value);
  });
  positionField.appendChild(positionSelect);

  const loopField = document.createElement("label");
  loopField.className = "controls__field";
  loopField.innerHTML = "<span>Loop</span>";
  const loopSelect = document.createElement("select");
  for (const value of ["true", "false"]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    loopSelect.appendChild(option);
  }
  loopSelect.value = "true";
  loopSelect.addEventListener("change", () => {
    turtle.setAttribute("loop", loopSelect.value);
  });
  loopField.appendChild(loopSelect);

  const interactionField = document.createElement("label");
  interactionField.className = "controls__field";
  interactionField.innerHTML = "<span>Interaction</span>";
  const interactionSelect = document.createElement("select");
  for (const value of ["true", "false"]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    interactionSelect.appendChild(option);
  }
  interactionSelect.value = "true";
  interactionSelect.addEventListener("change", () => {
    turtle.setAttribute("interaction", interactionSelect.value);
  });
  interactionField.appendChild(interactionSelect);

  grid.appendChild(widthField);
  grid.appendChild(speedField);
  grid.appendChild(dodgeField);
  grid.appendChild(topField);
  grid.appendChild(zIndexField);
  grid.appendChild(positionField);
  grid.appendChild(loopField);
  grid.appendChild(interactionField);

  controls.appendChild(title);
  controls.appendChild(grid);

  return controls;
}

function createDocs(): HTMLElement {
  const docs = document.createElement("section");
  docs.className = "docs";

  docs.innerHTML = `
    <h2 class="docs__title">
      <svg class="docs__title-icon" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
      </svg>
      Installation
    </h2>
    <div class="docs__download">
      <a href="/wala-turtle.js" download class="docs__download-btn">
        <svg viewBox="0 0 20 20" fill="currentColor" class="docs__download-icon">
          <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
        </svg>
        Download wala-turtle.js
      </a>
      <a href="/wala-turtle-assets.zip" download class="docs__download-btn">
        <svg viewBox="0 0 20 20" fill="currentColor" class="docs__download-icon">
          <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
        </svg>
        Download wala-turtle-assets.zip
      </a>
    </div>
    <div class="docs__notes">
      <h3 class="docs__notes-title">Step 1: Download both files above</h3>
      <p class="docs__notes-text">You need the component script and the animation assets zip.</p>
    </div>
    <div class="docs__notes">
      <h3 class="docs__notes-title">Step 2: Unzip the assets</h3>
      <p class="docs__notes-text">Extract <code>wala-turtle-assets.zip</code> into a folder on your website (e.g. <code>/assets/turtle/</code>). It contains the animation videos in both <code>.webm</code> and <code>.mp4</code> formats.</p>
    </div>
    <div class="docs__notes">
      <h3 class="docs__notes-title">Step 3: Add the script to your site</h3>
      <p class="docs__notes-text">Upload <code>wala-turtle.js</code> and add the script tag to your HTML:</p>
    </div>
    <div class="docs__code">
      <pre><span class="tag">&lt;script</span> <span class="attr">src</span>=<span class="value">"/path/to/wala-turtle.js"</span><span class="tag">&gt;&lt;/script&gt;</span></pre>
    </div>
    <div class="docs__notes">
      <h3 class="docs__notes-title">Step 4: Add the component</h3>
      <p class="docs__notes-text">Place the custom element in your HTML and set <code>asset-path</code> to the folder where you unzipped the assets:</p>
    </div>
    <div class="docs__code">
      <pre><span class="tag">&lt;wala-turtle</span>
  <span class="attr">asset-path</span>=<span class="value">"/assets/turtle"</span>
  <span class="attr">width</span>=<span class="value">"240px"</span>
  <span class="attr">walk-speed</span>=<span class="value">"60"</span>
<span class="tag">&gt;&lt;/wala-turtle&gt;</span></pre>
    </div>
    <div class="docs__notes">
      <h3 class="docs__notes-title">Attributes</h3>
      <ul class="docs__notes-list">
        <li><strong>asset-path</strong> — <em>(required)</em> Path to the folder containing walkingloop, lookuploop, dodgeup, dodgedown (.webm/.mp4)</li>
        <li><strong>width</strong> — Width of the turtle (default: 240px, max: 480px — larger values are clamped to avoid degraded video quality)</li>
        <li><strong>walk-speed</strong> — Relative walking speed; controls both translation and video playback rate, and scales with the turtle's size so his stride looks right at any width (default: 45, max: 150 — higher speeds are clamped as the animation breaks down)</li>
        <li><strong>dodge-proximity</strong> — Distance in pixels at which the turtle reacts to the mouse (default: 150)</li>
        <li><strong>starting-top-position</strong> — Distance from top in pixels (default: 1000)</li>
        <li><strong>z-index</strong> — CSS z-index for the turtle (default: auto). Set a value lower than your header/nav's z-index to have the turtle walk <em>underneath</em> them.</li>
        <li><strong>position</strong> — <code>fixed</code> (default) pins the turtle to the viewport; <code>absolute</code> anchors him to the nearest positioned parent so he scrolls with that section.</li>
        <li><strong>loop</strong> — <code>true</code> (default) the turtle loops back and starts again after walking off screen; <code>false</code> plays the animation once and stops.</li>
        <li><strong>interaction</strong> — <code>true</code> (default) the turtle reacts to mouse proximity and touch; <code>false</code> disables all interaction so the turtle is purely decorative.</li>
      </ul>
    </div>
    <div class="docs__help">
      <h3 class="docs__help-title">Would you like help with installation?</h3>
      <p class="docs__help-text">Book an integration session with a Watchpost software engineer:</p>
      <a href="https://calendar.app.google/w8mk1QDjAzztsU3Z6" target="_blank" rel="noopener" class="docs__help-btn">
        <svg viewBox="0 0 20 20" fill="currentColor" class="docs__help-icon">
          <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd"/>
        </svg>
        Book Integration Session
      </a>
    </div>
  `;

  return docs;
}

function createFooter(): HTMLElement {
  const footer = document.createElement("footer");
  footer.className = "footer";

  const p = document.createElement("p");
  p.innerHTML = `Made with love for Wala by <a href="https://www.watchpost.com.au" target="_blank" rel="noopener"><img src="${watchpostLogo}" alt="Watchpost" class="footer__logo" /></a>`;

  footer.appendChild(p);

  return footer;
}

createApp();
