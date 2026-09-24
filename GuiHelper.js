// GuiHelper.js

class GuiHelperTabs {
  constructor() {
    this.tabs = {};
    this.currentTab = null;
    this.defaultValues = {};
    this._commands = []; // 🆕 danh sách lệnh
    this._injectLayout(); // 👈 tạo DOM + style inline
    this._injectStyles(); // 👈 chèn CSS chung
    this._initShortcuts();
    this._initCollapseButton();
    this.miniMenu = null; // 🆕 lưu menu
    this._initMiniMenu();
    this._noteDiv = null; // 🆕 lưu div ghi chú hiện tại
    this._calculatorDiv = null;
    this._tocDiv = null;
this._tocData = this._createDefaultTOC();
this._tocCurrentLesson = null;

this._codeDiv = null;
this._codeEditor = null;
this._codeOutput = null;
this._codeMode = "javascript";
    // danh sách các controller dạng 4 cột
    this.fourColumnControllers = [];
    this._searchData = []; // 🆕 lưu tab + folder để tìm kiếm
    this.layoutMode = false; // 🆕 trạng thái Layout Mode

  }

  // ===== Tabs =====
  addTab(name, width = 300, options = {}) {
    const tabDiv = document.createElement("div");
    tabDiv.style.display = "none";
    this.contentEl.appendChild(tabDiv);

    const gui = new dat.GUI({ autoPlace: false, width });
    tabDiv.appendChild(gui.domElement);
    // Xóa nút close do dat.GUI tự tạo
    const closeBtn = gui.domElement.querySelector(".close-button");
    if (closeBtn) closeBtn.remove();
    this.tabs[name] = { gui, tabDiv };

    // tạo nút tab
    const btn = document.createElement("button");
    btn.className = "gui-tab button"; // 👈 style giống collapseBtn

    if (options.icon) {
      btn.innerHTML = options.icon; // hiển thị icon
      btn.title = options.label || name; // tooltip
    } else {
      btn.innerText = options.label || name; // hiển thị chữ
    }

    btn.onclick = () => this.showTab(name);
    this.tabsEl.appendChild(btn);
    this.tabs[name].btn = btn;

    if (!this.currentTab) this.showTab(name);

    // 🆕 Lưu vào danh sách search
    this._searchData.push({
      type: "tab",
      name: name,
      open: () => this.showTab(name),
    });
    return gui;
  }
  addWithIcon(gui, obj, prop, icon, options = {}) {
    let controller;

    if (options.choices) {
      controller = gui.add(obj, prop, options.choices);
    } else if (options.isColor) {
      controller = gui.addColor(obj, prop);
    } else {
      controller = gui.add(obj, prop);
    }

    const li = controller.domElement.parentElement.parentElement;
    li.classList.add("with-icon-item");

    // lấy label gốc
    const nameEl = li.querySelector(".property-name");
    if (nameEl) {
      nameEl.textContent = ""; // clear chữ gốc

      const iconSpan = document.createElement("span");
      iconSpan.textContent = icon || "";
      iconSpan.style.display = "inline-block";
      iconSpan.style.width = "20px";
      iconSpan.style.textAlign = "center";
      nameEl.appendChild(iconSpan);

      if (options.showLabel) {
        const labelSpan = document.createElement("span");
        labelSpan.textContent = " " + (options.label || prop);
        nameEl.appendChild(labelSpan);
      } else {
        // === Căn giữa nếu chỉ có icon ===
        const hasInput = li.querySelector(
          'input[type="checkbox"], input[type="text"], select, input[type="range"]'
        );
        if (!hasInput) {
          nameEl.style.display = "flex";
          nameEl.style.justifyContent = "center";
          nameEl.style.alignItems = "center";
        }
        nameEl.title = options.label || prop;
      }

      // tooltip khi chỉ hiển thị icon
      if (!options.showLabel) {
        nameEl.title = options.label || prop;
      }
    }

    // di chuyển checkbox sang phải
    const checkbox = li.querySelector('input[type="checkbox"]');
    if (checkbox) {
      checkbox.style.marginLeft = "8px";
      checkbox.style.float = "right";
    }

    // --- Tạo group with-icon nếu chưa có ---
    let customGroup = gui.domElement.querySelector("ul.with-icon-list");
    if (!customGroup) {
      customGroup = document.createElement("ul");
      customGroup.classList.add("with-icon-list");
      gui.domElement.querySelector("ul").appendChild(customGroup);
    }
    customGroup.appendChild(li);

    // ===== Thêm CSS trực tiếp cho ul.with-icon-list =====
    if (!document.getElementById("with-icon-list-style")) {
      const styleEl = document.createElement("style");
      styleEl.id = "with-icon-list-style";
      styleEl.innerHTML = `
        .dg.main ul.with-icon-list {
          display: flex !important;
          flex-wrap: wrap !important;
          padding: 0 !important;
          margin: 0 !important;
          list-style: none;
        }
      `;
      document.head.appendChild(styleEl);
    }

    // ===== Thêm CSS trực tiếp cho label .property-name =====
    if (!document.getElementById("with-icon-label-style")) {
      const styleEl = document.createElement("style");
      styleEl.id = "with-icon-label-style";
      styleEl.innerHTML = `
        .dg .cr .property-name {
          overflow: visible !important;
          text-overflow: unset !important;
          white-space: nowrap !important; /* 👈 giữ 1 dòng */
          line-height: 2.8em;
          max-width: none !important;
        }
      `;
      document.head.appendChild(styleEl);
    }

    // ===== Tùy biến số cột =====
    const cols = options.columns || 4;
    const liWidth = `calc(${100 / cols}%)`;
    li.style.setProperty("flex", `0 0 ${liWidth}`, "important");
    li.style.boxSizing = "border-box";

    if (options.onChange) controller.onChange(options.onChange);
    if (options.onFinishChange)
      controller.onFinishChange(options.onFinishChange);

    // 🆕 Thêm vào danh sách command palette
    if (options.label) {
      this._commands.push({
        label: options.label,
        run: () => {
          // toggle checkbox nếu có
          const checkbox = controller.domElement.querySelector(
            'input[type="checkbox"]'
          );
          if (checkbox) {
            checkbox.click();
          } else {
            // hoặc gọi onChange nếu là button
            if (typeof obj[prop] === "function") {
              obj[prop]();
            }
          }
        },
      });
    }

    return controller;
  }
  toggleLayoutMode() {
    this.layoutMode = !this.layoutMode;
    console.log("Layout Mode:", this.layoutMode ? "ON" : "OFF");
  }

  makeDraggable(el, handle) {
    let offsetX = 0, offsetY = 0, isDown = false;

    handle.style.cursor = "move"; // con trỏ kéo
    handle.onmousedown = (e) => {
      if (!this.layoutMode) return; // chỉ cho kéo khi LayoutMode bật
      isDown = true;
      offsetX = e.clientX - el.offsetLeft;
      offsetY = e.clientY - el.offsetTop;
      document.onmousemove = (e) => {
        if (!isDown) return;
        el.style.left = e.clientX - offsetX + "px";
        el.style.top = e.clientY - offsetY + "px";
      };
      document.onmouseup = () => {
        isDown = false;
        document.onmousemove = null;
        document.onmouseup = null;
      };
    };
  }
  // 🆕 Quick Command Palette
  createCommandPalette() {
    if (this._cmdDiv) {
      this._cmdDiv.remove();
      this._cmdDiv = null;
      return;
    }

    const div = document.createElement("div");
    this._cmdDiv = div;
    div.style.position = "fixed";
    div.style.top = "20px";
    div.style.left = "50%";
    div.style.transform = "translateX(-50%)";
    div.style.width = "400px";
    div.style.background = "rgba(30,30,30,0.95)";
    div.style.color = "#fff";
    div.style.borderRadius = "8px";
    div.style.boxShadow = "0 4px 15px rgba(0,0,0,0.5)";
    div.style.display = "flex";
    div.style.flexDirection = "column";
    div.style.zIndex = 20000;

    // --- Thanh input + nút X ---
    const inputRow = document.createElement("div");
    inputRow.style.display = "flex";
    inputRow.style.alignItems = "center";

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Gõ lệnh...";
    input.style.flex = "1";
    input.style.padding = "10px";
    input.style.border = "none";
    input.style.outline = "none";
    input.style.fontSize = "14px";
    input.style.background = "#1e1e1e";
    input.style.color = "#fff";

    const closeBtn = document.createElement("span");
    closeBtn.textContent = "✖";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.fontSize = "16px";
    closeBtn.style.padding = "0 10px";
    closeBtn.style.color = "#bbb";
    closeBtn.onmouseover = () => (closeBtn.style.color = "#fff");
    closeBtn.onmouseout = () => (closeBtn.style.color = "#bbb");
    closeBtn.onclick = () => {
      div.remove();
      this._cmdDiv = null;
    };

    inputRow.appendChild(input);
    inputRow.appendChild(closeBtn);
    div.appendChild(inputRow);

    // --- Results ---
    const results = document.createElement("div");
    results.style.maxHeight = "300px";
    results.style.overflowY = "auto";
    results.style.display = "none"; // 🚫 ban đầu ẩn
    div.appendChild(results);

    // Tìm kiếm
    const updateResults = () => {
      const val = input.value.toLowerCase().trim();
      results.innerHTML = "";

      if (!val) {
        results.style.display = "none"; // không hiển thị khi chưa nhập
        return;
      }

      const matches = this._commands.filter((c) =>
        c.label.toLowerCase().includes(val)
      );

      if (matches.length > 0) {
        results.style.display = "block"; // hiện khi có kết quả
        matches.forEach((c, idx) => {
          const item = document.createElement("div");
          item.textContent = c.label;
          item.style.padding = "6px 10px";
          item.style.cursor = "pointer";
          item.onmouseover = () =>
            (item.style.background = "rgba(255,255,255,0.2)");
          item.onmouseout = () => (item.style.background = "transparent");
          item.onclick = () => {
            c.run();
            // ❌ Không đóng palette nữa, chỉ chạy lệnh
          };
          if (idx === 0) item.style.background = "rgba(255,255,255,0.1)";
          results.appendChild(item);
        });
      } else {
        results.style.display = "none"; // không có kết quả thì ẩn
      }
    };

    input.addEventListener("input", updateResults);

    // Enter chọn lệnh đầu tiên
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const first = results.querySelector("div");
        if (first) first.click();
      }
    });
    input.addEventListener("click", (e) => e.stopPropagation());
    input.addEventListener("keydown", (e) => e.stopPropagation());
    results.addEventListener("click", (e) => e.stopPropagation());
    document.body.appendChild(div);
    input.focus();
  }

  addFolderWithTooltip(gui, folderName, icon = "", tooltip = "") {
    const folder = gui.addFolder(folderName);

    // Tìm thẻ <li> đại diện folder
    const li = folder.domElement.parentElement;
    if (li) {
      // Tạo span dấu chấm than
      const infoBtn = document.createElement("span");
      infoBtn.textContent = "❗"; // dấu chấm than
      infoBtn.title = tooltip; // tooltip khi hover

      // style cho nút info
      infoBtn.style.position = "absolute";
      infoBtn.style.right = "8px"; // nằm sát bên phải
      infoBtn.style.top = "50%";
      infoBtn.style.transform = "translateY(-50%)"; // căn giữa theo chiều dọc
      infoBtn.style.cursor = "pointer";
      infoBtn.style.padding = "2px 4px";
      infoBtn.style.borderRadius = "4px";
      infoBtn.style.transition = "all 0.2s ease";
      infoBtn.style.userSelect = "none";

      // hiệu ứng highlight khi hover
      infoBtn.onmouseover = () => {
        infoBtn.style.backgroundColor = "rgba(255,255,255,0.2)";
      };
      infoBtn.onmouseout = () => { 
        infoBtn.style.backgroundColor = "transparent";
      };

      // đặt relative cho container để nút info nằm đúng
      const titleEl = li.querySelector(".title");
      if (titleEl) {
        titleEl.style.position = "relative";
        titleEl.appendChild(infoBtn);
      }
    }
    // 🆕 Lưu vào danh sách search
    this._searchData.push({
      type: "folder",
      name: folderName,
      open: () => {
        folder.open();
        // Mở luôn tab chứa folder
        for (const key in this.tabs) {
          if (this.tabs[key].gui === gui) {
            this.showTab(key);
            break;
          }
        }
      },
    });
    return folder;
  }
// ============================================================
// 💻 CODE LAB / MATH 3D SCRIPTING LAYER v3
// ============================================================
// FIX:
//  - ReferenceError: cube is not defined giữa nhiều lần Run
//  - Persistent variables: CodeLab.vars
//  - MotionLab auto update
//  - MotionLab.animate(object | "objectName", callback)
//  - ObjectLab.get/find
//  - PlotLab full API
//  - Không tạo animation/render loop Three.js thứ hai
// ============================================================

