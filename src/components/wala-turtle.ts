function isSafari(): boolean {
  const ua = navigator.userAgent;
  return (
    ua.includes("Safari") && !ua.includes("Chrome") && !ua.includes("Chromium")
  );
}

type TurtleState =
  | "walking"
  | "looking"
  | "dodging-up"
  | "dodging-down"
  | "scuttling";

class WalaTurtle extends HTMLElement {
  static observedAttributes = [
    "walk-speed",
    "width",
    "starting-top-position",
    "asset-path",
    "dodge-proximity",
    "z-index",
    "position",
    "loop",
    "interaction",
  ];

  private walkVideoEl: HTMLVideoElement;
  private lookupVideoEl: HTMLVideoElement;
  private dodgeUpVideoEl: HTMLVideoElement;
  private dodgeDownVideoEl: HTMLVideoElement;
  private moverEl: HTMLDivElement;
  private lurchEl: HTMLDivElement;
  private styleEl: HTMLStyleElement;
  private state: TurtleState = "walking";

  private positionX = 0;
  private positionY = 0;
  private turtleWidthPx = 0;
  private stageWidth = 0;
  private currentRotation = 0;
  private targetRotation = 0;

  private hasLookedThisCycle = false;
  private pendingDodge = false;
  private readonly ACCELERATED_RATE = 3;
  private walkCycleTime = 0;
  private scuttlePhase: "fleeing" | "slowing" = "fleeing";

  private readyVideos = new Set<HTMLVideoElement>();
  private hasStarted = false;
  private loadGeneration = 0;

  private animationFrameId: number | null = null;
  private lastFrameTime: number | null = null;
  private lookTimeoutId: number | null = null;
  private readonly LOOK_DURATION_MS = 4000;

  private mouseX = 0;
  private mouseY = 0;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    this.moverEl = document.createElement("div");
    this.moverEl.className = "turtle-mover hidden";

    this.lurchEl = document.createElement("div");
    this.lurchEl.className = "turtle-lurch";

    this.walkVideoEl = this.createVideo("", false);
    this.lookupVideoEl = this.createVideo("", true);
    this.dodgeUpVideoEl = this.createVideo("", false);
    this.dodgeDownVideoEl = this.createVideo("", false);

    this.walkVideoEl.classList.add("video-active");

    this.lurchEl.appendChild(this.walkVideoEl);
    this.lurchEl.appendChild(this.lookupVideoEl);
    this.lurchEl.appendChild(this.dodgeUpVideoEl);
    this.lurchEl.appendChild(this.dodgeDownVideoEl);
    this.moverEl.appendChild(this.lurchEl);

    this.styleEl = document.createElement("style");
    this.updateStyles();

    this.shadowRoot!.appendChild(this.styleEl);
    this.shadowRoot!.appendChild(this.moverEl);