createCodeRunner() {

  // ============================================================
  // CLOSE IF ALREADY OPEN
  // ============================================================

  if (this._codeDiv) {

    if (
      window.Math3DCodeLab &&
      typeof window.Math3DCodeLab.destroy === "function"
    ) {

      try {
        window.Math3DCodeLab.destroy();
      } catch (e) {
        console.warn("CodeLab destroy error:", e);
      }

    }

    this._codeDiv.remove();

    this._codeDiv = null;
    this._codeEditor = null;
    this._codeOutput = null;

    return;
  }

  // ============================================================
  // MAIN WINDOW
  // ============================================================

  const codeDiv = document.createElement("div");

  this._codeDiv = codeDiv;

  Object.assign(codeDiv.style, {

    position: "fixed",

    top: "50px",
    left: "50%",

    transform: "translateX(-50%)",

    width: "950px",
    height: "700px",

    minWidth: "520px",
    minHeight: "380px",

    background: "rgba(18,18,18,.98)",

    color: "#ddd",

    zIndex: "30000",

    display: "flex",

    flexDirection: "column",

    border: "1px solid #555",

    borderRadius: "10px",

    overflow: "hidden",

    boxShadow:
      "0 10px 50px rgba(0,0,0,.85)",

    fontFamily:
      "Segoe UI, Arial, sans-serif",

    resize: "both"

  });

  // ============================================================
  // HEADER
  // ============================================================

  const header =
    document.createElement("div");

  Object.assign(header.style, {

    height: "40px",
    minHeight: "40px",

    background:
      "linear-gradient(90deg,#353535,#181818)",

    display: "flex",

    alignItems: "center",

    justifyContent: "space-between",

    padding: "0 9px",

    fontWeight: "bold",

    cursor: "move",

    userSelect: "none"

  });

  const title =
    document.createElement("span");

  title.textContent =
    "💻 Math 3D Plotter — Code Lab v3";

  header.appendChild(title);

  const headerButtons =
    document.createElement("div");

  headerButtons.style.display = "flex";
  headerButtons.style.gap = "4px";

  const helpBtn =
    document.createElement("button");

  helpBtn.textContent = "?";
  helpBtn.title = "API Help";

  const closeBtn =
    document.createElement("button");

  closeBtn.textContent = "✖";
  closeBtn.title = "Đóng";

  [helpBtn, closeBtn].forEach(btn => {

    Object.assign(btn.style, {

      background: "transparent",

      border: "none",

      color: "#aaa",

      cursor: "pointer",

      fontSize: "14px",

      padding: "4px 8px",

      borderRadius: "4px"

    });

    btn.onmouseenter = () => {

      btn.style.background =
        "rgba(255,255,255,.15)";

      btn.style.color =
        "#fff";

    };

    btn.onmouseleave = () => {

      btn.style.background =
        "transparent";

      btn.style.color =
        "#aaa";

    };

  });

  headerButtons.appendChild(helpBtn);
  headerButtons.appendChild(closeBtn);

  header.appendChild(headerButtons);

  codeDiv.appendChild(header);

  // ============================================================
  // TOOLBAR
  // ============================================================

  const toolbar =
    document.createElement("div");

  Object.assign(toolbar.style, {

    display: "flex",

    alignItems: "center",

    gap: "5px",

    padding: "5px 7px",

    background: "#181818",

    borderBottom: "1px solid #444",

    flexWrap: "wrap"

  });

  const modeSelect =
    document.createElement("select");

  modeSelect.innerHTML = `
    <option value="javascript">JavaScript</option>
    <option value="expression">Math Expression</option>
  `;

  Object.assign(modeSelect.style, {

    background: "#222",

    color: "#eee",

    border: "1px solid #555",

    borderRadius: "4px",

    padding: "5px 7px",

    outline: "none"

  });

  toolbar.appendChild(modeSelect);

  // ============================================================
  // BUTTON FACTORY
  // ============================================================

  const createToolbarButton =
    text => {

      const btn =
        document.createElement("button");

      btn.textContent = text;

      Object.assign(btn.style, {

        background: "#292929",

        color: "#ddd",

        border: "1px solid #4a4a4a",

        borderRadius: "4px",

        padding: "5px 9px",

        cursor: "pointer",

        fontSize: "12px"

      });

      btn.onmouseenter = () => {

        btn.style.background =
          "#404040";

      };

      btn.onmouseleave = () => {

        btn.style.background =
          "#292929";

      };

      return btn;

    };

  const runBtn =
    createToolbarButton("▶ Chạy");

  const clearBtn =
    createToolbarButton("🧹 Xóa");

  const copyBtn =
    createToolbarButton("📋 Copy");

  const saveBtn =
    createToolbarButton("💾 Lưu");

  const loadBtn =
    createToolbarButton("📂 Tải");

  const resetBtn =
    createToolbarButton("↻ Mẫu");

  const clearScriptObjectsBtn =
    createToolbarButton("🗑 Objects");

  const clearMotionBtn =
    createToolbarButton("⏹ Motion");

  [
    runBtn,
    clearBtn,
    copyBtn,
    saveBtn,
    loadBtn,
    resetBtn,
    clearScriptObjectsBtn,
    clearMotionBtn

  ].forEach(btn => {

    toolbar.appendChild(btn);

  });

  codeDiv.appendChild(toolbar);

  // ============================================================
  // API BAR
  // ============================================================

  const apiBar =
    document.createElement("div");

  Object.assign(apiBar.style, {

    height: "30px",

    minHeight: "30px",

    display: "flex",

    alignItems: "center",

    gap: "6px",

    padding: "0 8px",

    background: "#111",

    borderBottom: "1px solid #333",

    fontFamily:
      "Consolas, monospace",

    fontSize: "11px",

    color: "#777",

    overflow: "hidden",

    whiteSpace: "nowrap"

  });

  apiBar.innerHTML = `
    <span style="color:#aaa">API:</span>
    <span>PlotLab</span>
    <span>•</span>
    <span>ObjectLab</span>
    <span>•</span>
    <span>MotionLab</span>
    <span>•</span>
    <span>CodeLab.vars</span>
    <span>•</span>
    <span>THREE</span>
    <span>•</span>
    <span>math</span>
    <span>•</span>
    <span>scene</span>
    <span>•</span>
    <span>worldGroup</span>
  `;

  codeDiv.appendChild(apiBar);

  // ============================================================
  // EDITOR AREA
  // ============================================================

  const editorWrapper =
    document.createElement("div");

  Object.assign(editorWrapper.style, {

    flex: "1",

    minHeight: "0",

    position: "relative",

    display: "flex",

    background: "#101010"

  });

  // ============================================================
  // LINE NUMBERS
  // ============================================================

  const lineNumbers =
    document.createElement("div");

  Object.assign(lineNumbers.style, {

    width: "44px",

    minWidth: "44px",

    background: "#181818",

    color: "#555",

    textAlign: "right",

    padding: "10px 8px",

    fontFamily:
      "Consolas, monospace",

    fontSize: "13px",

    lineHeight: "1.5",

    userSelect: "none",

    overflow: "hidden"

  });

  editorWrapper.appendChild(lineNumbers);

  // ============================================================
  // EDITOR
  // ============================================================

  const editor =
    document.createElement("textarea");

  this._codeEditor =
    editor;

  editor.spellcheck = false;
  editor.autocomplete = "off";
  editor.autocorrect = "off";
  editor.autocapitalize = "off";

  Object.assign(editor.style, {

    flex: "1",

    width: "100%",

    height: "100%",

    resize: "none",

    border: "none",

    outline: "none",

    background: "#101010",

    color: "#e6e6e6",

    padding: "10px",

    fontFamily:
      "Consolas, 'Courier New', monospace",

    fontSize: "13px",

    lineHeight: "1.5",

    tabSize: "2",

    whiteSpace: "pre",

    overflow: "auto"

  });

  // ============================================================
  // OUTPUT HEADER
  // ============================================================

  const outputHeader =
    document.createElement("div");

  Object.assign(outputHeader.style, {

    height: "28px",

    minHeight: "28px",

    display: "flex",

    alignItems: "center",

    justifyContent: "space-between",

    padding: "0 8px",

    background: "#191919",

    borderTop: "1px solid #444",

    color: "#aaa",

    fontSize: "12px"

  });

  const outputTitle =
    document.createElement("span");

  outputTitle.textContent =
    "🖥 Console / Script Output";

  const clearOutputBtn =
    document.createElement("button");

  clearOutputBtn.textContent =
    "Clear";

  Object.assign(clearOutputBtn.style, {

    background: "transparent",

    color: "#888",

    border: "none",

    cursor: "pointer",

    fontSize: "11px"

  });

  outputHeader.appendChild(
    outputTitle
  );

  outputHeader.appendChild(
    clearOutputBtn
  );

  // ============================================================
  // OUTPUT
  // ============================================================

  const output =
    document.createElement("div");

  this._codeOutput =
    output;

  Object.assign(output.style, {

    height: "145px",

    minHeight: "70px",

    maxHeight: "240px",

    overflowY: "auto",

    background: "#080808",

    color: "#aaa",

    padding: "7px 10px",

    fontFamily:
      "Consolas, monospace",

    fontSize: "12px",

    lineHeight: "1.5",

    borderTop: "1px solid #333"

  });

  // ============================================================
  // PRINT
  // ============================================================

  const print =
    (
      value,
      type = "log"
    ) => {

      const row =
        document.createElement("div");

      let text;

      if (
        typeof value === "string"
      ) {

        text = value;

      } else {

        try {

          text =
            JSON.stringify(
              value,
              (key, val) => {

                if (
                  window.THREE &&
                  val instanceof THREE.Vector3
                ) {

                  return {
                    x: val.x,
                    y: val.y,
                    z: val.z
                  };

                }

                if (
                  window.THREE &&
                  val instanceof THREE.Vector2
                ) {

                  return {
                    x: val.x,
                    y: val.y
                  };

                }

                if (
                  window.THREE &&
                  val instanceof THREE.Color
                ) {

                  return (
                    "#" +
                    val.getHexString()
                  );

                }

                if (
                  typeof val === "function"
                ) {

                  return "[Function]";

                }

                return val;

              },
              2
            );

        } catch {

          text =
            String(value);

        }

      }

      row.textContent =
        text;

      row.style.whiteSpace =
        "pre-wrap";

      if (type === "error") {

        row.style.color =
          "#ff6b6b";

      } else if (
        type === "warn"
      ) {

        row.style.color =
          "#ffd166";

      } else if (
        type === "success"
      ) {

        row.style.color =
          "#66ff99";

      } else {

        row.style.color =
          "#aaa";

      }

      output.appendChild(row);

      output.scrollTop =
        output.scrollHeight;

    };

  // ============================================================
  // CONSOLE PROXY
  // ============================================================

  const createConsoleProxy =
    () => {

      return {

        log: (...args) => {

          args.forEach(
            v =>
              print(v, "log")
          );

        },

        info: (...args) => {

          args.forEach(
            v =>
              print(v, "log")
          );

        },

        warn: (...args) => {

          args.forEach(
            v =>
              print(v, "warn")
          );

        },

        error: (...args) => {

          args.forEach(
            v =>
              print(v, "error")
          );

        },

        success: (...args) => {

          args.forEach(
            v =>
              print(v, "success")
          );

        },

        clear: () => {

          output.innerHTML =
            "";

        }

      };

    };

 // ============================================================
// RUNTIME RESOLVER — FIXED / NO RECURSION
// ============================================================
//
// QUAN TRỌNG:
// getRuntime() KHÔNG được đọc từ window.Math3DAPI
// vì Math3DAPI có các getter gọi ngược lại getRuntime().
//
// Runtime thật được lưu tại:
// window.Math3DRuntime
//
// ============================================================

const getRuntime = () => {

  const raw =
    window.Math3DRuntime || {};

  const runtime = {

    THREE:
      window.THREE ||
      raw.THREE ||
      null,

    math:
      window.math ||
      raw.math ||
      null,

    scene:
      raw.scene ||
      window.scene ||
      null,

    camera:
      raw.camera ||
      window.camera ||
      null,

    renderer:
      raw.renderer ||
      window.renderer ||
      null,

    controls:
      raw.controls ||
      window.controls ||
      null,

    worldGroup:
      raw.worldGroup ||
      window.worldGroup ||
      null,

    allObjects:
      raw.allObjects ||
      window.allObjects ||
      null,

    sampleParams:
      raw.sampleParams ||
      window.sampleParams ||
      null,

    displayParams:
      raw.displayParams ||
      window.displayParams ||
      null,

    createShape:
      raw.createShape ||
      window.createShape ||
      null,

    plot:
      raw.plot ||
      window.plot ||
      null,

    plotFunction:
      raw.plotFunction ||
      window.plotFunction ||
      null,

    plotCartesian:
      raw.plotCartesian ||
      window.plotCartesian ||
      null,

    plotParametric:
      raw.plotParametric ||
      window.plotParametric ||
      null,

    plotPolar:
      raw.plotPolar ||
      window.plotPolar ||
      null,

    plotSurface:
      raw.plotSurface ||
      window.plotSurface ||
      null,

    clearPlots:
      raw.clearPlots ||
      window.clearPlots ||
      null

  };

  // ----------------------------------------------------------
  // ROOT
  // ----------------------------------------------------------

  runtime.root =
    runtime.worldGroup &&
    typeof runtime.worldGroup.add === "function"

      ? runtime.worldGroup

      : (
          runtime.scene &&
          typeof runtime.scene.add === "function"

            ? runtime.scene

            : null
        );

  return runtime;
};
  // ============================================================
  // PERSISTENT CODE LAB STATE
  // ============================================================

  // Không reset nếu CodeLab đã tồn tại.
  const previousCodeLab =
    window.Math3DCodeLab || {};

  const persistentVars =
    previousCodeLab.vars ||
    {};

  // ============================================================
  // RESOURCE REGISTRIES
  // ============================================================

  const scriptObjects =
    new Set();

  const scriptPlots =
    new Set();

  const scriptAnimations =
    new Set();

  // ============================================================
  // DISPOSE
  // ============================================================

  const disposeObject =
    object => {

      if (!object) return;

      // Children first
      if (
        Array.isArray(object.children)
      ) {

        [
          ...object.children
        ].forEach(
          child => {

            disposeObject(
              child
            );

          }
        );

      }

      if (object.parent) {

        object.parent.remove(
          object
        );

      }

      if (object.geometry) {

        try {

          object.geometry.dispose();

        } catch {}

      }

      if (object.material) {

        if (
          Array.isArray(object.material)
        ) {

          object.material.forEach(
            material => {

              try {

                material.dispose();

              } catch {}

            }
          );

        } else {

          try {

            object.material.dispose();

          } catch {}

        }

      }

    };

  // ============================================================
  // FIND OBJECT
  // ============================================================

  const findObject =
    name => {

      const runtime =
        getRuntime();

      const target =
        String(name);

      // Code Lab objects
      for (
        const obj
        of scriptObjects
      ) {

        if (
          obj &&
          obj.name === target
        ) {

          return obj;

        }

      }

      // Plot objects
      for (
        const obj
        of scriptPlots
      ) {

        if (
          obj &&
          obj.name === target
        ) {

          return obj;

        }

      }

      // allObjects array
      if (
        Array.isArray(
          runtime.allObjects
        )
      ) {

        const found =
          runtime.allObjects.find(
            obj =>
              obj &&
              obj.name === target
          );

        if (found) return found;

      }

      // worldGroup traversal
      if (
        runtime.worldGroup &&
        typeof runtime.worldGroup.getObjectByName ===
          "function"
      ) {

        const found =
          runtime.worldGroup.getObjectByName(
            target
          );

        if (found) return found;

      }

      // scene traversal
      if (
        runtime.scene &&
        typeof runtime.scene.getObjectByName ===
          "function"
      ) {

        const found =
          runtime.scene.getObjectByName(
            target
          );

        if (found) return found;

      }

      return null;

    };

  // ============================================================
  // OBJECT LAB
  // ============================================================

  const createObjectLab =
    runtime => {

      const ObjectLab = {

        create(
          type = "box",
          options = {}
        ) {

          const THREE =
            runtime.THREE ||
            window.THREE;

          if (!THREE) {

            throw new Error(
              "Three.js chưa được tải."
            );

          }

          const current =
            getRuntime();

          const root =
            current.root;

          if (
            !root ||
            typeof root.add !== "function"
          ) {

            throw new Error(
              "Math 3D Runtime chưa sẵn sàng: " +
              "không tìm thấy worldGroup/scene."
            );

          }

          let geometry;

          const size =
            Number(
              options.size ?? 1
            );

          const height =
            Number(
              options.height ?? size
            );

          const lowerType =
            String(type)
              .toLowerCase();

          switch (lowerType) {

            case "box":

              geometry =
                new THREE.BoxGeometry(
                  size,
                  height,
                  size
                );

              break;

            case "sphere":

              geometry =
                new THREE.SphereGeometry(
                  size,
                  Number(
                    options.widthSegments ??
                    32
                  ),
                  Number(
                    options.heightSegments ??
                    32
                  )
                );

              break;

            case "cylinder":

              geometry =
                new THREE.CylinderGeometry(
                  Number(
                    options.radiusTop ??
                    size
                  ),
                  Number(
                    options.radiusBottom ??
                    size
                  ),
                  height,
                  Number(
                    options.segments ??
                    32
                  )
                );

              break;

            case "cone":

              geometry =
                new THREE.ConeGeometry(
                  Number(
                    options.radius ??
                    size
                  ),
                  height,
                  Number(
                    options.segments ??
                    32
                  )
                );

              break;

            case "torus":

              geometry =
                new THREE.TorusGeometry(
                  Number(
                    options.radius ??
                    size
                  ),
                  Number(
                    options.tube ??
                    size * 0.25
                  ),
                  24,
                  64
                );

              break;

            case "plane":

              geometry =
                new THREE.PlaneGeometry(
                  Number(
                    options.width ??
                    size
                  ),
                  Number(
                    options.height ??
                    size
                  )
                );

              break;

            case "circle":

              geometry =
                new THREE.CircleGeometry(
                  size,
                  Number(
                    options.segments ??
                    64
                  )
                );

              break;

            case "ring":

              geometry =
                new THREE.RingGeometry(
                  Number(
                    options.innerRadius ??
                    size * 0.5
                  ),
                  Number(
                    options.outerRadius ??
                    size
                  ),
                  Number(
                    options.segments ??
                    64
                  )
                );

              break;

            default:

              throw new Error(
                "Object type không hỗ trợ: " +
                type
              );

          }

          const material =
            new THREE.MeshStandardMaterial({

              color:
                options.color ??
                "#44aaff",

              transparent:
                !!options.transparent,

              opacity:
                Number(
                  options.opacity ?? 1
                ),

              wireframe:
                !!options.wireframe,

              side:
                options.doubleSide
                  ? THREE.DoubleSide
                  : THREE.FrontSide

            });

          const mesh =
            new THREE.Mesh(
              geometry,
              material
            );

          // Position
          if (
            Array.isArray(
              options.position
            )
          ) {

            mesh.position.set(

              Number(
                options.position[0] ?? 0
              ),

              Number(
                options.position[1] ?? 0
              ),

              Number(
                options.position[2] ?? 0
              )

            );

          }

          // Rotation
          if (
            Array.isArray(
              options.rotation
            )
          ) {

            mesh.rotation.set(

              Number(
                options.rotation[0] ?? 0
              ),

              Number(
                options.rotation[1] ?? 0
              ),

              Number(
                options.rotation[2] ?? 0
              )

            );

          }

          // Scale
          if (
            Array.isArray(
              options.scale
            )
          ) {

            mesh.scale.set(

              Number(
                options.scale[0] ?? 1
              ),

              Number(
                options.scale[1] ?? 1
              ),

              Number(
                options.scale[2] ?? 1
              )

            );

          }

          if (options.name) {

            mesh.name =
              String(
                options.name
              );

          }

          root.add(mesh);

          scriptObjects.add(mesh);

          if (
            Array.isArray(
              current.allObjects
            )
          ) {

            current.allObjects.push(
              mesh
            );

          }

          return mesh;

        },

        get(name) {

          return findObject(name);

        },

        find(name) {

          return findObject(name);

        },

        remove(objectOrName) {

          const object =
            typeof objectOrName === "string"

              ? findObject(
                  objectOrName
                )

              : objectOrName;

          if (!object) return false;

          // Remove animation trước
          MotionLab.removeObject(
            object
          );

          disposeObject(
            object
          );

          scriptObjects.delete(
            object
          );

          const current =
            getRuntime();

          if (
            Array.isArray(
              current.allObjects
            )
          ) {

            const index =
              current.allObjects.indexOf(
                object
              );

            if (index >= 0) {

              current.allObjects.splice(
                index,
                1
              );

            }

          }

          return true;

        },

        clear() {

          [
            ...scriptObjects
          ].forEach(
            object =>
              ObjectLab.remove(
                object
              )
          );

        },

        list() {

          return [
            ...scriptObjects
          ];

        }

      };

      return ObjectLab;

    };

  // ============================================================
  // MOTION LAB
  // ============================================================

  const createMotionLab =
    () => {

      let running =
        false;

      let rafId =
        null;

      let lastGlobalTime =
        null;

      const resolveObject =
        objectOrName => {

          if (
            typeof objectOrName === "string"
          ) {

            return findObject(
              objectOrName
            );

          }

          return objectOrName;

        };

      const MotionLab = {

        // ------------------------------------------------------
        // ANIMATE
        // ------------------------------------------------------

        animate(
          objectOrName,
          callback,
          options = {}
        ) {

          const object =
            resolveObject(
              objectOrName
            );

          if (
            !object
          ) {

            throw new Error(
              "MotionLab: không tìm thấy object."
            );

          }

          if (
            typeof callback !==
              "function"
          ) {

            throw new Error(
              "MotionLab.animate(object, callback): " +
              "callback phải là function."
            );

          }

          const item = {

            object,

            callback,

            lastTime: null,

            enabled:
              options.enabled !== false,

            name:
              options.name ||
              null

          };

          scriptAnimations.add(
            item
          );

          // Tự khởi động ticker
          MotionLab.start();

          return item;

        },

        // ------------------------------------------------------
        // ANIMATE BY NAME
        // ------------------------------------------------------

        animateByName(
          name,
          callback,
          options = {}
        ) {

          const object =
            findObject(name);

          if (!object) {

            throw new Error(
              "MotionLab: không tìm thấy object '" +
              name +
              "'."
            );

          }

          return MotionLab.animate(
            object,
            callback,
            options
          );

        },

        // ------------------------------------------------------
        // REMOVE ANIMATION
        // ------------------------------------------------------

        remove(animation) {

          if (!animation) return;

          scriptAnimations.delete(
            animation
          );

        },

        // ------------------------------------------------------
        // REMOVE ALL MOTIONS OF OBJECT
        // ------------------------------------------------------

        removeObject(objectOrName) {

          const object =
            resolveObject(
              objectOrName
            );

          if (!object) return;

          [
            ...scriptAnimations
          ].forEach(
            animation => {

              if (
                animation.object ===
                object
              ) {

                scriptAnimations.delete(
                  animation
                );

              }

            }
          );

        },

        // ------------------------------------------------------
        // CLEAR
        // ------------------------------------------------------

        clear() {

          scriptAnimations.clear();

          MotionLab.stop();

        },

        // ------------------------------------------------------
        // UPDATE
        // ------------------------------------------------------

        update(time) {

          const now =
            Number(
              time ??
              performance.now()
            );

          for (
            const item
            of [...scriptAnimations]
          ) {

            if (
              !item ||
              !item.object ||
              !item.enabled
            ) {

              continue;

            }

            const dt =
              item.lastTime === null

                ? 0

                : Math.min(
                    0.1,
                    Math.max(
                      0,
                      (
                        now -
                        item.lastTime
                      ) *
                      0.001
                    )
                  );

            item.lastTime =
              now;

            try {

              item.callback(
                item.object,
                now,
                dt,
                now * 0.001
              );

            } catch (error) {

              console.warn(
                "Code Lab Motion Error:",
                error
              );

              print(
                "❌ Motion error: " +
                (
                  error?.message ||
                  String(error)
                ),
                "error"
              );

              // Không xóa animation ngay lập tức
              // để tránh mất motion khi một frame lỗi.

              item.enabled =
                false;

            }

          }

        },

        // ------------------------------------------------------
        // ENABLE
        // ------------------------------------------------------

        enable(animation) {

          if (animation) {

            animation.enabled =
              true;

          }

        },

        // ------------------------------------------------------
        // DISABLE
        // ------------------------------------------------------

        disable(animation) {

          if (animation) {

            animation.enabled =
              false;

          }

        },

        // ------------------------------------------------------
        // START INTERNAL TICKER
        // ------------------------------------------------------

        start() {

          if (running) return;

          running =
            true;

          lastGlobalTime =
            performance.now();

          const loop =
            time => {

              if (!running) {

                rafId =
                  null;

                return;

              }

              MotionLab.update(
                time
              );

              lastGlobalTime =
                time;

              rafId =
                requestAnimationFrame(
                  loop
                );

            };

          rafId =
            requestAnimationFrame(
              loop
            );

        },

        // ------------------------------------------------------
        // STOP INTERNAL TICKER
        // ------------------------------------------------------

        stop() {

          running =
            false;

          if (
            rafId !== null
          ) {

            cancelAnimationFrame(
              rafId
            );

          }

          rafId =
            null;

          lastGlobalTime =
            null;

        },

        // ------------------------------------------------------
        // LIST
        // ------------------------------------------------------

        list() {

          return [
            ...scriptAnimations
          ];

        },

        // ------------------------------------------------------
        // COUNT
        // ------------------------------------------------------

        count() {

          return scriptAnimations.size;

        }

      };

      return MotionLab;

    };

  // ============================================================
  // PLOT LAB
  // ============================================================

  const createPlotLab =
    runtime => {

      const THREE =
        runtime.THREE ||
        window.THREE;

      if (!THREE) {

        throw new Error(
          "Three.js chưa sẵn sàng."
        );

      }

      const getRoot =
        () => {

          const current =
            getRuntime();

          if (
            current.root &&
            typeof current.root.add ===
              "function"
          ) {

            return current.root;

          }

          throw new Error(
            "PlotLab: worldGroup/scene chưa sẵn sàng."
          );

        };

      const register =
        (
          object,
          name
        ) => {

          if (!object) return null;

          if (name) {

            object.name =
              String(name);

          }

          getRoot().add(
            object
          );

          scriptPlots.add(
            object
          );

          return object;

        };

      // ========================================================
      // VECTOR CONVERTER
      // ========================================================

      const toVector3 =
        point => {

          if (
            point instanceof THREE.Vector3
          ) {

            return point.clone();

          }

          if (
            Array.isArray(point)
          ) {

            return new THREE.Vector3(

              Number(
                point[0] ?? 0
              ),

              Number(
                point[1] ?? 0
              ),

              Number(
                point[2] ?? 0
              )

            );

          }

          if (point) {

            return new THREE.Vector3(

              Number(
                point.x ?? 0
              ),

              Number(
                point.y ?? 0
              ),

              Number(
                point.z ?? 0
              )

            );

          }

          return new THREE.Vector3();

        };

      // ========================================================
      // LINE
      // ========================================================

      const line =
        (
          points,
          options = {}
        ) => {

          if (
            !Array.isArray(points) ||
            points.length < 2
          ) {

            throw new Error(
              "PlotLab.line() cần ít nhất 2 points."
            );

          }

          const vectors =
            points.map(
              toVector3
            );

          const geometry =
            new THREE.BufferGeometry()
              .setFromPoints(
                vectors
              );

          const material =
            new THREE.LineBasicMaterial({

              color:
                options.color ??
                "#00ffff",

              transparent:
                !!options.transparent,

              opacity:
                Number(
                  options.opacity ?? 1
                )

            });

          const object =
            new THREE.Line(
              geometry,
              material
            );

          return register(
            object,
            options.name
          );

        };

      // ========================================================
// CARTESIAN
// Hỗ trợ:
//
// PlotLab.cartesian(x => Math.sin(x), options)
//
// hoặc:
//
// PlotLab.cartesian("sin(x)", options)
// ========================================================

const cartesian =
(
  fn,
  options = {}
) => {

  const expression =
    typeof fn === "string"
      ? fn.trim()
      : null;

  const evaluator =
    typeof fn === "function"

      ? fn

      : expression

        ? (x, t) => {

            const mathEngine =
              runtime.math ||
              window.math;

            if (!mathEngine) {
              throw new Error(
                "mathjs chưa được tải."
              );
            }

            return mathEngine.evaluate(
              expression,
              {
                x,
                t
              }
            );

          }

        : null;

  if (
    typeof evaluator !== "function"
  ) {

    throw new Error(
      'PlotLab.cartesian(): fn phải là function hoặc chuỗi như "sin(x)"'
    );

  }

  const xMin =
    Number(
      options.xMin ??
      options.min ??
      -10
    );

  const xMax =
    Number(
      options.xMax ??
      options.max ??
      10
    );

  let samples;

  if (
    options.samples !== undefined
  ) {

    samples =
      Math.max(
        2,
        Math.floor(
          Number(
            options.samples
          )
        )
      );

  } else if (
    options.step !== undefined
  ) {

    const step =
      Math.abs(
        Number(
          options.step
        )
      ) || 0.05;

    samples =
      Math.max(
        2,
        Math.ceil(
          Math.abs(
            xMax - xMin
          ) / step
        )
      );

  } else {

    samples = 500;

  }

  const points = [];

  for (
    let i = 0;
    i <= samples;
    i++
  ) {

    const t =
      i / samples;

    const x =
      xMin +
      (
        xMax -
        xMin
      ) *
      t;

    let y;

    try {

      y =
        Number(
          evaluator(
            x,
            t
          )
        );

    } catch (error) {

      continue;

    }

    if (
      !Number.isFinite(y)
    ) {

      continue;

    }

    points.push(
      new THREE.Vector3(

        x,

        y,

        Number(
          options.z ?? 0
        )

      )
    );

  }

  if (
    points.length < 2
  ) {

    throw new Error(
      "PlotLab.cartesian(): không tạo đủ điểm."
    );

  }

  return line(
    points,
    options
  );

};

      // ========================================================
// PARAMETRIC
//
// Cách 1:
//
// PlotLab.parametric(
//   t => [
//     Math.cos(t),
//     Math.sin(t),
//     t
//   ]
// )
//
// Cách 2:
//
// PlotLab.parametric(
//   "cos(t)",
//   "sin(t)",
//   "t"
// )
// ========================================================

const parametric =
(
  fn,
  fnY,
  fnZ,
  options = {}
) => {

  // --------------------------------------------
  // STRING MODE
  // --------------------------------------------

  let evaluator;

  if (
    typeof fn === "string"
  ) {

    const xExpression =
      fn;

    const yExpression =
      fnY;

    const zExpression =
      fnZ;

    // Cho phép:
    //
    // PlotLab.parametric(
    //   "cos(t)",
    //   "sin(t)",
    //   "t"
    // )

    evaluator =
      (t, normalizedT) => {

        const mathEngine =
          runtime.math ||
          window.math;

        if (!mathEngine) {

          throw new Error(
            "mathjs chưa được tải."
          );

        }

        return {

          x:
            mathEngine.evaluate(
              xExpression,
              {
                t,
                u: t
              }
            ),

          y:
            mathEngine.evaluate(
              yExpression,
              {
                t,
                u: t
              }
            ),

          z:
            mathEngine.evaluate(
              zExpression,
              {
                t,
                u: t
              }
            )

        };

      };

  }

  // --------------------------------------------
  // FUNCTION MODE
  // --------------------------------------------

  else if (
    typeof fn === "function"
  ) {

    evaluator =
      fn;

  }

  else {

    throw new Error(
      "PlotLab.parametric(): fn phải là function hoặc chuỗi."
    );

  }

  // --------------------------------------------
  // OPTIONS
  // --------------------------------------------

  const tMin =
    Number(
      options.tMin ??
      options.min ??
      0
    );

  const tMax =
    Number(
      options.tMax ??
      options.max ??
      Math.PI * 2
    );

  let samples;

  if (
    options.samples !== undefined
  ) {

    samples =
      Math.max(
        2,
        Math.floor(
          Number(
            options.samples
          )
        )
      );

  } else if (
    options.step !== undefined
  ) {

    const step =
      Math.abs(
        Number(
          options.step
        )
      ) || 0.02;

    samples =
      Math.max(
        2,
        Math.ceil(
          Math.abs(
            tMax - tMin
          ) / step
        )
      );

  } else {

    samples = 500;

  }

  // --------------------------------------------
  // GENERATE
  // --------------------------------------------

  const points = [];

  for (
    let i = 0;
    i <= samples;
    i++
  ) {

    const normalizedT =
      i / samples;

    const t =
      tMin +
      (
        tMax -
        tMin
      ) *
      normalizedT;

    let value;

    try {

      value =
        evaluator(
          t,
          normalizedT
        );

    } catch {

      continue;

    }

    if (
      Array.isArray(value)
    ) {

      value = {

        x:
          value[0],

        y:
          value[1],

        z:
          value[2]

      };

    }

    if (!value) continue;

    const x =
      Number(
        value.x ?? 0
      );

    const y =
      Number(
        value.y ?? 0
      );

    const z =
      Number(
        value.z ?? 0
      );

    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(z)
    ) {

      continue;

    }

    points.push(
      new THREE.Vector3(
        x,
        y,
        z
      )
    );

  }

  if (
    points.length < 2
  ) {

    throw new Error(
      "PlotLab.parametric(): không tạo đủ điểm."
    );

  }

  return line(
    points,
    options
  );

};
      // ========================================================
// POLAR
//
// PlotLab.polar(
//   "1 + cos(theta)",
//   options
// )
//
// hoặc:
//
// PlotLab.polar(
//   theta => 1 + Math.cos(theta),
//   options
// )
// ========================================================

const polar =
(
  fn,
  options = {}
) => {

  let evaluator;

  if (
    typeof fn === "function"
  ) {

    evaluator =
      fn;

  } else if (
    typeof fn === "string"
  ) {

    const expression =
      fn.trim();

    evaluator =
      (theta, t) => {

        const mathEngine =
          runtime.math ||
          window.math;

        if (!mathEngine) {

          throw new Error(
            "mathjs chưa được tải."
          );

        }

        return mathEngine.evaluate(
          expression,
          {
            theta,
            t
          }
        );

      };

  } else {

    throw new Error(
      'PlotLab.polar(): fn phải là function hoặc chuỗi như "1 + cos(theta)"'
    );

  }

  const thetaMin =
    Number(
      options.thetaMin ??
      options.min ??
      0
    );

  const thetaMax =
    Number(
      options.thetaMax ??
      options.max ??
      Math.PI * 2
    );

  let samples;

  if (
    options.samples !== undefined
  ) {

    samples =
      Math.max(
        2,
        Math.floor(
          Number(
            options.samples
          )
        )
      );

  } else if (
    options.step !== undefined
  ) {

    const step =
      Math.abs(
        Number(
          options.step
        )
      ) || 0.01;

    samples =
      Math.max(
        2,
        Math.ceil(
          Math.abs(
            thetaMax -
            thetaMin
          ) /
          step
        )
      );

  } else {

    samples = 500;

  }

  const points = [];

  for (
    let i = 0;
    i <= samples;
    i++
  ) {

    const normalizedT =
      i / samples;

    const theta =
      thetaMin +
      (
        thetaMax -
        thetaMin
      ) *
      normalizedT;

    let r;

    try {

      r =
        Number(
          evaluator(
            theta,
            normalizedT
          )
        );

    } catch {

      continue;

    }

    if (
      !Number.isFinite(r)
    ) {

      continue;

    }

    points.push(
      new THREE.Vector3(

        r *
          Math.cos(theta),

        r *
          Math.sin(theta),

        Number(
          options.z ?? 0
        )

      )
    );

  }

  if (
    points.length < 2
  ) {

    throw new Error(
      "PlotLab.polar(): không tạo đủ điểm."
    );

  }

  return line(
    points,
    options
  );

};
      // ========================================================
// SURFACE
//
// PlotLab.surface(
//   "x^2 + z^2",
//   options
// )
//
// hoặc:
//
// PlotLab.surface(
//   (x, z) => x*x + z*z,
//   options
// )
// ========================================================

const surface =
(
  fn,
  options = {}
) => {

  let evaluator;

  if (
    typeof fn === "function"
  ) {

    evaluator =
      fn;

  } else if (
    typeof fn === "string"
  ) {

    const expression =
      fn.trim();

    evaluator =
      (
        x,
        z,
        tx,
        tz
      ) => {

        const mathEngine =
          runtime.math ||
          window.math;

        if (!mathEngine) {

          throw new Error(
            "mathjs chưa được tải."
          );

        }

        return mathEngine.evaluate(
          expression,
          {
            x,
            z,

            // Cho phép dùng cả y
            // như alias của z
            y: z,

            tx,
            tz
          }
        );

      };

  } else {

    throw new Error(
      'PlotLab.surface(): fn phải là function hoặc chuỗi.'
    );

  }

  const xMin =
    Number(
      options.xMin ??
      options.xmin ??
      -5
    );

  const xMax =
    Number(
      options.xMax ??
      options.xmax ??
      5
    );

  const zMin =
    Number(
      options.zMin ??
      options.zmin ??
      -5
    );

  const zMax =
    Number(
      options.zMax ??
      options.zmax ??
      5
    );

  const segments =
    Math.max(
      2,
      Math.floor(
        Number(
          options.segments ??
          options.samples ??
          50
        )
      )
    );

  const vertices = [];
  const indices = [];

  // --------------------------------------------
  // VERTICES
  // --------------------------------------------

  for (
    let iz = 0;
    iz <= segments;
    iz++
  ) {

    const tz =
      iz /
      segments;

    const z =
      zMin +
      (
        zMax -
        zMin
      ) *
      tz;

    for (
      let ix = 0;
      ix <= segments;
      ix++
    ) {

      const tx =
        ix /
        segments;

      const x =
        xMin +
        (
          xMax -
          xMin
        ) *
        tx;

      let y;

      try {

        y =
          Number(
            evaluator(
              x,
              z,
              tx,
              tz
            )
          );

      } catch {

        y = 0;

      }

      if (
        !Number.isFinite(y)
      ) {

        y = 0;

      }

      vertices.push(
        x,
        y,
        z
      );

    }

  }

  // --------------------------------------------
  // TRIANGLES
  // --------------------------------------------

  for (
    let iz = 0;
    iz < segments;
    iz++
  ) {

    for (
      let ix = 0;
      ix < segments;
      ix++
    ) {

      const a =
        iz *
        (
          segments + 1
        ) +
        ix;

      const b =
        a + 1;

      const c =
        a +
        (
          segments + 1
        );

      const d =
        c + 1;

      indices.push(

        a,
        c,
        b,

        b,
        c,
        d

      );

    }

  }

  // --------------------------------------------
  // GEOMETRY
  // --------------------------------------------

  const geometry =
    new THREE.BufferGeometry();

  geometry.setAttribute(

    "position",

    new THREE.Float32BufferAttribute(
      vertices,
      3
    )

  );

  geometry.setIndex(
    indices
  );

  geometry.computeVertexNormals();

  // --------------------------------------------
  // MATERIAL
  // --------------------------------------------

  const material =
    new THREE.MeshStandardMaterial({

      color:
        options.color ??
        "#00aa88",

      side:
        THREE.DoubleSide,

      wireframe:
        !!options.wireframe,

      transparent:
        !!options.transparent,

      opacity:
        Number(
          options.opacity ?? 1
        )

    });

  const mesh =
    new THREE.Mesh(
      geometry,
      material
    );

  return register(
    mesh,
    options.name
  );

};
      // ========================================================
      // POINT
      // ========================================================

      const point =
        (
          x,
          y,
          z,
          options = {}
        ) => {

          const geometry =
            new THREE.SphereGeometry(

              Number(
                options.size ?? 0.12
              ),

              16,
              16

            );

          const material =
            new THREE.MeshStandardMaterial({

              color:
                options.color ??
                "#ff0000"

            });

          const mesh =
            new THREE.Mesh(
              geometry,
              material
            );

          mesh.position.set(

            Number(x ?? 0),

            Number(y ?? 0),

            Number(z ?? 0)

          );

          return register(
            mesh,
            options.name
          );

        };

      // ========================================================
      // VECTOR
      // ========================================================

      const vector =
        (
          origin,
          direction,
          options = {}
        ) => {

          const o =
            toVector3(
              origin
            );

          const d =
            toVector3(
              direction
            );

          const length =
            d.length();

          if (
            length === 0
          ) {

            throw new Error(
              "Vector direction không được bằng 0."
            );

          }

          const arrow =
            new THREE.ArrowHelper(

              d.clone().normalize(),

              o,

              length,

              options.color ??
                "#ffff00",

              Number(
                options.headLength ??
                length * 0.15
              ),

              Number(
                options.headWidth ??
                length * 0.08
              )

            );

          return register(
            arrow,
            options.name
          );

        };

      // ========================================================
      // REMOVE
      // ========================================================

      const remove =
        objectOrName => {

          const object =
            typeof objectOrName === "string"

              ? findObject(
                  objectOrName
                )

              : objectOrName;

          if (!object) return false;

          MotionLab.removeObject(
            object
          );

          disposeObject(
            object
          );

          scriptPlots.delete(
            object
          );

          return true;

        };

      // ========================================================
      // CLEAR
      // ========================================================

      const clear =
        () => {

          [
            ...scriptPlots
          ].forEach(
            object =>
              remove(
                object
              )
          );

        };

      return {

        line,

        cartesian,

        parametric,

        polar,

        surface,

        point,

        vector,

        remove,

        clear,

        list() {

          return [
            ...scriptPlots
          ];

        }

      };

    };

  // ============================================================
  // BUILD RUNTIME
  // ============================================================

  const runtime =
    getRuntime();

  // ============================================================
  // CREATE LABS
  // ============================================================

  const ObjectLab =
    createObjectLab(
      runtime
    );

  const MotionLab =
    createMotionLab();

  const PlotLab =
    createPlotLab(
      runtime
    );

  // ============================================================
  // CODELAB OBJECT
  // ============================================================

  const CodeLab = {

    vars:
      persistentVars,

    objects:
      scriptObjects,

    plots:
      scriptPlots,

    animations:
      scriptAnimations,

    PlotLab,

    ObjectLab,

    MotionLab,

    // ----------------------------------------------------------
    // OBJECT FINDER
    // ----------------------------------------------------------

    getObject(name) {

      return findObject(
        name
      );

    },

    find(name) {

      return findObject(
        name
      );

    },

    // ----------------------------------------------------------
    // SAVE VARIABLE
    // ----------------------------------------------------------

    set(name, value) {

      this.vars[
        String(name)
      ] =
        value;

      return value;

    },

    // ----------------------------------------------------------
    // GET VARIABLE
    // ----------------------------------------------------------

    get(name) {

      return this.vars[
        String(name)
      ];

    },

    // ----------------------------------------------------------
    // DELETE VARIABLE
    // ----------------------------------------------------------

    unset(name) {

      delete this.vars[
        String(name)
      ];

    },

    // ----------------------------------------------------------
    // CLEAR EVERYTHING CREATED BY CODE LAB
    // ----------------------------------------------------------

    clear() {

      MotionLab.clear();

      PlotLab.clear();

      ObjectLab.clear();

      Object.keys(
        this.vars
      ).forEach(
        key => {

          delete this.vars[
            key
          ];

        }
      );

    },

    // ----------------------------------------------------------
    // DESTROY SESSION
    // ----------------------------------------------------------

    destroy() {

      MotionLab.clear();

      PlotLab.clear();

      ObjectLab.clear();

      // Không xóa vars khi chỉ đóng cửa sổ.
      // Cho phép mở lại Code Lab và tiếp tục session.

    }

  };

  // ============================================================
  // GLOBAL API
  // ============================================================

  // ============================================================
// GLOBAL API — SAFE VERSION
// ============================================================

const previousAPI =
window.Math3DAPI || {};

window.Math3DAPI = {

// ----------------------------------------------------------
// CODE LAB
// ----------------------------------------------------------

PlotLab,

ObjectLab,

MotionLab,

CodeLab,

// ----------------------------------------------------------
// CORE
// ----------------------------------------------------------

get THREE() {

  return (
    window.Math3DRuntime?.THREE ||
    window.THREE ||
    null
  );

},

get math() {

  return (
    window.Math3DRuntime?.math ||
    window.math ||
    null
  );

},

get scene() {

  return (
    window.Math3DRuntime?.scene ||
    null
  );

},

get camera() {

  return (
    window.Math3DRuntime?.camera ||
    null
  );

},

get renderer() {

  return (
    window.Math3DRuntime?.renderer ||
    null
  );

},

get controls() {

  return (
    window.Math3DRuntime?.controls ||
    null
  );

},

get worldGroup() {

  return (
    window.Math3DRuntime?.worldGroup ||
    null
  );

},

get allObjects() {

  return (
    window.Math3DRuntime?.allObjects ||
    null
  );

},

get sampleParams() {

  return (
    window.Math3DRuntime?.sampleParams ||
    null
  );

},

get displayParams() {

  return (
    window.Math3DRuntime?.displayParams ||
    null
  );

},

get createShape() {

  return (
    window.Math3DRuntime?.createShape ||
    null
  );

},

// ----------------------------------------------------------
// EXISTING PLOT FUNCTIONS
// ----------------------------------------------------------

get plot() {

  return (
    window.Math3DRuntime?.plot ||
    null
  );

},

get plotFunction() {

  return (
    window.Math3DRuntime?.plotFunction ||
    null
  );

},

get plotCartesian() {

  return (
    window.Math3DRuntime?.plotCartesian ||
    null
  );

},

get plotParametric() {

  return (
    window.Math3DRuntime?.plotParametric ||
    null
  );

},

get plotPolar() {

  return (
    window.Math3DRuntime?.plotPolar ||
    null
  );

},

get plotSurface() {

  return (
    window.Math3DRuntime?.plotSurface ||
    null
  );

},

get clearPlots() {

  return (
    window.Math3DRuntime?.clearPlots ||
    null
  );

}

};

  // ============================================================
  // GLOBAL CODE LAB
  // ============================================================

  window.Math3DCodeLab =
    CodeLab;

  // Alias ngắn
  window.M3D =
    window.Math3DAPI;

  // ============================================================
  // SCRIPT CONTEXT
  // ============================================================

  const buildContext =
    consoleProxy => {

      const current =
        getRuntime();

      return {

        // CORE
        THREE:
          current.THREE,

        math:
          current.math,

        scene:
          current.scene,

        camera:
          current.camera,

        renderer:
          current.renderer,

        controls:
          current.controls,

        worldGroup:
          current.worldGroup ||
          current.root,

        root:
          current.root,

        allObjects:
          current.allObjects,

        sampleParams:
          current.sampleParams,

        displayParams:
          current.displayParams,

        // EXISTING APP
        createShape:
          current.createShape,

        plot:
          current.plot,

        plotFunction:
          current.plotFunction,

        plotCartesian:
          current.plotCartesian,

        plotParametric:
          current.plotParametric,

        plotPolar:
          current.plotPolar,

        plotSurface:
          current.plotSurface,

        clearPlots:
          current.clearPlots,

        // CODE LAB
        PlotLab,

        ObjectLab,

        MotionLab,

        CodeLab,

        M3D:
          window.Math3DAPI,

        Math3DAPI:
          window.Math3DAPI,

        Math3DCodeLab:
          CodeLab,

        // PERSISTENT VARIABLES
        vars:
          CodeLab.vars,

        // BROWSER
        window,

        document,

        performance,

        // CONSOLE
        console:
          consoleProxy

      };

    };

  // ============================================================
  // DEFAULT SCRIPT
  // ============================================================

  const defaultCode = `// ======================================================
// MATH 3D PLOTTER — CODE LAB v3
// ======================================================

console.log("Math 3D Code Lab started");

// ======================================================
// CORE
// ======================================================

console.log(
  "Three.js:",
  THREE.REVISION
);

console.log(
  "scene:",
  scene
);

console.log(
  "worldGroup:",
  worldGroup
);

// ======================================================
// CARTESIAN
// ======================================================

const graph =
  PlotLab.cartesian(
    x => Math.sin(x),
    {
      xMin: -10,
      xMax: 10,
      samples: 600,
      color: "#00ffff",
      name: "sin(x)"
    }
  );

console.log(
  "Cartesian:",
  graph
);

// ======================================================
// PARAMETRIC
// ======================================================

const helix =
  PlotLab.parametric(
    t => [
      Math.cos(t) * 2,
      Math.sin(t) * 2,
      t * 0.15
    ],
    {
      tMin: 0,
      tMax: Math.PI * 10,
      samples: 1000,
      color: "#ff44ff",
      name: "helix"
    }
  );

// ======================================================
// SURFACE
// ======================================================

const surface =
  PlotLab.surface(
    (x, z) =>
      Math.sin(
        Math.sqrt(
          x * x +
          z * z
        )
      ),
    {
      xMin: -5,
      xMax: 5,
      zMin: -5,
      zMax: 5,
      segments: 50,
      color: "#00ff99",
      name: "surface"
    }
  );

// ======================================================
// OBJECT
// ======================================================

const cube =
  ObjectLab.create(
    "box",
    {
      size: 1,
      color: "#ff8800",
      position: [0, 1, 0],
      name: "CodeCube"
    }
  );

// ======================================================
// PERSISTENT VARIABLE
//
// Có thể dùng ở lần Run tiếp theo:
// CodeLab.vars.cube
// ======================================================

CodeLab.vars.cube =
  cube;

// ======================================================
// MOTION
// ======================================================

MotionLab.animate(
  cube,
  (obj, time, dt) => {

    obj.rotation.x +=
      dt;

    obj.rotation.y +=
      dt * 1.5;

  }
);

console.log(
  "Cube:",
  cube
);

console.log(
  "✓ Script completed."
);

console.log(
  "Lần Run sau có thể dùng:",
  "CodeLab.vars.cube"
);
`;

  editor.value =
    defaultCode;

  editorWrapper.appendChild(
    editor
  );

  codeDiv.appendChild(
    editorWrapper
  );

  codeDiv.appendChild(
    outputHeader
  );

  codeDiv.appendChild(
    output
  );

  // ============================================================
  // LINE NUMBERS
  // ============================================================

  const updateLineNumbers =
    () => {

      const lines =
        editor.value.split("\n").length;

      let html = "";

      for (
        let i = 1;
        i <= lines;
        i++
      ) {

        html +=
          i + "<br>";

      }

      lineNumbers.innerHTML =
        html;

    };

  updateLineNumbers();

  editor.addEventListener(
    "input",
    updateLineNumbers
  );

  editor.addEventListener(
    "scroll",
    () => {

      lineNumbers.scrollTop =
        editor.scrollTop;

    }
  );

  // ============================================================
  // RUN JAVASCRIPT
  // ============================================================

  const runJavaScript =
    async () => {

      const code =
        editor.value.trim();

      if (!code) {

        print(
          "⚠ Không có code để chạy.",
          "warn"
        );

        return;

      }

      print(
        "────────────────────────────────",
        "log"
      );

      print(
        "▶ Running Math 3D Script...",
        "log"
      );

      try {

        const consoleProxy =
          createConsoleProxy();

        const context =
          buildContext(
            consoleProxy
          );

        const keys =
          Object.keys(
            context
          );

        const values =
          keys.map(
            key =>
              context[key]
          );

        const fn =
          new Function(

            ...keys,

            `
"use strict";

${code}
`

          );

        const result =
          fn(
            ...values
          );

        const finalResult =
          result &&
          typeof result.then ===
            "function"

            ? await result

            : result;

        if (
          finalResult !== undefined
        ) {

          print(
            "→ " +
            String(
              finalResult
            ),
            "log"
          );

        }

        print(
          "✓ Execution finished.",
          "success"
        );

      } catch (error) {

        print(
          "❌ " +
          (
            error?.stack ||
            error?.message ||
            String(error)
          ),
          "error"
        );

      }

    };

  // ============================================================
  // EXPRESSION còn lỗi
  // ============================================================

  const runExpression =
    () => {

      const expression =
        editor.value.trim();

      if (!expression) return;

      try {

        const current =
          getRuntime();

        if (!current.math) {

          throw new Error(
            "mathjs chưa được tải."
          );

        }

        const result =
          current.math.evaluate(
            expression
          );

        print(
          "→ " +
          JSON.stringify(
            result
          ),
          "log"
        );

      } catch (error) {

        print(
          "❌ " +
          (
            error?.stack ||
            error?.message ||
            String(error)
          ),
          "error"
        );

      }

    };

  // ============================================================
  // RUN
  // ============================================================

  const runCode =
    () => {

      if (
        modeSelect.value ===
        "expression"
      ) {

        runExpression();

      } else {

        runJavaScript();

      }

    };

  runBtn.onclick =
    e => {

      e.stopPropagation();

      runCode();

    };

  // ============================================================
  // CTRL ENTER + TAB
  // ============================================================

  editor.addEventListener(
    "keydown",
    e => {

      e.stopPropagation();

      if (
        e.ctrlKey &&
        e.key === "Enter"
      ) {

        e.preventDefault();

        runCode();

        return;

      }

      if (
        e.key === "Tab"
      ) {

        e.preventDefault();

        const start =
          editor.selectionStart;

        const end =
          editor.selectionEnd;

        editor.value =

          editor.value.substring(
            0,
            start
          ) +

          "  " +

          editor.value.substring(
            end
          );

        editor.selectionStart =
          editor.selectionEnd =
            start + 2;

        updateLineNumbers();

      }

    }
  );

  // ============================================================
  // CLEAR EDITOR
  // ============================================================

  clearBtn.onclick =
    e => {

      e.stopPropagation();

      editor.value =
        "";

      updateLineNumbers();

      editor.focus();

    };

  // ============================================================
  // CLEAR OUTPUT
  // ============================================================

  clearOutputBtn.onclick =
    e => {

      e.stopPropagation();

      output.innerHTML =
        "";

    };

  // ============================================================
  // CLEAR OBJECTS
  // ============================================================

  clearScriptObjectsBtn.onclick =
    e => {

      e.stopPropagation();

      try {

        MotionLab.clear();

        PlotLab.clear();

        ObjectLab.clear();

        print(
          "✓ Đã xóa object/plot/motion do Code Lab tạo.",
          "success"
        );

      } catch (error) {

        print(
          "❌ " +
          (
            error?.message ||
            String(error)
          ),
          "error"
        );

      }

    };

  // ============================================================
  // CLEAR MOTION
  // ============================================================

  clearMotionBtn.onclick =
    e => {

      e.stopPropagation();

      MotionLab.clear();

      print(
        "✓ Đã dừng toàn bộ MotionLab.",
        "success"
      );

    };

  // ============================================================
  // COPY
  // ============================================================

  copyBtn.onclick =
    async e => {

      e.stopPropagation();

      try {

        await navigator.clipboard.writeText(
          editor.value
        );

        copyBtn.textContent =
          "✓ Đã copy";

        setTimeout(
          () => {

            copyBtn.textContent =
              "📋 Copy";

          },
          1000
        );

      } catch {

        print(
          "❌ Không thể copy clipboard.",
          "error"
        );

      }

    };

  // ============================================================
  // SAVE
  // ============================================================

  saveBtn.onclick =
    e => {

      e.stopPropagation();

      try {

        localStorage.setItem(
          "math3d-code-lab",
          editor.value
        );

        print(
          "✓ Đã lưu script.",
          "success"
        );

      } catch (error) {

        print(
          "❌ Không thể lưu: " +
          error.message,
          "error"
        );

      }

    };

  // ============================================================
  // LOAD
  // ============================================================

  loadBtn.onclick =
    e => {

      e.stopPropagation();

      const saved =
        localStorage.getItem(
          "math3d-code-lab"
        );

      if (
        saved === null
      ) {

        print(
          "⚠ Chưa có script.",
          "warn"
        );

        return;

      }

      editor.value =
        saved;

      updateLineNumbers();

      print(
        "✓ Đã tải script.",
        "success"
      );

      editor.focus();

    };

  // ============================================================
  // RESET
  // ============================================================

  resetBtn.onclick =
    e => {

      e.stopPropagation();

      editor.value =
        defaultCode;

      updateLineNumbers();

      editor.focus();

    };

  // ============================================================
  // HELP
  // ============================================================

  helpBtn.onclick =
    e => {

      e.stopPropagation();

      output.innerHTML =
        "";

      const help = [

        "💻 MATH 3D PLOTTER — CODE LAB v3",

        "",

        "━━ CORE ━━━━━━━━━━━━━━━━━━━━━━━",

        "THREE",
        "math",
        "scene",
        "camera",
        "renderer",
        "controls",
        "worldGroup",
        "root",
        "allObjects",

        "",

        "━━ PERSISTENT STATE ━━━━━━━━━",

        "CodeLab.vars",
        "CodeLab.vars.cube",
        "CodeLab.set(name, value)",
        "CodeLab.get(name)",
        "CodeLab.getObject(name)",
        "CodeLab.find(name)",

        "",

        "━━ PLOT LAB ━━━━━━━━━━━━━━━━━",

        "PlotLab.line(points, options)",
        "PlotLab.cartesian(fn, options)",
        "PlotLab.parametric(fn, options)",
        "PlotLab.polar(fn, options)",
        "PlotLab.surface(fn, options)",
        "PlotLab.point(x,y,z, options)",
        "PlotLab.vector(origin,direction, options)",
        "PlotLab.remove(object)",
        "PlotLab.clear()",
        "PlotLab.list()",

        "",

        "━━ OBJECT LAB ━━━━━━━━━━━━━━━",

        'ObjectLab.create("box", options)',
        'ObjectLab.create("sphere", options)',
        'ObjectLab.create("cylinder", options)',
        'ObjectLab.create("cone", options)',
        'ObjectLab.create("torus", options)',
        'ObjectLab.create("plane", options)',
        'ObjectLab.create("circle", options)',
        'ObjectLab.create("ring", options)',

        "ObjectLab.get(name)",
        "ObjectLab.find(name)",
        "ObjectLab.remove(object)",
        "ObjectLab.remove(name)",
        "ObjectLab.clear()",
        "ObjectLab.list()",

        "",

        "━━ MOTION LAB ━━━━━━━━━━━━━━━",

        "MotionLab.animate(object, callback)",
        'MotionLab.animate("CodeCube", callback)',
        "MotionLab.animateByName(name, callback)",
        "MotionLab.remove(animation)",
        "MotionLab.removeObject(object)",
        "MotionLab.clear()",
        "MotionLab.update(time)",
        "MotionLab.enable(animation)",
        "MotionLab.disable(animation)",
        "MotionLab.list()",
        "MotionLab.count()",

        "",

        "━━ EXAMPLE MOTION ━━━━━━━━━━",

        'const cube = ObjectLab.get("CodeCube");',

        "MotionLab.animate(",

        "  cube,",

        "  (obj, time, dt) => {",

        "    obj.rotation.y += dt;",

        "  }",

        ");",

        "",

        "━━ PERSISTENT OBJECT ━━━━━━━",

        "CodeLab.vars.cube",

        "MotionLab.animate(",

        "  CodeLab.vars.cube,",

        "  (obj, time, dt) => {",

        "    obj.rotation.y += dt;",

        "  }",

        ");",

        "",

        "━━ MATHJS ━━━━━━━━━━━━━━━━━━━",

        'math.evaluate("2 + 3")',

        "",

        "━━ KEYBOARD ━━━━━━━━━━━━━━━━━",

        "Ctrl + Enter → Run",

        "Tab → 2 spaces"

      ];

      help.forEach(
        line =>
          print(
            line,
            "log"
          )
      );

    };

  // ============================================================
  // CLOSE
  // ============================================================

  closeBtn.onclick =
    e => {

      e.stopPropagation();

      if (
        window.Math3DCodeLab &&
        typeof window.Math3DCodeLab.destroy ===
          "function"
      ) {

        try {

          window.Math3DCodeLab.destroy();

        } catch {}

      }

      codeDiv.remove();

      this._codeDiv = null;
      this._codeEditor = null;
      this._codeOutput = null;

    };

  // ============================================================
  // EVENT PROTECTION
  // ============================================================

  codeDiv.addEventListener(
    "mousedown",
    e => e.stopPropagation()
  );

  codeDiv.addEventListener(
    "click",
    e => e.stopPropagation()
  );

  codeDiv.addEventListener(
    "wheel",
    e => e.stopPropagation()
  );

  // ============================================================
  // ADD DOM
  // ============================================================

  document.body.appendChild(
    codeDiv
  );

  // ============================================================
  // DRAG
  // ============================================================

  this.makeDraggable(
    codeDiv,
    header
  );

  // ============================================================
  // FOCUS
  // ============================================================

  editor.focus();

  // ============================================================
  // STATUS
  // ============================================================

  const initialRuntime =
    getRuntime();

  if (
    !initialRuntime.root
  ) {

    print(
      "⚠ Code Lab đã mở nhưng Math3D Runtime chưa có worldGroup/scene.",
      "warn"
    );

    print(
      "→ Kiểm tra Math3DAPI trong script.js.",
      "warn"
    );

  } else {

    print(
      "✓ Math 3D Code Lab v3 ready.",
      "success"
    );

    print(
      "✓ PlotLab / ObjectLab / MotionLab ready.",
      "success"
    );

  }

}
  // 🆕 Tạo khung tìm kiếm nổi (giống note)
  createSearchBox() {
    // Nếu đã có box hiện tại thì toggle đóng/mở
    if (this._searchDiv) {
      this._searchDiv.remove();
      this._searchDiv = null;
      return;
    }

    const searchDiv = document.createElement("div");
    this._searchDiv = searchDiv;

    // --- Khung chính ---
    searchDiv.style.position = "fixed";
    searchDiv.style.top = "20px";
    searchDiv.style.left = "20px";
    searchDiv.style.width = "280px";
    searchDiv.style.background = "rgba(40,40,40,0.97)";
    searchDiv.style.color = "#ddd";
    searchDiv.style.zIndex = 10000;
    searchDiv.style.display = "flex";
    searchDiv.style.flexDirection = "column";
    searchDiv.style.borderRadius = "10px";
    searchDiv.style.overflow = "hidden";
    searchDiv.style.boxShadow = "0 4px 15px rgba(0,0,0,0.6)";
    searchDiv.style.fontFamily = "Segoe UI, sans-serif";

    // --- Header ---
    const header = document.createElement("div");
    header.innerText = "🔍 Tìm kiếm";
    header.style.background = "linear-gradient(90deg, #444, #222)";
    header.style.color = "#fff";
    header.style.padding = "6px 10px";
    header.style.fontSize = "14px";
    header.style.fontWeight = "bold";
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    searchDiv.appendChild(header);

    // --- Nút đóng ---
    const closeBtn = document.createElement("button");
    closeBtn.innerText = "✖";
    closeBtn.style.background = "transparent";
    closeBtn.style.border = "none";
    closeBtn.style.color = "#aaa";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.fontSize = "14px";
    closeBtn.style.transition = "color 0.2s";
    closeBtn.onmouseover = () => (closeBtn.style.color = "#ff5555");
    closeBtn.onmouseout = () => (closeBtn.style.color = "#aaa");
    closeBtn.onclick = () => {
      searchDiv.remove();
      this._searchDiv = null;
    };
    header.appendChild(closeBtn);

    // --- Input ---
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Nhập tên tab hoặc folder...";
    input.style.width = "100%";
    input.style.padding = "6px 8px";
    input.style.border = "none";
    input.style.outline = "none";
    input.style.background = "#1e1e1e";
    input.style.color = "#eee";
    input.style.fontSize = "14px";
    searchDiv.appendChild(input);

    // --- Results ---
    const results = document.createElement("div");
    results.style.flex = "1";
    results.style.overflowY = "auto";
    results.style.maxHeight = "200px";
    results.style.background = "#222";
    results.style.padding = "4px";
    searchDiv.appendChild(results);

    // --- Xử lý tìm kiếm ---
    input.addEventListener("input", () => {
      const val = input.value.toLowerCase().trim();
      results.innerHTML = "";
      if (!val) return;

      const matches = this._searchData.filter((item) =>
        item.name.toLowerCase().includes(val)
      );

      if (matches.length === 0) {
        const div = document.createElement("div");
        div.textContent = "Không tìm thấy";
        div.style.padding = "4px 6px";
        div.style.color = "#aaa";
        results.appendChild(div);
      } else {
        matches.forEach((item) => {
          const div = document.createElement("div");
          div.textContent = `${item.type === "tab" ? "📑" : "📂"} ${item.name}`;
          div.style.padding = "4px 6px";
          div.style.cursor = "pointer";
          div.onmouseover = () =>
            (div.style.background = "rgba(255,255,255,0.15)");
          div.onmouseout = () => (div.style.background = "transparent");
          div.onclick = () => {
            // Nếu đang thu gọn thì tự mở trước
            if (this._collapsed && this._collapseBtn) {
              this._collapseBtn.click();
            }
            item.open();
          };

          results.appendChild(div);
        });
      }
    });
    // Ngăn sự kiện click bên trong searchBox bong ra ngoài
    input.addEventListener("click", (e) => e.stopPropagation());
    input.addEventListener("keydown", (e) => e.stopPropagation());
    results.addEventListener("click", (e) => e.stopPropagation());

    document.body.appendChild(searchDiv);
    this.makeDraggable(searchDiv, header); // 🆕 kéo-thả bằng header

  }

  showTab(name) {
    for (const key in this.tabs) {
      const { tabDiv, btn } = this.tabs[key];
      tabDiv.style.display = key === name ? "block" : "none";
      btn.classList.toggle("active", key === name);
    }
    this.currentTab = name;
  }

  getCurrentGUI() {
    return this.tabs[this.currentTab]?.gui || null;
  }

  // ===== Extra Features =====
  saveDefaults(paramsObj) {
    for (const key in paramsObj) {
      if (!(key in this.defaultValues)) {
        this.defaultValues[key] = JSON.parse(JSON.stringify(paramsObj[key]));
      }
    }
  }

  resetAll(paramsObj) {
    for (const key in this.defaultValues) {
      if (paramsObj[key] !== undefined) {
        paramsObj[key] = JSON.parse(JSON.stringify(this.defaultValues[key]));
      }
    }
    this.updateAllDisplays();
  }

  exportJSON(paramsObj) {
    const json = JSON.stringify(paramsObj, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gui-config.json";
    a.click();
  }

  importJSON(paramsObj, file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = JSON.parse(e.target.result);
      Object.assign(paramsObj, data);
      this.updateAllDisplays();
    };
    reader.readAsText(file);
  }

  collapseAll() {
    for (const key in this.tabs) {
      const gui = this.tabs[key].gui;
      if (gui.__folders) {
        Object.values(gui.__folders).forEach((f) => {
          f.close(); // chỉ cần close thôi
        });
      }
    }
  }

  expandAll() {
    for (const key in this.tabs) {
      const gui = this.tabs[key].gui;
      if (gui.__folders) {
        Object.values(gui.__folders).forEach((f) => {
          f.open(); // chỉ cần open thôi
        });
      }
    }
  }

  toggle() {
    const root = document.getElementById("gui-root");
    root.style.display = root.style.display === "none" ? "flex" : "none";
  }

  updateAllDisplays() {
    for (const key in this.tabs) {
      this.tabs[key].gui.updateDisplay();
    }
  }
  // ===== Tạo miniMenu kiểu dat.GUI =====
  _initMiniMenu() {
    const menu = document.createElement("div");
    menu.className = "gui-mini-menu";
    menu.style.position = "absolute";
    menu.style.background = "rgba(50,50,50,0.95)";
    menu.style.color = "#fff";
    menu.style.padding = "6px 10px";
    menu.style.borderRadius = "6px";
    menu.style.display = "none";
    menu.style.zIndex = "9999";
    menu.style.fontSize = "14px";
    menu.style.minWidth = "120px";
    menu.style.boxShadow = "0 2px 6px rgba(0,0,0,0.3)";
    menu.style.userSelect = "none";
    document.body.appendChild(menu);
    this.miniMenu = menu;

    // click ra ngoài ẩn menu
    window.addEventListener("click", () => {
      menu.style.display = "none";
    });
  }

  // 🆕 Cập nhật nội dung menu
  setMiniMenuItems(items) {
    if (!this.miniMenu) return;
    this.miniMenu.innerHTML = "";
    items.forEach((it) => {
      const div = document.createElement("div");
      div.textContent = it.label;
      div.style.padding = "2px 6px";
      div.style.cursor = "pointer";
      div.onmouseover = () => (div.style.background = "rgba(255,255,255,0.2)");
      div.onmouseout = () => (div.style.background = "transparent");
      div.onclick = (e) => {
        e.stopPropagation(); // 🆕 ngăn sự kiện click "bong ra" window
        it.onClick();
        this.miniMenu.style.display = "none";
      };
      this.miniMenu.appendChild(div);
    });
  }

  // 🆕 Hiển thị menu tại vị trí chuột
  showMiniMenu(x, y) {
    if (!this.miniMenu) return;
    this.miniMenu.style.left = x + "px";
    this.miniMenu.style.top = y + "px";
    this.miniMenu.style.display = "block";
  }
  createNote() {
    // Nếu đã có note đang hiển thị, đóng nó và trả về
    if (this._noteDiv) {
      this._noteDiv.remove();
      this._noteDiv = null;
      return;
    }

    const noteDiv = document.createElement("div");
    this._noteDiv = noteDiv; // lưu tham chiếu

    // --- Khung chính ---
    noteDiv.style.position = "fixed";
    noteDiv.style.top = "20px";
    noteDiv.style.left = "20px";
    noteDiv.style.width = "350px";
    noteDiv.style.height = "300px";
    noteDiv.style.background = "rgba(40,40,40,0.97)";
    noteDiv.style.color = "#ddd";
    noteDiv.style.zIndex = 10000;
    noteDiv.style.display = "flex";
    noteDiv.style.flexDirection = "column";
    noteDiv.style.borderRadius = "10px";
    noteDiv.style.overflow = "hidden";
    noteDiv.style.boxShadow = "0 4px 15px rgba(0,0,0,0.6)";
    noteDiv.style.fontFamily = "Segoe UI, sans-serif";

    // --- Header ---
    const header = document.createElement("div");
    header.innerText = "📝 Ghi chú";
    header.style.background = "linear-gradient(90deg, #444, #222)";
    header.style.color = "#fff";
    header.style.padding = "6px 10px";
    header.style.fontSize = "14px";
    header.style.fontWeight = "bold";
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    noteDiv.appendChild(header);

    // --- Nút đóng ---
    const closeBtn = document.createElement("button");
    closeBtn.innerText = "✖";
    closeBtn.style.background = "transparent";
    closeBtn.style.border = "none";
    closeBtn.style.color = "#aaa";
    closeBtn.style.cursor = "pointer";
    closeBtn.style.fontSize = "14px";
    closeBtn.style.transition = "color 0.2s";
    closeBtn.onmouseover = () => (closeBtn.style.color = "#ff5555");
    closeBtn.onmouseout = () => (closeBtn.style.color = "#aaa");
    closeBtn.onclick = () => {
      noteDiv.remove();
      this._noteDiv = null; // reset tham chiếu
    };
    header.appendChild(closeBtn);

    // --- Textarea ---
    const textarea = document.createElement("textarea");
    textarea.value = "Viết ghi chú...";
    textarea.style.flex = "1";
    textarea.style.resize = "none";
    textarea.style.width = "100%";
    textarea.style.height = "100%";
    textarea.style.background = "#1e1e1e";
    textarea.style.color = "#eee";
    textarea.style.border = "none";
    textarea.style.outline = "none";
    textarea.style.padding = "10px";
    textarea.style.fontFamily = "Consolas, monospace";
    textarea.style.fontSize = "14px";
    textarea.style.lineHeight = "1.4";

    textarea.addEventListener("click", (e) => e.stopPropagation());
    textarea.addEventListener("keydown", (e) => e.stopPropagation());

    noteDiv.appendChild(textarea);

    document.body.appendChild(noteDiv);
    this.makeDraggable(noteDiv, header); // 🆕 kéo-thả bằng header

  }

  // ============================================================