    this.setupEventListeners();
  }

  private get allVideos(): HTMLVideoElement[] {
    return [
      this.walkVideoEl,
      this.lookupVideoEl,
      this.dodgeUpVideoEl,
      this.dodgeDownVideoEl,
    ];
  }

  private get assetPath(): string {
    return this.getAttribute("asset-path") || "";
  }

  private readonly BASE_WALK_SPEED = 45;
  private readonly BASE_WIDTH_PX = 240;

  private get sizeScale(): number {
    return this.turtleWidthPx > 0 ? this.turtleWidthPx / this.BASE_WIDTH_PX : 1;
  }

  private get translationSpeed(): number {
    return this.walkSpeed * this.sizeScale;
  }

  private readonly MAX_WALK_SPEED = 150;

  private get walkSpeed(): number {
    const attr = this.getAttribute("walk-speed");
    const raw = attr ? parseFloat(attr) : this.BASE_WALK_SPEED;
    return Math.min(raw, this.MAX_WALK_SPEED);
  }

  private readonly SCUTTLE_MULTIPLIER = 2.5;

  private get scuttleSpeed(): number {
    if (this.scuttlePhase === "slowing") {
      return this.walkSpeed * 2 * this.sizeScale;
    }
    return this.walkSpeed * this.SCUTTLE_MULTIPLIER * this.sizeScale;
  }

  private readonly MAX_WIDTH_PX = 480;

  private get turtleWidth(): string {
    const raw = this.getAttribute("width") || "240px";
    const match = raw.match(/^(-?\d*\.?\d+)(.*)$/);
    if (!match) return raw;
    const value = parseFloat(match[1]);
    const unit = match[2] || "px";
    if (unit === "px" && value > this.MAX_WIDTH_PX) {
      return `${this.MAX_WIDTH_PX}px`;
    }
    return raw;
  }

  private get playbackRate(): number {
    return this.walkSpeed / this.BASE_WALK_SPEED;
  }

  private async updateVideoSources(): Promise<void> {
    const basePath = this.assetPath.replace(/\/$/, "");
    if (!basePath) return;

    const ext = isSafari() ? "mp4" : "webm";

    const sources: Array<[HTMLVideoElement, string]> = [
      [this.walkVideoEl, `${basePath}/walkingloop.${ext}`],
      [this.lookupVideoEl, `${basePath}/lookuploop.${ext}`],
      [this.dodgeUpVideoEl, `${basePath}/dodgeup.${ext}`],
      [this.dodgeDownVideoEl, `${basePath}/dodgedown.${ext}`],
    ];

    const generation = ++this.loadGeneration;
    this.readyVideos.clear();

    await Promise.all(
      sources.map(
        ([video, url]) =>
          new Promise<void>((resolve) => {
            let settled = false;
            const done = async (trigger: string): Promise<void> => {
              if (settled) return;
              settled = true;
              video.removeEventListener("canplaythrough", onCanPlay);
              video.removeEventListener("loadeddata", onLoadedData);
              this.debugLog(`load ${this.videoTag(video)}: via ${trigger}`);
              await this.primeVideo(video);
              this.readyVideos.add(video);
              resolve();
            };
            const onCanPlay = (): void => {
              void done("canplaythrough");
            };
            const onLoadedData = (): void => {
              void done("loadeddata");
            };
            video.addEventListener("canplaythrough", onCanPlay);
            video.addEventListener("loadeddata", onLoadedData);
            if (video.src !== url) {
              video.src = url;
            }
            video.load();
            // Safety net: Safari sometimes stalls readyState reporting for
            // alpha HEVC. If neither event fires within 5s, proceed anyway —
            // primeVideo will play a few frames which is the real readiness
            // signal we care about.
            setTimeout(() => void done("timeout"), 5000);
          }),
      ),
    );

    if (generation !== this.loadGeneration) return;

    this.maybeStart();
  }

  private get dodgeProximity(): number {
    const attr = this.getAttribute("dodge-proximity");
    return attr ? parseFloat(attr) : 150;
  }

  private get startingTopPosition(): number {
    const attr = this.getAttribute("starting-top-position");
    return attr ? parseFloat(attr) : 1000;
  }

  private get zIndexValue(): string {
    return this.getAttribute("z-index") || "auto";
  }

  private get positionValue(): "fixed" | "absolute" {
    return this.getAttribute("position") === "absolute" ? "absolute" : "fixed";
  }

  private get loopEnabled(): boolean {
    return this.getAttribute("loop") !== "false";
  }

  private get interactionEnabled(): boolean {
    return this.getAttribute("interaction") !== "false";
  }

  private updateStyles(): void {
    this.styleEl.textContent = `
      :host {
        display: block;
        position: ${this.positionValue};
        top: 0;
        left: 0;
        width: ${this.positionValue === "fixed" ? "100vw" : "100%"};
        height: ${this.positionValue === "fixed" ? "100vh" : "100%"};
        overflow: hidden;
        pointer-events: none;
        z-index: ${this.zIndexValue};
      }

      .turtle-mover {
        position: absolute;
        top: ${this.startingTopPosition}px;
        left: 0;
        cursor: ${this.interactionEnabled ? "pointer" : "default"};
        will-change: transform;
        pointer-events: ${this.interactionEnabled ? "auto" : "none"};
        z-index: ${this.zIndexValue};
        width: var(--turtle-width, 240px);
      }

      .turtle-mover.hidden {
        opacity: 0;
      }

      .turtle-lurch {
        will-change: transform;
        position: relative;
        width: 100%;
        height: calc(var(--turtle-width, 240px) * 0.45);
      }

      video {
        display: block;
        width: 100%;
        height: auto;
        background: transparent;
        opacity: 0;
        position: absolute;
        top: 0;
        left: 0;
        transform: translateY(-10%);
        will-change: opacity;
        backface-visibility: hidden;
      }

      video.video-active {
        opacity: 1;
      }
    `;
  }

  private createVideo(src: string, loop: boolean): HTMLVideoElement {
    const video = document.createElement("video");
    video.src = src;
    video.preload = "auto";
    video.muted = true;
    video.setAttribute("muted", "");
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");
    video.loop = loop;
    video.autoplay = false;
    return video;
  }

  private setupEventListeners(): void {
    this.walkVideoEl.addEventListener("ended", () => {
      this.handleWalkVideoEnd();
    });

    this.lookupVideoEl.addEventListener("ended", () => {
      this.handleLookupVideoEnd();
    });

    this.dodgeUpVideoEl.addEventListener("ended", () => {
      this.transitionToScuttle();
    });

    this.dodgeDownVideoEl.addEventListener("ended", () => {
      this.transitionToScuttle();
    });

    this.moverEl.addEventListener("touchstart", this.handleTap, {
      passive: false,
    });
  }

  private handleWalkVideoEnd(): void {
    if (this.state === "walking") {
      if (this.pendingDodge) {
        this.pendingDodge = false;
        this.triggerDodge();
        return;
      }

      if (
        !this.hasLookedThisCycle &&
        this.positionX > -this.turtleWidthPx * 0.5
      ) {
        this.transitionToLooking();
        return;
      }

      this.walkVideoEl.currentTime = 0;
      this.walkVideoEl.play();
    } else if (this.state === "scuttling") {
      if (this.scuttlePhase === "fleeing") {
        this.scuttlePhase = "slowing";
        this.walkVideoEl.loop = false;
        this.walkVideoEl.currentTime = 0;
        this.walkVideoEl.playbackRate = this.playbackRate * 2;
        this.walkVideoEl.play();
      } else {
        this.settleFromScuttle();
      }
    }
  }

  private settleFromScuttle(): void {
    this.targetRotation = 0;
    this.hasLookedThisCycle = false;
    this.transitionToLooking();
  }

  private handleLookupVideoEnd(): void {
    if (this.state !== "looking") return;

    if (this.pendingDodge) {
      this.pendingDodge = false;
      this.triggerDodge();
      return;
    }

    if (!this.lookupVideoEl.loop) {
      this.resumeWalkFromLooking();
    }
  }

  private requestDodge(): void {
    if (this.pendingDodge) return;

    this.pendingDodge = true;

    if (this.state === "walking") {
      this.walkVideoEl.playbackRate = this.playbackRate * this.ACCELERATED_RATE;
    } else if (this.state === "looking") {
      this.cancelLookTimeout();
      this.lookupVideoEl.loop = false;
      this.lookupVideoEl.playbackRate =
        this.playbackRate * this.ACCELERATED_RATE;
    }
  }

  private getDodgeDirection(): "up" | "down" {
    const rect = this.moverEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = this.mouseX - cx;
    const dy = this.mouseY - cy;

    const angleRad = (this.currentRotation * Math.PI) / 180;
    const dot = dx * Math.sin(angleRad) - dy * Math.cos(angleRad);

    return dot > 0 ? "down" : "up";
  }

  private triggerDodge(): void {
    this.stopAnimation();
    const direction = this.getDodgeDirection();
    this.targetRotation = 0;
    if (direction === "up") {
      this.transitionToDodgeUp();
    } else {
      this.transitionToDodgeDown();
    }
  }

  private handleTap = (e: TouchEvent): void => {
    if (!this.interactionEnabled) return;
    if (this.state === "walking" || this.state === "looking") {
      e.preventDefault();
      this.requestDodge();
    }
  };

  private handleMouseMove = (e: MouseEvent): void => {
    this.mouseX = e.clientX;
    this.mouseY = e.clientY;

    if (!this.interactionEnabled) return;
    if (this.state === "walking" || this.state === "looking") {
      this.checkMouseProximity();
    }
  };

  private distanceToMouse(): number {
    const rect = this.moverEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = this.mouseX - cx;
    const dy = this.mouseY - cy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private checkMouseProximity(): void {
    if (this.distanceToMouse() < this.dodgeProximity) {
      this.requestDodge();
    }
  }

  private cancelLookTimeout(): void {
    if (this.lookTimeoutId !== null) {
      clearTimeout(this.lookTimeoutId);
      this.lookTimeoutId = null;
    }
  }

  private showOnly(video: HTMLVideoElement): void {
    video.classList.add("video-active");
    for (const v of this.allVideos) {
      if (v !== video) {
        v.classList.remove("video-active");
      }
    }
  }

  private async prepareAndShow(
    next: HTMLVideoElement,
    prev: HTMLVideoElement,
  ): Promise<void> {
    const tag = this.videoTag(next);
    const playPromise = Promise.resolve(next.play()).catch(() => {});

    // Wait for the first presented frame, then the one after it. A single
    // rvfc means "a frame is queued for presentation"; two in a row means
    // the pipeline has actually delivered a frame AND is running — so by
    // the time we flip opacity, the video is definitely on-screen.
    const firstSource = await this.waitForFirstFrame(next);
    const secondSource = await this.waitForFirstFrame(next);
    this.debugLog(
      `prepareAndShow ${tag}: frames via ${firstSource},${secondSource}`,
    );
    await playPromise;

    this.showOnly(next);
    prev.pause();
    this.debugLog(`prepareAndShow ${tag}: swap complete`);
  }

  private videoTag(video: HTMLVideoElement): string {
    if (video === this.walkVideoEl) return "walk";
    if (video === this.lookupVideoEl) return "lookup";
    if (video === this.dodgeUpVideoEl) return "dodgeUp";
    if (video === this.dodgeDownVideoEl) return "dodgeDown";
    return "unknown";
  }

  private debugLog(msg: string): void {
    if (
      (window as unknown as { __turtleDebug?: boolean }).__turtleDebug === true
    ) {
      console.debug("[turtle]", msg);
    }
  }

  private async primeVideo(video: HTMLVideoElement): Promise<void> {
    const tag = this.videoTag(video);
    // 1. Get the very first frame decoded and presented.
    video.currentTime = 0;
    const seekSource = await this.waitForFirstFrame(video);
    this.debugLog(`prime ${tag}: first frame via ${seekSource}`);

    // 2. Actually play a few frames so the decode pipeline runs end-to-end.
    const wasMuted = video.muted;
    video.muted = true;
    try {
      await video.play();
      await this.waitForNVideoFrames(video, 3);
      video.pause();
      this.debugLog(`prime ${tag}: played ${video.currentTime.toFixed(3)}s`);
    } catch {
      this.debugLog(`prime ${tag}: play() rejected, skipping warmup`);
    }
    video.muted = wasMuted;

    // 3. Park at 0.001 and wait for the seeked frame to be rendered
    //    so the *next* play() has an already-decoded first frame to swap to.
    await new Promise<void>((resolve) => {
      const onSeeked = (): void => {
        video.removeEventListener("seeked", onSeeked);
        resolve();
      };
      video.addEventListener("seeked", onSeeked, { once: true });
      video.currentTime = 0;
      setTimeout(() => {
        video.removeEventListener("seeked", onSeeked);
        resolve();
      }, 300);
    });
    const parkedSource = await this.waitForFirstFrame(video);
    this.debugLog(`prime ${tag}: parked frame via ${parkedSource}`);
  }

  private waitForNVideoFrames(
    video: HTMLVideoElement,
    n: number,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      let seen = 0;
      let settled = false;
      const vfc = (
        video as HTMLVideoElement & {
          requestVideoFrameCallback?: (cb: () => void) => number;
        }
      ).requestVideoFrameCallback;
      const finish = (): void => {
        if (settled) return;
        settled = true;
        resolve();
      };
      if (typeof vfc === "function") {
        const tick = (): void => {
          if (settled) return;
          seen += 1;
          if (seen >= n) {
            finish();
            return;
          }
          vfc.call(video, tick);
        };
        vfc.call(video, tick);
      } else {
        const step = (remaining: number): void => {
          if (settled) return;
          if (remaining <= 0) {
            finish();
            return;
          }
          requestAnimationFrame(() => step(remaining - 1));
        };
        step(n * 2);
      }
      setTimeout(finish, 500);
    });
  }

  private waitForFirstFrame(
    video: HTMLVideoElement,
  ): Promise<"vfc" | "raf" | "timeout"> {
    return new Promise<"vfc" | "raf" | "timeout">((resolve) => {
      let settled = false;
      const finish = (source: "vfc" | "raf" | "timeout"): void => {
        if (settled) return;
        settled = true;
        resolve(source);
      };
      const vfc = (
        video as HTMLVideoElement & {
          requestVideoFrameCallback?: (cb: () => void) => number;
        }
      ).requestVideoFrameCallback;
      if (typeof vfc === "function") {
        vfc.call(video, () => finish("vfc"));
      } else {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => finish("raf")),
        );
      }
      setTimeout(() => finish("timeout"), 300);
    });
  }

  private transitionToWalk(): void {
    this.state = "walking";
    this.pendingDodge = false;
    this.targetRotation = 0;
    this.walkVideoEl.loop = false;
    this.showOnly(this.walkVideoEl);
    this.walkVideoEl.currentTime = 0;
    this.walkVideoEl.playbackRate = this.playbackRate;
    this.walkVideoEl.play();
    this.startLurch();
    this.startAnimation();
  }

  private async transitionToLooking(): Promise<void> {
    this.state = "looking";
    this.hasLookedThisCycle = true;
    this.stopLurch();
    this.stopAnimation();
    const prev = this.walkVideoEl;
    if (this.lookupVideoEl.currentTime !== 0) {
      this.lookupVideoEl.currentTime = 0;
    }
    this.lookupVideoEl.loop = true;
    this.lookupVideoEl.playbackRate = this.playbackRate;
    await this.prepareAndShow(this.lookupVideoEl, prev);

    this.lookTimeoutId = window.setTimeout(() => {
      this.lookTimeoutId = null;
      this.lookupVideoEl.loop = false;
    }, this.LOOK_DURATION_MS / this.playbackRate);
  }

  private async resumeWalkFromLooking(): Promise<void> {
    this.state = "walking";
    this.pendingDodge = false;
    this.targetRotation = 0;
    const prev = this.lookupVideoEl;
    if (this.walkVideoEl.currentTime !== 0) {
      this.walkVideoEl.currentTime = 0;
    }
    this.walkVideoEl.loop = false;
    this.walkVideoEl.playbackRate = this.playbackRate;
    await this.prepareAndShow(this.walkVideoEl, prev);
    this.startLurch();
    this.startAnimation();
  }

  private async transitionToDodgeUp(): Promise<void> {
    this.state = "dodging-up";
    this.stopLurch();
    const prev = this.walkVideoEl;
    if (this.dodgeUpVideoEl.currentTime !== 0) {
      this.dodgeUpVideoEl.currentTime = 0;
    }
    this.dodgeUpVideoEl.playbackRate = this.playbackRate;
    await this.prepareAndShow(this.dodgeUpVideoEl, prev);
  }

  private async transitionToDodgeDown(): Promise<void> {
    this.state = "dodging-down";
    this.stopLurch();
    const prev = this.walkVideoEl;
    if (this.dodgeDownVideoEl.currentTime !== 0) {
      this.dodgeDownVideoEl.currentTime = 0;
    }
    this.dodgeDownVideoEl.playbackRate = this.playbackRate;
    await this.prepareAndShow(this.dodgeDownVideoEl, prev);
  }

  private transitionToScuttle(): void {
    this.state = "scuttling";
    this.scuttlePhase = "fleeing";
    this.stopLurch();

    const rect = this.moverEl.getBoundingClientRect();
    const cy = rect.top + rect.height / 2;

    const awayY = cy - this.mouseY;
    const sign = awayY >= 0 ? 1 : -1;
    this.targetRotation = sign * 20;

    this.walkVideoEl.loop = true;
    this.showOnly(this.walkVideoEl);
    this.walkVideoEl.currentTime = 0;
    this.walkVideoEl.playbackRate = this.playbackRate * this.SCUTTLE_MULTIPLIER;
    this.walkVideoEl.play();
    this.startAnimation();
  }

  private startAnimation(): void {
    this.lastFrameTime = null;
    if (this.animationFrameId === null) {
      this.animationFrameId = requestAnimationFrame(this.tick);
    }
  }

  private stopAnimation(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.lastFrameTime = null;
  }

  private tick = (timestamp: number): void => {
    if (this.lastFrameTime === null) {
      this.lastFrameTime = timestamp;
      this.animationFrameId = requestAnimationFrame(this.tick);
      return;
    }

    const delta = (timestamp - this.lastFrameTime) / 1000;
    this.lastFrameTime = timestamp;

    const rotDiff = this.targetRotation - this.currentRotation;
    const maxStep = 40 * delta;
    if (Math.abs(rotDiff) > 0.1) {
      this.currentRotation += Math.max(-maxStep, Math.min(maxStep, rotDiff));
    }

    if (this.state === "walking") {
      this.walkCycleTime += delta * this.playbackRate;
      this.positionX += this.translationSpeed * delta;
      if (this.positionX >= this.stageWidth + this.turtleWidthPx) {
        this.resetCycle();
        return;
      }
    } else if (this.state === "scuttling") {
      const angleRad = (this.currentRotation * Math.PI) / 180;
      this.positionX += this.scuttleSpeed * Math.cos(angleRad) * delta;
      this.positionY += this.scuttleSpeed * Math.sin(angleRad) * delta;

      if (
        this.scuttlePhase === "fleeing" &&
        this.walkVideoEl.loop &&
        !this.pendingDodge
      ) {
        const dist = this.distanceToMouse();
        if (dist > this.dodgeProximity * 2.5) {
          this.walkVideoEl.loop = false;
        }
      }

      if (this.positionX >= this.stageWidth + this.turtleWidthPx) {
        this.resetCycle();
        return;
      }
    }

    this.applyTransform();
    this.animationFrameId = requestAnimationFrame(this.tick);
  };

  private computeLurch(p: number): number {
    // 0–0.6 → two connected lurches
    // 0.6–1 → pause

    if (p < 0.6) {
      const t = p / 0.6;

      // first big lurch (centered ~0.25)
      const big = Math.exp(-Math.pow((t - 0.25) / 0.18, 2));

      // second small lurch (centered ~0.55)
      const small = Math.exp(-Math.pow((t - 0.55) / 0.12, 2));

      return 8 * big + 3 * small;
    }

    // smooth decay into pause (no snap)
    const t = (p - 0.6) / 0.4;
    return (1 - t * t) * 0.5;
  }

  private startLurch(): void {
    this.walkCycleTime = 0;
  }

  private stopLurch(): void {
    this.lurchEl.style.transform = "";
  }

  private applyTransform(): void {
    let t = `translate(${this.positionX}px, ${this.positionY}px)`;
    if (this.currentRotation !== 0) {
      t += ` rotate(${this.currentRotation.toFixed(1)}deg)`;
    }
    this.moverEl.style.transform = t;

    if (this.state === "walking") {
      const duration = this.walkVideoEl.duration;
      const cycleDuration = duration && isFinite(duration) ? duration : 1.2;
      const p = (this.walkCycleTime % cycleDuration) / cycleDuration;
      this.lurchEl.style.transform = `translateX(${this.computeLurch(p)}px)`;
    }
  }

  private resetCycle(): void {
    this.stopAnimation();
    this.stopLurch();
    this.cancelLookTimeout();
    this.pendingDodge = false;
    this.hasLookedThisCycle = false;
    this.currentRotation = 0;
    this.targetRotation = 0;
    for (const v of this.allVideos) {
      v.pause();
      v.classList.remove("video-active");
    }
    this.walkVideoEl.classList.add("video-active");

    if (!this.loopEnabled) return;

    this.positionX = -this.turtleWidthPx;
    this.positionY = 0;
    this.applyTransform();

    setTimeout(() => {
      this.transitionToWalk();
    }, 800);
  }

  connectedCallback(): void {
    this.updateTurtleWidth();
    this.updateStageWidth();
    this.initStartPosition();
    this.updateVideoSources();

    window.addEventListener("resize", this.handleResize);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    document.addEventListener("mousemove", this.handleMouseMove);
  }

  private handleResize = (): void => {
    this.updateStageWidth();
  };

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.pauseAll();
    } else {
      this.resumeAnimation();
    }
  };

  private pauseAll(): void {
    this.stopAnimation();
    this.cancelLookTimeout();
    for (const v of this.allVideos) {
      v.pause();
    }
  }

  private resumeAnimation(): void {
    if (!this.hasStarted) return;

    if (this.state === "walking" || this.state === "scuttling") {
      this.walkVideoEl.play();
      this.startAnimation();
    } else if (this.state === "looking") {
      this.lookupVideoEl.play();
    } else if (this.state === "dodging-up") {
      this.dodgeUpVideoEl.play();
    } else if (this.state === "dodging-down") {
      this.dodgeDownVideoEl.play();
    }
  }

  private updateStageWidth(): void {
    this.stageWidth = window.innerWidth;
  }

  private updateTurtleWidth(): void {
    this.moverEl.style.setProperty("--turtle-width", this.turtleWidth);
    this.turtleWidthPx =
      this.moverEl.offsetWidth || parseInt(this.turtleWidth, 10) || 240;
  }

  private initStartPosition(): void {
    this.positionX = -this.turtleWidthPx;
    this.positionY = 0;
    this.applyTransform();
  }

  private maybeStart(): void {
    if (this.hasStarted) return;
    if (!this.isConnected) return;

    this.hasStarted = true;
    this.transitionToWalk();

    setTimeout(() => {
      this.moverEl.classList.remove("hidden");
    }, 300);
  }

  attributeChangedCallback(name: string): void {
    if (name === "width") {
      this.updateTurtleWidth();
    } else if (
      name === "starting-top-position" ||
      name === "z-index" ||
      name === "position" ||
      name === "interaction"
    ) {
      this.updateStyles();
    } else if (name === "asset-path") {
      this.updateVideoSources();
    }
  }

  disconnectedCallback(): void {
    window.removeEventListener("resize", this.handleResize);
    document.removeEventListener(
      "visibilitychange",
      this.handleVisibilityChange,
    );
    this.stopAnimation();
    this.cancelLookTimeout();
    document.removeEventListener("mousemove", this.handleMouseMove);
  }
}

customElements.define("wala-turtle", WalaTurtle);

export { WalaTurtle };