// 📚 TABLE OF CONTENTS / MỤC LỤC TÀI LIỆU
// ============================================================

_createDefaultTOC() {
  return [
    {
      id: "algebra",
      title: "Đại số",
      icon: "🧮",
      chapters: [
        {
          id: "algebra-functions",
          title: "Hàm số",
          lessons: [
            {
              id: "function-basic",
              title: "Khái niệm hàm số",
              content: `
                <h2>Khái niệm hàm số</h2>
                <p>
                  Hàm số mô tả mối quan hệ giữa các biến.
                  Với mỗi giá trị của biến độc lập, ta xác định được
                  một giá trị tương ứng của biến phụ thuộc.
                </p>

                <div class="toc-formula">
                  y = f(x)
                </div>

                <h3>Ví dụ</h3>
                <p>
                  Xét hàm:
                </p>

                <div class="toc-formula">
                  f(x) = x² + 2x + 1
                </div>

                <p>
                  Hàm số này có thể được đưa trực tiếp vào
                  Function Plotter của Math 3D Plotter.
                </p>
              `,
              formulas: [
                "y = f(x)",
                "f(x) = x² + 2x + 1"
              ]
            },
            {
              id: "function-domain",
              title: "Tập xác định",
              content: `
                <h2>Tập xác định của hàm số</h2>

                <p>
                  Tập xác định là tập hợp tất cả các giá trị
                  của biến làm cho biểu thức có nghĩa.
                </p>

                <div class="toc-formula">
                  D = {x ∈ ℝ | f(x) xác định}
                </div>

                <h3>Một số trường hợp thường gặp</h3>

                <ul>
                  <li>Mẫu số khác 0.</li>
                  <li>Biểu thức dưới căn bậc chẵn ≥ 0.</li>
                  <li>Đối số của logarit > 0.</li>
                </ul>
              `,
              formulas: []
            }
          ]
        },
        {
          id: "equation",
          title: "Phương trình",
          lessons: [
            {
              id: "equation-linear",
              title: "Phương trình bậc nhất",
              content: `
                <h2>Phương trình bậc nhất</h2>

                <div class="toc-formula">
                  ax + b = 0
                </div>

                <p>Với a ≠ 0:</p>

                <div class="toc-formula">
                  x = -b/a
                </div>
              `,
              formulas: [
                "ax + b = 0",
                "x = -b/a"
              ]
            },
            {
              id: "equation-quadratic",
              title: "Phương trình bậc hai",
              content: `
                <h2>Phương trình bậc hai</h2>

                <div class="toc-formula">
                  ax² + bx + c = 0
                </div>

                <p>
                  Biệt thức:
                </p>

                <div class="toc-formula">
                  Δ = b² - 4ac
                </div>

                <p>
                  Nghiệm được xác định dựa vào dấu của Δ.
                </p>
              `,
              formulas: [
                "ax² + bx + c = 0",
                "Δ = b² - 4ac"
              ]
            }
          ]
        }
      ]
    },

    {
      id: "geometry",
      title: "Hình học",
      icon: "📐",
      chapters: [
        {
          id: "geometry-plane",
          title: "Hình học phẳng",
          lessons: [
            {
              id: "line",
              title: "Đường thẳng",
              content: `
                <h2>Đường thẳng</h2>

                <p>
                  Trong hệ tọa độ Descartes, phương trình đường thẳng
                  có thể được biểu diễn dưới nhiều dạng.
                </p>

                <div class="toc-formula">
                  y = ax + b
                </div>

                <div class="toc-formula">
                  Ax + By + C = 0
                </div>
              `,
              formulas: [
                "y = ax + b",
                "Ax + By + C = 0"
              ]
            },
            {
              id: "circle",
              title: "Đường tròn",
              content: `
                <h2>Đường tròn</h2>

                <div class="toc-formula">
                  (x-a)² + (y-b)² = R²
                </div>

                <p>
                  Tâm đường tròn:
                </p>

                <div class="toc-formula">
                  I(a,b)
                </div>

                <p>
                  Bán kính:
                </p>

                <div class="toc-formula">
                  R
                </div>
              `,
              formulas: [
                "(x-a)² + (y-b)² = R²"
              ]
            }
          ]
        }
      ]
    },

    {
      id: "calculus",
      title: "Giải tích",
      icon: "📈",
      chapters: [
        {
          id: "limit",
          title: "Giới hạn",
          lessons: [
            {
              id: "limit-basic",
              title: "Khái niệm giới hạn",
              content: `
                <h2>Giới hạn</h2>

                <p>
                  Giới hạn mô tả xu hướng của một hàm số khi
                  biến tiến gần tới một giá trị nào đó.
                </p>

                <div class="toc-formula">
                  lim(x → a) f(x)
                </div>
              `,
              formulas: [
                "lim(x → a) f(x)"
              ]
            }
          ]
        },

        {
          id: "derivative",
          title: "Đạo hàm",
          lessons: [
            {
              id: "derivative-basic",
              title: "Khái niệm đạo hàm",
              content: `
                <h2>Đạo hàm</h2>

                <p>
                  Đạo hàm biểu diễn tốc độ biến thiên của hàm số.
                </p>

                <div class="toc-formula">
                  f'(x) = lim(h → 0)
                  [f(x+h)-f(x)] / h
                </div>

                <h3>Ứng dụng trong Math 3D Plotter</h3>

                <p>
                  Đạo hàm có thể được sử dụng để tìm:
                </p>

                <ul>
                  <li>Tiếp tuyến.</li>
                  <li>Điểm cực trị.</li>
                  <li>Gradient.</li>
                  <li>Vector pháp tuyến.</li>
                </ul>
              `,
              formulas: [
                "f'(x)",
                "df/dx"
              ]
            }
          ]
        },

        {
          id: "integral",
          title: "Tích phân",
          lessons: [
            {
              id: "integral-basic",
              title: "Tích phân cơ bản",
              content: `
                <h2>Tích phân</h2>

                <div class="toc-formula">
                  ∫ f(x) dx
                </div>

                <p>
                  Tích phân xác định có thể được sử dụng để tính
                  diện tích, thể tích và nhiều đại lượng hình học.
                </p>

                <div class="toc-formula">
                  ∫ₐᵇ f(x)dx
                </div>
              `,
              formulas: [
                "∫ f(x) dx",
                "∫ₐᵇ f(x) dx"
              ]
            }
          ]
        }
      ]
    },

    {
      id: "linear-algebra",
      title: "Đại số tuyến tính",
      icon: "🔢",
      chapters: [
        {
          id: "matrix",
          title: "Ma trận",
          lessons: [
            {
              id: "matrix-basic",
              title: "Khái niệm ma trận",
              content: `
                <h2>Ma trận</h2>

                <p>
                  Ma trận là một bảng chữ nhật gồm các phần tử
                  được sắp xếp theo hàng và cột.
                </p>

                <div class="toc-formula">
                  A = [aᵢⱼ]
                </div>
              `,
              formulas: [
                "A = [aᵢⱼ]"
              ]
            }
          ]
        },

        {
          id: "vector",
          title: "Vector",
          lessons: [
            {
              id: "vector-basic",
              title: "Vector trong không gian",
              content: `
                <h2>Vector trong không gian 3D</h2>

                <div class="toc-formula">
                  v = (x,y,z)
                </div>

                <p>
                  Độ dài vector:
                </p>

                <div class="toc-formula">
                  |v| = √(x² + y² + z²)
                </div>

                <p>
                  Math 3D Plotter có thể biểu diễn vector trực tiếp
                  trong không gian Three.js.
                </p>
              `,
              formulas: [
                "v = (x,y,z)",
                "|v| = √(x²+y²+z²)"
              ]
            }
          ]
        }
      ]
    },

    {
      id: "statistics",
      title: "Xác suất – Thống kê",
      icon: "📊",
      chapters: [
        {
          id: "statistics-basic",
          title: "Thống kê cơ bản",
          lessons: [
            {
              id: "mean",
              title: "Trung bình cộng",
              content: `
                <h2>Trung bình cộng</h2>

                <div class="toc-formula">
                  x̄ = (x₁ + x₂ + ... + xₙ) / n
                </div>
              `,
              formulas: [
                "x̄ = Σxᵢ/n"
              ]
            }
          ]
        }
      ]
    },

    {
      id: "analytic-geometry",
      title: "Hình học giải tích 3D",
      icon: "🌐",
      chapters: [
        {
          id: "plane",
          title: "Mặt phẳng",
          lessons: [
            {
              id: "plane-equation",
              title: "Phương trình mặt phẳng",
              content: `
                <h2>Phương trình mặt phẳng</h2>

                <div class="toc-formula">
                  Ax + By + Cz + D = 0
                </div>

                <p>
                  Vector pháp tuyến:
                </p>

                <div class="toc-formula">
                  n = (A,B,C)
                </div>
              `,
              formulas: [
                "Ax + By + Cz + D = 0",
                "n = (A,B,C)"
              ]
            }
          ]
        },

        {
          id: "sphere",
          title: "Mặt cầu",
          lessons: [
            {
              id: "sphere-equation",
              title: "Phương trình mặt cầu",
              content: `
                <h2>Mặt cầu</h2>

                <div class="toc-formula">
                  (x-a)² + (y-b)² + (z-c)² = R²
                </div>

                <p>
                  Tâm:
                </p>

                <div class="toc-formula">
                  I(a,b,c)
                </div>
              `,
              formulas: [
                "(x-a)²+(y-b)²+(z-c)²=R²"
              ]
            }
          ]
        }
      ]
    }
  ];
}


createTableOfContents() {

  // ==========================================================
  // TOGGLE
  // ==========================================================

  if (this._tocDiv) {
    this._tocDiv.remove();
    this._tocDiv = null;
    this._tocCurrentLesson = null;
    return;
  }

  // ==========================================================
  // MAIN WINDOW
  // ==========================================================

  const tocDiv = document.createElement("div");

  this._tocDiv = tocDiv;

  Object.assign(tocDiv.style, {
    position: "fixed",
    top: "60px",
    left: "80px",
    width: "760px",
    height: "520px",
    background: "rgba(30,30,30,0.98)",
    color: "#ddd",
    zIndex: "10002",
    display: "flex",
    flexDirection: "column",
    border: "1px solid #555",
    borderRadius: "10px",
    overflow: "hidden",
    boxShadow: "0 8px 30px rgba(0,0,0,.7)",
    fontFamily: "Segoe UI, Arial, sans-serif"
  });

  // ==========================================================
  // HEADER
  // ==========================================================

  const header = document.createElement("div");

  Object.assign(header.style, {
    height: "38px",
    minHeight: "38px",
    background: "linear-gradient(90deg,#444,#222)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 8px",
    fontWeight: "bold",
    cursor: "move",
    userSelect: "none"
  });

  const title = document.createElement("span");

  title.textContent = "📚 Mục lục tài liệu";

  const headerButtons = document.createElement("div");

  headerButtons.style.display = "flex";
  headerButtons.style.gap = "4px";

  // Nút đóng
  const closeBtn = document.createElement("button");

  closeBtn.textContent = "✖";
  closeBtn.title = "Đóng";

  Object.assign(closeBtn.style, {
    background: "transparent",
    border: "none",
    color: "#aaa",
    cursor: "pointer",
    fontSize: "14px",
    padding: "4px 7px"
  });

  closeBtn.onmouseenter = () => {
    closeBtn.style.background = "rgba(255,80,80,.25)";
    closeBtn.style.color = "#fff";
  };

  closeBtn.onmouseleave = () => {
    closeBtn.style.background = "transparent";
    closeBtn.style.color = "#aaa";
  };

  closeBtn.onclick = (e) => {

    e.stopPropagation();

    tocDiv.remove();

    this._tocDiv = null;
    this._tocCurrentLesson = null;
  };

  headerButtons.appendChild(closeBtn);

  header.appendChild(title);
  header.appendChild(headerButtons);

  tocDiv.appendChild(header);

  // ==========================================================
  // TOOLBAR
  // ==========================================================

  const toolbar = document.createElement("div");

  Object.assign(toolbar.style, {
    display: "flex",
    gap: "5px",
    padding: "6px",
    background: "#191919",
    borderBottom: "1px solid #444"
  });

  const searchInput = document.createElement("input");

  searchInput.type = "text";
  searchInput.placeholder = "🔎 Tìm bài giảng, chương, công thức...";

  Object.assign(searchInput.style, {
    flex: "1",
    minWidth: "0",
    background: "#111",
    color: "#eee",
    border: "1px solid #444",
    borderRadius: "5px",
    outline: "none",
    padding: "7px 9px",
    fontSize: "13px"
  });

  toolbar.appendChild(searchInput);

  // Expand
  const expandBtn = document.createElement("button");

  expandBtn.textContent = "⊞";
  expandBtn.title = "Mở tất cả";

  // Collapse
  const collapseBtn = document.createElement("button");

  collapseBtn.textContent = "⊟";
  collapseBtn.title = "Thu gọn tất cả";

  [expandBtn, collapseBtn].forEach(btn => {

    Object.assign(btn.style, {
      width: "34px",
      background: "#292929",
      color: "#ddd",
      border: "1px solid #444",
      borderRadius: "5px",
      cursor: "pointer"
    });

    btn.onmouseenter = () => {
      btn.style.background = "#444";
    };

    btn.onmouseleave = () => {
      btn.style.background = "#292929";
    };
  });

  toolbar.appendChild(expandBtn);
  toolbar.appendChild(collapseBtn);

  tocDiv.appendChild(toolbar);

  // ==========================================================
  // BODY
  // ==========================================================

  const body = document.createElement("div");

  Object.assign(body.style, {
    flex: "1",
    display: "flex",
    minHeight: "0"
  });

  tocDiv.appendChild(body);

  // ==========================================================
  // LEFT - TREE
  // ==========================================================

  const treePanel = document.createElement("div");

  Object.assign(treePanel.style, {
    width: "300px",
    minWidth: "300px",
    overflowY: "auto",
    background: "#191919",
    borderRight: "1px solid #444",
    padding: "6px"
  });

  body.appendChild(treePanel);

  // ==========================================================
  // RIGHT - CONTENT
  // ==========================================================

  const contentPanel = document.createElement("div");

  Object.assign(contentPanel.style, {
    flex: "1",
    minWidth: "0",
    overflowY: "auto",
    background: "#202020",
    padding: "18px",
    lineHeight: "1.6"
  });

  body.appendChild(contentPanel);

  // ==========================================================
  // STYLE
  // ==========================================================

  const styleId = "guihelper-toc-style";

  if (!document.getElementById(styleId)) {

    const style = document.createElement("style");

    style.id = styleId;

    style.innerHTML = `

      .gui-toc-scroll::-webkit-scrollbar {
        width: 6px;
      }

      .gui-toc-scroll::-webkit-scrollbar-thumb {
        background: #555;
        border-radius: 4px;
      }

      .gui-toc-scroll::-webkit-scrollbar-track {
        background: #191919;
      }

      .gui-toc-item {
        padding: 6px 8px;
        margin: 2px 0;
        border-radius: 5px;
        cursor: pointer;
        transition: background .15s;
        user-select: none;
      }

      .gui-toc-item:hover {
        background: rgba(255,255,255,.10);
      }

      .gui-toc-lesson {
        padding-left: 30px;
        font-size: 12px;
        color: #bbb;
      }

      .gui-toc-lesson.active {
        background: rgba(0,200,255,.18);
        color: #fff;
      }

      .gui-toc-chapter {
        color: #ddd;
        font-weight: bold;
        background: rgba(255,255,255,.04);
      }

      .gui-toc-section {
        color: #fff;
        font-weight: bold;
        font-size: 13px;
      }

      .gui-toc-formula {
        margin: 12px 0;
        padding: 12px;
        background: #111;
        border: 1px solid #444;
        border-radius: 6px;
        color: #00ffcc;
        font-family: Consolas, monospace;
        font-size: 15px;
        overflow-x: auto;
      }

      .gui-toc-content h2 {
        margin-top: 0;
        color: #fff;
        font-size: 21px;
      }

      .gui-toc-content h3 {
        color: #8fdcff;
        font-size: 15px;
        margin-top: 20px;
      }

      .gui-toc-content p {
        color: #ccc;
      }

      .gui-toc-content li {
        margin: 5px 0;
      }

      .gui-toc-action {
        display: inline-block;
        margin: 5px 4px 5px 0;
        padding: 6px 10px;
        border-radius: 5px;
        border: 1px solid #555;
        background: #292929;
        color: #ddd;
        cursor: pointer;
        font-size: 12px;
      }

      .gui-toc-action:hover {
        background: #444;
      }

    `;

    document.head.appendChild(style);
  }

  treePanel.classList.add("gui-toc-scroll");
  contentPanel.classList.add("gui-toc-scroll");

  // ==========================================================
  // RENDER TREE
  // ==========================================================

  const renderTree = (filter = "") => {

    treePanel.innerHTML = "";

    const query = filter.toLowerCase().trim();

    this._tocData.forEach(section => {

      let sectionVisible = false;

      section.chapters.forEach(chapter => {

        const chapterMatches =
          chapter.title.toLowerCase().includes(query);

        const matchingLessons =
          chapter.lessons.filter(lesson => {

            const text =
              (
                lesson.title +
                " " +
                (lesson.content || "") +
                " " +
                (lesson.formulas || []).join(" ")
              ).toLowerCase();

            return !query || text.includes(query);
          });

        if (chapterMatches || matchingLessons.length > 0) {

          sectionVisible = true;

          const sectionDiv = document.createElement("div");

          sectionDiv.className =
            "gui-toc-item gui-toc-section";

          sectionDiv.innerHTML =
            `${section.icon || "📚"} ${section.title}`;

          treePanel.appendChild(sectionDiv);

          const chapterDiv = document.createElement("div");

          chapterDiv.className =
            "gui-toc-item gui-toc-chapter";

          chapterDiv.innerHTML =
            `▾ 📂 ${chapter.title}`;

          treePanel.appendChild(chapterDiv);

          const lessonsDiv = document.createElement("div");

          chapter.lessons.forEach(lesson => {

            const visible =
              !query ||
              matchingLessons.includes(lesson) ||
              chapterMatches;

            if (!visible) return;

            const lessonDiv = document.createElement("div");

            lessonDiv.className =
              "gui-toc-item gui-toc-lesson";

            lessonDiv.innerHTML =
              `📄 ${lesson.title}`;

            if (
              this._tocCurrentLesson &&
              this._tocCurrentLesson.id === lesson.id
            ) {
              lessonDiv.classList.add("active");
            }

            lessonDiv.onclick = (e) => {

              e.stopPropagation();

              this._tocCurrentLesson = lesson;

              renderTree(searchInput.value);

              renderLesson(lesson);
            };

            lessonsDiv.appendChild(lessonDiv);
          });

          treePanel.appendChild(lessonsDiv);

          chapterDiv.onclick = () => {

            const visible =
              lessonsDiv.style.display !== "none";

            lessonsDiv.style.display =
              visible ? "none" : "block";

            chapterDiv.innerHTML =
              visible
                ? `▸ 📂 ${chapter.title}`
                : `▾ 📂 ${chapter.title}`;
          };
        }
      });

      if (!sectionVisible && !query) {
        // Không làm gì
      }
    });
  };

  // ==========================================================
  // RENDER LESSON
  // ==========================================================

  const renderLesson = (lesson) => {

    contentPanel.innerHTML = "";

    const content = document.createElement("div");

    content.className = "gui-toc-content";

    content.innerHTML = lesson.content || `
      <h2>${lesson.title}</h2>
      <p>Chưa có nội dung.</p>
    `;

    contentPanel.appendChild(content);

    // ========================================================
    // FORMULAS
    // ========================================================

    if (lesson.formulas && lesson.formulas.length) {

      const formulaTitle = document.createElement("h3");

      formulaTitle.textContent = "📐 Công thức";

      content.appendChild(formulaTitle);

      lesson.formulas.forEach(formula => {

        const formulaDiv =
          document.createElement("div");

        formulaDiv.className =
          "gui-toc-formula";

        formulaDiv.textContent = formula;

        content.appendChild(formulaDiv);

      });
    }

    // ========================================================
    // ACTIONS
    // ========================================================

    const actions = document.createElement("div");

    actions.style.marginTop = "20px";

    const plotBtn =
      document.createElement("button");

    plotBtn.className =
      "gui-toc-action";

    plotBtn.textContent =
      "📊 Đưa vào Plotter";

    plotBtn.onclick = () => {

      const formula =
        lesson.formulas?.[0];

      if (!formula) {

        alert("Bài này chưa có công thức để đưa vào Plotter.");

        return;
      }

      // Tìm các input / object phổ biến của Math 3D Plotter
      const candidates = [
        "#formula",
        "#equation",
        "#expression",
        "#functionInput",
        "#formulaInput"
      ];

      let input = null;

      for (const selector of candidates) {

        const el =
          document.querySelector(selector);

        if (el) {

          input = el;
          break;
        }
      }

      if (input) {

        input.value = formula;

        input.dispatchEvent(
          new Event("input", { bubbles: true })
        );

        input.dispatchEvent(
          new Event("change", { bubbles: true })
        );

      } else {

        console.log(
          "📚 Công thức từ tài liệu:",
          formula
        );

        alert(
          "Công thức đã được chọn:\n\n" +
          formula +
          "\n\nBạn có thể kết nối nút này với Function Plotter hiện tại."
        );
      }
    };

    actions.appendChild(plotBtn);

    const copyBtn =
      document.createElement("button");

    copyBtn.className =
      "gui-toc-action";

    copyBtn.textContent =
      "📋 Sao chép công thức";

    copyBtn.onclick = () => {

      const text =
        (lesson.formulas || []).join("\n");

      if (!text) return;

      navigator.clipboard
        ?.writeText(text)
        .then(() => {

          copyBtn.textContent =
            "✓ Đã sao chép";

          setTimeout(() => {

            copyBtn.textContent =
              "📋 Sao chép công thức";

          }, 1200);

        });
    };

    actions.appendChild(copyBtn);

    content.appendChild(actions);

    // ========================================================
    // SCROLL TOP
    // ========================================================

    contentPanel.scrollTop = 0;
  };

  // ==========================================================
  // SEARCH
  // ==========================================================

  searchInput.addEventListener("input", () => {

    renderTree(searchInput.value);
  });

  searchInput.addEventListener("keydown", e => {

    e.stopPropagation();

    if (e.key === "Escape") {

      searchInput.value = "";

      renderTree();
    }
  });

  searchInput.addEventListener("click", e => {
    e.stopPropagation();
  });

  // ==========================================================
  // EXPAND ALL
  // ==========================================================

  expandBtn.onclick = () => {

    treePanel
      .querySelectorAll(".gui-toc-chapter")
      .forEach(chapter => {

        const next = chapter.nextElementSibling;

        if (next) {
          next.style.display = "block";
        }

        chapter.innerHTML =
          chapter.innerHTML
            .replace(/^▸/, "▾");
      });
  };

  // ==========================================================
  // COLLAPSE ALL
  // ==========================================================

  collapseBtn.onclick = () => {

    treePanel
      .querySelectorAll(".gui-toc-chapter")
      .forEach(chapter => {

        const next = chapter.nextElementSibling;

        if (next) {
          next.style.display = "none";
        }

        chapter.innerHTML =
          chapter.innerHTML
            .replace(/^▾/, "▸");
      });
  };

  // ==========================================================
  // RENDER INITIAL
  // ==========================================================

  renderTree();

  // ==========================================================
  // EMPTY CONTENT
  // ==========================================================

  contentPanel.innerHTML = `
    <div
      style="
        height:100%;
        display:flex;
        flex-direction:column;
        justify-content:center;
        align-items:center;
        text-align:center;
        color:#777;
      "
    >
      <div style="font-size:50px;margin-bottom:10px">
        📚
      </div>

      <div style="font-size:18px;color:#aaa">
        Thư viện tài liệu
      </div>

      <div style="font-size:13px;margin-top:5px">
        Chọn một bài trong mục lục để xem nội dung
      </div>
    </div>
  `;

  // ==========================================================
  // ADD TO BODY
  // ==========================================================

  document.body.appendChild(tocDiv);

  // ==========================================================
  // DRAG
  // ==========================================================

  this.makeDraggable(tocDiv, header);
}

// ============================================================
// SCIENTIFIC CALCULATOR
// ============================================================
createScientificCalculator() {
  // Nếu calculator đang mở -> đóng
  if (this._calculatorDiv) {
    this._calculatorDiv.remove();
    this._calculatorDiv = null;
    return;
  }

  const calcDiv = document.createElement("div");
  this._calculatorDiv = calcDiv;

  // ==========================================================
  // WINDOW
  // ==========================================================
  calcDiv.style.position = "fixed";
  calcDiv.style.top = "80px";
  calcDiv.style.left = "80px";
  calcDiv.style.width = "360px";
  calcDiv.style.background = "rgba(30,30,30,0.98)";
  calcDiv.style.color = "#eee";
  calcDiv.style.zIndex = "10001";
  calcDiv.style.display = "flex";
  calcDiv.style.flexDirection = "column";
  calcDiv.style.border = "1px solid #555";
  calcDiv.style.borderRadius = "10px";
  calcDiv.style.overflow = "hidden";
  calcDiv.style.boxShadow = "0 8px 30px rgba(0,0,0,0.7)";
  calcDiv.style.fontFamily = "Segoe UI, Arial, sans-serif";
  calcDiv.style.userSelect = "none";

  // ==========================================================
  // HEADER
  // ==========================================================
  const header = document.createElement("div");

  header.style.height = "36px";
  header.style.background = "linear-gradient(90deg,#444,#222)";
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.padding = "0 8px";
  header.style.fontWeight = "bold";
  header.style.cursor = "move";

  const title = document.createElement("span");
  title.textContent = "🧮 Scientific Calculator";

  const headerButtons = document.createElement("div");
  headerButtons.style.display = "flex";
  headerButtons.style.gap = "4px";

  const clearHistoryBtn = document.createElement("button");
  clearHistoryBtn.textContent = "🗑";
  clearHistoryBtn.title = "Xóa lịch sử";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✖";
  closeBtn.title = "Đóng";

  [clearHistoryBtn, closeBtn].forEach(btn => {
    btn.style.background = "transparent";
    btn.style.border = "none";
    btn.style.color = "#aaa";
    btn.style.cursor = "pointer";
    btn.style.fontSize = "14px";
    btn.style.padding = "4px 7px";
    btn.style.borderRadius = "4px";

    btn.onmouseenter = () => {
      btn.style.background = "rgba(255,255,255,.15)";
      btn.style.color = "#fff";
    };

    btn.onmouseleave = () => {
      btn.style.background = "transparent";
      btn.style.color = "#aaa";
    };
  });

  headerButtons.appendChild(clearHistoryBtn);
  headerButtons.appendChild(closeBtn);

  header.appendChild(title);
  header.appendChild(headerButtons);

  calcDiv.appendChild(header);

  // ==========================================================
  // DISPLAY
  // ==========================================================
  const display = document.createElement("input");

  display.type = "text";
  display.placeholder = "Nhập biểu thức...";
  display.autocomplete = "off";
  display.spellcheck = false;

  display.style.width = "100%";
  display.style.boxSizing = "border-box";
  display.style.height = "54px";
  display.style.background = "#111";
  display.style.border = "none";
  display.style.borderBottom = "1px solid #444";
  display.style.outline = "none";
  display.style.color = "#00ffcc";
  display.style.fontFamily = "Consolas, monospace";
  display.style.fontSize = "22px";
  display.style.textAlign = "right";
  display.style.padding = "8px 12px";

  calcDiv.appendChild(display);

  // ==========================================================
  // MODE + MEMORY
  // ==========================================================
  const modeRow = document.createElement("div");

  modeRow.style.display = "flex";
  modeRow.style.alignItems = "center";
  modeRow.style.padding = "5px";
  modeRow.style.gap = "5px";
  modeRow.style.background = "#181818";

  const modeLabel = document.createElement("span");
  modeLabel.textContent = "Mode:";
  modeLabel.style.fontSize = "12px";
  modeLabel.style.color = "#aaa";

  const modeSelect = document.createElement("select");

  [
    ["DEG", "deg"],
    ["RAD", "rad"],
    ["GRAD", "grad"]
  ].forEach(([text, value]) => {
    const option = document.createElement("option");
    option.textContent = text;
    option.value = value;
    modeSelect.appendChild(option);
  });

  modeSelect.style.background = "#222";
  modeSelect.style.color = "#fff";
  modeSelect.style.border = "1px solid #555";
  modeSelect.style.borderRadius = "4px";
  modeSelect.style.padding = "3px";

  const ansLabel = document.createElement("span");

  ansLabel.textContent = "Ans: 0";
  ansLabel.style.marginLeft = "auto";
  ansLabel.style.fontSize = "12px";
  ansLabel.style.color = "#aaa";

  modeRow.appendChild(modeLabel);
  modeRow.appendChild(modeSelect);
  modeRow.appendChild(ansLabel);

  calcDiv.appendChild(modeRow);

  // ==========================================================
  // BUTTON GRID
  // ==========================================================
  const grid = document.createElement("div");

  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(5, 1fr)";
  grid.style.gap = "4px";
  grid.style.padding = "6px";

  const buttons = [
    ["sin", "sin("],
    ["cos", "cos("],
    ["tan", "tan("],
    ["log", "log("],
    ["ln", "ln("],

    ["asin", "asin("],
    ["acos", "acos("],
    ["atan", "atan("],
    ["√", "sqrt("],
    ["x²", "^2"],

    ["xʸ", "^"],
    ["π", "pi"],
    ["e", "e"],
    ["(", "("],
    [")", ")"],

    ["7", "7"],
    ["8", "8"],
    ["9", "9"],
    ["÷", "/"],
    ["C", "CLEAR"],

    ["4", "4"],
    ["5", "5"],
    ["6", "6"],
    ["×", "*"],
    ["⌫", "BACKSPACE"],

    ["1", "1"],
    ["2", "2"],
    ["3", "3"],
    ["−", "-"],
    ["%", "%"],

    ["0", "0"],
    [".", "."],
    ["Ans", "Ans"],
    ["+", "+"],
    ["=", "EQUAL"]
  ];

  const createButton = (label, value) => {
    const btn = document.createElement("button");

    btn.textContent = label;

    btn.style.height = "38px";
    btn.style.border = "1px solid #444";
    btn.style.borderRadius = "5px";
    btn.style.background = "#292929";
    btn.style.color = "#eee";
    btn.style.cursor = "pointer";
    btn.style.fontSize = "14px";
    btn.style.fontWeight = "bold";

    btn.onmouseenter = () => {
      btn.style.background = "#3d3d3d";
    };

    btn.onmouseleave = () => {
      btn.style.background = "#292929";
    };

    btn.onclick = () => {

      if (value === "CLEAR") {
        display.value = "";
        return;
      }

      if (value === "BACKSPACE") {
        display.value = display.value.slice(0, -1);
        return;
      }

      if (value === "EQUAL") {
        calculate();
        return;
      }

      insertText(value);
    };

    return btn;
  };

  buttons.forEach(([label, value]) => {
    grid.appendChild(createButton(label, value));
  });

  calcDiv.appendChild(grid);

  // ==========================================================
  // HISTORY
  // ==========================================================
  const historyTitle = document.createElement("div");

  historyTitle.textContent = "📜 History";
  historyTitle.style.padding = "5px 8px";
  historyTitle.style.fontSize = "12px";
  historyTitle.style.color = "#aaa";
  historyTitle.style.borderTop = "1px solid #444";

  calcDiv.appendChild(historyTitle);

  const history = document.createElement("div");

  history.style.maxHeight = "100px";
  history.style.overflowY = "auto";
  history.style.background = "#151515";
  history.style.padding = "5px";

  calcDiv.appendChild(history);

  // ==========================================================
  // VARIABLES
  // ==========================================================
  let ans = 0;

  // ==========================================================
  // INSERT TEXT
  // ==========================================================
  function insertText(text) {

    const start = display.selectionStart ?? display.value.length;
    const end = display.selectionEnd ?? display.value.length;

    display.value =
      display.value.slice(0, start) +
      text +
      display.value.slice(end);

    const cursor = start + text.length;

    display.focus();

    display.setSelectionRange(cursor, cursor);
  }

  // ==========================================================
  // FACTORIAL
  // ==========================================================
  function factorial(n) {

    n = Number(n);

    if (!Number.isFinite(n)) {
      throw new Error("Factorial không hợp lệ");
    }

    if (n < 0 || !Number.isInteger(n)) {
      throw new Error("Factorial cần số nguyên ≥ 0");
    }

    let result = 1;

    for (let i = 2; i <= n; i++) {
      result *= i;
    }

    return result;
  }

  // ==========================================================
  // DEG / RAD / GRAD
  // ==========================================================
  function convertAngle(x) {

    const mode = modeSelect.value;

    if (mode === "deg") {
      return x * Math.PI / 180;
    }

    if (mode === "grad") {
      return x * Math.PI / 200;
    }

    return x;
  }

  function sin(x) {
    return Math.sin(convertAngle(x));
  }

  function cos(x) {
    return Math.cos(convertAngle(x));
  }

  function tan(x) {
    return Math.tan(convertAngle(x));
  }

  function asin(x) {
    const result = Math.asin(x);

    if (modeSelect.value === "deg") {
      return result * 180 / Math.PI;
    }

    if (modeSelect.value === "grad") {
      return result * 200 / Math.PI;
    }

    return result;
  }

  function acos(x) {
    const result = Math.acos(x);

    if (modeSelect.value === "deg") {
      return result * 180 / Math.PI;
    }

    if (modeSelect.value === "grad") {
      return result * 200 / Math.PI;
    }

    return result;
  }

  function atan(x) {
    const result = Math.atan(x);

    if (modeSelect.value === "deg") {
      return result * 180 / Math.PI;
    }

    if (modeSelect.value === "grad") {
      return result * 200 / Math.PI;
    }

    return result;
  }

  // ==========================================================
  // EXPRESSION ENGINE
  // ==========================================================
  function evaluateExpression(expression) {

    let expr = expression;

    expr = expr
      .replace(/π/g, "Math.PI")
      .replace(/\bpi\b/gi, "Math.PI")
      .replace(/\bAns\b/g, `(${ans})`)
      .replace(/\be\b/g, "Math.E");

    expr = expr.replace(/\^/g, "**");

    expr = expr.replace(/\blog\(/g, "Math.log10(");
    expr = expr.replace(/\bln\(/g, "Math.log(");
    expr = expr.replace(/\bsqrt\(/g, "Math.sqrt(");

    expr = expr.replace(/\bsin\(/g, "sin(");
    expr = expr.replace(/\bcos\(/g, "cos(");
    expr = expr.replace(/\btan\(/g, "tan(");

    expr = expr.replace(/\basin\(/g, "asin(");
    expr = expr.replace(/\bacos\(/g, "acos(");
    expr = expr.replace(/\batan\(/g, "atan(");

    expr = expr.replace(/(\d+(?:\.\d+)?)!/g, "factorial($1)");

    expr = expr.replace(/(\d+(?:\.\d+)?)%/g, "($1/100)");

    // Chỉ cho phép biểu thức toán học
    if (!/^[0-9+\-*/%().,\sA-Za-z_*]+$/.test(expr)) {
      throw new Error("Ký tự không hợp lệ");
    }

    return Function(
      "sin",
      "cos",
      "tan",
      "asin",
      "acos",
      "atan",
      "factorial",
      `"use strict"; return (${expr})`
    )(
      sin,
      cos,
      tan,
      asin,
      acos,
      atan,
      factorial
    );
  }

  // ==========================================================
  // CALCULATE
  // ==========================================================
  function calculate() {

    const expression = display.value.trim();

    if (!expression) return;

    try {

      const result = evaluateExpression(expression);

      if (!Number.isFinite(result)) {
        throw new Error("Kết quả không xác định");
      }

      ans = result;

      display.value = String(
        Number(result.toPrecision(14))
      );

      ansLabel.textContent = "Ans: " + display.value;

      const item = document.createElement("div");

      item.style.padding = "3px 5px";
      item.style.cursor = "pointer";
      item.style.fontFamily = "Consolas, monospace";
      item.style.fontSize = "12px";

      item.innerHTML =
        `<span style="color:#888">${expression}</span>` +
        ` <span style="color:#666">=</span> ` +
        `<span style="color:#00ffcc">${display.value}</span>`;

      item.onclick = () => {
        display.value = expression;
        display.focus();
      };

      item.onmouseenter = () => {
        item.style.background = "rgba(255,255,255,.08)";
      };

      item.onmouseleave = () => {
        item.style.background = "transparent";
      };

      history.prepend(item);

    } catch (error) {

      display.value = "Error";

      setTimeout(() => {

        if (display.value === "Error") {
          display.value = expression;
        }

      }, 800);
    }
  }

  // ==========================================================
  // KEYBOARD
  // ==========================================================
  display.addEventListener("keydown", (e) => {

    e.stopPropagation();

    if (e.key === "Enter") {
      e.preventDefault();
      calculate();
    }

    if (e.key === "Escape") {
      e.preventDefault();
      display.value = "";
    }
  });

  display.addEventListener("click", e => {
    e.stopPropagation();
  });

  // ==========================================================
  // CLEAR HISTORY
  // ==========================================================
  clearHistoryBtn.onclick = (e) => {

    e.stopPropagation();

    history.innerHTML = "";
  };

  // ==========================================================
  // CLOSE
  // ==========================================================
  closeBtn.onclick = (e) => {

    e.stopPropagation();

    calcDiv.remove();
    this._calculatorDiv = null;
  };

  // ==========================================================
  // DRAG
  // ==========================================================
  this.makeDraggable(calcDiv, header);

  document.body.appendChild(calcDiv);

  display.focus();
}
  // 🆕 Gắn sự kiện chuột phải
  attachMiniMenu(renderer) {
    renderer.domElement.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation(); // 🆕 ngăn "bong ra" click
      this.setMiniMenuItems([
        {
          label: "📝 Ghi chú",
          onClick: () => this.createNote(),
        },
        {
          label: "🧮 Scientific Calculator",
          onClick: () => this.createScientificCalculator(),
        },
        {
          label: "🔍 Tìm kiếm",
          onClick: () => this.createSearchBox(),
        },
        {
          label: "📚 Mục lục tài liệu",
          onClick: () => this.createTableOfContents(),
        },
        {
          label: "💻 Code Lab",
          onClick: () => this.createCodeRunner(),
        },
        {
          label: "Xoá",
          onClick: () => console.log("Xoá"),
        },
      ]);

      this.showMiniMenu(event.clientX, event.clientY);
    });

    // click ra ngoài mới ẩn menu
    window.addEventListener("click", (e) => {
      if (!this.miniMenu.contains(e.target)) {
        this.miniMenu.style.display = "none";
      }
    });
  }

  // ===== Nút thu gọn =====
  _initCollapseButton() {
    const collapseBtn = document.createElement("button");
    collapseBtn.innerHTML = "»";
    collapseBtn.title = "Thu gọn / Mở rộng panel";
    collapseBtn.className = "gui-tab button";
    this.tabsEl.insertBefore(collapseBtn, this.tabsEl.firstChild);

    this._collapsed = true; // 👈 lưu trạng thái
    this._collapseBtn = collapseBtn; // 👈 lưu tham chiếu

    // ẩn content + các tab con ngay khi khởi tạo
    this.contentEl.style.display = "none";
    Array.from(this.tabsEl.children).forEach((el) => {
      if (el !== collapseBtn) el.style.display = "none";
    });

    collapseBtn.onclick = () => {
      this._collapsed = !this._collapsed; // 👈 update trạng thái
      if (this._collapsed) {
        this.contentEl.style.display = "none";
        Array.from(this.tabsEl.children).forEach((el) => {
          if (el !== collapseBtn) el.style.display = "none";
        });
        collapseBtn.innerHTML = "»";
      } else {
        this.contentEl.style.display = "";
        Array.from(this.tabsEl.children).forEach((el) => {
          if (el !== collapseBtn) el.style.display = "";
        });
        collapseBtn.innerHTML = "«";
      }
    };
  }

  _initShortcuts() {
    window.addEventListener("keydown", (e) => {
      // toggle panel
      if (e.key.toLowerCase() === "h") {
        this.toggle();
      }
      // 🆕 mở Quick Command Palette: Ctrl+Shift+P
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        this.createCommandPalette();
      }
    });
  }
  _injectLayout() {
    // container chính
    this.containerEl = document.createElement("div");
    this.containerEl.className = "gui-container";
    this.containerEl.style.position = "fixed";
    this.containerEl.style.top = "20%";
    this.containerEl.style.right = "20px";
    this.containerEl.style.display = "flex";
    this.containerEl.style.border = "1px solid #555";
    this.containerEl.style.background = "#222";
    this.containerEl.style.color = "white";
    this.containerEl.style.zIndex = "9999";
    this.containerEl.style.maxHeight = "90vh";

    // content
    this.contentEl = document.createElement("div");
    this.contentEl.className = "gui-content";
    this.contentEl.style.display = "flex";
    this.contentEl.style.flexDirection = "column";
    this.contentEl.style.borderLeft = "1px solid #444";
    this.contentEl.style.maxHeight = "60vh";
    this.contentEl.style.overflowY = "auto";

    // tabs
    this.tabsEl = document.createElement("div");
    this.tabsEl.className = "gui-tabs";
    this.tabsEl.style.display = "flex";
    this.tabsEl.style.flexDirection = "column";
    this.tabsEl.style.borderLeft = "1px solid #444";
    this.tabsEl.style.maxHeight = "60vh";
    this.tabsEl.style.overflowY = "auto";

    // gắn vào container
    this.containerEl.appendChild(this.contentEl);
    this.containerEl.appendChild(this.tabsEl);

    // chèn vào body
    document.body.appendChild(this.containerEl);
  }

  _injectStyles() {
    if (document.getElementById("guihelper-style")) return;
  
    const styleEl = document.createElement("style");
    styleEl.id = "guihelper-style";
  
    styleEl.innerHTML = `
  
      /* =========================================================
         GUIHELPER
         ========================================================= */
  
      .gui-container {
        z-index: 10000 !important;
      }
  
      .gui-content {
        z-index: 10001 !important;
      }
  
      .gui-tabs {
        z-index: 10002 !important;
      }
  
  
      /* =========================================================
         DAT.GUI
         ========================================================= */
  
      .dg {
        z-index: 10000 !important;
      }
  
      .dg.ac {
        z-index: 10000 !important;
      }
  
  
      /* =========================================================
         ACCOUNT UI
         
         Account Menu / Login / Register luôn nằm trên
         GUIHelper + dat.GUI.
         ========================================================= */
  
      #accountMenu,
      .account-menu,
      .account-dropdown,
      .account-panel,
      .account-overlay,
      #loginModal,
      #registerModal,
      .auth-modal,
      .auth-overlay {
  
        position: relative;
  
        z-index: 900000 !important;
  
      }
  
  
      /*
       * Modal toàn màn hình
       */
  
      #loginModal,
      #registerModal,
      .auth-modal,
      .auth-overlay {
  
        position: fixed !important;
  
        inset: 0;
  
      }
  
  
      /*
       * Account dropdown
       */
  
      #accountMenu,
      .account-menu,
      .account-dropdown {
  
        position: fixed !important;
  
        z-index: 900001 !important;
  
      }
  
  
      /* =========================================================
         SCROLLBAR CHUNG
         ========================================================= */
  
      .gui-container::-webkit-scrollbar,
      .gui-content::-webkit-scrollbar,
      .gui-tabs::-webkit-scrollbar {
  
        width: 6px;
  
      }
  
  
      .gui-container::-webkit-scrollbar-thumb,
      .gui-content::-webkit-scrollbar-thumb,
      .gui-tabs::-webkit-scrollbar-thumb {
  
        background: #555;
  
        border-radius: 3px;
  
      }
  
  
      .gui-container::-webkit-scrollbar-thumb:hover,
      .gui-content::-webkit-scrollbar-thumb:hover,
      .gui-tabs::-webkit-scrollbar-thumb:hover {
  
        background: #777;
  
      }
  
  
      .gui-container::-webkit-scrollbar-track,
      .gui-content::-webkit-scrollbar-track,
      .gui-tabs::-webkit-scrollbar-track {
  
        background: #222;
  
      }
  
  
      /* =========================================================
         GUI TABS
         ========================================================= */
  
      .gui-tabs button {
  
        background: #444;
  
        color: #eee;
  
        border: none;
  
        cursor: pointer;
  
        padding: 6px 10px;
  
        font-size: 14px;
  
        margin: 2px;
  
        border-radius: 4px;
  
        min-width: 32px;
  
        min-height: 28px;
  
      }
  
  
      .gui-tabs button.active {
  
        background: #666;
  
        font-weight: bold;
  
      }
  
  
      /* =========================================================
         DAT.GUI SELECT
         ========================================================= */
  
      .dg .c select {
  
        background-color: #222;
  
        color: #ffffff;
  
        border: 1px solid #666;
  
        border-radius: 6px;
  
        padding: 1px;
  
      }
  
  
      .dg .c select:hover {
  
        background-color: #333;
  
        color: #fff;
  
      }
  
  
      /* =========================================================
         DAT.GUI COLOR
         ========================================================= */
  
      .dg .cr.color .c {
  
        width: 60px !important;
  
      }
  
  
      .dg .cr.color input {
  
        width: 55px !important;
  
        height: 20px !important;
  
        padding: 0 2px;
  
        font-size: 11px;
  
      }
  
  
      /* =========================================================
         ACCOUNT UI — FORCE TOP LAYER
         ========================================================= */
  
      #accountMenu *,
      .account-menu *,
      .account-dropdown *,
      .account-panel *,
      #loginModal *,
      #registerModal *,
      .auth-modal *,
      .auth-overlay * {
  
        position: relative;
  
      }
  
  
      #accountMenu,
      #accountMenu *,
      .account-menu,
      .account-menu *,
      .account-dropdown,
      .account-dropdown *,
      .account-panel,
      .account-panel *,
      #loginModal,
      #loginModal *,
      #registerModal,
      #registerModal *,
      .auth-modal,
      .auth-modal *,
      .auth-overlay,
      .auth-overlay * {
  
        z-index: 900000 !important;
  
      }
      /* =========================================================
      ACCOUNT GLOBAL LAYER
      Luôn nằm trên GUI / dat.GUI / Three.js
      ========================================================= */
   
   #accountLayer {
       position: fixed !important;
       inset: 0 !important;
   
       width: 100vw !important;
       height: 100vh !important;
   
       z-index: 900000 !important;
   
       pointer-events: none;
   
       isolation: isolate;
   }
   
   
   /* Các thành phần account được phép nhận chuột */
   
   #accountLayer > * {
       pointer-events: auto;
   }
   
   
   /* =========================================================
      ACCOUNT MENU
      ========================================================= */
   
   #accountLayer #accountMenu,
   #accountLayer .account-menu,
   #accountLayer .account-dropdown,
   #accountLayer .account-panel {
   
       position: fixed !important;
   
       z-index: 900010 !important;
   
       pointer-events: auto !important;
   }
   
   
   /* =========================================================
      ACCOUNT MODAL
      ========================================================= */
   
   #accountLayer .account-modal {
   
       position: fixed !important;
   
       inset: 0 !important;
   
       width: 100vw !important;
       height: 100vh !important;
   
       display: none;
   
       align-items: center;
       justify-content: center;
   
       z-index: 900100 !important;
   
       pointer-events: auto !important;
   
       isolation: isolate;
   }
   
   
   /* Khi JS mở modal */
   
   #accountLayer .account-modal.active,
   #accountLayer .account-modal.show,
   #accountLayer .account-modal.open {
   
       display: flex !important;
   }
   
   
   /* =========================================================
      MODAL CARD
      ========================================================= */
   
   #accountLayer .account-modal-card {
   
       position: relative !important;
   
       z-index: 900110 !important;
   
       pointer-events: auto !important;
   
       max-width: min(520px, calc(100vw - 32px));
       max-height: calc(100vh - 32px);
   
       overflow-y: auto;
   }
   
   
   /* =========================================================
      MODAL ELEMENTS
      ========================================================= */
   
   #accountLayer .account-modal button,
   #accountLayer .account-modal input,
   #accountLayer .account-modal select,
   #accountLayer .account-modal textarea,
   #accountLayer .account-modal form {
   
       pointer-events: auto !important;
   }
   
   
   /* =========================================================
      PROFILE
      ========================================================= */
   
   #accountLayer #profileModal {
       z-index: 900100 !important;
   }
   
   #accountLayer #profileModal .account-modal-card {
       z-index: 900110 !important;
   }
   
   
   /* =========================================================
      PASSWORD
      ========================================================= */
   
   #accountLayer #passwordModal {
       z-index: 900100 !important;
   }
   
   #accountLayer #passwordModal .account-modal-card {
       z-index: 900110 !important;
   }
   
   
   /* =========================================================
      LOGIN / REGISTER
      ========================================================= */
   
   #accountLayer #loginModal,
   #accountLayer #registerModal {
   
       z-index: 900100 !important;
   }
   
   #accountLayer #loginModal .account-modal-card,
   #accountLayer #registerModal .account-modal-card {
   
       z-index: 900110 !important;
   }
   
   
   /* =========================================================
      AUTH OVERLAY
      ========================================================= */
   
   #accountLayer .auth-overlay,
   #accountLayer .account-overlay {
   
       position: fixed !important;
   
       inset: 0 !important;
   
       z-index: 900090 !important;
   
       pointer-events: auto !important;
   }
    `;
  
    document.head.appendChild(styleEl);
  }
}
