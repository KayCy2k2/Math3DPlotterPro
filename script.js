const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0.06, 24.71, 0.13);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Label renderer
const labelRenderer = new THREE.CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = "absolute";
labelRenderer.domElement.style.top = "0";
labelRenderer.domElement.style.pointerEvents = "none";
document.body.appendChild(labelRenderer.domElement);

// Controls
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

let gridHelper = new THREE.GridHelper(100, 20);
scene.add(gridHelper);

// Light
scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const light = new THREE.PointLight(0xffffff, 1);
light.position.set(50, 50, 100);
scene.add(light);

// Hàm tạo trục
let axisGroup = new THREE.Group(); // Nhóm chứa các trục
scene.add(axisGroup);

// ----- Hiển thị -----
let autoRotate = false;
const displayParams = {
  // Toggle
  autoRotate: false,
  showFormula: true,
  showInNote: true,
  layoutMode: false,   // 👈 cần khai báo trong object
coord: false,
  // Trục
  axisLength: 50,
  step: 5,
  min: -50,
  max: 50,
  axisColor: "#ffffff",

  // Hiển thị
  showAxisLabels: true,
  showAxisTicks: true,
  showAxisX: true,
  showAxisY: true,
  showAxisZ: true,
  // Nhãn trục
  labelX: "X",
  labelY: "Y",
  labelZ: "Z",
  viewAngle: "isometric", // góc nhìn mặc định
  gridPlane: "XZ", // mặt phẳng mặc định
  octant: "all",
  // Nút hành động
  toggleGrid: () => {
    toggle(gridHelper);
  },
  updateAxes: () => {
    updateAxisAllGUI(); // cập nhật trục & ticks
    updateGrid(); // cập nhật luôn lưới
  },
};
function createFullAxis(axis = "x", length = 50, color = 0xffffff) {
  const dirMap = {
    x: new THREE.Vector3(1, 0, 0),
    y: new THREE.Vector3(0, 1, 0),
    z: new THREE.Vector3(0, 0, 1),
  };
  const dir = dirMap[axis];
  if (!dir) return;

  const oct = displayParams.octant;

  // Vẽ từng đoạn nhỏ để kiểm tra octant
  const step = 1; // độ phân mảnh
  for (let i = -length; i < length; i += step) {
    const a = dir.clone().multiplyScalar(i);
    const b = dir.clone().multiplyScalar(i + step);

    if (inOctant(a, oct) && inOctant(b, oct)) {
      const geom = new THREE.BufferGeometry().setFromPoints([a, b]);
      const mat = new THREE.LineBasicMaterial({ color });
      const line = new THREE.Line(geom, mat);
      axisGroup.add(line);
    }
  }

  // Vẽ mũi tên dương
  const posP = dir.clone().multiplyScalar(length);
  if (inOctant(posP, oct)) {
    const arrow1 = new THREE.ArrowHelper(
      dir.clone().normalize(),
      posP,
      3,
      color,
      1,
      0.5
    );
    axisGroup.add(arrow1);
  }

  // Vẽ mũi tên âm
  const posN = dir.clone().multiplyScalar(-length);
  if (inOctant(posN, oct)) {
    const arrow2 = new THREE.ArrowHelper(
      dir.clone().negate().normalize(),
      posN,
      3,
      color,
      1,
      0.5
    );
    axisGroup.add(arrow2);
  }
}

// Gọi các trục như trước
createFullAxis("x", 50, 0xff0000);
createFullAxis("y", 50, 0x00ff00);
createFullAxis("z", 50, 0x00ffff);

// Labels
// Labels với offset
let shapeLabels = [];

// Xoá nhãn theo tag (vd: "graph2D")
function clearLabels(tag = null) {
  shapeLabels = shapeLabels.filter((label) => {
    if (!tag || label.userData.tag === tag) {
      if (label.parent) label.parent.remove(label);
      return false; // bỏ khỏi mảng
    }
    return true; // giữ lại nếu khác tag
  });
}

function createLabel(
  text,
  pos,
  color = "#000000",
  offset = new THREE.Vector3(0.1, 0.1, 0.2),
  tag = "default" // 👈 thêm tham số tag
) {
  const div = document.createElement("div");
  div.textContent = text;
  div.style.color = color;
  div.style.fontWeight = "bold";
  div.style.fontSize = "20px";
  div.style.userSelect = "none";

  const label = new THREE.CSS2DObject(div);
  label.position.copy(pos.clone().add(offset));
  label.userData.tag = tag; // 👈 gắn tag vào nhãn
  axisGroup.add(label);

  shapeLabels.push(label);
  return label;
}
// ===== Hiển thị nhãn tạm thời trong không gian =====
function showTempLabel(text, position, color = "#ffff00", duration = 3000) {
  const label = createLabel(text, position, color);

  // Sau "duration" ms thì xóa nhãn
  setTimeout(() => {
    if (label && label.parent) {
      label.parent.remove(label); // 👈 remove từ đúng group cha
    }
    // đồng thời loại khỏi shapeLabels
    shapeLabels = shapeLabels.filter((l) => l !== label);
  }, duration);

  return label;
}

const oLabel = createLabel(".", new THREE.Vector3(0, 0, 0), "white");
const xLabel = createLabel("X", new THREE.Vector3(55, 0, 0), "red");
const yLabel = createLabel("Y", new THREE.Vector3(0, 55, 0), "lime");
const zLabel = createLabel("Z", new THREE.Vector3(0, 0, 55), "cyan");

let axisTicksGroup = new THREE.Group(); // Nhóm để dễ ẩn/hiện tất cả tick

// Dùng nhóm để chứa tất cả ticks
function addAxisTicks(
  axis = "x",
  step = 5,
  min = -50,
  max = 50,
  color = "white"
) {
  const dirVectors = {
    x: {
      from: (i) => [
        new THREE.Vector3(i, -0.5, 0),
        new THREE.Vector3(i, 0.5, 0),
      ],
      pos: (i) => new THREE.Vector3(i, 0, 0),
    },
    y: {
      from: (i) => [
        new THREE.Vector3(-0.5, i, 0),
        new THREE.Vector3(0.5, i, 0),
      ],
      pos: (i) => new THREE.Vector3(0, i, 0),
    },
    z: {
      from: (i) => [
        new THREE.Vector3(0, -0.5, i),
        new THREE.Vector3(0, 0.5, i),
      ],
      pos: (i) => new THREE.Vector3(0, 0, i),
    },
  };

  const data = dirVectors[axis];
  if (!data) return;

  const material = new THREE.LineBasicMaterial({ color });

  for (let i = min; i <= max; i += step) {
    // ✅ kiểm tra xem tick này có nằm trong octant được chọn không
    if (!inOctant(data.pos(i), displayParams.octant)) continue;
    if (i === 0) continue;

    const points = data.from(i);
    const tick = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      material
    );
    axisTicksGroup.add(tick);

    const label = createLabel(`${i}`, data.pos(i), color);
    axisTicksGroup.add(label);
  }
}
function updateAxisAllGUI() {
  const {
    axisLength,
    axisColor,
    showAxisLabels,
    showAxisTicks,
    step,
    min,
    max,
    labelX,
    labelY,
    labelZ,
    octant,
    showAxisX,
    showAxisY,
    showAxisZ,
  } = displayParams;

  axisGroup.clear();
  axisTicksGroup.clear();

  const labelMap = { x: labelX, y: labelY, z: labelZ };
  const labelColor = { x: "red", y: "lime", z: "cyan" };
  const showAxis = { x: showAxisX, y: showAxisY, z: showAxisZ };

  ["x", "y", "z"].forEach((axis) => {
    if (!showAxis[axis]) return; // 👈 bỏ qua nếu trục bị tắt

    createFullAxis(axis, axisLength, new THREE.Color(axisColor));

    if (showAxisLabels) {
      const len = axisLength + 5;
      let pos;
      if (octant === "all") {
        if (axis === "x") pos = new THREE.Vector3(len, 0, 0);
        if (axis === "y") pos = new THREE.Vector3(0, len, 0);
        if (axis === "z") pos = new THREE.Vector3(0, 0, len);
      } else {
        const [sx, sy, sz] = octant.split("").map((s) => (s === "+" ? 1 : -1));
        if (axis === "x") pos = new THREE.Vector3(sx * len, 0, 0);
        if (axis === "y") pos = new THREE.Vector3(0, sy * len, 0);
        if (axis === "z") pos = new THREE.Vector3(0, 0, sz * len);
      }
      createLabel(labelMap[axis], pos, labelColor[axis]);
    }

    if (showAxisTicks) {
      addAxisTicks(axis, step, min, max, axisColor);
    }
  });

  if (showAxisLabels) {
    createLabel(".", new THREE.Vector3(0, 0, 0), "white");
  }
}

// Thêm ticks 1 lần
addAxisTicks("x", 5, -50, 50, "white");
addAxisTicks("y", 5, -50, 50, "white");
addAxisTicks("z", 5, -50, 50, "white");
scene.add(axisTicksGroup);

function createFormulaLabel(text, position = new THREE.Vector3(0, 0, 0)) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = 512;
  canvas.height = 128;

  ctx.fillStyle = "white";
  ctx.font = "bold 32px monospace";
  ctx.fillText(text, 20, 80);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
  });
  const sprite = new THREE.Sprite(material);

  sprite.scale.set(10, 2.5, 1); // tùy chỉnh kích thước
  sprite.position.copy(position.clone().add(new THREE.Vector3(0, 5, 0))); // đặt phía trên đồ thị

  return sprite;
}
let worldGroup = new THREE.Group();
scene.add(worldGroup);

// Đưa các phần hiển thị vào worldGroup
worldGroup.add(axisGroup);
worldGroup.add(axisTicksGroup);
worldGroup.add(gridHelper);

// Tạo tab GUI
const guiHelper = new GuiHelperTabs();
guiHelper.createSearchBox(); // 👈 thêm ô tìm kiếm
guiHelper.attachMiniMenu(renderer); // renderer là renderer của Three.js

const guiDisplay = guiHelper.addTab("Hiển thị", 350, {
  icon: "🖥️",
  label: "Hiển thị",
});

guiDisplay
  .add(displayParams, "viewAngle", {
    "🔼 Top": "top",
    "➡️ Right": "right",
    "⬅️ Front": "front",
    "🟪 Isometric": "isometric",
    "⏺ Custom": "custom",
  })
  .name("👁️ Góc nhìn");
guiDisplay
  .add(displayParams, "gridPlane", {
    XY: "XY",
    XZ: "XZ",
    YZ: "YZ",
  })
  .name("📊 Mặt phẳng lưới")
  .onChange(updateGrid);

guiDisplay
  .add(displayParams, "octant", {
    "Toàn bộ": "all",
    "+++ (X>0,Y>0,Z>0)": "+++",
    "++- (X>0,Y>0,Z<0)": "++-",
    "+-+ (X>0,Y<0,Z>0)": "+-+",
    "+-- (X>0,Y<0,Z<0)": "+--",
    "-++ (X<0,Y>0,Z>0)": "-++",
    "-+- (X<0,Y>0,Z<0)": "-+-",
    "--+ (X<0,Y<0,Z>0)": "--+",
    "--- (X<0,Y<0,Z<0)": "---",
  })
  .name("🧭 Octant")
  .onChange(() => {
    updateAxisAllGUI();
    updateGrid();

    // 👁️ Đặt lại camera nhìn thấy 3 trục
    camera.position.set(60, 60, 60);
    controls.target.set(0, 0, 0);
    controls.update();
  });

function inOctant(v, octant) {
  if (octant === "all") return true;
  const [sx, sy, sz] = octant.split("").map((s) => (s === "+" ? 1 : -1));
  return (
    (Math.sign(v.x) === sx || v.x === 0) &&
    (Math.sign(v.y) === sy || v.y === 0) &&
    (Math.sign(v.z) === sz || v.z === 0)
  );
}

// Hàm tiện ích tạo folder cấu hình trục + ticks
function addAxisAndTicksFolder(gui, params) {
  const folder = guiHelper.addFolderWithTooltip(
    gui,
    "⚙️ Cấu hình trục & ticks",
    "",
    "Thiết lập độ dài, màu sắc, nhãn trục và bước nhảy cho ticks"
  );

  // --- Cấu hình trục ---
  folder.add(params, "axisLength", 10, 200, 1).name("Độ dài trục");
  folder.domElement.classList.add("axis-folder");
  folder
    .addColor(params, "axisColor")
    .name("Màu trục")
    .onChange(updateAxisAllGUI);
  // 👇 Sub-folder cho Nhãn trục
  const labelFolder = folder.addFolder("Nhãn trục");
  guiHelper.addWithIcon(labelFolder, params, "labelX", "X", {
    label: "Nhãn trục X (đỏ)",
    showLabel: false,
    columns: 3,
  });
  guiHelper.addWithIcon(labelFolder, params, "labelY", "Y", {
    label: "Nhãn trục Y (xanh lá)",
    showLabel: false,
    columns: 3,
  });
  guiHelper.addWithIcon(labelFolder, params, "labelZ", "Z", {
    label: "Nhãn trục Z (xanh dương)",
    showLabel: false,
    columns: 3,
  });

  // --- Cấu hình ticks ---
  folder.add(params, "step", 1, 20, 1).name("Bước").onChange(updateAxisAllGUI);
  folder.add(params, "min", -100, 0, 1).name("Min").onChange(updateAxisAllGUI);
  folder.add(params, "max", 0, 100, 1).name("Max").onChange(updateAxisAllGUI);
  // 👇 Trong folder Cấu hình trục & ticks

  return folder;
}

const fAxisTicks = addAxisAndTicksFolder(guiDisplay, displayParams);

function addActionsFolder(gui, params) {
  // --- Nút hành động ---
  const folder = guiHelper.addFolderWithTooltip(
    gui,
    "⚡ Hành động",
    "",
    "Các nút thực hiện thao tác nhanh như bật/tắt lưới hoặc cập nhật trục"
  );

  // 🔄 Auto-Rotate
  guiHelper.addWithIcon(folder, params, "autoRotate", "", {
    label: "Auto-Rotate",
    columns: 3,
    onChange: (v) => {
      autoRotate = v;
    },
    showLabel: true,
  });

  // 📖 Hiển thị công thức
  guiHelper.addWithIcon(folder, params, "showFormula", "", {
    label: "Formula",
    columns: 3,
    onChange: (v) => {
      formulaVisible = v;
      if (formulaLabel) formulaLabel.visible = v;
    },
    showLabel: true,
  });

  guiHelper.addWithIcon(folder, params, "toggleGrid", "", {
    label: "Grid",
    columns: 3,
    showLabel: true,
  });
  guiHelper
    .addWithIcon(folder, params, "showAxisX", "", {
      label: "Axis X",
      columns: 3,
      showLabel: true,
    })
    .onChange(updateAxisAllGUI);
  guiHelper
    .addWithIcon(folder, params, "showAxisY", "", {
      label: "Axis Y",
      columns: 3,
      showLabel: true,
    })
    .onChange(updateAxisAllGUI);
  guiHelper
    .addWithIcon(folder, params, "showAxisZ", "", {
      label: "Axis Z",
      columns: 3,
      showLabel: true,
    })
    .onChange(updateAxisAllGUI);
  guiHelper
    .addWithIcon(folder, params, "showAxisLabels", "", {
      label: "Axis Labels",
      columns: 3,
      showLabel: true,
    })
    .onChange(updateAxisAllGUI);
  guiHelper
    .addWithIcon(folder, params, "showAxisTicks", "", {
      label: "Axis Ticks",
      columns: 3,
      showLabel: true,
    })
    .onChange(updateAxisAllGUI);
  guiHelper.addWithIcon(folder, params, "updateAxes", "", {
    label: "Update Axes",
    columns: 3,
    showLabel: true,
  });
  guiHelper.addWithIcon(
    folder,
    { note: () => guiHelper.createNote() },
    "note",
    "",
    { label: "Create Note", columns: 3, showLabel: true }
  );
  guiHelper.addWithIcon(
    folder,
    { Calculator: () => guiHelper.createScientificCalculator() },
    "Calculator",
    "",
    { label: "Create Note", columns: 3, showLabel: true }
  );
  // ==== GUI button ====
guiHelper.addWithIcon(folder, params, "coord", "", {
  label: "coord",
  columns: 3,
  showLabel: true,
});
  
  guiHelper.addWithIcon(
    folder,
    { search: () => guiHelper.createSearchBox() },
    "search",
    "",
    { label: "Search Gui", columns: 3, showLabel: true }
  );
  guiHelper.addWithIcon(
    folder,
    { cmd: () => guiHelper.createCommandPalette() },
    "cmd",
    "",
    { label: "Command", columns: 3, showLabel: true }
  );
  guiHelper.addWithIcon(folder, params, "layoutMode", "", {
    label: "Layout Mode",
    columns: 2,
    onChange: (v) => guiHelper.toggleLayoutMode(), // toggle khi check/uncheck
    showLabel: true,
  });
  guiHelper.addWithIcon(folder, params, "showInNote", "", {
    label: "Show in Note",
    columns: 2,
    showLabel: true,
  });
}
const fActions = addActionsFolder(guiDisplay, displayParams);

function updateGrid() {
  // Xóa lưới cũ
  if (gridHelper) {
    worldGroup.remove(gridHelper);
    gridHelper.geometry.dispose();
    gridHelper.material.dispose();
  }

  const { min, max, step, gridPlane, axisColor, octant } = displayParams;
  const vertices = [];

  let dir1, dir2;
  switch (gridPlane) {
    case "XY":
      dir1 = "x";
      dir2 = "y";
      break;
    case "YZ":
      dir1 = "y";
      dir2 = "z";
      break;
    case "XZ":
    default:
      dir1 = "x";
      dir2 = "z";
      break;
  }

  const segment = 1; // chia nhỏ để kiểm tra

  for (let i = min; i <= max; i += step) {
    // line song song trục dir1
    for (let j = min; j < max; j += segment) {
      const a1 = new THREE.Vector3();
      const b1 = new THREE.Vector3();
      a1[dir1] = j;
      a1[dir2] = i;
      b1[dir1] = j + segment;
      b1[dir2] = i;

      if (inOctant(a1, octant) && inOctant(b1, octant)) {
        vertices.push(...a1.toArray(), ...b1.toArray());
      }
    }

    // line song song trục dir2
    for (let j = min; j < max; j += segment) {
      const a2 = new THREE.Vector3();
      const b2 = new THREE.Vector3();
      a2[dir1] = i;
      a2[dir2] = j;
      b2[dir1] = i;
      b2[dir2] = j + segment;

      if (inOctant(a2, octant) && inOctant(b2, octant)) {
        vertices.push(...a2.toArray(), ...b2.toArray());
      }
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  const mat = new THREE.LineBasicMaterial({
    color: axisColor,
    opacity: 0.3,
    transparent: true,
  });
  gridHelper = new THREE.LineSegments(geom, mat);

  worldGroup.add(gridHelper);
}

// ----- Nút Trợ giúp -----
displayParams.help = () => {
  alert(
    `📖 Hướng dẫn sử dụng tab Hiển thị:

🔄 Auto-Rotate: Bật/tắt tự động xoay toàn cảnh.
📖 Hiển thị công thức: Bật/tắt nhãn công thức trong không gian.

📐 Cấu hình trục:
- Độ dài trục: Điều chỉnh chiều dài các trục X, Y, Z.
- Màu trục: Chọn màu hiển thị cho trục.
- Nhãn X/Y/Z: Đổi ký hiệu nhãn cho từng trục.

📏 Cấu hình ticks:
- Bước: Khoảng cách giữa các ticks (vạch chia).
- Min/Max: Giới hạn hiển thị trên trục.
- Hiển thị nhãn: Bật/tắt chữ số trên ticks.
- Hiển thị ticks: Bật/tắt vạch chia trên trục.

🟩 Bật/Tắt Lưới: Ẩn/hiện lưới nền.
🔄 Cập nhật Trục & Ticks: Tải lại toàn bộ trục và lưới theo cấu hình mới.
`
  );
};

// Thêm vào GUI
guiDisplay.add(displayParams, "help").name("❓ Trợ giúp");

const sampleParams = {
  primitiveShape: "none",
  motionEffect: "",
  customMotionCode: "",
  shapeType: "box",
  shapeSize: 1,
  shapeHeight: 1,
  shapeColor: "#44ccff",
};

const guiSample = guiHelper.addTab("Khối Mẫu", 340, {
  icon: "🧊",
  label: "Khối Mẫu",
});

guiSample
  .add(sampleParams, "primitiveShape", {
    "Chọn khối 2D/3D": "none",
    "Hình Lập Phương": "cube",
    "Hình Cầu": "sphere",
    "Hình Trụ": "cylinder",
    "Hình Nón": "cone",
    "Hình Tròn 2D": "circle",
    Ellipse: "ellipse",
    "Tam Giác 2D": "triangle",
    "Ngũ Giác 2D": "pentagon",
    "Lục Giác 2D": "hexagon",
    "Hình Chóp": "pyramid",
    "Mặt Phẳng": "plane",
  })
  .name("🎨 Chọn Khối 2D/3D");

guiSample
  .add(sampleParams, "motionEffect", {
    "-- Không chuyển động --": "",
    "Quay quanh trục Y": "rotateY",
    "Quay quanh trục X": "rotateX",
    "Nảy lên xuống": "bounce",
    "Gợn sóng": "wave",
    "Xoay liên tục": "spin",
    "Lắc ngang": "shake",
    "Trượt tròn": "circle",
    "Gợn sóng trục Z": "waveZ",
    "Trôi nổi": "float",
    Xoay: "rotate",
    "Phồng lên": "pulse",
    "Quay quanh tâm": "orbit",
    "Chớp màu": "flashColor",
  })
  .name("🌀 Hiệu Ứng Chuyển Động");

guiSample.add(sampleParams, "customMotionCode").name("Custom Motion (JS)");

const fShape = guiSample.addFolder("🧱 Tùy Biến Khối 3D");
fShape
  .add(sampleParams, "shapeType", {
    Box: "box",
    Sphere: "sphere",
    Cylinder: "cylinder",
  })
  .name("Loại Khối");
fShape
  .add(sampleParams, "shapeSize", 0.1, 10, 0.1)
  .name("Kích thước / Bán kính");
fShape.add(sampleParams, "shapeHeight", 0.1, 10, 0.1).name("Chiều Cao");
fShape.addColor(sampleParams, "shapeColor").name("Màu sắc");
fShape
  .add({ createShape: () => createShape(sampleParams) }, "createShape")
  .name("➕ Tạo Khối");

// Danh sách preset (hiển thị trong GUI)
const presetShapes = {
  "⚪ Khối Cầu": "sphere",
  "❤️ Trái Tim": "heart",
  "🌀 Hình Xuyến": "torus",
  "🔃 Xoắn Ốc": "spiral",
  "🌊 Sóng Sin": "wave",
  "🔺 Yên Ngựa": "saddle",
  "🧊 Elipsoid": "ellipsoid",
  "📈 Parabol 3D": "paraboloid",
  "🌀 Sin-Cos Wave": "sincosWave",
  "♾️ Mobius": "mobius",
  "🔻 Cone": "cone",
  "🌀 Cycloid": "cycloid",
};

// Tạo GUI chọn khối
guiSample
  .add({ preset: "sphere" }, "preset", presetShapes)
  .name("📦 Khối Mẫu")
  .onChange((val) => {
    if (allObjects[val]) toggle(allObjects[val]);
  });

// ----- Nút Trợ giúp -----
sampleParams.help = () => {
  alert(
    `📖 Hướng dẫn sử dụng tab Khối Mẫu:

🎨 Chọn Khối 2D/3D:
- Chọn nhanh các khối cơ bản như Cube, Sphere, Cylinder, Cone, Circle, Ellipse, Tam giác, Ngũ giác, Lục giác, Chóp, Mặt phẳng.

🌀 Hiệu Ứng Chuyển Động:
- Thêm chuyển động động cho khối đã chọn.
- Ví dụ: Quay quanh trục, Nảy, Gợn sóng, Lắc, Quay quanh tâm, Chớp màu...

💻 Custom Motion (JS):
- Tự viết code JavaScript để tạo hiệu ứng chuyển động tùy biến cho khối.

🧱 Tùy Biến Khối 3D:
- Loại Khối: Box, Sphere, Cylinder.
- Kích thước / Bán kính: Điều chỉnh kích thước khối.
- Chiều cao: Điều chỉnh độ cao (đối với Cylinder, Box, Cone).
- Màu sắc: Chọn màu khối.
- ➕ Tạo Khối: Sinh khối mới theo cấu hình.

📦 Khối Mẫu:
- Danh sách các khối đặc biệt (Heart, Torus, Spiral, Mobius, Paraboloid...).
- Chọn để hiển thị/ẩn các khối trong worldGroup.
`
  );
};

// Thêm nút Trợ giúp vào GUI
guiSample.add(sampleParams, "help").name("❓ Trợ giúp");
function createShape(params) {
  const type = params.shapeType;
  const size = params.shapeSize;
  const height = params.shapeHeight;
  const color = params.shapeColor;

  let geometry;

  switch (type) {
    case "box":
      geometry = new THREE.BoxGeometry(size, height, size);
      break;
    case "sphere":
      geometry = new THREE.SphereGeometry(size, 32, 32);
      break;
    case "cylinder":
      geometry = new THREE.CylinderGeometry(size, size, height, 32);
      break;
    default:
      console.warn("Loại khối chưa hỗ trợ:", type);
      return;
  }

  const material = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);

  // Đặt vị trí ngẫu nhiên để dễ nhìn
  mesh.position.set(
    (Math.random() - 0.5) * 5,
    (Math.random() - 0.5) * 5,
    (Math.random() - 0.5) * 5
  );

  worldGroup.add(mesh);
  allObjects.push(mesh); // nếu bạn dùng để animate
}

// ----- Ánh sáng nâng cao -----
const lightParams = {
  lightMode: "soft",
  materialType: "standard",
  textureImage: null,
  lightColor: "#ffffff",
  lightIntensity: 1,
  lightType: "Directional",
  metalness: 0.5,
  roughness: 0.5,
  animateLight: false,
};

// GUI Tab
const guiLight = guiHelper.addTab("Ánh Sáng", 400, {
  icon: "💡",
  label: "Ánh Sáng",
});

// Chế độ ánh sáng
guiLight
  .add(lightParams, "lightMode", {
    Mềm: "soft",
    Mạnh: "strong",
    "Chỉ khung": "wireframe",
  })
  .name("Chế độ ánh sáng")
  .onChange(updateLightMode);

// Loại vật liệu
guiLight
  .add(lightParams, "materialType", {
    Standard: "standard",
    Phong: "phong",
    Lambert: "lambert",
    Toon: "toon",
    Texture: "texture",
  })
  .name("Loại vật liệu")
  .onChange(updateLightMode);

// Metalness / Roughness (cho Standard / Texture)
guiLight
  .add(lightParams, "metalness", 0, 1, 0.01)
  .name("💍 Metalness")
  .onChange(updateLightMode);
guiLight
  .add(lightParams, "roughness", 0, 1, 0.01)
  .name("🧽 Roughness")
  .onChange(updateLightMode);

// Màu và cường độ ánh sáng
guiLight
  .addColor(lightParams, "lightColor")
  .name("🎨 Màu ánh sáng")
  .onChange(updateLightMode);
guiLight
  .add(lightParams, "lightIntensity", 0, 5, 0.1)
  .name("💡 Cường độ")
  .onChange(updateLightMode);

// Loại ánh sáng
guiLight
  .add(lightParams, "lightType", {
    Directional: "Directional",
    Point: "Point",
    Spot: "Spot",
  })
  .name("Loại ánh sáng")
  .onChange(updateLightMode);

// Animation ánh sáng
guiLight.add(lightParams, "animateLight").name("🔄 Animate Light");

// Hidden file input cho Texture
const hiddenTextureInput = document.createElement("input");
hiddenTextureInput.type = "file";
hiddenTextureInput.accept = "image/*";
hiddenTextureInput.style.display = "none";
document.body.appendChild(hiddenTextureInput);

hiddenTextureInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    lightParams.textureImage = ev.target.result;
    updateLightMode();
  };
  reader.readAsDataURL(file);
});

// Nút chọn ảnh
guiLight
  .add({ chọnẢnh: () => hiddenTextureInput.click() }, "chọnẢnh")
  .name("📂 Chọn Texture");

// Trợ giúp
lightParams.help = () => {
  alert(
    `💡 Hướng dẫn sử dụng tab Ánh Sáng:

🔆 Chế độ ánh sáng: Mềm / Mạnh / Wireframe
🎨 Loại vật liệu: Standard / Phong / Lambert / Toon / Texture
💍 Metalness / 🧽 Roughness: cho vật liệu PBR
🎨 Màu và cường độ ánh sáng
💡 Loại ánh sáng: Directional / Point / Spot
🔄 Animate Light: ánh sáng quay xung quanh
📂 Chọn Texture: tải ảnh từ máy để áp dụng
`
  );
};
guiLight.add(lightParams, "help").name("❓ Trợ giúp");

// ---------- Ánh sáng worldGroup ----------
if (!worldGroup.light) {
  worldGroup.light = new THREE.DirectionalLight(
    lightParams.lightColor,
    lightParams.lightIntensity
  );
  worldGroup.add(worldGroup.light);
}

// -------- Update ánh sáng + vật liệu --------
function updateLightMode() {
  const mode = lightParams.lightMode;
  const materialType = lightParams.materialType;
  if (!surfaceMesh) return;

  // --- Cập nhật ánh sáng ---
  if (worldGroup.light) worldGroup.remove(worldGroup.light);

  switch (lightParams.lightType) {
    case "Point":
      worldGroup.light = new THREE.PointLight(
        lightParams.lightColor,
        lightParams.lightIntensity
      );
      worldGroup.light.position.set(50, 50, 50);
      break;
    case "Spot":
      worldGroup.light = new THREE.SpotLight(
        lightParams.lightColor,
        lightParams.lightIntensity
      );
      worldGroup.light.position.set(50, 100, 50);
      worldGroup.light.angle = Math.PI / 6;
      break;
    default:
      worldGroup.light = new THREE.DirectionalLight(
        lightParams.lightColor,
        lightParams.lightIntensity
      );
      worldGroup.light.position.set(60, 60, 60);
  }
  worldGroup.add(worldGroup.light);

  // --- Cập nhật vật liệu ---
  let newMaterial;
  const texLoader = new THREE.TextureLoader();

  switch (materialType) {
    case "phong":
      newMaterial = new THREE.MeshPhongMaterial({
        color: 0xffaa00,
        shininess: 100,
        side: THREE.DoubleSide,
      });
      break;
    case "lambert":
      newMaterial = new THREE.MeshLambertMaterial({
        color: 0x99ccff,
        side: THREE.DoubleSide,
      });
      break;
    case "toon":
      newMaterial = new THREE.MeshToonMaterial({
        color: 0xff99cc,
        gradientMap: null,
        side: THREE.DoubleSide,
      });
      break;
    case "texture":
      if (lightParams.textureImage) {
        const img = new Image();
        img.onload = function () {
          const texture = new THREE.Texture(img);
          texture.needsUpdate = true;
          const texturedMat = new THREE.MeshStandardMaterial({
            map: texture,
            metalness: lightParams.metalness,
            roughness: lightParams.roughness,
            flatShading: mode === "strong",
            side: THREE.DoubleSide,
          });
          applyMaterial(texturedMat);
        };
        img.src = lightParams.textureImage;
        return;
      } else {
        console.warn("Chưa chọn ảnh texture.");
        return;
      }
    case "standard":
    default:
      const baseTexture = texLoader.load(
        "https://threejsfundamentals.org/threejs/resources/images/checker.png"
      );
      newMaterial = new THREE.MeshStandardMaterial({
        color: 0x00ffff,
        map: baseTexture,
        metalness: lightParams.metalness,
        roughness: lightParams.roughness,
        flatShading: mode === "strong",
        side: THREE.DoubleSide,
      });
  }

  if (mode === "wireframe") {
    newMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
    });
  }

  applyMaterial(newMaterial);
}

// -------- Apply Material --------
function applyMaterial(material) {
  if (surfaceMesh instanceof THREE.Mesh) {
    surfaceMesh.material.dispose();
    surfaceMesh.material = material;
  }
}

// -------- Animate Light (gọi trong animate loop) --------
function animateLights(deltaTime) {
  if (lightParams.animateLight && worldGroup.light) {
    const t = Date.now() * 0.001;
    worldGroup.light.position.x = 60 * Math.sin(t);
    worldGroup.light.position.z = 60 * Math.cos(t);
  }
}

// ----- History -----
const historyParams = {
  entries: [], // 👈 mảng lưu lịch sử

  addEntry: (text) => {
    historyParams.entries.push(text);
    updateHistoryBox();
  },

  clear: () => {
    historyParams.entries = [];
    updateHistoryBox();
  },

  help: () => {
    alert(
      `📖 Hướng dẫn sử dụng tab Lịch Sử:

📜 Mục đích:
- Lưu lại các hành động hoặc sự kiện quan trọng trong quá trình làm việc.

✅ Box lịch sử:
- Hiển thị danh sách các sự kiện đã lưu.
- Tự động đánh số thứ tự cho từng dòng.

🗑️ Xóa Lịch Sử:
- Dùng để xóa toàn bộ các sự kiện đã lưu, đưa về trạng thái trống.

🛠️ Lưu sự kiện mới:
- Gọi hàm historyParams.addEntry("Nội dung sự kiện") để thêm vào lịch sử.

👉 Tính năng này giúp bạn theo dõi và ghi nhớ các bước thao tác đã thực hiện.`
    );
  },
};

const guiHistory = guiHelper.addTab("Lịch Sử", 250, {
  icon: "📜",
  label: "Lịch Sử",
});

// ✅ Tạo box hiển thị trong tab lịch sử
const historyWrapper = document.createElement("div");
historyWrapper.style.width = "100%";
historyWrapper.style.minHeight = "150px";
historyWrapper.style.padding = "10px";
historyWrapper.style.marginTop = "8px";
historyWrapper.style.background = "#111";
historyWrapper.style.color = "#0f0";
historyWrapper.style.fontFamily = "monospace";
historyWrapper.style.fontSize = "12px";
historyWrapper.style.borderRadius = "6px";
historyWrapper.style.overflowY = "auto";

const historyBox = document.createElement("pre");
historyBox.style.whiteSpace = "pre-wrap";
historyBox.style.wordBreak = "break-word";
historyBox.textContent = "📜 Chưa có lịch sử.";
historyWrapper.appendChild(historyBox);

guiHistory.domElement.appendChild(historyWrapper);

// ✅ Hàm cập nhật lịch sử trong box
function updateHistoryBox() {
  if (historyParams.entries.length === 0) {
    historyBox.textContent = "📜 Chưa có lịch sử.";
  } else {
    historyBox.textContent = historyParams.entries
      .map((e, i) => `${i + 1}. ${e}`)
      .join("\n");
  }
}

// ✅ Thêm nút xóa lịch sử
guiHistory.add(historyParams, "clear").name("🗑️ Xóa Lịch Sử");

// ✅ Thêm nút trợ giúp
guiHistory.add(historyParams, "help").name("❓ Trợ giúp");

// ----- Export -----
const exportParams = {
  savePNG: () => saveAsPNG(),
  saveJPG: () => saveAsJPG(),
  saveGLTF: () => saveAsGLTF(),
};

const guiExport = guiHelper.addTab("Xuất Ảnh", 250, {
  icon: "📤",
  label: "Xuất Ảnh",
});

guiExport.add(exportParams, "savePNG").name("💾 Xuất PNG");
guiExport.add(exportParams, "saveJPG").name("💾 Xuất JPG");
guiExport.add(exportParams, "saveGLTF").name("💾 Xuất GLTF");
guiExport
  .add(
    {
      help: () => {
        alert(
          "📤 Hướng dẫn Xuất Ảnh:\n\n" +
            "💾 Xuất PNG: Lưu ảnh canvas hiện tại dưới dạng file PNG.\n" +
            "💾 Xuất JPG: Lưu ảnh canvas hiện tại dưới dạng file JPG.\n" +
            "💾 Xuất GLTF: Lưu mô hình 3D hiện tại ở định dạng GLTF để dùng trong Blender/Three.js."
        );
      },
    },
    "help"
  )
  .name("❓ Trợ giúp");
// Xuất ảnh
function saveAsPNG() {
  renderer.render(scene, camera);
  const link = document.createElement("a");
  link.download = "screenshot.png";
  link.href = renderer.domElement.toDataURL("image/png");
  link.click();
}
// ----- Tích Phân -----
const integralParams = {
  // 1 biến
  func1D: "Math.sin(x)", // hàm mặc định
  a: 0,
  b: Math.PI,
  n: 100,
  method: "midpoint",
  showSteps: false,
  compute1D: () => computeIntegral1D(),
  result1D: "Chưa tính",
  // 2 biến
  func2D: "Math.sin(x) * Math.cos(y)",
  ax: 0,
  bx: Math.PI,
  ay: 0,
  by: Math.PI,
  nx: 30,
  ny: 30,
  colormap: "viridis",
  compute2D: () => computeIntegral2D(),
  result2D: "Chưa tính",
};

const guiIntegral = guiHelper.addTab("Tích Phân", 350, {
  icon: "∫",
  label: "Tích Phân",
});

// --- Tích phân 1 biến ---
// --- Tích phân 1 biến ---
const f1 = guiIntegral.addFolder("📈 1 Biến (∫ f(x) dx)");
f1.add(integralParams, "func1D").name("Hàm f(x)");
f1.add(integralParams, "a", -10, 10, 0.1).name("Cận a");
f1.add(integralParams, "b", -10, 10, 0.1).name("Cận b");
f1.add(integralParams, "n", 10, 1000, 10).name("Số điểm n");
f1.add(integralParams, "method", ["midpoint", "trapezoidal", "simpson"]).name(
  "Phương pháp"
);
f1.add(integralParams, "showSteps").name("Hiện từng bước");
f1.add(integralParams, "result1D").name("Kết quả").listen();
f1.add(
  {
    visualize3D: () => visualizeIntegral1D3D(),
  },
  "visualize3D"
).name("🟦 Vẽ 3D");

// ✅ Tạo canvas trong folder f1 nhưng ẩn đi
const canvasWrapper1D = document.createElement("div");
canvasWrapper1D.style.width = "100%";
canvasWrapper1D.style.height = "250px";
canvasWrapper1D.style.padding = "10px";
canvasWrapper1D.style.display = "none"; // 👈 ẩn mặc định

const canvasIntegral = document.createElement("canvas");
canvasIntegral.id = "integralGraph1D";
canvasIntegral.width = 320;
canvasIntegral.height = 240;

canvasWrapper1D.appendChild(canvasIntegral);
f1.domElement.appendChild(canvasWrapper1D);

// ✅ Thêm nút compute và hiện canvas khi bấm
f1.add(integralParams, "compute1D")
  .name("▶️ Tính 1 Biến")
  .onChange(() => {
    canvasWrapper1D.style.display = "block"; // 👈 hiện canvas
    // integralParams.compute1D();                // gọi hàm tính
  });

// --- Hàm tính & vẽ ---
function computeIntegral1D() {
  const formula = integralParams.func1D.replace(/^f\(x\)\s*=\s*/, "");
  const a =
    typeof integralParams.a === "string"
      ? math.evaluate(integralParams.a)
      : integralParams.a;
  const b =
    typeof integralParams.b === "string"
      ? math.evaluate(integralParams.b)
      : integralParams.b;
  const steps = parseInt(integralParams.n);
  const method = integralParams.method;
  const showSteps = integralParams.showSteps;

  const expr = math.compile(formula);

  let area = 0;
  const dx = (b - a) / steps;
  const xVals = [],
    yVals = [],
    barData = [];

  if (method === "midpoint") {
    for (let i = 0; i < steps; i++) {
      const x = a + (i + 0.5) * dx;
      const y = expr.evaluate({ x });
      const slice = y * dx;
      area += slice;
      xVals.push(x);
      yVals.push(y);
      barData.push({ x, y });
    }
  } else if (method === "trapezoidal") {
    for (let i = 0; i <= steps; i++) {
      const x = a + i * dx;
      const y = expr.evaluate({ x });
      xVals.push(x);
      yVals.push(y);
      barData.push({ x, y });
      if (i === 0 || i === steps) area += y / 2;
      else area += y;
    }
    area *= dx;
  } else if (method === "simpson" && steps % 2 === 0) {
    for (let i = 0; i <= steps; i++) {
      const x = a + i * dx;
      const y = expr.evaluate({ x });
      xVals.push(x);
      yVals.push(y);
      barData.push({ x, y });
      if (i === 0 || i === steps) area += y;
      else if (i % 2 === 0) area += 2 * y;
      else area += 4 * y;
    }
    area *= dx / 3;
  } else {
    alert("Simpson's Rule cần số khoảng n chẵn.");
    return;
  }

  // 👉 update kết quả trong GUI
  integralParams.result1D = `≈ ${area.toFixed(6)}`;
  // 👉 lưu vào lịch sử (dùng historyParams thay vì historyData)
  const historyEntry = `Hàm: ${formula}, [${a}, ${b}], n=${steps}, phương pháp=${method}, KQ=${area.toFixed(
    6
  )}`;
  historyParams.addEntry(historyEntry);
  // 👉 vẽ bằng Chart.js
  const ctx = canvasIntegral.getContext("2d");
  if (window.chartIntegral1D) window.chartIntegral1D.destroy();

  window.chartIntegral1D = new Chart(ctx, {
    type: "bar",
    data: {
      datasets: [
        {
          type: "line",
          label: "f(x)",
          data: xVals.map((x, i) => ({ x, y: yVals[i] })),
          borderColor: "blue",
          backgroundColor: "rgba(59,130,246,0.2)",
          tension: 0.3,
          fill: true,
          parsing: false,
        },
        {
          type: "bar",
          label: "Diện tích lát",
          data: barData,
          backgroundColor: "rgba(34,197,94,0.6)",
          borderWidth: 0,
          parsing: false,
          barThickness: Math.max(1, 300 / steps),
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { type: "linear", title: { display: true, text: "x" } },
        y: { title: { display: true, text: "f(x)" } },
      },
    },
  });
}
function visualizeIntegral1D3D() {
  const formula = integralParams.func1D.replace(/^f\(x\)\s*=\s*/, "");
  const a =
    typeof integralParams.a === "string"
      ? math.evaluate(integralParams.a)
      : integralParams.a;
  const b =
    typeof integralParams.b === "string"
      ? math.evaluate(integralParams.b)
      : integralParams.b;
  const steps = parseInt(integralParams.n);
  const expr = math.compile(formula);

  const dx = (b - a) / steps;
  const vertices = [];
  const colors = [];
  const color = new THREE.Color();

  const z0 = 0; // đáy
  for (let i = 0; i < steps; i++) {
    const x1 = a + i * dx;
    const x2 = a + (i + 1) * dx;
    const y1 = expr.evaluate({ x: x1 });
    const y2 = expr.evaluate({ x: x2 });

    // Tạo 2 tam giác cho mỗi lát (bar)
    vertices.push(
      x1,
      z0,
      0,
      x2,
      z0,
      0,
      x1,
      y1,
      0,

      x2,
      z0,
      0,
      x2,
      y2,
      0,
      x1,
      y1,
      0
    );

    // màu sắc theo chiều cao
    const avgY = (y1 + y2) / 2;
    color.setHSL(0.3 - 0.3 * (avgY / 10), 1.0, 0.5);
    for (let k = 0; k < 6; k++) colors.push(color.r, color.g, color.b);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3)
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "integral1DSurface";

  const old = worldGroup.getObjectByName("integral1DSurface");
  if (old) worldGroup.remove(old);
  worldGroup.add(mesh);

  // Cập nhật camera
  if (camera && controls) {
    const centerX = (a + b) / 2;
    const centerY = 0;
    let zMax = Math.max(...vertices.filter((v, i) => i % 3 === 1));
    controls.target.set(centerX, centerY, zMax / 2);
    camera.position.set(centerX, -(b - a) * 1.5, zMax + 2);
    controls.update();
  }
}

// ----- Tích Phân 2D (dùng integralParams) -----
const f2 = guiIntegral.addFolder("📊 2 Biến (∬ f(x,y) dxdy)");
f2.add(integralParams, "func2D").name("Hàm f(x,y)");
f2.add(integralParams, "ax", -10, 10, 0.1).name("X min");
f2.add(integralParams, "bx", -10, 10, 0.1).name("X max");
f2.add(integralParams, "ay", -10, 10, 0.1).name("Y min");
f2.add(integralParams, "by", -10, 10, 0.1).name("Y max");
f2.add(integralParams, "nx", 10, 200, 1).name("Nx");
f2.add(integralParams, "ny", 10, 200, 1).name("Ny");
f2.add(integralParams, "colormap", ["viridis", "plasma", "turbo", "gray"])
  .name("Colormap")
  .onChange(() => computeIntegral2D());

guiIntegral
  .add(
    {
      help: () => {
        alert(
          "∫ Hướng dẫn sử dụng Tích Phân:\n\n" +
            "📈 1 Biến:\n" +
            "- Nhập hàm f(x), ví dụ: Math.sin(x)\n" +
            "- Chọn cận a, b và số điểm n để chia nhỏ.\n" +
            "- Phương pháp: midpoint (hình chữ nhật), trapezoidal (hình thang), simpson.\n" +
            "- Bấm ▶️ Tính 1 Biến để xem kết quả và đồ thị.\n\n" +
            "📊 2 Biến:\n" +
            "- Nhập hàm f(x,y), ví dụ: Math.sin(x)*Math.cos(y)\n" +
            "- Chọn miền X: [ax, bx], Y: [ay, by]\n" +
            "- Nx, Ny: số điểm chia theo X và Y.\n" +
            "- Colormap: chọn bảng màu hiển thị heatmap.\n" +
            "- Bấm ▶️ Tính 2 Biến để xem kết quả, heatmap và mô hình 3D."
        );
      },
    },
    "help"
  )
  .name("❓ Trợ giúp");

// ✅ Tạo canvas heatmap nhưng ẩn đi
const canvasWrapper2D = document.createElement("div");
canvasWrapper2D.style.width = "100%";
canvasWrapper2D.style.height = "250px";
canvasWrapper2D.style.padding = "10px";
canvasWrapper2D.style.display = "none"; // 👈 ẩn mặc định

const canvasHeatmap2D = document.createElement("canvas");
canvasHeatmap2D.id = "integralHeatmap2D";
canvasHeatmap2D.width = 320;
canvasHeatmap2D.height = 240;

canvasWrapper2D.appendChild(canvasHeatmap2D);
f2.domElement.appendChild(canvasWrapper2D);

const resultCtrl = f2
  .add(integralParams, "result2D")
  .name("Kết quả ∬")
  .listen();

// ✅ Nút compute 2D: hiện canvas + chạy tính toán
f2.add(integralParams, "compute2D")
  .name("▶️ Tính 2 Biến")
  .onChange(() => {
    canvasWrapper2D.style.display = "block"; // 👈 hiện canvas
    // integralParams.compute2D();               // gọi hàm tính
  });

// Tính tích phân 2D đơn giản bằng phương pháp hình chữ nhật
function computeIntegral2D() {
  const formula =
    typeof integralParams.func2D === "string"
      ? integralParams.func2D.replace(/^f\(x,y\)\s*=\s*/, "")
      : String(integralParams.func2D);

  const xMin = parseFloat(integralParams.ax);
  const xMax = parseFloat(integralParams.bx);
  const yMin = parseFloat(integralParams.ay);
  const yMax = parseFloat(integralParams.by);
  const stepsX = parseInt(integralParams.nx);
  const stepsY = parseInt(integralParams.ny);
  const colormapName = integralParams.colormap || "viridis";

  const expr = math.compile(formula);
  const dx = (xMax - xMin) / stepsX;
  const dy = (yMax - yMin) / stepsY;

  let sum = 0;
  for (let i = 0; i <= stepsX; i++) {
    const x = xMin + i * dx;
    for (let j = 0; j <= stepsY; j++) {
      const y = yMin + j * dy;
      const val = expr.evaluate({ x, y });
      if (isFinite(val)) sum += val * dx * dy;
    }
  }

  integralParams.result2D = `≈ ${sum.toFixed(6)}`; // cập nhật GUI tự động nhờ .listen()

  // --- ghi lịch sử ---
  const timestamp = new Date().toLocaleTimeString();
  const entry = `[${timestamp}] ∫∫ f(x,y) dxdy = ${sum.toFixed(
    6
  )} | f(x,y)=${formula}, [${xMin},${xMax}]×[${yMin},${yMax}] steps=(${stepsX},${stepsY})`;
  historyParams.addEntry(entry);

  // vẽ heatmap và 3D surface bằng các hàm đã viết, truyền tham số vào
  draw2DHeatmap(formula, xMin, xMax, yMin, yMax, stepsX, stepsY, colormapName);
  visualizeIntegral2D(formula, xMin, xMax, yMin, yMax, stepsX, stepsY);
}

function draw2DHeatmap(
  formula,
  xMin,
  xMax,
  yMin,
  yMax,
  stepsX,
  stepsY,
  colormapName = "viridis"
) {
  const ctx = document.getElementById("integralHeatmap2D")?.getContext("2d");
  if (!ctx) return;

  const expr = math.compile(formula);
  const dx = (xMax - xMin) / stepsX;
  const dy = (yMax - yMin) / stepsY;

  const data = [];
  let zMin = Infinity,
    zMax = -Infinity;

  for (let i = 0; i < stepsX; i++) {
    const x = xMin + i * dx + dx / 2;
    for (let j = 0; j < stepsY; j++) {
      const y = yMin + j * dy + dy / 2;
      try {
        const z = expr.evaluate({ x, y });
        if (!isFinite(z)) continue;
        data.push({ x, y, v: z });
        zMin = Math.min(zMin, z);
        zMax = Math.max(zMax, z);
      } catch (e) {
        console.warn(`Lỗi tại (${x},${y}):`, e.message);
      }
    }
  }

  if (window.heatmap2DChart) window.heatmap2DChart.destroy();

  window.heatmap2DChart = new Chart(ctx, {
    type: "matrix",
    data: {
      datasets: [
        {
          label: "f(x,y)",
          data: data,
          backgroundColor(ctx) {
            const point = ctx.dataset?.data?.[ctx.dataIndex];
            if (!point || typeof point.v !== "number") return "rgba(0,0,0,0)";
            const normalized = (point.v - zMin) / (zMax - zMin || 1);
            return getColorFromMap(normalized, colormapName);
          },

          width(ctx) {
            const area = ctx.chart.chartArea;
            if (!area) return 10;
            return area.width / stepsX;
          },
          height(ctx) {
            const area = ctx.chart.chartArea;
            if (!area) return 10;
            return area.height / stepsY;
          },
        },
      ],
    },
    options: {
      maintainAspectRatio: true,
      responsive: true,
      plugins: {
        tooltip: {
          callbacks: {
            title: () => "",
            label: (ctx) => {
              const d = ctx.raw;
              return `x: ${d.x.toFixed(2)}, y: ${d.y.toFixed(
                2
              )}, z: ${d.v.toFixed(2)}`;
            },
          },
        },
        legend: { display: false },
      },
      scales: {
        x: {
          type: "linear",
          min: xMin,
          max: xMax,
          title: { display: true, text: "x" },
        },
        y: {
          type: "linear",
          min: yMin,
          max: yMax,
          title: { display: true, text: "y" },
        },
      },
    },
  });
}

function getColorFromMap(t, mapName = "viridis") {
  t = Math.min(1, Math.max(0, t)); // đảm bảo t ∈ [0,1]

  // Các colormap phổ biến
  switch (mapName) {
    case "plasma":
      return plasmaColorMap(t);
    case "turbo":
      return turboColorMap(t);
    case "gray":
      const g = Math.floor(255 * t);
      return `rgba(${g},${g},${g},1)`;
    case "viridis":
    default:
      return viridisColorMap(t);
  }
}

// Colormap viridis (giảm nhẹ để phù hợp)
function viridisColorMap(t) {
  const r = Math.floor(255 * Math.max(0, Math.min(1, 0.267 + 1.5 * t)));
  const g = Math.floor(255 * Math.max(0, Math.min(1, 0.004 + 2.0 * t)));
  const b = Math.floor(255 * Math.max(0, Math.min(1, 0.329 + 1.2 * t)));
  return `rgba(${r},${g},${b},1)`;
}

function plasmaColorMap(t) {
  const r = Math.floor(255 * Math.min(1, Math.max(0, 1.5 * t)));
  const g = Math.floor(255 * Math.abs(Math.sin(t * Math.PI)));
  const b = Math.floor(255 * (1 - t));
  return `rgba(${r},${g},${b},1)`;
}

function turboColorMap(t) {
  // https://ai.googleblog.com/2019/08/turbo-improved-rainbow-colormap-for.html
  const r = Math.floor(
    255 * Math.max(0, Math.min(1, 1.0 - Math.abs(4.0 * (t - 0.75))))
  );
  const g = Math.floor(
    255 * Math.max(0, Math.min(1, 1.0 - Math.abs(4.0 * (t - 0.5))))
  );
  const b = Math.floor(
    255 * Math.max(0, Math.min(1, 1.0 - Math.abs(4.0 * (t - 0.25))))
  );
  return `rgba(${r},${g},${b},1)`;
}

function visualizeIntegral2D(formula, xMin, xMax, yMin, yMax, stepsX, stepsY) {
  const dx = (xMax - xMin) / stepsX;
  const dy = (yMax - yMin) / stepsY;
  const expr = math.compile(formula);

  function safeEval(x, y) {
    try {
      const z = expr.evaluate({ x, y });
      return isFinite(z) ? z : null;
    } catch {
      return null;
    }
  }

  const geometry = new THREE.BufferGeometry();
  const vertices = [];
  const colors = [];
  const color = new THREE.Color();
  const z0 = 0; // mặt phẳng đáy

  // ===== Mặt trên (surface) + tường =====
  for (let i = 0; i < stepsX; i++) {
    for (let j = 0; j < stepsY; j++) {
      const x1 = xMin + i * dx;
      const y1 = yMin + j * dy;
      const x2 = xMin + (i + 1) * dx;
      const y2 = yMin + (j + 1) * dy;

      const z11 = safeEval(x1, y1);
      const z12 = safeEval(x1, y2);
      const z21 = safeEval(x2, y1);
      const z22 = safeEval(x2, y2);

      if (z11 == null || z12 == null || z21 == null || z22 == null) {
        continue; // bỏ qua ô lỗi
      }

      // --- Mặt trên (surface) ---
      vertices.push(x1, y1, z11, x2, y1, z21, x1, y2, z12);
      vertices.push(x2, y1, z21, x2, y2, z22, x1, y2, z12);

      const avgZ = (z11 + z12 + z21 + z22) / 4;
      for (let k = 0; k < 6; k++) {
        color.setHSL(0.6 - 0.6 * (avgZ / 10), 1.0, 0.5);
        colors.push(color.r, color.g, color.b);
      }

      // --- Tường đứng (kéo xuống z=0) ---

      // cạnh theo x (y = y1)
      vertices.push(x1, y1, z0, x1, y1, z11, x2, y1, z21);
      vertices.push(x1, y1, z0, x2, y1, z21, x2, y1, z0);

      // cạnh theo x (y = y2)
      vertices.push(x1, y2, z0, x1, y2, z12, x2, y2, z22);
      vertices.push(x1, y2, z0, x2, y2, z22, x2, y2, z0);

      // cạnh theo y (x = x1)
      vertices.push(x1, y1, z0, x1, y2, z12, x1, y1, z11);
      vertices.push(x1, y1, z0, x1, y2, z0, x1, y2, z12);

      // cạnh theo y (x = x2)
      vertices.push(x2, y1, z0, x2, y2, z22, x2, y1, z21);
      vertices.push(x2, y1, z0, x2, y2, z0, x2, y2, z22);

      // màu tường
      for (let k = 0; k < 24; k++) {
        color.setHSL(0.6 - 0.6 * (avgZ / 10), 1.0, 0.3);
        colors.push(color.r, color.g, color.b);
      }
    }
  }

  // ===== Mặt đáy (z=0) =====
  for (let i = 0; i < stepsX; i++) {
    for (let j = 0; j < stepsY; j++) {
      const x1 = xMin + i * dx;
      const y1 = yMin + j * dy;
      const x2 = xMin + (i + 1) * dx;
      const y2 = yMin + (j + 1) * dy;

      vertices.push(x1, y1, z0, x2, y1, z0, x1, y2, z0);
      vertices.push(x2, y1, z0, x2, y2, z0, x1, y2, z0);

      for (let k = 0; k < 6; k++) {
        color.setRGB(0.2, 0.2, 0.2);
        colors.push(color.r, color.g, color.b);
      }
    }
  }

  // ===== Tạo mesh =====
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3)
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.7,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "integralSurface";

  const old = worldGroup.getObjectByName("integralSurface");
  if (old) worldGroup.remove(old);
  worldGroup.add(mesh);

  // ===== Cập nhật camera =====
  if (camera && controls) {
    const centerX = (xMin + xMax) / 2;
    const centerY = (yMin + yMax) / 2;
    let zSum = 0;
    for (let k = 2; k < vertices.length; k += 3) {
      zSum += vertices[k];
    }
    const centerZ = zSum / (vertices.length / 3);
    controls.target.set(centerX, centerY, centerZ);
    camera.position.set(centerX, centerY - (xMax - xMin) * 1.5, centerZ + 5);
    controls.update();
  }
}

// ----- Fourier -----
const fourierParams = {
  func: "Math.sin(x)", // hàm gốc f(x)
  terms: 10, // số số hạng Fourier
  xmin: 0,
  xmax: 2 * Math.PI,
  nPoints: 200, // số điểm vẽ đồ thị
  showOriginal: true, // hiển thị hàm gốc
  showApprox: true, // hiển thị xấp xỉ Fourier
  result: "", // kết quả text (chuỗi Fourier)

  compute: () => computeFourier(),
};
const guiFourier = guiHelper.addTab("🔶 Fourier", 350, {
  icon: "🔶",
  label: "Chuỗi Fourier",
});

// Input hàm
guiFourier.add(fourierParams, "func").name("f(x)");

// Số hạng Fourier
guiFourier.add(fourierParams, "terms", 1, 50, 1).name("Số hạng N");

// Khoảng x
guiFourier.add(fourierParams, "xmin", -10, 10, 0.1).name("X min");
guiFourier.add(fourierParams, "xmax", -10, 10, 0.1).name("X max");

// Số điểm vẽ
guiFourier.add(fourierParams, "nPoints", 50, 1000, 1).name("Số điểm");

// Checkbox hiển thị
guiFourier.add(fourierParams, "showOriginal").name("Hiển thị hàm gốc");
guiFourier.add(fourierParams, "showApprox").name("Hiển thị xấp xỉ Fourier");

// Nút tính toán
guiFourier.add(fourierParams, "compute").name("▶️ Tính Fourier");

// Kết quả
const resultCtrlFourier = guiFourier
  .add(fourierParams, "result")
  .name("Chuỗi Fourier")
  .listen();
function computeFourier() {
  const formula = fourierParams.func;
  const N = parseInt(fourierParams.terms);
  const xMin = parseFloat(fourierParams.xmin);
  const xMax = parseFloat(fourierParams.xmax);
  const nPoints = parseInt(fourierParams.nPoints);

  const dx = (xMax - xMin) / (nPoints - 1);
  const xs = [];
  const fOrig = [];
  const fApprox = [];

  const expr = math.compile(formula);

  for (let i = 0; i < nPoints; i++) {
    const x = xMin + i * dx;
    xs.push(x);
    try {
      fOrig.push(expr.evaluate({ x }));
    } catch {
      fOrig.push(0);
    }
  }

  const L = (xMax - xMin) / 2;
  const a0 =
    (1 / L) * xs.reduce((acc, x) => acc + expr.evaluate({ x }), 0) * dx;
  const a = [],
    b = [];
  for (let n = 1; n <= N; n++) {
    let an = 0,
      bn = 0;
    for (let i = 0; i < nPoints; i++) {
      const x = xs[i];
      const fx = expr.evaluate({ x });
      an += fx * Math.cos((n * Math.PI * (x - xMin)) / L);
      bn += fx * Math.sin((n * Math.PI * (x - xMin)) / L);
    }
    a.push((an * dx) / L);
    b.push((bn * dx) / L);
  }

  for (let i = 0; i < nPoints; i++) {
    const x = xs[i];
    let sum = a0 / 2;
    for (let n = 1; n <= N; n++)
      sum +=
        a[n - 1] * Math.cos((n * Math.PI * (x - xMin)) / L) +
        b[n - 1] * Math.sin((n * Math.PI * (x - xMin)) / L);
    fApprox.push(sum);
  }

  fourierParams.result = `f(x) ≈ a0/2 + Σ(1→${N}) [a_n cos(nπx/L) + b_n sin(nπx/L)]`;

  // Vẽ 2D chart
  drawFourierChart(xs, fOrig, fApprox);

  // Vẽ 3D surface
  visualizeFourier3D(xs, fApprox);
}

const canvasFourier = document.createElement("canvas");
canvasFourier.id = "fourierCanvas";
canvasFourier.width = 600;
canvasFourier.height = 300;
guiFourier.domElement.appendChild(canvasFourier);

function drawFourierChart(xs, fOrig, fApprox) {
  if (window.fourierChart) window.fourierChart.destroy();

  const datasets = [];
  if (fourierParams.showOriginal) {
    datasets.push({
      label: "Hàm gốc",
      data: xs.map((x, i) => ({ x, y: fOrig[i] })),
      borderColor: "blue",
      fill: false,
      tension: 0.1,
    });
  }
  if (fourierParams.showApprox) {
    datasets.push({
      label: "Xấp xỉ Fourier",
      data: xs.map((x, i) => ({ x, y: fApprox[i] })),
      borderColor: "red",
      fill: false,
      tension: 0.1,
    });
  }

  const ctx = document.getElementById("fourierCanvas").getContext("2d");
  window.fourierChart = new Chart(ctx, {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: {
        x: { type: "linear", title: { display: true, text: "x" } },
        y: { title: { display: true, text: "f(x)" } },
      },
    },
  });
}
function visualizeFourier3D(xs, fApprox) {
  const geometry = new THREE.BufferGeometry();
  const vertices = [];
  const colors = [];
  const color = new THREE.Color();

  const y0 = -0.5; // bề rộng mesh theo Y
  const y1 = 0.5;

  for (let i = 0; i < xs.length - 1; i++) {
    const x1 = xs[i],
      x2 = xs[i + 1];
    const z1 = fApprox[i],
      z2 = fApprox[i + 1];

    // Tạo 2 tam giác (quad) giữa 2 điểm liên tiếp
    vertices.push(x1, y0, z1, x2, y0, z2, x1, y1, z1);
    vertices.push(x2, y0, z2, x2, y1, z2, x1, y1, z1);

    // màu gradient theo Z
    for (let k = 0; k < 6; k++) {
      const t = (z1 + z2) / 2; // trung bình 2 điểm
      color.setHSL(0.6 - 0.6 * (t / 10), 1.0, 0.5);
      colors.push(color.r, color.g, color.b);
    }
  }

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3)
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "fourierSurface";

  const old = worldGroup.getObjectByName("fourierSurface");
  if (old) worldGroup.remove(old);
  worldGroup.add(mesh);

  // cập nhật camera/controls
  if (camera && controls) {
    const centerX = (xs[0] + xs[xs.length - 1]) / 2;
    let zSum = 0;
    for (let k = 2; k < vertices.length; k += 3) zSum += vertices[k];
    const centerZ = zSum / (vertices.length / 3);
    controls.target.set(centerX, 0, centerZ);
    camera.position.set(centerX, -(xs[xs.length - 1] - xs[0]), centerZ + 5);
    controls.update();
  }
}
// ----- Fourier 2D -----
const fourier2DParams = {
  func: "Math.sin(x)*Math.cos(2*y)", // hàm 2 biến f(x,y)
  termsX: 5, // số hạng Fourier theo X
  termsY: 5, // số hạng Fourier theo Y
  xmin: 0,
  xmax: 2 * Math.PI,
  ymin: 0,
  ymax: 2 * Math.PI,
  nPoints: 50, // số điểm trên mỗi trục
  showOriginal: true,
  showApprox: true,
  result: "",
  compute: () => computeFourier2D(),
};

const guiFourier2D = guiHelper.addTab("🔷 Fourier 2D", 350, {
  icon: "🔷",
  label: "Chuỗi Fourier 2D",
});
guiFourier2D.add(fourier2DParams, "func").name("f(x,y)");
guiFourier2D.add(fourier2DParams, "termsX", 1, 20, 1).name("Số hạng X");
guiFourier2D.add(fourier2DParams, "termsY", 1, 20, 1).name("Số hạng Y");
guiFourier2D.add(fourier2DParams, "xmin", -10, 10, 0.1).name("X min");
guiFourier2D.add(fourier2DParams, "xmax", -10, 10, 0.1).name("X max");
guiFourier2D.add(fourier2DParams, "ymin", -10, 10, 0.1).name("Y min");
guiFourier2D.add(fourier2DParams, "ymax", -10, 10, 0.1).name("Y max");
guiFourier2D.add(fourier2DParams, "nPoints", 10, 200, 1).name("Số điểm");
guiFourier2D.add(fourier2DParams, "showOriginal").name("Hiển thị gốc");
guiFourier2D.add(fourier2DParams, "showApprox").name("Hiển thị xấp xỉ");
guiFourier2D.add(fourier2DParams, "compute").name("▶️ Tính Fourier 2D");
guiFourier2D.add(fourier2DParams, "result").name("Chuỗi Fourier 2D").listen();

function computeFourier2D() {
  const formula = fourier2DParams.func;
  const Nx = parseInt(fourier2DParams.termsX);
  const Ny = parseInt(fourier2DParams.termsY);
  const nPoints = parseInt(fourier2DParams.nPoints);
  const xMin = parseFloat(fourier2DParams.xmin);
  const xMax = parseFloat(fourier2DParams.xmax);
  const yMin = parseFloat(fourier2DParams.ymin);
  const yMax = parseFloat(fourier2DParams.ymax);

  const dx = (xMax - xMin) / (nPoints - 1);
  const dy = (yMax - yMin) / (nPoints - 1);

  const xs = [],
    ys = [],
    fOrig = [],
    fApprox = [];
  const expr = math.compile(formula);

  for (let i = 0; i < nPoints; i++) xs.push(xMin + i * dx);
  for (let j = 0; j < nPoints; j++) ys.push(yMin + j * dy);

  // Tạo lưới 2D
  for (let i = 0; i < nPoints; i++) {
    fOrig[i] = [];
    fApprox[i] = [];
    for (let j = 0; j < nPoints; j++) {
      const x = xs[i],
        y = ys[j];
      fOrig[i][j] = expr.evaluate({ x, y });
      fApprox[i][j] = 0; // khởi tạo xấp xỉ
    }
  }

  // Fourier 2D xấp xỉ bằng Nx * Ny số hạng
  const Lx = (xMax - xMin) / 2,
    Ly = (yMax - yMin) / 2;
  for (let n = 0; n < Nx; n++) {
    for (let m = 0; m < Ny; m++) {
      // Tính hệ số anm = 4/Lx/Ly ∫∫ f(x,y) cos(nπx/Lx) cos(mπy/Ly) dxdy (giả sử chẵn)
      let sum = 0;
      for (let i = 0; i < nPoints; i++) {
        for (let j = 0; j < nPoints; j++) {
          sum +=
            fOrig[i][j] *
            Math.cos((n * Math.PI * (xs[i] - xMin)) / Lx) *
            Math.cos((m * Math.PI * (ys[j] - yMin)) / Ly);
        }
      }
      const anm = (4 / (Lx * Ly)) * sum * dx * dy; // bỏ chia nPoints*nPoints
      for (let i = 0; i < nPoints; i++) {
        for (let j = 0; j < nPoints; j++) {
          fApprox[i][j] +=
            anm *
            Math.cos((n * Math.PI * (xs[i] - xMin)) / Lx) *
            Math.cos((m * Math.PI * (ys[j] - yMin)) / Ly);
        }
      }
    }
  }

  fourier2DParams.result = `f(x,y) ≈ Σ(n=0→${Nx}) Σ(m=0→${Ny}) a_nm cos(nπx/Lx) cos(mπy/Ly)`;

  drawFourier2DSurface(xs, ys, fOrig, fApprox);
}

// Vẽ surface 3D
function drawFourier2DSurface(xs, ys, fOrig, fApprox) {
  const geometry = new THREE.BufferGeometry();
  const vertices = [],
    colors = [];
  const color = new THREE.Color();
  const n = xs.length;

  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < n - 1; j++) {
      const x1 = xs[i],
        x2 = xs[i + 1],
        y1 = ys[j],
        y2 = ys[j + 1];
      const z11 = fApprox[i][j],
        z12 = fApprox[i][j + 1],
        z21 = fApprox[i + 1][j],
        z22 = fApprox[i + 1][j + 1];

      // 2 tam giác
      vertices.push(x1, y1, z11, x2, y1, z21, x1, y2, z12);
      vertices.push(x2, y1, z21, x2, y2, z22, x1, y2, z12);

      for (let k = 0; k < 6; k++) {
        const t = (z11 + z12 + z21 + z22) / 4;
        color.setHSL(0.6 - 0.6 * (t / 10), 1, 0.5);
        colors.push(color.r, color.g, color.b);
      }
    }
  }

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3)
  );
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "fourier2DSurface";

  const old = worldGroup.getObjectByName("fourier2DSurface");
  if (old) worldGroup.remove(old);
  worldGroup.add(mesh);

  if (camera && controls) {
    const centerX = (xs[0] + xs[xs.length - 1]) / 2;
    const centerY = (ys[0] + ys[ys.length - 1]) / 2;
    let zSum = 0;
    for (let k = 2; k < vertices.length; k += 3) zSum += vertices[k];
    const centerZ = zSum / (vertices.length / 3);
    controls.target.set(centerX, centerY, centerZ);
    camera.position.set(
      centerX - (xs[xs.length - 1] - xs[0]),
      centerY - (ys[ys.length - 1] - ys[0]),
      centerZ + 5
    );
    controls.update();
  }
}

// ----- Đồ thị 2D -----
const graph2DParams = {
  formula: "y = sin(x)", // công thức mặc định
  domain: {
    xMin: -10,
    xMax: 10,
    step: 0.1,
  },
  plot: () => plotGraph2D(),
  help: () => {
    alert(
      `📖 Hướng dẫn sử dụng tab Đồ thị 2D:

✏️ Công thức:
- Nhập công thức dạng "y = f(x)".
- Ví dụ: y = sin(x), y = cos(x), y = x^2, y = exp(-x^2).

📐 X Min, X Max:
- Giới hạn miền giá trị trục X.

🔢 Bước Δx:
- Độ chia nhỏ, càng nhỏ thì đồ thị càng mượt.

📈 Vẽ Đồ Thị:
- Nhấn để cập nhật đồ thị.

🖼️ Kết quả:
- Đồ thị hiển thị trực tiếp.
- Có thể thu phóng, đổi công thức bất kỳ lúc nào.
`
    );
  },
};

// Tạo tab trong GUI
const guiGraph2D = guiHelper.addTab("Đồ thị 2D", 350, {
  icon: "📈",
  label: "Đồ thị 2D",
});

guiGraph2D.add(graph2DParams, "formula").name("Công thức");

// Tạo folder con cho miền giá trị
const domainFolder = guiGraph2D.addFolder("Miền giá trị X");
domainFolder.add(graph2DParams.domain, "xMin", -50, 0, 1).name("X Min");
domainFolder.add(graph2DParams.domain, "xMax", 0, 50, 1).name("X Max");
domainFolder.add(graph2DParams.domain, "step", 0.01, 1, 0.01).name("Bước Δx");

guiGraph2D.add(graph2DParams, "plot").name("📈 Vẽ Đồ Thị");
graph2DParams.plot3D = () => plotGraph2D3D();
guiGraph2D.add(graph2DParams, "plot3D").name("🟢 Vẽ ra 3D");
function addAsymptotes3D(verticalAsymptotes = [], obliqueAsymptotes = []) {
  const group = new THREE.Group();

  verticalAsymptotes.forEach((x) => {
    const points = [
      new THREE.Vector3(x, -1000, 0),
      new THREE.Vector3(x, 1000, 0),
    ];
    const mat = new THREE.LineDashedMaterial({
      color: 0xff9900,
      dashSize: 1,
      gapSize: 1,
      linewidth: 2,
    });
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geom, mat);
    line.computeLineDistances(); // bắt buộc cho dashed
    group.add(line);

    // Thêm nhãn x
    const label = createLabel(
      `x=${x.toFixed(2)}`,
      new THREE.Vector3(x, 0, 0),
      "#ff9900",
      new THREE.Vector3(0.2, 0.2, 0),
      "graph2D"
    );
    group.add(label);
  });

  obliqueAsymptotes.forEach((o) => {
    const { a, b } = o;
    const xMin = graph2DParams.domain.xMin;
    const xMax = graph2DParams.domain.xMax;
    const points = [
      new THREE.Vector3(xMin, a * xMin + b, 0),
      new THREE.Vector3(xMax, a * xMax + b, 0),
    ];
    const mat = new THREE.LineDashedMaterial({
      color: 0x9900ff,
      dashSize: 1,
      gapSize: 2,
      linewidth: 2,
    });
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geom, mat);
    line.computeLineDistances();
    group.add(line);

    // Nhãn xiên
    const label = createLabel(
      `y=${a.toFixed(2)}x+${b.toFixed(2)}`,
      new THREE.Vector3(xMax, a * xMax + b, 0),
      "#9900ff",
      new THREE.Vector3(0.2, 0.2, 0),
      "graph2D"
    );
    group.add(label);
  });

  return group;
}
function addCriticalPoints3D(points) {
  const group = new THREE.Group();
  const sphereGeom = new THREE.SphereGeometry(0.15, 16, 16);
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

  points.forEach((p) => {
    // Vẽ quả cầu tại điểm tới hạn
    const sphere = new THREE.Mesh(sphereGeom, sphereMat);
    sphere.position.set(p.x, p.y, 0);
    group.add(sphere);

    // Thêm nhãn bằng createLabel
    const label = createLabel(
      `(${p.x.toFixed(2)}, ${p.y.toFixed(2)})`,
      new THREE.Vector3(p.x, p.y, 0),
      "#ff0000", // màu chữ
      new THREE.Vector3(0, 0.3, 0), // offset nhãn lên trên 1 chút
      "graph2D"
    );
    group.add(label);
  });

  return group;
}

let last2DGraph3D = null;

function plotGraph2D3D() {
  if (!worldGroup) return;

  // Xoá đồ thị cũ
  if (last2DGraph3D) {
    worldGroup.remove(last2DGraph3D);
    // Duyệt từng object con để dispose geometry/material nếu có
    last2DGraph3D.traverse((obj) => {
      if (obj.isMesh || obj.isLine) {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      }
    });
    last2DGraph3D = null;
  }
  clearLabels("graph2D");
  const input = graph2DParams.formula.trim();
  const exprStr = input.replace(/^y\s*=\s*/, "");
  const expr = math.compile(exprStr);

  const points = [];
  const { xMin, xMax, step } = graph2DParams.domain;
  const yValues = [];
  for (let x = xMin; x <= xMax + 1e-12; x += step) {
    let y;
    try {
      y = expr.evaluate({ x });
      if (!Number.isFinite(y) || Math.abs(y) > HUGE_THRESHOLD) {
        y = null; // coi là "không xác định"
      }
    } catch {
      y = null;
    }

    if (y !== null) points.push(new THREE.Vector3(x, y, 0));
    yValues.push(y);
  }

  // Tạo Line3D
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0x33ff99 });
  const curve3D = new THREE.Line(geometry, material);

  // Phân tích đồ thị
  const analysis = analyzeGraph2D(
    exprStr,
    expr,
    points.map((p) => p.x),
    yValues
  );

  // Nhóm các layer
  const group = new THREE.Group();
  group.add(curve3D);
  group.add(
    addAsymptotes3D(analysis.verticalAsymptotes, analysis.obliqueAsymptotes)
  );
  group.add(addCriticalPoints3D(analysis.criticalPoints));

  worldGroup.add(group);
  last2DGraph3D = group;

  if (points.length > 0) moveCameraTo(points);
}

guiGraph2D.add(graph2DParams, "help").name("❓ Trợ giúp");

// ✅ Tạo canvas
const canvasWrapper = document.createElement("div");
canvasWrapper.style.width = "100%";
canvasWrapper.style.height = "260px";
canvasWrapper.style.padding = "10px";
const canvasGraph2D = document.createElement("canvas");
canvasGraph2D.id = "graph2D";
canvasWrapper.appendChild(canvasGraph2D);
guiGraph2D.domElement.appendChild(canvasWrapper);

// ==== Tham số nội bộ (có thể tùy chỉnh) ====
const HUGE_THRESHOLD = 1e8; // nếu |y| > ngưỡng này coi như "vô hạn"
const JUMP_MULTIPLIER = 1e3; // nếu delta lớn hơn maxAbs * JUMP_MULTIPLIER => coi là nhảy lớn
const REFINE_ITERS = 35; // lần lặp tối đa khi refine vị trí tiệm cận
const REFINE_TOL = 1e-7; // độ chính xác refine

// ===== Hàm vẽ đồ thị (thay thế) =====
function plotGraph2D() {
  const input = graph2DParams.formula.trim();
  if (!/^y\s*=/.test(input)) {
    alert("Công thức phải có dạng: y = f(x)");
    return;
  }
  const exprStr = input.replace(/^y\s*=\s*/, "");
  let expr;
  try {
    expr = math.compile(exprStr);
  } catch (e) {
    alert("Sai công thức: " + e.message);
    return;
  }

  const xValues = [];
  const yValues = [];
  for (
    let x = graph2DParams.domain.xMin;
    x <= graph2DParams.domain.xMax + 1e-12;
    x += graph2DParams.domain.step
  ) {
    xValues.push(+x.toFixed(12)); // tránh lỗi số thực
    try {
      const y = expr.evaluate({ x });
      // coi như "không hữu hạn" khi số bị Infinity, NaN, hoặc quá lớn
      if (!Number.isFinite(y) || Math.abs(y) > HUGE_THRESHOLD) {
        yValues.push(null);
      } else {
        yValues.push(y);
      }
    } catch {
      // lỗi khi evaluate -> coi như tiệm cận (null)
      yValues.push(null);
    }
  }

  const analysis = analyzeGraph2D(exprStr, expr, xValues, yValues);

  // Tạo annotations: trục, cực trị, tiệm cận
  const annotations = {
    axisX: {
      type: "line",
      yMin: 0,
      yMax: 0,
      borderColor: "#666",
      borderWidth: 1.2,
    },
    axisY: {
      type: "line",
      xMin: 0,
      xMax: 0,
      borderColor: "#666",
      borderWidth: 1.2,
    },
    // cực trị
    ...analysis.criticalPoints.reduce((acc, p, i) => {
      acc[`critPoint${i}`] = {
        type: "point",
        xValue: p.x,
        yValue: p.y,
        backgroundColor: "red",
        radius: 5,
      };
      acc[`critVLine${i}`] = {
        type: "line",
        xMin: p.x,
        xMax: p.x,
        yMin: 0,
        yMax: p.y,
        borderColor: "red",
        borderDash: [6, 6],
        borderWidth: 1,
      };
      acc[`critHLine${i}`] = {
        type: "line",
        yMin: p.y,
        yMax: p.y,
        xMin: 0,
        xMax: p.x,
        borderColor: "red",
        borderDash: [6, 6],
        borderWidth: 1,
      };
      return acc;
    }, {}),
    // tiệm cận đứng
    ...analysis.verticalAsymptotes.reduce((acc, x, i) => {
      acc[`asym${i}`] = {
        type: "line",
        xMin: x,
        xMax: x,
        borderColor: "orange",
        borderWidth: 2,
        borderDash: [6, 6],
        label: {
          display: true,
          content: `x=${x.toFixed(3)}`,
          position: "start", // có thể thử "end" hoặc "center"
          color: "orange",
          backgroundColor: "rgba(0,0,0,0.5)",
        },
      };
      return acc;
    }, {}),

    // tiệm cận xiên
    ...analysis.obliqueAsymptotes.reduce((acc, obj, i) => {
      const { a, b, side } = obj;
      const xStart = graph2DParams.domain.xMin;
      const xEnd = graph2DParams.domain.xMax;
      acc[`oblique${i}`] = {
        type: "line",
        xMin: xStart,
        xMax: xEnd,
        yMin: a * xStart + b,
        yMax: a * xEnd + b,
        borderColor: "purple",
        borderWidth: 2,
        borderDash: [8, 6],
        label: {
          display: true,
          content: `y=${a.toFixed(3)}x+${b.toFixed(3)} (${side})`,
          position: "end",
          color: "purple",
          backgroundColor: "rgba(0,0,0,0.5)",
        },
      };
      return acc;
    }, {}),
  };

  // Hủy đồ thị cũ nếu có
  if (window.chart2D) window.chart2D.destroy();
  const ctx = canvasGraph2D.getContext("2d");
  window.chart2D = new Chart(ctx, {
    type: "line",
    data: {
      labels: xValues,
      datasets: [
        {
          label: input,
          data: yValues,
          borderColor: "rgb(75, 192, 192)",
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          spanGaps: false, // KHÔNG nối qua null (đảm bảo chia đoạn tại tiệm cận)
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { type: "linear", title: { display: true, text: "x" } },
        y: { title: { display: true, text: "y" } },
      },
      plugins: {
        annotation: { annotations },
        zoom: {
          pan: { enabled: true, mode: "xy" },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: "xy",
          },
        },
      },
    },
  });

    // ✅ Xuất chi tiết vào Note (nếu bật showInNote)
    showInNote(
      guiHelper,
      displayParams,
      "📈 Khảo sát hàm số",
      `
      f(x) = ${exprStr}
      f'(x) = ${analysis.derivative}
      `,
      `
      Miền khảo sát: [${graph2DParams.domain.xMin}, ${graph2DParams.domain.xMax}]
      Cực trị: ${
        analysis.criticalPoints.length > 0
          ? analysis.criticalPoints
              .map((p) => `(${p.x.toFixed(3)}, ${p.y.toFixed(3)})`)
              .join(", ")
          : "Không có"
      }
      GTNN ≈ ${analysis.yMin}
      GTLN ≈ ${analysis.yMax}
      Tiệm cận đứng: ${
        analysis.verticalAsymptotes.length > 0
          ? analysis.verticalAsymptotes.map((x) => `x=${x.toFixed(3)}`).join(", ")
          : "—"
      }
      Tiệm cận xiên: ${
        analysis.obliqueAsymptotes.length > 0
          ? analysis.obliqueAsymptotes
              .map((o) => `y=${o.a.toFixed(3)}x+${o.b.toFixed(3)}`)
              .join(", ")
          : "—"
      }
      `
    );
}

// ===== Phân tích đồ thị (cập nhật) =====
function analyzeGraph2D(exprStr, expr, xValues, yValues) {
  // Derivative
  let derivative;
  try {
    derivative = math.derivative(exprStr, "x");
  } catch {
    derivative = null;
  }

  // Tính f'(x) trên lưới (nếu có)
  const dValues = derivative
    ? xValues.map((x) => {
        try {
          const v = derivative.evaluate({ x });
          return Number.isFinite(v) ? v : null;
        } catch {
          return null;
        }
      })
    : xValues.map((_) => null);

  // Tìm cực trị
  const criticalPoints = [];
  for (let i = 1; i < dValues.length; i++) {
    const d0 = dValues[i - 1],
      d1 = dValues[i];
    if (d0 === null || d1 === null) continue;
    if (d0 * d1 <= 0) {
      const x0 = (xValues[i - 1] + xValues[i]) / 2;
      try {
        const y0 = expr.evaluate({ x: x0 });
        if (Number.isFinite(y0)) criticalPoints.push({ x: x0, y: y0 });
      } catch {}
    }
  }

  // GTLN, GTNN
  const finiteY = yValues.filter((v) => v !== null && Number.isFinite(v));
  const yMin = finiteY.length ? Math.min(...finiteY) : null;
  const yMax = finiteY.length ? Math.max(...finiteY) : null;

  // Phát hiện tiệm cận đứng
  const verticalAsymptotes = [];
  for (let i = 1; i < yValues.length; i++) {
    const y0 = yValues[i - 1],
      y1 = yValues[i];
    const x0 = xValues[i - 1],
      x1 = xValues[i];
    if ((y0 === null && y1 !== null) || (y0 !== null && y1 === null)) {
      const approx = refineAsymptoteIfPossible(expr, x0, x1);
      verticalAsymptotes.push(approx);
    }
  }
  const uniqAsym = uniqueApprox(verticalAsymptotes, 1e-6);

  // 👉 Tiệm cận xiên
  function obliqueAsymptote(side = "right") {
    try {
      const sampleXs =
        side === "right"
          ? xValues.slice(-20) // 20 điểm cuối
          : xValues.slice(0, 20); // 20 điểm đầu
      const sampleYs = sampleXs.map((x) => expr.evaluate({ x }));
      if (sampleYs.some((y) => !Number.isFinite(y))) return null;
      // Fit tuyến tính y ≈ ax+b
      const n = sampleXs.length;
      const sumX = sampleXs.reduce((a, b) => a + b, 0);
      const sumY = sampleYs.reduce((a, b) => a + b, 0);
      const sumXY = sampleXs.reduce((a, b, i) => a + b * sampleYs[i], 0);
      const sumX2 = sampleXs.reduce((a, b) => a + b * b, 0);
      const a = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const b = (sumY - a * sumX) / n;
      // kiểm tra: nếu a ≈ 0 coi như tiệm cận ngang
      if (Math.abs(a) < 1e-6) return null;
      return { a, b, side };
    } catch {
      return null;
    }
  }

  const oblique = [];
  const leftAsym = obliqueAsymptote("left");
  if (leftAsym) oblique.push(leftAsym);
  const rightAsym = obliqueAsymptote("right");
  if (rightAsym) oblique.push(rightAsym);

  return {
    derivative: derivative ? derivative.toString() : "—",
    criticalPoints,
    yMin,
    yMax,
    verticalAsymptotes: uniqAsym,
    obliqueAsymptotes: oblique,
  };
}

// ===== Helper: refine vị trí tiệm cận bằng chia đôi (nếu có thể) =====
function refineAsymptoteIfPossible(expr, a, b) {
  // đảm bảo a < b
  if (a > b) {
    const t = a;
    a = b;
    b = t;
  }
  let left = a,
    right = b;

  // cap vào vùng đồ thị hiện tại nếu quá rộng
  const span = Math.max(1e-12, right - left);

  // nếu khoảng quá nhỏ thì trả về midpoint
  if (Math.abs(right - left) < REFINE_TOL) return (left + right) / 2;

  // xác định trạng thái đầu: finite hay not
  function evalSafe(x) {
    try {
      const v = expr.evaluate({ x });
      return Number.isFinite(v) && Math.abs(v) <= HUGE_THRESHOLD
        ? { finite: true, v }
        : { finite: false, v: null };
    } catch {
      return { finite: false, v: null };
    }
  }

  // Nếu cả 2 đầu đều finite thì vẫn thử refine nếu jump lớn
  let leftState = evalSafe(left),
    rightState = evalSafe(right);

  // lặp chia đôi, tìm điểm chuyển finite -> not finite
  for (let it = 0; it < REFINE_ITERS; it++) {
    const mid = (left + right) / 2;
    const midState = evalSafe(mid);
    // Nếu mid không finite => tiệm cận gần mid, thu hẹp về phía mid
    if (!midState.finite) {
      // nếu left finite thì move right to mid, ngược lại move left to mid
      if (leftState.finite) {
        right = mid;
        rightState = midState;
      } else {
        left = mid;
        leftState = midState;
      }
    } else {
      // mid finite -> cần tìm phía còn lại không finite
      // nếu left không finite thì move right to mid; nếu right không finite move left to mid
      if (!leftState.finite) {
        left = mid;
        leftState = midState;
      } else if (!rightState.finite) {
        right = mid;
        rightState = midState;
      } else {
        // cả 2 phía đều finite (trường hợp jump nhưng cả hai finite): thu hẹp theo gradient (chọn phía có |y| lớn hơn)
        const leftY = leftState.v,
          rightY = rightState.v;
        if (Math.abs(leftY) > Math.abs(rightY)) {
          right = mid;
          rightState = midState;
        } else {
          left = mid;
          leftState = midState;
        }
      }
    }
    if (Math.abs(right - left) < Math.max(REFINE_TOL, span * 1e-6)) break;
  }
  return (left + right) / 2;
}

// ===== Helper: loại bỏ phần tử gần nhau (approx unique) =====
function uniqueApprox(arr, tol = 1e-8) {
  if (!arr || arr.length === 0) return [];
  const sorted = arr.slice().sort((a, b) => a - b);
  const out = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i] - out[out.length - 1]) > tol) out.push(sorted[i]);
  }
  return out;
}

// ----- Mặt phẳng & Đường thẳng -----
const geometryParams = {
  planes: [], // danh sách phương trình dạng text
  planeEquations: [], // danh sách hệ số {a,b,c,d}

  // hệ số nhập từ GUI
  a: 1,
  b: 0,
  c: 0,
  d: 0,

  addPlane: () => {
    const { a, b, c, d } = geometryParams;
    const eq = `${a}x + ${b}y + ${c}z + ${d} = 0`;

    geometryParams.planes.push(eq);
    geometryParams.planeEquations.push({ a, b, c, d });

    updatePlaneList();

    // vẽ mặt phẳng
    drawPlaneFromParams(a, b, c, d);

    if (typeof historyParams !== "undefined") {
      historyParams.addEntry(`➕ Thêm mặt phẳng: ${eq}`);
    }
  },

  plane1: null,
  plane2: null,

  findIntersection: () => {
    const i1 = geometryParams.planes.indexOf(geometryParams.plane1);
    const i2 = geometryParams.planes.indexOf(geometryParams.plane2);

    if (i1 < 0 || i2 < 0 || i1 === i2) {
      showTempLabel(
        "⚠️ Vui lòng chọn hai mặt phẳng khác nhau",
        new THREE.Vector3(0, 0, 0),
        "#ff4444"
      );
      return;
    }

    const p1 = geometryParams.planeEquations[i1];
    const p2 = geometryParams.planeEquations[i2];

    intersectPlanes(p1, p2);

    if (typeof historyParams !== "undefined") {
      historyParams.addEntry(
        `📌 Giao tuyến: ${geometryParams.plane1} ∩ ${geometryParams.plane2}`
      );
    }
  },

  v1: [1, 0, 0],
  v2: [0, 1, 0],

  checkRelation: () => {
    const [x1, y1, z1] = geometryParams.v1;
    const [x2, y2, z2] = geometryParams.v2;
    const dot = x1 * x2 + y1 * y2 + z1 * z2;
    const cross = [y1 * z2 - z1 * y2, z1 * x2 - x1 * z2, x1 * y2 - y1 * x2];
    let result = "⚪ Tổng quát";
    if (dot === 0) result = "⟂ Vuông góc";
    else if (cross.every((v) => v === 0)) result = "∥ Song song";

    document.getElementById("checkResult").innerText = "Kết quả: " + result;

    if (typeof historyParams !== "undefined") {
      historyParams.addEntry(`🔎 Quan hệ vector: ${result}`);
    }
  },
};

// --- Tạo GUI ---
const guiGeometry = guiHelper.addTab("Mặt phẳng & Đường thẳng", 350, {
  icon: "📐",
  label: "Mặt phẳng & Đường thẳng",
});

// nhập hệ số mặt phẳng
guiGeometry.add(geometryParams, "a", -10, 10, 0.1).name("Hệ số a");
guiGeometry.add(geometryParams, "b", -10, 10, 0.1).name("Hệ số b");
guiGeometry.add(geometryParams, "c", -10, 10, 0.1).name("Hệ số c");
guiGeometry.add(geometryParams, "d", -10, 10, 0.1).name("Hệ số d");

// nút thêm mặt phẳng
guiGeometry.add(geometryParams, "addPlane").name("➕ Thêm mặt phẳng");

// chọn 2 mặt phẳng
guiGeometry
  .add(geometryParams, "plane1", geometryParams.planes)
  .name("Mặt phẳng 1");
guiGeometry
  .add(geometryParams, "plane2", geometryParams.planes)
  .name("Mặt phẳng 2");

// tìm giao tuyến
guiGeometry.add(geometryParams, "findIntersection").name("📌 Giao tuyến");

// --- Vector checker ---
const fVec = guiGeometry.addFolder("🎯 Vector Checker");
fVec.add(geometryParams.v1, 0, -10, 10, 1).name("v1.x");
fVec.add(geometryParams.v1, 1, -10, 10, 1).name("v1.y");
fVec.add(geometryParams.v1, 2, -10, 10, 1).name("v1.z");
fVec.add(geometryParams.v2, 0, -10, 10, 1).name("v2.x");
fVec.add(geometryParams.v2, 1, -10, 10, 1).name("v2.y");
fVec.add(geometryParams.v2, 2, -10, 10, 1).name("v2.z");
fVec.add(geometryParams, "checkRelation").name("Kiểm tra quan hệ");
// ----- Thêm nút Trợ giúp -----
geometryParams.help = () => {
  alert(
    `📖 Hướng dẫn sử dụng tab Mặt phẳng & Đường thẳng:

➕ Thêm mặt phẳng:
- Nhập các hệ số a, b, c, d để định nghĩa phương trình mặt phẳng dạng:
  ax + by + cz + d = 0
- Sau đó bấm "➕ Thêm mặt phẳng" để thêm vào danh sách và hiển thị trong không gian 3D.

📌 Giao tuyến:
- Chọn 2 mặt phẳng từ danh sách "Mặt phẳng 1" và "Mặt phẳng 2".
- Bấm "📌 Giao tuyến" để hiển thị đường thẳng giao tuyến của chúng (nếu tồn tại).

🎯 Vector Checker:
- Nhập tọa độ cho hai vector v1 và v2.
- Bấm "Kiểm tra quan hệ" để xem chúng có quan hệ gì:
  ⟂ Vuông góc, ∥ Song song, hay ⚪ Tổng quát.

👉 Bạn có thể thêm nhiều mặt phẳng, kiểm tra giao tuyến, và so sánh vector để trực quan hóa các đối tượng hình học 3D.
`
  );
};

// Gắn nút vào GUI
guiGeometry.add(geometryParams, "help").name("❓ Trợ giúp");

// --- Cập nhật danh sách mặt phẳng ---
function updatePlaneList() {
  const planeSelect1 = guiGeometry.__controllers.find(
    (c) => c.property === "plane1"
  );
  const planeSelect2 = guiGeometry.__controllers.find(
    (c) => c.property === "plane2"
  );
  if (planeSelect1 && planeSelect2) {
    planeSelect1.options(geometryParams.planes);
    planeSelect2.options(geometryParams.planes);
  }
}

// --- Hàm vẽ mặt phẳng ---
function drawPlaneFromParams(a, b, c, d) {
  const geometry = new THREE.PlaneGeometry(100, 100);
  const normal = new THREE.Vector3(a, b, c).normalize();
  const center = normal.clone().multiplyScalar(-d / normal.lengthSq());

  const material = new THREE.MeshStandardMaterial({
    color: Math.random() * 0xffffff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.4,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(center);
  mesh.lookAt(center.clone().add(normal));
  worldGroup.add(mesh);
}

// --- Hàm tính giao tuyến 2 mặt phẳng ---
function intersectPlanes(p1, p2) {
  const n1 = new THREE.Vector3(p1.a, p1.b, p1.c);
  const n2 = new THREE.Vector3(p2.a, p2.b, p2.c);
  const dir = new THREE.Vector3().crossVectors(n1, n2);

  if (dir.length() < 1e-6) {
    showTempLabel(
      "⚠️ Hai mặt phẳng song song hoặc trùng nhau",
      new THREE.Vector3(0, 0, 0),
      "#ff4444"
    );
    return;
  }

  const A = new THREE.Matrix3();
  A.set(p1.a, p1.b, p1.c, p2.a, p2.b, p2.c, dir.x, dir.y, dir.z);

  const D = new THREE.Vector3(-p1.d, -p2.d, 0);
  const Ainv = A.clone().invert();

  if (!Ainv) {
    showTempLabel(
      "⚠️ Không tìm được điểm giao",
      new THREE.Vector3(0, 0, 0),
      "#ff4444"
    );
    return;
  }

  const point = D.applyMatrix3(Ainv);

  const points = [];
  for (let t = -50; t <= 50; t += 1) {
    const pt = point.clone().add(dir.clone().normalize().multiplyScalar(t));
    points.push(pt);
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0xffff00 });
  const line = new THREE.Line(geometry, material);
  worldGroup.add(line);
}

// ----- Đạo hàm -----
const derivativeParams = {
  formula: "z = x^2 + y^2",
  mode: "surface",
  resolution: 50,

  // phạm vi mặc định
  xMin: -5,
  xMax: 5,
  yMin: -5,
  yMax: 5,
  derivativeText: "Kết quả đạo hàm sẽ hiện ở đây",
  plotSurfa: () =>
    plotSurface({
      formula: derivativeParams.formula,
      mode: derivativeParams.mode,
      resolution: derivativeParams.resolution,
      xMin: derivativeParams.xMin,
      xMax: derivativeParams.xMax,
      yMin: derivativeParams.yMin,
      yMax: derivativeParams.yMax,
    }),

  compute: () => computeDerivatives(),
  plotDx: () => plotDerivative("dx"),
  plotDy: () => plotDerivative("dy"),
  plotDx2: () => plotDerivative("dx2"),
  plotDy2: () => plotDerivative("dy2"),
  plotDxDy: () => plotDerivative("dxdy"),
};

let derivatives = {};

const guiDerivative = guiHelper.addTab("Đạo hàm", 350, {
  icon: "𝑑/dx",
  label: "Đạo hàm",
});
guiDerivative.add(derivativeParams, "formula").name("Công thức");
guiDerivative
  .add(derivativeParams, "mode", ["surface", "line"])
  .name("Chế độ hiển thị");
guiDerivative
  .add(derivativeParams, "resolution", 10, 200, 1)
  .name("Độ phân giải");

// 👇 thêm group nhập phạm vi
const fRange = guiDerivative.addFolder("📐 Phạm vi");
fRange.add(derivativeParams, "xMin", -50, 0, 0.1).name("x Min");
fRange.add(derivativeParams, "xMax", 0, 50, 0.1).name("x Max");
fRange.add(derivativeParams, "yMin", -50, 0, 0.1).name("y Min");
fRange.add(derivativeParams, "yMax", 0, 50, 0.1).name("y Max");

guiDerivative.add(derivativeParams, "plotSurfa").name("🧮 Vẽ đồ thị");
// ✅ Tạo box hiển thị kết quả đạo hàm, ẩn mặc định
const derivativeWrapper = document.createElement("div");
derivativeWrapper.style.width = "100%";
derivativeWrapper.style.minHeight = "150px";
derivativeWrapper.style.padding = "10px";
derivativeWrapper.style.marginTop = "8px";
derivativeWrapper.style.background = "#111";
derivativeWrapper.style.color = "#0f0";
derivativeWrapper.style.fontFamily = "monospace";
derivativeWrapper.style.fontSize = "12px";
derivativeWrapper.style.borderRadius = "6px";
derivativeWrapper.style.display = "none"; // 👈 ẩn mặc định

const derivativeBox = document.createElement("pre");
derivativeBox.style.whiteSpace = "pre-wrap";
derivativeBox.style.wordBreak = "break-word";
derivativeBox.textContent = derivativeParams.derivativeText;

derivativeWrapper.appendChild(derivativeBox);
guiDerivative.domElement.appendChild(derivativeWrapper);

// ✅ Nút tính đạo hàm → hiện box + cập nhật nội dung
guiDerivative
  .add(derivativeParams, "compute")
  .name("🧮 Tính đạo hàm")
  .onChange(() => {
    derivativeWrapper.style.display = "block"; // hiện box
    computeDerivatives();
    derivativeBox.textContent = derivativeParams.derivativeText; // update text
  });

// Group hiển thị các nút vẽ đạo hàm
const fDeriv = guiDerivative.addFolder("✏️ Vẽ các đạo hàm");
fDeriv.add(derivativeParams, "plotDx").name("∂z/∂x");
fDeriv.add(derivativeParams, "plotDy").name("∂z/∂y");
fDeriv.add(derivativeParams, "plotDx2").name("∂²z/∂x²");
fDeriv.add(derivativeParams, "plotDy2").name("∂²z/∂y²");
fDeriv.add(derivativeParams, "plotDxDy").name("∂²z/∂x∂y");
// ----- Nút Trợ giúp -----
derivativeParams.help = () => {
  alert(
    `📖 Hướng dẫn sử dụng tab Đạo hàm:

✏️ Công thức:
- Nhập công thức dưới dạng "z = f(x,y)".
- Ví dụ: z = x^2 + y^2 hoặc z = sin(x) * cos(y).

🖼️ Chế độ hiển thị:
- "surface": Vẽ bề mặt 3D.
- "line": Vẽ đường cong (1 biến).

🔢 Độ phân giải:
- Quyết định số lượng điểm vẽ. Càng cao thì càng mượt nhưng tốn tài nguyên.

📐 Phạm vi:
- xMin, xMax, yMin, yMax: Khoảng giá trị vẽ.
- step: bước lưới (dùng trong grid).

🧮 Vẽ đồ thị:
- Vẽ đồ thị từ công thức gốc đã nhập.

🧮 Tính đạo hàm:
- Tự động tính ∂z/∂x, ∂z/∂y, ∂²z/∂x², ∂²z/∂y², ∂²z/∂x∂y.
- Kết quả hiện trong hộp bên dưới.

✏️ Vẽ các đạo hàm:
- ∂z/∂x: Vẽ đạo hàm theo x.
- ∂z/∂y: Vẽ đạo hàm theo y.
- ∂²z/∂x², ∂²z/∂y²: Vẽ đạo hàm bậc 2.
- ∂²z/∂x∂y: Vẽ đạo hàm hỗn hợp.

👉 Quy trình gợi ý:
1. Nhập công thức z = f(x,y).
2. Nhấn "🧮 Tính đạo hàm".
3. Chọn các nút ∂ để vẽ đạo hàm tương ứng.
`
  );
};

// Thêm nút vào GUI
guiDerivative.add(derivativeParams, "help").name("❓ Trợ giúp");

function computeDerivatives() {
  const expr = derivativeParams.formula.replace(/^z\s*=\s*/, "");
  try {
    const dz_dx = math.derivative(expr, "x").toString();
    const dz_dy = math.derivative(expr, "y").toString();
    const d2z_dx2 = math.derivative(dz_dx, "x").toString();
    const d2z_dy2 = math.derivative(dz_dy, "y").toString();
    const d2z_dxdy = math.derivative(dz_dx, "y").toString();
    const differential = `dz = (${dz_dx}) dx + (${dz_dy}) dy`;

    derivatives = {
      dx: dz_dx,
      dy: dz_dy,
      dx2: d2z_dx2,
      dy2: d2z_dy2,
      dxdy: d2z_dxdy,
    };

    derivativeParams.derivativeText = `
∂z/∂x = ${dz_dx}
∂z/∂y = ${dz_dy}
∂²z/∂x² = ${d2z_dx2}
∂²z/∂y² = ${d2z_dy2}
∂²z/∂x∂y = ${d2z_dxdy}

${differential}
`.trim();
  } catch (err) {
    derivativeParams.derivativeText =
      "❌ Lỗi công thức hoặc không thể tính đạo hàm.";
  }
}

function plotDerivative(key) {
  const formula = derivatives[key];
  if (!formula) {
    showTempLabel(
      "❗ Vui lòng nhấn 'Tính Đạo Hàm' trước",
      new THREE.Vector3(0, 0, 0),
      "#ff4444"
    );
    return;
  }

  plotSurface({
    formula: "z = " + formula, // 👈 truyền đạo hàm vào luôn
    mode: derivativeParams.mode,
    resolution: derivativeParams.resolution,
    xMin: derivativeParams.xMin,
    xMax: derivativeParams.xMax,
    yMin: derivativeParams.yMin,
    yMax: derivativeParams.yMax,
  });
}

// ----- Đồ thị cực -----
const polarParams = {
  // cho polar
  formula: "theta",
  sampleFormula: "",
  drawPolar: () => plotPolar(),

  // cho 3D
  xFormula: "cos(t)",
  yFormula: "sin(t)",
  zFormula: "t",
  sample3D: "",
  drawCustom: () => plotCustom3D(),

  tMin: 0,
  tMax: 10,
  step: 0.1,
};

// Các công thức mẫu r = f(θ)
const polarSamples = {
  "r = θ": "theta",
  "r = 3θ": "3 * theta",
  "r = √θ": "sqrt(theta)",
  "r = θ * sin(θ)": "theta * sin(theta)",
  "r = 10 * sin(3θ)": "10 * sin(3 * theta)",
  "r = 5 + 2 * cos(4θ)": "5 + 2 * cos(4 * theta)",
  "r = |4 * sin(2θ)|": "abs(4 * sin(2 * theta))",
  "r = √|cos(2θ)|": "sqrt(abs(cos(2 * theta)))",
  "Cardioid ❤️": "1 - sin(theta)",
  "Cardioid 💙": "1 + cos(theta)",
  "Hoa 5 cánh 🌸": "5 * sin(5 * theta)",
  "Hoa 7 cánh 🌼": "7 * cos(7 * theta)",
  "Euler Special":
    "exp(cos(theta)) - 2 * cos(4 * theta) + pow(sin(theta/12), 5)",
};

// Các công thức mẫu 3D
const polarSamples3D = {
  Helix: "x = cos(t); y = sin(t); z = t",
  "Parabol 3D": "x = t; y = t^2; z = t^3",
  "Sine + Cosine Wave": "x = t; y = sin(t); z = cos(t)",
  "Spiral Xoắn": "x = 10 * sin(t); y = 10 * cos(t); z = 0.5 * t",
  "Lissajous 3D": "x = sin(2*t); y = cos(3*t); z = sin(t)",
  "Archimedean Spiral": "x = t * cos(t); y = t * sin(t); z = t",
  "Hình trứng 3D": "x = sin(t) * cos(t); y = cos(t); z = sin(t)",
  "Bó hoa xoắn": "x = sin(t) * sqrt(abs(t)); y = cos(t) * sqrt(abs(t)); z = t",
};

// ---- GUI ----
const guiPolar = guiHelper.addTab("Đồ thị cực", 350, {
  icon: "🌀",
  label: "Đồ thị cực",
});

// Công thức r = f(θ)
// Tạo controller riêng để có thể update lại giao diện
const formulaCtrl = guiPolar
  .add(polarParams, "formula")
  .name("Công thức r=f(θ)");

guiPolar
  .add(polarParams, "sampleFormula", Object.keys(polarSamples))
  .name("📌 Chọn mẫu")
  .onChange((v) => {
    polarParams.formula = polarSamples[v];
    formulaCtrl.updateDisplay(); // ✅ cập nhật lại GUI input
  });

guiPolar.add(polarParams, "drawPolar").name("📈 Vẽ đồ thị cực");

// Công thức 3D
const f3D = guiPolar.addFolder("🌀 Đồ thị tham số 3D");

const xCtrl = f3D.add(polarParams, "xFormula").name("x(t) = ");
const yCtrl = f3D.add(polarParams, "yFormula").name("y(t) = ");
const zCtrl = f3D.add(polarParams, "zFormula").name("z(t) = ");

f3D
  .add(polarParams, "sample3D", Object.keys(polarSamples3D))
  .name("📌 Mẫu 3D")
  .onChange((v) => {
    const formula = polarSamples3D[v];
    const parts = formula.split(";");
    polarParams.xFormula = parts[0].split("=")[1].trim();
    polarParams.yFormula = parts[1].split("=")[1].trim();
    polarParams.zFormula = parts[2].split("=")[1].trim();

    // ✅ update lại giao diện
    xCtrl.updateDisplay();
    yCtrl.updateDisplay();
    zCtrl.updateDisplay();
  });

f3D.add(polarParams, "tMin", -50, 0, 1).name("t Min");
f3D.add(polarParams, "tMax", 1, 100, 1).name("t Max");
f3D.add(polarParams, "step", 0.01, 1, 0.01).name("Bước Δt");
f3D.add(polarParams, "drawCustom").name("🎨 Vẽ đồ thị 3D");
// ----- Thêm nút Trợ giúp -----
polarParams.help = () => {
  alert(
    `📖 Hướng dẫn sử dụng tab Đồ thị cực:

📌 Đồ thị cực r = f(θ):
- Nhập công thức r(θ) vào ô "Công thức r=f(θ)".
- Có thể chọn công thức mẫu ở "📌 Chọn mẫu".
- Nhấn "📈 Vẽ đồ thị cực" để hiển thị.

🌀 Đồ thị tham số 3D:
- Nhập công thức x(t), y(t), z(t) vào các ô tương ứng.
- Có thể chọn công thức mẫu ở "📌 Mẫu 3D" để điền nhanh.
- Điều chỉnh miền giá trị của t bằng "t Min", "t Max" và bước "Δt".
- Nhấn "🎨 Vẽ đồ thị 3D" để hiển thị.

⚙️ Lưu ý:
- Hỗ trợ các hàm toán học: sin, cos, tan, sqrt, abs, exp, pow...
- Có thể dùng biến θ (theta) cho đồ thị cực, hoặc biến t cho đồ thị tham số 3D.
- Nếu công thức không hợp lệ hoặc thiếu điểm, hệ thống sẽ báo lỗi.

👉 Bạn có thể kết hợp nhiều đồ thị để quan sát và so sánh trực quan.
`
  );
};

// Gắn vào GUI
guiPolar.add(polarParams, "help").name("❓ Trợ giúp");

// --- Vẽ đồ thị cực r = f(θ) ---
let lastPolarGraph = null;

function plotPolar() {
  // Xoá đồ thị cũ
  if (lastPolarGraph) {
    worldGroup.remove(lastPolarGraph);
    lastPolarGraph.geometry.dispose();
    lastPolarGraph.material.dispose();
    lastPolarGraph = null;
  }

  let expr;
  try {
    expr = math.compile(polarParams.formula);
  } catch (e) {
    showTempLabel(
      "❌ Công thức không hợp lệ",
      new THREE.Vector3(0, 0, 0),
      "#ff4444"
    );
    return;
  }

  const points = [];
  for (let i = 0; i <= 1000; i++) {
    const theta = (i / 1000) * Math.PI * 2;
    let r = 0;
    try {
      r = expr.evaluate({ theta });
    } catch (e) {}
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    points.push(new THREE.Vector3(x, 0, y));
  }
  if (points.length < 2) {
    showTempLabel(
      "⚠️ Không đủ điểm polar",
      new THREE.Vector3(0, 0, 0),
      "#ffaa00"
    );
    return;
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0xff9933 });
  const polarCurve = new THREE.Line(geometry, material);

  worldGroup.add(polarCurve);
  lastPolarGraph = polarCurve;

  // Trong plotCustom3D()
  if (points.length > 0) {
    moveCameraTo(points);
  }
}

// --- Vẽ đồ thị tham số 3D ---
let customCurve = null;

function plotCustom3D() {
  let fx, fy, fz;
  try {
    fx = math.compile(polarParams.xFormula);
    fy = math.compile(polarParams.yFormula);
    fz = math.compile(polarParams.zFormula);
  } catch (e) {
    showTempLabel(
      "❌ Công thức 3D không hợp lệ",
      new THREE.Vector3(0, 0, 0),
      "#ff4444"
    );
    return;
  }

  if (customCurve) {
    worldGroup.remove(customCurve);
    customCurve.geometry.dispose();
    customCurve.material.dispose();
    customCurve = null;
  }

  const points = [];
  for (let t = polarParams.tMin; t <= polarParams.tMax; t += polarParams.step) {
    const ctx = { t, theta: t, u: t, v: t };
    try {
      const x = fx.evaluate(ctx);
      const y = fy.evaluate(ctx);
      const z = fz.evaluate(ctx);
      if (isFinite(x) && isFinite(y) && isFinite(z)) {
        points.push(new THREE.Vector3(x, y, z));
      }
    } catch {}
  }

  if (points.length < 2) {
    showTempLabel(
      "⚠️ Không đủ điểm để vẽ đường cong 3D",
      new THREE.Vector3(0, 0, 0),
      "#ffaa00"
    );
    return;
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color: 0xff44aa });
  customCurve = new THREE.Line(geometry, material);
  worldGroup.add(customCurve);

  if (points.length > 0) {
    moveCameraTo(points);
  }
}

// ===== Tab GUI vẽ minh họa bằng click chuột =====
// ===== Thêm điểm =====
const drawParams = {
  points: [],
  lines: [],
  selectedPoints: [],
  selectedLines: [],

  addPoint: (x = null, y = null, z = null) => {
    x = x ?? (Math.random() - 0.5) * 50;
    y = y ?? (Math.random() - 0.5) * 50;
    z = z ?? (Math.random() - 0.5) * 50;

    const geometry = new THREE.SphereGeometry(0.5, 16, 16);
    const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(x, y, z);
    worldGroup.add(sphere);

    const label = String.fromCharCode(65 + drawParams.points.length); // A, B, C...
    const labelSprite = createLabelSprite(label, "#ff0000");
    labelSprite.position.copy(
      sphere.position.clone().add(new THREE.Vector3(0, 3, 0))
    );

    const pointObj = { x, y, z, mesh: sphere, label, labelSprite };
    drawParams.points.push(pointObj);

    // GUI điểm
    const f = guiDraw.addFolder(`Điểm ${label}`);
    f.add(pointObj, "x", -100, 100, 0.1)
      .name("X")
      .onChange((val) => {
        pointObj.mesh.position.x = val;
        pointObj.labelSprite.position.copy(
          pointObj.mesh.position.clone().add(new THREE.Vector3(0, 3, 0))
        );
        updateLinesConnected(pointObj);
      });
    f.add(pointObj, "y", -100, 100, 0.1)
      .name("Y")
      .onChange((val) => {
        pointObj.mesh.position.y = val;
        pointObj.labelSprite.position.copy(
          pointObj.mesh.position.clone().add(new THREE.Vector3(0, 3, 0))
        );
        updateLinesConnected(pointObj);
      });
    f.add(pointObj, "z", -100, 100, 0.1)
      .name("Z")
      .onChange((val) => {
        pointObj.mesh.position.z = val;
        pointObj.labelSprite.position.copy(
          pointObj.mesh.position.clone().add(new THREE.Vector3(0, 3, 0))
        );
        updateLinesConnected(pointObj);
      });

    f.open();
  },

  connectSelected: () => {
    if (drawParams.selectedPoints.length < 2) return;
    const p1 = drawParams.selectedPoints[0];
    const p2 = drawParams.selectedPoints[1];

    const geometry = new THREE.BufferGeometry().setFromPoints([
      p1.mesh.position.clone(),
      p2.mesh.position.clone(),
    ]);
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    const lineMesh = new THREE.Line(geometry, material);
    worldGroup.add(lineMesh);

    const label = `${p1.label}${p2.label}`;
    const initialLength = p1.mesh.position.distanceTo(p2.mesh.position);
    const lengthSprite = createLabelSprite(initialLength.toFixed(2), "#00aa00");
    lengthSprite.position.copy(
      new THREE.Vector3()
        .addVectors(p1.mesh.position, p2.mesh.position)
        .multiplyScalar(0.5)
    );

    const lineObj = {
      line: lineMesh,
      p1,
      p2,
      _length: initialLength,
      label,
      lengthSprite,
      angleSprite: null,
    };
    drawParams.lines.push(lineObj);
    updateEdgeListGUI();
    // GUI đường
    const fLine = guiDraw.addFolder(`Đường ${label}`);
    fLine
      .add(lineObj, "_length", 0, 200, 0.1)
      .name("Chiều dài")
      .listen()
      .onChange((val) => {
        const dir = new THREE.Vector3()
          .subVectors(lineObj.p2.mesh.position, lineObj.p1.mesh.position)
          .normalize();
        lineObj.p2.mesh.position.copy(
          lineObj.p1.mesh.position.clone().add(dir.multiplyScalar(val))
        );
        updateLineGeometry(lineObj);
        updateAngles();
      });

    lineObj.angleGUI = fLine
      .add({ angle: 0 }, "angle")
      .name("Góc (°)")
      .listen();
    fLine.open();

    drawParams.selectedPoints.forEach((p) =>
      p.mesh.material.color.set(0xff0000)
    );
    drawParams.selectedPoints = [];
  },

  clearAll: () => {
    drawParams.points.forEach((p) => {
      worldGroup.remove(p.mesh);
      worldGroup.remove(p.labelSprite);
    });
    drawParams.lines.forEach((l) => {
      worldGroup.remove(l.line);
      if (l.lengthSprite) worldGroup.remove(l.lengthSprite);
      if (l.angleSprite) worldGroup.remove(l.angleSprite);
    });
    drawParams.points = [];
    drawParams.lines = [];
    drawParams.selectedPoints = [];
    drawParams.selectedLines = [];
  },

  help: () => {
    alert(`📖 Hướng dẫn:
1. "➕ Thêm điểm": thêm điểm ngẫu nhiên.
2. Click 2 điểm để nối thành đường.
3. GUI điểm: cập nhật vị trí.
4. GUI đường: chỉnh chiều dài, xem góc nếu chọn 2 đường chung 1 điểm.
5. Click đường: chọn (màu vàng).
6. "🗑️ Xóa tất cả": xóa toàn bộ.`);
  },
};

// ===== GUI =====
const guiDraw = guiHelper.addTab("Vẽ minh họa", 350, {
  icon: "✏️",
  label: "Vẽ minh họa",
});
guiDraw.add(drawParams, "addPoint").name("➕ Thêm điểm");
guiDraw.add(drawParams, "clearAll").name("🗑️ Xóa tất cả");
// ===== Thêm trạng thái hiển thị dạng checkbox =====
drawParams.showValues = true; // mặc định hiển thị

// ===== Thêm checkbox trong GUI =====
guiDraw
  .add(drawParams, "showValues")
  .name("Hiển thị giá trị")
  .onChange((val) => {
    // Cập nhật nhãn độ dài và góc
    drawParams.lines.forEach((l) => {
      if (l.lengthSprite) l.lengthSprite.visible = val;
      if (l.angleSprite) l.angleSprite.visible = val;
    });
  });
const edgeTab = guiHelper.addTab("Cạnh", 250, {
  icon: "🛠️",
  label: "Cạnh & Trung điểm",
});
function createPerpendicularPoint(point, lineObj) {
  const p = point.mesh.position;
  const a = lineObj.p1.mesh.position;
  const b = lineObj.p2.mesh.position;

  const ab = new THREE.Vector3().subVectors(b, a);
  const ap = new THREE.Vector3().subVectors(p, a);

  // Chiếu AP lên AB
  const t = ap.dot(ab) / ab.lengthSq();
  const proj = a.clone().add(ab.multiplyScalar(t));

  // Tạo điểm vuông góc
  drawParams.addPoint(proj.x, proj.y, proj.z);

  // Vẽ đường vuông góc từ point đến điểm vuông góc
  const geometry = new THREE.BufferGeometry().setFromPoints([
    p.clone(),
    proj.clone(),
  ]);
  const material = new THREE.LineBasicMaterial({ color: 0xff00ff });
  const line = new THREE.Line(geometry, material);
  worldGroup.add(line);
}

function updateEdgeListGUI() {
  // Xóa folder cũ nếu có
  if (edgeTab.__folders) {
    Object.values(edgeTab.__folders).forEach((f) => edgeTab.removeFolder(f));
  }

  drawParams.lines.forEach((lineObj) => {
    const f = edgeTab.addFolder(`Đường ${lineObj.label}`);

    // Nút tạo trung điểm
    f.add(
      {
        createMidpoint: () => {
          // 1. Lấy vị trí
          const p1Pos = normalizePoint(lineObj.p1);
          const p2Pos = normalizePoint(lineObj.p2);

          // 2. Tính trung điểm
          const midPos = new THREE.Vector3()
            .addVectors(p1Pos, p2Pos)
            .multiplyScalar(0.5);

          // 3. Đặt tên trung điểm (nếu p1/p2 chưa có name thì đặt tạm)
          const p1Name = lineObj.p1?.name || "P1";
          const p2Name = lineObj.p2?.name || "P2";
          const midName = `M_${p1Name}${p2Name}`;

          // 4. Tạo điểm trung điểm (hàm addPoint nên nhận name)
          const midPoint = drawParams.addPoint(
            midPos.x,
            midPos.y,
            midPos.z,
            midName
          );

          // 5. Xóa cạnh cũ
          worldGroup.remove(lineObj.line);
          drawParams.lines = drawParams.lines.filter((l) => l !== lineObj);

          // 6. Hàm tạo line mới
          const makeLine = (p1, p2, label, color = 0x00ff00) => {
            const pos1 = normalizePoint(p1);
            const pos2 = normalizePoint(p2);

            const geometry = new THREE.BufferGeometry().setFromPoints([
              pos1,
              pos2,
            ]);
            const material = new THREE.LineBasicMaterial({ color });
            const lineMesh = new THREE.Line(geometry, material);

            worldGroup.add(lineMesh);

            const newLine = {
              line: lineMesh,
              p1,
              p2,
              _length: pos1.distanceTo(pos2),
              label,
              lengthSprite: null,
              angleSprite: null,
              angleArc: null,
            };

            drawParams.lines.push(newLine);
            updateLineLength(newLine);
            return newLine;
          };

          // 7. Tạo 2 cạnh mới
          const line1 = makeLine(
            lineObj.p1,
            midPoint,
            `${p1Name}${midPoint.name}`
          );
          const line2 = makeLine(
            midPoint,
            lineObj.p2,
            `${midPoint.name}${p2Name}`
          );

          // 8. Ghi log
          historyParams.addEntry(
            `✂️ Chia cạnh ${lineObj.label} thành ${line1.label}, ${line2.label}`
          );

          // 9. Refresh GUI
          updateEdgeListGUI();
        },
      },
      "createMidpoint"
    ).name("Tạo trung điểm");

    f.open();
  });
}
function normalizePoint(p) {
  if (!p) return new THREE.Vector3(0, 0, 0); // fallback nếu undefined
  if (p.mesh) return p.mesh.position.clone(); // nếu là point object
  if (p instanceof THREE.Vector3) return p.clone(); // nếu là Vector3
  if (p.x !== undefined && p.y !== undefined && p.z !== undefined) {
    return new THREE.Vector3(p.x, p.y, p.z); // nếu là object {x,y,z}
  }
  return new THREE.Vector3(0, 0, 0);
}

guiDraw.add(drawParams, "help").name("❓ Trợ giúp");

// ===== Hiển thị tọa độ chuột so với cả 3 trục & tick =====
const coordDiv = document.createElement("div");
coordDiv.style.position = "absolute";
coordDiv.style.bottom = "10px";
coordDiv.style.right = "10px";
coordDiv.style.padding = "6px 12px";
coordDiv.style.background = "rgba(0,0,0,0.6)";
coordDiv.style.color = "yellow";
coordDiv.style.fontFamily = "monospace";
coordDiv.style.fontSize = "14px";
coordDiv.style.borderRadius = "6px";
coordDiv.innerText = "X: 0, Y: 0, Z: 0";
document.body.appendChild(coordDiv);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// === Tick highlight cho cả 3 trục ===
const tickGeometry = new THREE.SphereGeometry(0.3, 16, 16);
const tickMaterials = {
  X: new THREE.MeshBasicMaterial({ color: 0xff0000 }), // đỏ cho X
  Y: new THREE.MeshBasicMaterial({ color: 0x00ff00 }), // xanh lá cho Y
  Z: new THREE.MeshBasicMaterial({ color: 0x0000ff })  // xanh dương cho Z
};

const tickHighlights = {
  X: new THREE.Mesh(tickGeometry, tickMaterials.X),
  Y: new THREE.Mesh(tickGeometry, tickMaterials.Y),
  Z: new THREE.Mesh(tickGeometry, tickMaterials.Z)
};

// === Line dashed từ tick tới vị trí chuột ===
const dashedMaterials = {
  X: new THREE.LineDashedMaterial({ color: 0xff0000, dashSize: 0.5, gapSize: 0.3 }),
  Y: new THREE.LineDashedMaterial({ color: 0x00ff00, dashSize: 0.5, gapSize: 0.3 }),
  Z: new THREE.LineDashedMaterial({ color: 0x0000ff, dashSize: 0.5, gapSize: 0.3 })
};

const dashedLines = {};
Object.keys(tickHighlights).forEach(axis => {
  const points = [new THREE.Vector3(), new THREE.Vector3()];
  const geom = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(geom, dashedMaterials[axis]);
  line.computeLineDistances(); // bắt buộc cho LineDashedMaterial
  line.visible = false;
  dashedLines[axis] = line;

  scene.add(tickHighlights[axis]);
  scene.add(line);
});

// === Mouse move event ===
window.addEventListener("mousemove", (event) => {
  if (!displayParams.coord) {
    Object.values(tickHighlights).forEach(tick => tick.visible = false);
    Object.values(dashedLines).forEach(line => line.visible = false);
    coordDiv.innerText = "X: -, Y: -, Z: -";
    return;
  }

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  // Điểm trong không gian 3D ứng với chuột
  const mousePoint = raycaster.ray.origin.clone()
    .add(raycaster.ray.direction.clone().multiplyScalar(50)); // lấy xa 1 đoạn

  const axes = {
    X: new THREE.Vector3(1, 0, 0),
    Y: new THREE.Vector3(0, 1, 0),
    Z: new THREE.Vector3(0, 0, 1),
  };

  const step = displayParams.step;
  const snapPoints = { X: null, Y: null, Z: null };

  Object.keys(axes).forEach((axisName) => {
    const axisDir = axes[axisName].clone().normalize();
    const p2 = new THREE.Vector3(0, 0, 0);
    const d2 = axisDir;
    const p1 = raycaster.ray.origin;
    const d1 = raycaster.ray.direction.clone().normalize();

    const r = new THREE.Vector3().subVectors(p1, p2);
    const a = d1.dot(d1);
    const b = d1.dot(d2);
    const c = d2.dot(d2);
    const d = d1.dot(r);
    const e = d2.dot(r);

    const denom = a * c - b * b;
    let t2 = 0;
    if (Math.abs(denom) > 1e-6) {
      t2 = (a * e - b * d) / denom;
    }
    const closestPoint = p2.clone().add(d2.clone().multiplyScalar(t2));

    let snapPoint = closestPoint.clone();
    if (axisName === "X") {
      snapPoint.x = Math.round(snapPoint.x / step) * step;
      snapPoint.y = 0;
      snapPoint.z = 0;
    }
    if (axisName === "Y") {
      snapPoint.y = Math.round(snapPoint.y / step) * step;
      snapPoint.x = 0;
      snapPoint.z = 0;
    }
    if (axisName === "Z") {
      snapPoint.z = Math.round(snapPoint.z / step) * step;
      snapPoint.x = 0;
      snapPoint.y = 0;
    }

    snapPoints[axisName] = snapPoint;

    // Tick
    tickHighlights[axisName].visible = true;
    tickHighlights[axisName].position.copy(snapPoint);

    // Line dashed
    const line = dashedLines[axisName];
    const positions = line.geometry.attributes.position.array;
    positions[0] = snapPoint.x;
    positions[1] = snapPoint.y;
    positions[2] = snapPoint.z;
    positions[3] = mousePoint.x;
    positions[4] = mousePoint.y;
    positions[5] = mousePoint.z;
    line.geometry.attributes.position.needsUpdate = true;
    line.computeLineDistances();
    line.visible = true;
  });

  coordDiv.innerText =
    `X: ${snapPoints.X.x.toFixed(2)}, ` +
    `Y: ${snapPoints.Y.y.toFixed(2)}, ` +
    `Z: ${snapPoints.Z.z.toFixed(2)}`;
});


// ===== Hàm tạo nhãn nhỏ hơn =====
function createLabelSprite(text, color = "#000000") {
  // Đo độ dài text để tính canvas
  const fontSize = 14;
  const padding = 20;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  ctx.font = `${fontSize}px Arial`;
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = fontSize;

  canvas.width = textWidth + padding;
  canvas.height = textHeight + padding;

  // Vẽ text
  ctx.font = `${fontSize}px Arial`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(spriteMaterial);

  // Scale: chia cho 10 để nhãn vừa trong worldGroup
  const scaleFactor = 0.1;
  sprite.scale.set(canvas.width * scaleFactor, canvas.height * scaleFactor, 1);

  worldGroup.add(sprite);
  return sprite;
}

// ===== Hàm vẽ cung góc =====
function createAngleArc(shared, other1, other2, radius = 5, segments = 16) {
  const v1 = new THREE.Vector3()
    .subVectors(other1.mesh.position, shared.mesh.position)
    .normalize();
  const v2 = new THREE.Vector3()
    .subVectors(other2.mesh.position, shared.mesh.position)
    .normalize();
  const angle = v1.angleTo(v2);

  const axis = new THREE.Vector3().crossVectors(v1, v2).normalize();
  const arcPoints = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * angle;
    const q = new THREE.Quaternion().setFromAxisAngle(axis, t);
    const point = v1
      .clone()
      .applyQuaternion(q)
      .multiplyScalar(radius)
      .add(shared.mesh.position);
    arcPoints.push(point);
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(arcPoints);
  const material = new THREE.LineBasicMaterial({ color: 0x0000ff });
  const arc = new THREE.Line(geometry, material);
  worldGroup.add(arc);
  return arc;
}

// ===== Cập nhật độ dài đường =====
function updateLineLength(lineObj) {
  const mid = new THREE.Vector3()
    .addVectors(lineObj.p1.mesh.position, lineObj.p2.mesh.position)
    .multiplyScalar(0.5);
  const text = `${lineObj.label} = ${lineObj._length.toFixed(2)}`;
  if (lineObj.lengthSprite) worldGroup.remove(lineObj.lengthSprite);
  lineObj.lengthSprite = createLabelSprite(text, "#00aa00", 64, 2);
  lineObj.lengthSprite.position.copy(mid);
}

// ===== Cập nhật góc và vẽ cung =====
function updateAngles() {
  drawParams.selectedLines.forEach((l) => {
    if (l.angleSprite) worldGroup.remove(l.angleSprite);
    if (l.angleArc) worldGroup.remove(l.angleArc);
  });

  if (drawParams.selectedLines.length === 2) {
    const l1 = drawParams.selectedLines[0];
    const l2 = drawParams.selectedLines[1];
    const pts1 = [l1.p1, l1.p2];
    const pts2 = [l2.p1, l2.p2];
    const shared = pts1.find((p) => pts2.includes(p));
    if (!shared) return;

    const other1 = l1.p1 === shared ? l1.p2 : l1.p1;
    const other2 = l2.p1 === shared ? l2.p2 : l2.p1;

    const v1 = new THREE.Vector3()
      .subVectors(other1.mesh.position, shared.mesh.position)
      .normalize();
    const v2 = new THREE.Vector3()
      .subVectors(other2.mesh.position, shared.mesh.position)
      .normalize();
    const angleDeg = THREE.MathUtils.radToDeg(v1.angleTo(v2));

    // Nhãn góc
    const angleLabel = `${other1.label}${shared.label}${
      other2.label
    } = ${angleDeg.toFixed(1)}°`;
    const midPos = shared.mesh.position
      .clone()
      .add(
        new THREE.Vector3()
          .addVectors(other1.mesh.position, other2.mesh.position)
          .multiplyScalar(0.25)
      );
    l1.angleSprite = createLabelSprite(angleLabel, "#0000ff", 64, 2);
    l1.angleSprite.position.copy(midPos);
    l2.angleSprite = l1.angleSprite;

    // Vẽ cung biểu diễn góc
    l1.angleArc = createAngleArc(shared, other1, other2, 5, 16);
    l2.angleArc = l1.angleArc;

    l1.angleGUI.name(`Góc ${other1.label}${shared.label}${other2.label} (°)`);
    l1.angleGUI.setValue(angleDeg.toFixed(2));
    l2.angleGUI.setValue(angleDeg.toFixed(2));
  }
}

// ===== Cập nhật vị trí nhãn khi di chuyển điểm =====
function updateLinesConnected(point) {
  drawParams.lines.forEach((lineObj) => {
    if (lineObj.p1 === point || lineObj.p2 === point) {
      updateLineGeometry(lineObj);
      lineObj._length = lineObj.p1.mesh.position.distanceTo(
        lineObj.p2.mesh.position
      );
      updateLineLength(lineObj);
    }
  });
  updateAngles();
}

// ===== Cập nhật geometry đường =====
function updateLineGeometry(lineObj) {
  lineObj.line.geometry.setFromPoints([
    lineObj.p1.mesh.position.clone(),
    lineObj.p2.mesh.position.clone(),
  ]);
}

function getPointerPosition(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  let clientX, clientY;

  if (event.touches && event.touches.length > 0) {
    clientX = event.touches[0].clientX;
    clientY = event.touches[0].clientY;
  } else if (event.changedTouches && event.changedTouches.length > 0) {
    clientX = event.changedTouches[0].clientX;
    clientY = event.changedTouches[0].clientY;
  } else {
    clientX = event.clientX;
    clientY = event.clientY;
  }

  return {
    x: ((clientX - rect.left) / rect.width) * 2 - 1,
    y: -((clientY - rect.top) / rect.height) * 2 + 1,
  };
}

function onSelect(event) {
  // Ngăn trình duyệt zoom/scroll khi chạm
  event.preventDefault();

  const pos = getPointerPosition(event);
  mouse.x = pos.x;
  mouse.y = pos.y;

  raycaster.setFromCamera(mouse, camera);

  // ---- Chọn vector (ArrowHelper) ----
  const allArrowMeshes = vectorsHistory.flatMap((v) => v.meshes);
  const intersectsArrow = raycaster.intersectObjects(allArrowMeshes);

  if (intersectsArrow.length > 0) {
    const mesh = intersectsArrow[0].object;
    const vObj = vectorsHistory.find((v) => v.meshes.includes(mesh));

    if (!selectedVectors.includes(vObj)) {
      selectedVectors.push(vObj);
      vObj.arrow.setColor(new THREE.Color(0xffff00));
    } else {
      selectedVectors = selectedVectors.filter((v) => v !== vObj);
      vObj.arrow.setColor(new THREE.Color(0x00ff00));
    }
    return;
  }

  // ---- Chọn điểm ----
  const intersectsPoint = raycaster.intersectObjects(
    drawParams.points.map((p) => p.mesh)
  );
  if (intersectsPoint.length > 0) {
    const mesh = intersectsPoint[0].object;
    const p = drawParams.points.find((p) => p.mesh === mesh);
    if (!drawParams.selectedPoints.includes(p)) {
      drawParams.selectedPoints.push(p);
      mesh.material.color.set(0x0000ff);
    } else {
      drawParams.selectedPoints = drawParams.selectedPoints.filter(
        (pt) => pt !== p
      );
      mesh.material.color.set(0xff3333);
    }
    if (drawParams.selectedPoints.length === 2) drawParams.connectSelected();
    return;
  }

  // ---- Chọn đường ----
  const intersectsLine = raycaster.intersectObjects(
    drawParams.lines.map((l) => l.line)
  );
  if (intersectsLine.length > 0) {
    const mesh = intersectsLine[0].object;
    const lineObj = drawParams.lines.find((l) => l.line === mesh);
    if (!drawParams.selectedLines.includes(lineObj)) {
      drawParams.selectedLines.push(lineObj);
      mesh.material.color.set(0xffff00);
    } else {
      drawParams.selectedLines = drawParams.selectedLines.filter(
        (l) => l !== lineObj
      );
      mesh.material.color.set(0x00ff00);
    }
    updateAngles();
    return;
  }

  // ---- Chọn cạnh bất kỳ trong Shape ----
  const intersectsEdge = raycaster.intersectObjects(shapeEdges);
  if (intersectsEdge.length > 0) {
    const edgeLine = intersectsEdge[0].object;
    if (edgeLine.userData.type === "shapeEdge") {
      selectedEdge = edgeLine;
      shapeEdges.forEach((e) => e.material.color.set(0x000000));
      edgeLine.material.color.set(0xff0000);

      historyParams.addEntry(
        `🔹 Đã chọn cạnh từ ${edgeLine.userData.edge.a.toArray()} → ${edgeLine.userData.edge.b.toArray()}`
      );
      return;
    }
  }

  // ---- Nếu click ra ngoài: bỏ chọn hết ----
  selectedVectors.forEach((v) => v.arrow.setColor(new THREE.Color(0x00ff00)));
  selectedVectors = [];

  drawParams.selectedPoints.forEach((p) => p.mesh.material.color.set(0xff3333));
  drawParams.selectedPoints = [];

  drawParams.selectedLines.forEach((l) => l.line.material.color.set(0x00ff00));
  drawParams.selectedLines = [];

  // Bỏ chọn cạnh hình
  if (selectedEdge) {
    shapeEdges.forEach((e) => e.material.color.set(0x000000)); // reset tất cả cạnh về màu mặc định
    selectedEdge = null;
  }

  updateAngles();
}

// ===== Gắn event cho cả chuột & cảm ứng =====
renderer.domElement.addEventListener("click", onSelect);
renderer.domElement.addEventListener("touchend", onSelect, { passive: false });

// ================== SHAPE MODULE ==================
let selectedEdge = null;
let shapeMesh;
let shapeEdges = [];
let shapeMeshFaces = []; // Lưu các mặt riêng lẻ của khối để explode/implode

// Các tham số chung
const shapeParams = {
  type: "pyramid", // Loại hình khối
  n: 4, // số cạnh đáy (pyramid, prism)
  radius: 2, // bán kính (pyramid, prism, cone, sphere)
  height: 3, // chiều cao (pyramid, prism, cone, cylinder)
  tiltX: 0, // nghiêng theo trục X
  tiltY: 0, // nghiêng theo trục Y
  splitRatio: "1:1", // mặc định
  splitEdgeRatio: () => {
    if (!selectedEdge) {
      showTempLabel(
        "⚠️ Hãy chọn một cạnh trước!",
        new THREE.Vector3(0, 0, 0),
        "#ff4444"
      );
      return;
    }

    const { a, b } = selectedEdge.userData.edge;

    const [p1, p2] = shapeParams.splitRatio.split(":").map(Number);
    const total = p1 + p2;
    const t = p1 / total;

    const pos = new THREE.Vector3().lerpVectors(a, b, t);

    const geom = new THREE.SphereGeometry(0.1, 16, 16);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff00ff });
    const sphere = new THREE.Mesh(geom, mat);
    sphere.position.copy(pos);
    worldGroup.add(sphere);

    createLabel(
      `${p1}:${p2}`,
      pos,
      "#ff00ff",
      new THREE.Vector3(0.1, 0.1, 0.2),
      "shape"
    );
    historyParams.addEntry(`✂️ Chia cạnh theo tỉ lệ ${p1}:${p2}`);
  },

  explode: false,
  draw: () => drawShape(),
};

// GUI
const guiShape = guiHelper.addTab("Shapes", 250, {
  icon: "📐",
  label: "Khối 3D",
});

guiShape
  .add(shapeParams, "type", [
    "pyramid",
    "prism",
    "cube",
    "cylinder",
    "cone",
    "sphere",
    "torus",
    "frustum",
    "octahedron",
    "dodecahedron",
    "icosahedron",
  ])
  .name("Loại hình");

guiShape.add(shapeParams, "n", 3, 30, 1).name("Số cạnh đáy");
guiShape.add(shapeParams, "radius", 1, 50, 0.1).name("Bán kính");
guiShape.add(shapeParams, "height", 1, 50, 0.1).name("Chiều cao");
guiShape.add(shapeParams, "tiltX", -50, 50, 0.1).name("Nghiêng X");
guiShape.add(shapeParams, "tiltY", -50, 50, 0.1).name("Nghiêng Y");
guiShape.add(shapeParams, "draw").name("🏗️ Vẽ hình");
guiShape
  .add(shapeParams, "explode")
  .name("💥 Explode View")
  .onChange((val) => {
    if (shapeMeshFaces.length > 0) applyExplode(val ? 1 : 0);
  });
guiShape.add(shapeParams, "splitRatio").name("Tỉ lệ (a:b)");
guiShape.add(shapeParams, "splitEdgeRatio").name("✂️ Chia theo tỉ lệ");

// Hàm tổng
function drawShape() {
  const { type } = shapeParams;

  if (shapeMesh) worldGroup.remove(shapeMesh);
  shapeEdges.forEach((e) => worldGroup.remove(e));
  shapeEdges = [];
  shapeMeshFaces.forEach((f) => worldGroup.remove(f));
  shapeMeshFaces = [];
  clearLabels("shape");
  switch (type) {
    case "pyramid":
      drawPyramid();
      break;
    case "prism":
      drawPrism();
      break;
    case "cube":
      drawCube();
      break;
    case "cylinder":
      drawCylinder();
      break;
    case "cone":
      drawCone();
      break;
    case "sphere":
      drawSphere();
      break;
    case "torus":
      drawTorus();
      break;
    case "frustum":
      drawFrustum();
      break;
    case "octahedron":
      drawOctahedron();
      break;
    case "dodecahedron":
      drawDodecahedron();
      break;
    case "icosahedron":
      drawIcosahedron();
      break;
  }

  // Zoom camera (giữ nguyên phần bạn viết)
  if (shapeMesh) {
    const box = new THREE.Box3().setFromObject(shapeMesh);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.2;

    camera.position.set(center.x, center.y, center.z + cameraZ);
    camera.lookAt(center);

    if (controls) {
      controls.target.copy(center);
      controls.update();
    }
  }
}

// ---- Cylinder ----
function drawCylinder() {
  const { radius, height } = shapeParams;
  shapeMeshFaces.forEach((f) => worldGroup.remove(f));
  shapeMeshFaces = [];

  const geom = new THREE.CylinderGeometry(radius, radius, height, 32, 1, false);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x99ff99,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  });
  shapeMesh = new THREE.Mesh(geom, mat);
  worldGroup.add(shapeMesh);

  historyParams.addEntry("🟢 Cylinder");

  if (shapeParams.explode) applyExplode(shapeParams.explode);
}

// ---- Cone ----
function drawCone() {
  const { radius, height } = shapeParams;
  shapeMeshFaces.forEach((f) => worldGroup.remove(f));
  shapeMeshFaces = [];

  const geom = new THREE.ConeGeometry(radius, height, 32);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xff9999,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  });
  shapeMesh = new THREE.Mesh(geom, mat);
  worldGroup.add(shapeMesh);

  historyParams.addEntry("🔺 Cone");

  if (shapeParams.explode) applyExplode(shapeParams.explode);
}

// ---- Sphere ----
function drawSphere() {
  const { radius } = shapeParams;
  shapeMeshFaces.forEach((f) => worldGroup.remove(f));
  shapeMeshFaces = [];

  const geom = new THREE.SphereGeometry(radius, 32, 16);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffff66,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  });
  shapeMesh = new THREE.Mesh(geom, mat);
  worldGroup.add(shapeMesh);

  historyParams.addEntry("🟡 Sphere");

  if (shapeParams.explode) applyExplode(shapeParams.explode);
}

// ---- Torus ----
function drawTorus() {
  const { radius } = shapeParams;
  shapeMeshFaces.forEach((f) => worldGroup.remove(f));
  shapeMeshFaces = [];

  const geom = new THREE.TorusGeometry(radius, radius / 3, 16, 100);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xcc99ff,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  });
  shapeMesh = new THREE.Mesh(geom, mat);
  worldGroup.add(shapeMesh);

  historyParams.addEntry("🟣 Torus");

  if (shapeParams.explode) applyExplode(shapeParams.explode);
}

// ---- Frustum (chóp cụt) ----
function drawFrustum() {
  const { radius, height } = shapeParams;
  shapeMeshFaces.forEach((f) => worldGroup.remove(f));
  shapeMeshFaces = [];

  const geom = new THREE.CylinderGeometry(
    radius,
    radius / 2,
    height,
    32,
    1,
    false
  );
  const mat = new THREE.MeshStandardMaterial({
    color: 0xff9966,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  });
  shapeMesh = new THREE.Mesh(geom, mat);
  worldGroup.add(shapeMesh);

  historyParams.addEntry("🟠 Frustum");

  if (shapeParams.explode) applyExplode(shapeParams.explode);
}

// ---- Octahedron (n-gon base) ----
function drawOctahedron() {
  const { n, radius, height, tiltX, tiltY } = shapeParams;

  // Xóa khối cũ nếu có
  shapeMeshFaces.forEach((f) => worldGroup.remove(f));
  if (shapeMesh) {
    worldGroup.remove(shapeMesh);
    shapeMesh = null;
  }
  shapeMeshFaces = [];

  const basePoints = [];
  const baseLabels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"; // nhãn cho đa giác

  // --- Tạo đa giác đều n cạnh ---
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const p = new THREE.Vector3(
      radius * Math.cos(angle),
      radius * Math.sin(angle),
      0
    );
    basePoints.push(p);
    createLabel(
      baseLabels[i % baseLabels.length],
      p,
      "#ff0000",
      new THREE.Vector3(0.1, 0.1, 0.2),
      "shape"
    ); // 👈 tag shape
  }

  // --- Tạo 2 đỉnh S và S' ---
  const top = new THREE.Vector3(tiltX, tiltY, height / 2);
  const bottom = new THREE.Vector3(-tiltX, -tiltY, -height / 2);
  createLabel("S", top, "#ff0000", new THREE.Vector3(0.1, 0.1, 0.2), "shape"); // 👈 tag shape
  createLabel(
    "S'",
    bottom,
    "#ff0000",
    new THREE.Vector3(0.1, 0.1, 0.2),
    "shape"
  );

  // Gom tất cả mặt vào group
  const group = new THREE.Group();

  // --- Mặt trên nối S với đa giác ---
  for (let i = 0; i < n; i++) {
    const p1 = basePoints[i];
    const p2 = basePoints[(i + 1) % n];

    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [...top.toArray(), ...p1.toArray(), ...p2.toArray()],
        3
      )
    );
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x66ffff,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geom, mat);

    // Tính tâm mặt
    const center = new THREE.Vector3()
      .addVectors(top, p1)
      .add(p2)
      .divideScalar(3);
    mesh.userData.center = center;

    group.add(mesh);
    shapeMeshFaces.push(mesh);
  }

  // --- Mặt dưới nối S' với đa giác ---
  for (let i = 0; i < n; i++) {
    const p1 = basePoints[i];
    const p2 = basePoints[(i + 1) % n];

    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [...bottom.toArray(), ...p2.toArray(), ...p1.toArray()], // đảo ngược
        3
      )
    );
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x66ffff,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geom, mat);

    // Tính tâm mặt
    const center = new THREE.Vector3()
      .addVectors(bottom, p1)
      .add(p2)
      .divideScalar(3);
    mesh.userData.center = center;

    group.add(mesh);
    shapeMeshFaces.push(mesh);
  }

  worldGroup.add(group);
  shapeMesh = group; // 👈 gán để drawShape() zoom được

  // --- Cạnh ---
  const allEdges = [];
  for (let i = 0; i < n; i++) {
    const p1 = basePoints[i];
    const p2 = basePoints[(i + 1) % n];
    allEdges.push([p1, p2]); // cạnh đa giác
    allEdges.push([top, p1]); // cạnh trên
    allEdges.push([bottom, p1]); // cạnh dưới
  }
  addEdges(allEdges);

  historyParams.addEntry(`🔷 Octahedron ${n}-cạnh với tilt và height`);

  // Nếu đã bật explode, áp dụng luôn
  if (shapeParams.explode) applyExplode(shapeParams.explode);
}

// ---- Dodecahedron ----
function drawDodecahedron() {
  const { radius } = shapeParams;
  shapeMeshFaces.forEach((f) => worldGroup.remove(f));
  shapeMeshFaces = [];

  const geom = new THREE.DodecahedronGeometry(radius);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffccff,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  });
  shapeMesh = new THREE.Mesh(geom, mat);
  worldGroup.add(shapeMesh);

  historyParams.addEntry("💠 Dodecahedron");

  if (shapeParams.explode) applyExplode(shapeParams.explode);
}

// ---- Icosahedron ----
function drawIcosahedron() {
  const { radius } = shapeParams;
  shapeMeshFaces.forEach((f) => worldGroup.remove(f));
  shapeMeshFaces = [];

  const geom = new THREE.IcosahedronGeometry(radius);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x99ffcc,
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
  });
  shapeMesh = new THREE.Mesh(geom, mat);
  worldGroup.add(shapeMesh);

  historyParams.addEntry("🔺 Icosahedron");

  if (shapeParams.explode) applyExplode(shapeParams.explode);
}

// ---- Pyramid ----
// ---- Pyramid ----
function drawPyramid() {
  const { n, radius, height, tiltX, tiltY } = shapeParams;
  const basePoints = [];
  const baseLabels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"; // nhãn đáy

  // Xóa mặt cũ nếu có
  shapeMeshFaces.forEach((f) => worldGroup.remove(f));
  if (shapeMesh) {
    worldGroup.remove(shapeMesh);
    shapeMesh = null;
  }
  shapeMeshFaces = [];

  // Tạo điểm đáy
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const p = new THREE.Vector3(
      radius * Math.cos(angle),
      radius * Math.sin(angle),
      0
    );
    basePoints.push(p);
    createLabel(
      baseLabels[i],
      p,
      "#ff0000",
      new THREE.Vector3(0.1, 0.1, 0.2),
      "shape"
    ); // 👈 thêm tag "shape"
  }

  const apex = new THREE.Vector3(tiltX, tiltY, height);
  createLabel("S", apex, "#ff0000", new THREE.Vector3(0.1, 0.1, 0.2), "shape"); // 👈 thêm tag "shape"

  // --- Tạo từng mặt bên ---
  for (let i = 0; i < n; i++) {
    const p1 = basePoints[i];
    const p2 = basePoints[(i + 1) % n];
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [...apex.toArray(), ...p1.toArray(), ...p2.toArray()],
        3
      )
    );
    geom.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.userData.center = new THREE.Vector3()
      .addVectors(apex, p1)
      .add(p2)
      .divideScalar(3);
    worldGroup.add(mesh);
    shapeMeshFaces.push(mesh);
  }

  // --- Tạo mặt đáy ---
  for (let i = 1; i < n - 1; i++) {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [
          ...basePoints[0].toArray(),
          ...basePoints[i].toArray(),
          ...basePoints[i + 1].toArray(),
        ],
        3
      )
    );
    geom.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geom, mat);
    const center = new THREE.Vector3()
      .add(basePoints[0])
      .add(basePoints[i])
      .add(basePoints[i + 1])
      .divideScalar(3);
    mesh.userData.center = center;
    worldGroup.add(mesh);
    shapeMeshFaces.push(mesh);
  }

  // Cạnh
  const allEdges = [];
  basePoints.forEach((p, i) => {
    const next = basePoints[(i + 1) % n];
    allEdges.push([p, next]); // đáy
    allEdges.push([apex, p]); // cạnh bên
  });
  addEdges(allEdges);

  historyParams.addEntry(`🔺 Pyramid ${n} cạnh đáy với nghiêng`);

  // Gom tất cả mặt vào một group để gán cho shapeMesh
  const group = new THREE.Group();
  shapeMeshFaces.forEach((f) => group.add(f));
  worldGroup.add(group);
  shapeMesh = group;

  // Nếu đã bật explode, áp dụng luôn
  if (shapeParams.explode) applyExplode(shapeParams.explode);
}

// ---- Prism ----
function drawPrism() {
  const { n, radius, height, tiltX, tiltY } = shapeParams;
  const baseBottom = [],
    baseTop = [];

  // Xóa mặt cũ nếu có
  shapeMeshFaces.forEach((f) => worldGroup.remove(f));
  if (shapeMesh) {
    worldGroup.remove(shapeMesh);
    shapeMesh = null;
  }
  shapeMeshFaces = [];

  // Tạo nhãn
  const bottomLabels = [];
  const topLabels = [];
  for (let i = 0; i < n; i++) {
    bottomLabels.push(String.fromCharCode(65 + i)); // A,B,C...
    topLabels.push(String.fromCharCode(65 + i) + "'"); // A',B',C'...
  }

  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const bottom = new THREE.Vector3(
      radius * Math.cos(angle),
      radius * Math.sin(angle),
      0
    );
    const top = new THREE.Vector3(
      radius * Math.cos(angle) + tiltX,
      radius * Math.sin(angle) + tiltY,
      height
    );
    baseBottom.push(bottom);
    baseTop.push(top);

    createLabel(
      bottomLabels[i],
      bottom,
      "#ff0000",
      new THREE.Vector3(0.1, 0.1, 0.2),
      "shape"
    ); // 👈 thêm tag
    createLabel(
      topLabels[i],
      top,
      "#ff0000",
      new THREE.Vector3(0.1, 0.1, 0.2),
      "shape"
    ); // 👈 thêm tag
  }

  // --- Tạo mặt riêng ---
  const faces = [];

  // Mặt bên
  for (let i = 0; i < n; i++) {
    const p1 = baseBottom[i];
    const p2 = baseBottom[(i + 1) % n];
    const p3 = baseTop[(i + 1) % n];
    const p4 = baseTop[i];
    faces.push([p1, p2, p3, p4]);
  }

  // Mặt đáy
  for (let i = 1; i < n - 1; i++) {
    faces.push([baseBottom[0], baseBottom[i], baseBottom[i + 1]]);
  }

  // Mặt trên
  for (let i = 1; i < n - 1; i++) {
    faces.push([baseTop[0], baseTop[i + 1], baseTop[i]]);
  }

  faces.forEach((fVerts) => {
    const geom = new THREE.BufferGeometry();
    const vArray = [];

    if (fVerts.length === 4) {
      vArray.push(
        ...fVerts[0].toArray(),
        ...fVerts[1].toArray(),
        ...fVerts[2].toArray()
      );
      vArray.push(
        ...fVerts[0].toArray(),
        ...fVerts[2].toArray(),
        ...fVerts[3].toArray()
      );
    } else {
      vArray.push(
        ...fVerts[0].toArray(),
        ...fVerts[1].toArray(),
        ...fVerts[2].toArray()
      );
    }

    geom.setAttribute("position", new THREE.Float32BufferAttribute(vArray, 3));
    geom.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geom, mat);

    // Tính tâm mặt cho explode
    const center = new THREE.Vector3();
    fVerts.forEach((v) => center.add(v));
    center.divideScalar(fVerts.length);
    mesh.userData.center = center;

    worldGroup.add(mesh);
    shapeMeshFaces.push(mesh);
  });

  // Cạnh
  const edges = [];
  for (let i = 0; i < n; i++) {
    edges.push([baseTop[i], baseTop[(i + 1) % n]]);
    edges.push([baseBottom[i], baseBottom[(i + 1) % n]]);
    edges.push([baseTop[i], baseBottom[i]]);
  }
  addEdges(edges);

  historyParams.addEntry(
    `🔶 Lăng trụ ${n} cạnh đáy với nghiêng và nhãn hình học`
  );

  // Gom tất cả mặt vào một group để gán cho shapeMesh
  const group = new THREE.Group();
  shapeMeshFaces.forEach((f) => group.add(f));
  worldGroup.add(group);
  shapeMesh = group;

  // Nếu explode đang bật, áp dụng ngay
  if (shapeParams.explode) applyExplode(shapeParams.explode);
}

// ---- Cube ----
function drawCube() {
  const { radius, tiltX, tiltY } = shapeParams;
  const half = radius;
  const bottomZ = 0;
  const topZ = radius * 2;

  // Xóa mặt cũ nếu có
  shapeMeshFaces.forEach((f) => worldGroup.remove(f));
  if (shapeMesh) {
    worldGroup.remove(shapeMesh);
    shapeMesh = null;
  }
  shapeMeshFaces = [];

  // Nhãn: đáy A', B', C', D'; đỉnh A, B, C, D
  const topLabels = ["A", "B", "C", "D"];
  const bottomLabels = ["A'", "B'", "C'", "D'"];

  const vertices = [
    // đáy
    new THREE.Vector3(-half, -half, bottomZ),
    new THREE.Vector3(half, -half, bottomZ),
    new THREE.Vector3(half, half, bottomZ),
    new THREE.Vector3(-half, half, bottomZ),
    // đỉnh (nghiêng theo tilt)
    new THREE.Vector3(-half + tiltX, -half + tiltY, topZ),
    new THREE.Vector3(half + tiltX, -half + tiltY, topZ),
    new THREE.Vector3(half + tiltX, half + tiltY, topZ),
    new THREE.Vector3(-half + tiltX, half + tiltY, topZ),
  ];

  // Thêm nhãn
  for (let i = 0; i < 4; i++) {
    createLabel(
      bottomLabels[i],
      vertices[i],
      "#ff0000",
      new THREE.Vector3(0.1, 0.1, 0.2),
      "shape"
    ); // 👈 thêm tag
  }
  for (let i = 4; i < 8; i++) {
    createLabel(
      topLabels[i - 4],
      vertices[i],
      "#ff0000",
      new THREE.Vector3(0.1, 0.1, 0.2),
      "shape"
    ); // 👈 thêm tag
  }

  // --- Tạo từng mặt ---
  const faceIndices = [
    [0, 1, 2, 3], // đáy
    [4, 5, 6, 7], // đỉnh
    [0, 1, 5, 4], // cạnh bên
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 0, 4, 7],
  ];

  const group = new THREE.Group();

  faceIndices.forEach((indices) => {
    const geom = new THREE.BufferGeometry();
    const vArray = [
      ...vertices[indices[0]].toArray(),
      ...vertices[indices[1]].toArray(),
      ...vertices[indices[2]].toArray(),
      ...vertices[indices[0]].toArray(),
      ...vertices[indices[2]].toArray(),
      ...vertices[indices[3]].toArray(),
    ];
    geom.setAttribute("position", new THREE.Float32BufferAttribute(vArray, 3));
    geom.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x66ccff,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geom, mat);

    // Tính tâm mặt để explode
    const center = new THREE.Vector3();
    indices.forEach((i) => center.add(vertices[i]));
    center.divideScalar(4);
    mesh.userData.center = center;

    group.add(mesh);
    shapeMeshFaces.push(mesh);
  });

  // Cạnh
  const edges = [
    [vertices[0], vertices[1]],
    [vertices[1], vertices[2]],
    [vertices[2], vertices[3]],
    [vertices[3], vertices[0]],
    [vertices[4], vertices[5]],
    [vertices[5], vertices[6]],
    [vertices[6], vertices[7]],
    [vertices[7], vertices[4]],
    [vertices[0], vertices[4]],
    [vertices[1], vertices[5]],
    [vertices[2], vertices[6]],
    [vertices[3], vertices[7]],
  ];
  addEdges(edges);

  worldGroup.add(group);
  shapeMesh = group; // gán cho shapeMesh để drawShape() zoom chuẩn

  historyParams.addEntry(
    `🟦 Cube với nghiêng X:${tiltX} Y:${tiltY} và nhãn hình học`
  );

  // Nếu explode đang bật, áp dụng ngay
  if (shapeParams.explode) applyExplode(shapeParams.explode);
}

// ---- Hàm tiện ích thêm cạnh ----
function addEdges(edgeArray) {
  edgeArray.forEach(([a, b]) => {
    const lineGeom = new THREE.BufferGeometry().setFromPoints([a, b]);
    const line = new THREE.Line(
      lineGeom,
      new THREE.LineBasicMaterial({ color: 0xffffff })
    );
    worldGroup.add(line);
    shapeEdges.push(line);
    line.userData.edge = { a, b };
    line.userData.type = "shapeEdge";
  });
}

function applyExplode(value) {
  const explodeDistance = 1.5; // khoảng cách tách mặt
  shapeMeshFaces.forEach((mesh) => {
    if (value === 1) {
      const dir = mesh.userData.center
        .clone()
        .sub(new THREE.Vector3(0, 0, 0))
        .normalize();
      mesh.position.copy(dir.multiplyScalar(explodeDistance));
    } else {
      mesh.position.set(0, 0, 0); // trở về
    }
  });
}

// ================== VECTOR MODULE ==================

// Tham số vector và GUI
const vectorParams = {
  x1: 0,
  y1: 0,
  z1: 0,
  x2: 1,
  y2: 1,
  z2: 1,
  nameFrom: "A",
  nameTo: "B",
  scalarValue: 2, // 👈 hệ số nhân mặc định
  proj: () => projectionVector(),
  draw: () => drawVectorFromInput(),
  length: () => getVectorLength(),
  unit: () => getUnitVector(),
  add: () => addSelectedVectors(),
  sub: () => subSelectedVectors(),
  dot: () => dotSelectedVectors(),
  cross: () => crossSelectedVectors(),
  angle: () => angleBetweenFromHistory(),
  scalar: () => scalarMultiplyFromHistory(), // 👈 thêm chức năng mới
  triple: () => tripleProductFromHistory(), // 👈 mới
  doubleCross: () => doubleCrossProductFromHistory(), // 👈 thêm mới
  plane: () => createPlaneFromTwoVectors(),
  line: () => createLineFromPointAndVector(),
  para: () => drawParallelogram(),
  tri: () => drawTriangleBetweenVectors(),
  cone: () => drawProjectionCone(),
  reverseVector: () => {
    if (selectedVectors.length === 0) {
      showTempLabel(
        "⚠️ Chưa chọn vector nào!",
        new THREE.Vector3(0, 0, 0),
        "#ff4444"
      );
      return;
    }

    const vObj = selectedVectors[0];
    const oldFrom = vObj.from.clone();
    const oldTo = vObj.to.clone();

    const newFrom = oldTo.clone();
    const newTo = oldFrom.clone();

    // Xóa arrow cũ
    worldGroup.remove(vObj.arrow);

    // --- Tạo arrow mới nhưng KHÔNG push vào vectorsHistory ---
    const dir = new THREE.Vector3().subVectors(newTo, newFrom);
    const len = dir.length();

    const arrow = new THREE.ArrowHelper(
      dir.clone().normalize(),
      newFrom.clone(),
      len,
      0xff0000,
      1,
      0.5
    );
    worldGroup.add(arrow);

    // Cập nhật vObj cũ (ghi đè)
    vObj.from = newFrom;
    vObj.to = newTo;
    vObj.dir = dir;
    vObj.arrow = arrow;
    vObj.meshes = [arrow.cone, arrow.line];

    // Highlight
    arrow.line.material.color.set(0xffff00);
    arrow.cone.material.color.set(0xffff00);

    // Cập nhật danh sách vector đã chọn
    selectedVectors[0] = vObj;

    // Cập nhật lịch sử vector (vectorsHistory đã có vObj, ghi đè trực tiếp)
    const idx = vectorsHistory.findIndex((v) => v === vObj);
    if (idx !== -1) vectorsHistory[idx] = vObj;

    historyParams.addEntry(
      `↔️ Đảo chiều vector: [${oldFrom.x.toFixed(1)},${oldFrom.y.toFixed(
        1
      )},${oldFrom.z.toFixed(1)}] → [${oldTo.x.toFixed(1)},${oldTo.y.toFixed(
        1
      )},${oldTo.z.toFixed(1)}] thành [${newFrom.x.toFixed(
        1
      )},${newFrom.y.toFixed(1)},${newFrom.z.toFixed(1)}] → [${newTo.x.toFixed(
        1
      )},${newTo.y.toFixed(1)},${newTo.z.toFixed(1)}]`
    );

    refreshVectorList(); // Cập nhật GUI danh sách vector
  },
  // Hiển thị vector từ tọa độ nhập vào
  showCoords: () => {
    if (selectedVectors.length > 0) {
      const vObj = selectedVectors[0];
      const vx = vObj.to.x - vObj.from.x;
      const vy = vObj.to.y - vObj.from.y;
      const vz = vObj.to.z - vObj.from.z;

      const pos = vObj.from
        .clone()
        .add(new THREE.Vector3(vx, vy, vz).multiplyScalar(0.5));

      showTempLabel(
        `📌 (${vx.toFixed(3)}, ${vy.toFixed(3)}, ${vz.toFixed(3)})`,
        pos,
        "#ffaa00"
      );

      historyParams.addEntry(
        `📌 Vector tọa độ: [${vObj.from.x.toFixed(3)},${vObj.from.y.toFixed(
          3
        )},${vObj.from.z.toFixed(3)}] → [${vObj.to.x.toFixed(
          3
        )},${vObj.to.y.toFixed(3)},${vObj.to.z.toFixed(3)}] = (${vx.toFixed(
          3
        )},${vy.toFixed(3)},${vz.toFixed(3)})`
      );
    } else {
      // fallback dùng giá trị nhập
      const { x1, y1, z1, x2, y2, z2 } = vectorParams;
      const vx = x2 - x1;
      const vy = y2 - y1;
      const vz = z2 - z1;

      const pos = new THREE.Vector3(x1, y1, z1).add(
        new THREE.Vector3(vx, vy, vz).multiplyScalar(0.5)
      );
      showTempLabel(
        `📌 (${vx.toFixed(3)}, ${vy.toFixed(3)}, ${vz.toFixed(3)})`,
        pos,
        "#ffaa00"
      );

      historyParams.addEntry(
        `📌 Vector tọa độ: [${x1},${y1},${z1}] → [${x2},${y2},${z2}] = (${vx.toFixed(
          3
        )},${vy.toFixed(3)},${vz.toFixed(3)})`
      );
    }
  },

  help: () => {
    alert(
      `📖 Hướng dẫn sử dụng tab Vector:

✏️ Vẽ Vector:
- Nhập tọa độ điểm đầu (X1, Y1, Z1).
- Nhập tọa độ điểm cuối (X2, Y2, Z2).
- Nhấn "✏️ Vẽ Vector" để tạo mũi tên trong không gian 3D.

📏 Chức năng mở rộng:
- Độ dài, vector đơn vị.
- Tổng, hiệu, tích vô hướng, tích có hướng.
- Góc giữa 2 vector (chọn từ lịch sử).

🗒️ Lịch sử:
- Mỗi vector đã vẽ sẽ được lưu lại để tính toán tiếp.
`
    );
  },
};

// Tạo GUI tab
const guiVector = guiHelper.addTab("Vector", 300, {
  icon: "🧭",
  label: "Vector",
});
const basicVector = guiHelper.addFolderWithTooltip(
  guiVector,
  "Tạo vector",
  "",
  "Nhập tọa độ và tên cho vector"
);
// --- Nhóm nhập điểm với tooltip ---
const pointFolderA = basicVector.addFolder("Điểm đầu");
pointFolderA.add(vectorParams, "nameFrom").name("Tên điểm đầu");
// --- Tọa độ điểm đầu ---
guiHelper.addWithIcon(pointFolderA, vectorParams, "x1", "X", { columns: 3 });
guiHelper.addWithIcon(pointFolderA, vectorParams, "y1", "Y", { columns: 3 });
guiHelper.addWithIcon(pointFolderA, vectorParams, "z1", "Z", { columns: 3 });
const pointFolderB = basicVector.addFolder("Điểm cuối");
pointFolderB.add(vectorParams, "nameTo").name("Tên điểm cuối");
// --- Tọa độ điểm cuối ---
guiHelper.addWithIcon(pointFolderB, vectorParams, "x2", "X", { columns: 3 });
guiHelper.addWithIcon(pointFolderB, vectorParams, "y2", "Y", { columns: 3 });
guiHelper.addWithIcon(pointFolderB, vectorParams, "z2", "Z", { columns: 3 });

// Nhóm Vẽ & Thông tin cơ bản
// --- Nhóm Cơ bản với tooltip ---
const basicFolder = guiHelper.addFolderWithTooltip(
  basicVector,
  "🎯 Cơ bản",
  "",
  "Các thao tác cơ bản với vector: vẽ, độ dài, vector đơn vị, hiển thị tọa độ, đảo chiều"
);

// --- Các nút hành động ---
guiHelper.addWithIcon(basicFolder, vectorParams, "draw", "✏️", {
  label: "Vẽ Vector",
  columns: 5,
  showLabel: false,
});
guiHelper.addWithIcon(basicFolder, vectorParams, "length", "📏", {
  label: "Độ dài",
  columns: 5,
  showLabel: false,
});
guiHelper.addWithIcon(basicFolder, vectorParams, "unit", "↔️", {
  label: "Vector đơn vị",
  columns: 5,
  showLabel: false,
});
guiHelper.addWithIcon(basicFolder, vectorParams, "showCoords", "📌", {
  label: "Hiển thị tọa độ",
  columns: 5,
  showLabel: false,
});
guiHelper.addWithIcon(basicFolder, vectorParams, "reverseVector", "↔️", {
  label: "Đảo chiều vector",
  columns: 5,
  showLabel: false,
});

basicFolder
  .add(
    {
      createFromEdge: () => {
        // --- Trường hợp chọn cạnh của Shape ---
        if (selectedEdge) {
          const { a, b } = selectedEdge.userData.edge;
          const vObj = createVectorArrow(a, b, 0xffff00);

          historyParams.addEntry(
            `📐 Tạo vector từ cạnh [${a.x.toFixed(1)},${a.y.toFixed(
              1
            )},${a.z.toFixed(1)}] → [${b.x.toFixed(1)},${b.y.toFixed(
              1
            )},${b.z.toFixed(1)}]`
          );

          selectedVectors = [vObj];
          return;
        }

        // --- Trường hợp chọn đường (line) ---
        if (drawParams.selectedLines.length > 0) {
          const lineObj = drawParams.selectedLines[0]; // lấy đường đầu tiên
          const a = lineObj.p1.mesh.position.clone();
          const b = lineObj.p2.mesh.position.clone();

          const vObj = createVectorArrow(a, b, 0xffff00);

          historyParams.addEntry(
            `📐 Tạo vector từ đường ${lineObj.label}: [${a.x.toFixed(
              1
            )},${a.y.toFixed(1)},${a.z.toFixed(1)}] → [${b.x.toFixed(
              1
            )},${b.y.toFixed(1)},${b.z.toFixed(1)}]`
          );

          selectedVectors = [vObj];
          return;
        }

        showTempLabel(
          "⚠️ Chưa chọn cạnh/đường nào!",
          new THREE.Vector3(0, 0, 0),
          "#ff4444"
        );
      },
    },
    "createFromEdge"
  )
  .name("Tạo vector từ cạnh/đường");

// --- Nhóm Phép toán với tooltip ---
const calcFolder = guiHelper.addFolderWithTooltip(
  guiVector,
  "⚡ Phép toán",
  "", // icon chính của folder nếu muốn
  "Các phép toán vector: cộng, trừ, tích vô hướng, v.v."
);

// --- Các giá trị số ---
guiHelper.addWithIcon(calcFolder, vectorParams, "scalarValue", "🔢", {
  label: "Hệ số nhân",
  columns: 3,
});

// --- Các checkbox / nút hành động ---
guiHelper.addWithIcon(calcFolder, vectorParams, "scalar", "📈", {
  columns: 3,
  showLabel: true,
});
guiHelper.addWithIcon(calcFolder, vectorParams, "proj", "📍", {
  columns: 3,
  showLabel: true,
});
guiHelper.addWithIcon(calcFolder, vectorParams, "add", "➕", {
  columns: 3,
  showLabel: true,
});
guiHelper.addWithIcon(calcFolder, vectorParams, "sub", "➖", {
  columns: 3,
  showLabel: true,
});
guiHelper.addWithIcon(calcFolder, vectorParams, "dot", "✴️", {
  columns: 3,
  showLabel: true,
});
guiHelper.addWithIcon(calcFolder, vectorParams, "cross", "✖️", {
  columns: 3,
  showLabel: true,
});
guiHelper.addWithIcon(calcFolder, vectorParams, "angle", "📐", {
  columns: 3,
  showLabel: true,
});
guiHelper.addWithIcon(calcFolder, vectorParams, "triple", "📦", {
  columns: 3,
  showLabel: true,
});
guiHelper.addWithIcon(calcFolder, vectorParams, "doubleCross", "🌀", {
  columns: 3,
});

// --- Các hành động dạng nút ---
guiHelper.addWithIcon(calcFolder, { rel: checkVectorRelations }, "rel", "🔎", {
  columns: 3,
  label: "Quan hệ 2 vector",
});
guiHelper.addWithIcon(
  calcFolder,
  { dist: distanceBetweenVectors },
  "dist",
  "📏",
  { columns: 3, label: "Khoảng cách 2 vector" }
);

// Nhóm Hình học cao hơn
const geomFolder = guiVector.addFolder("📐 Hình học cao hơn");
geomFolder.add(vectorParams, "plane").name("📄 Mặt phẳng (từ 2 vector)");
geomFolder.add(vectorParams, "line").name("📏 Đường thẳng (điểm + vector)");
geomFolder.add(vectorParams, "para").name("🟦 Hình bình hành (Cộng 2 vector)");
geomFolder.add(vectorParams, "tri").name("🔺 Tam giác + Góc");
geomFolder.add(vectorParams, "cone").name("🛑 Hình nón chiếu vector");

// ===== GUI Danh sách Vector =====
const listFolder = guiVector.addFolder("📜 Danh sách Vector");

// Object lưu control để dễ xóa/refresh
const vectorListControls = {};

function refreshVectorList() {
  // Xóa control cũ
  for (let key in vectorListControls) {
    listFolder.remove(vectorListControls[key]);
    delete vectorListControls[key];
  }

  // Tạo control mới cho từng vector
  vectorsHistory.forEach((vObj, idx) => {
    const name = `v${idx + 1}: (${vObj.from.x.toFixed(1)},${vObj.from.y.toFixed(
      1
    )},${vObj.from.z.toFixed(1)}) → (${vObj.to.x.toFixed(
      1
    )},${vObj.to.y.toFixed(1)},${vObj.to.z.toFixed(1)})`;

    vectorListControls[idx] = listFolder
      .add(
        {
          focus: () => focusOnVector(vObj),
          remove: () => removeVector(vObj),
        },
        "focus"
      )
      .name(name);

    // thêm nút xóa riêng
    vectorListControls[`del${idx}`] = listFolder
      .add(
        {
          del: () => removeVector(vObj),
        },
        "del"
      )
      .name(`❌ Xóa v${idx + 1}`);
  });
}

// ===== Zoom camera tới vector =====
function focusOnVector(vObj) {
  const center = vObj.from.clone().add(vObj.to).multiplyScalar(0.5);
  const size = vObj.from.distanceTo(vObj.to);

  // di chuyển camera đến gần vector
  const dir = camera.position.clone().sub(center).normalize();
  camera.position.copy(center.clone().add(dir.multiplyScalar(size * 3)));
  camera.lookAt(center);
}

// ===== Xóa vector khỏi worldGroup và lịch sử =====
function removeVector(vObj) {
  worldGroup.remove(vObj.arrow);
  if (vObj.dashedLine) worldGroup.remove(vObj.dashedLine);

  // Xóa điểm ở 2 đầu + nhãn
  [vObj.from, vObj.to].forEach((pos) => {
    const p = drawParams.points.find((p) => p.pos.equals(pos));
    if (p) {
      worldGroup.remove(p.mesh);

      // xoá nhãn bằng clearLabels theo tag "point"
      if (p.label && p.label.userData?.tag === "point") {
        if (p.label.parent) p.label.parent.remove(p.label);
        shapeLabels = shapeLabels.filter((l) => l !== p.label);
      }

      drawParams.points = drawParams.points.filter((pp) => pp !== p);
    }
  });

  // Cập nhật lại danh sách vector
  vectorsHistory = vectorsHistory.filter((v) => v !== vObj);
  refreshVectorList();
}

// Nhóm Trợ giúp
const helpFolder = guiVector.addFolder("ℹ️ Khác");
helpFolder.add(vectorParams, "help").name("❓ Trợ giúp");

// ====== Hàm chung để tạo vector + lưu ======
function createVectorArrow(from, to, color = 0x00ff00) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();

  const arrow = new THREE.ArrowHelper(
    dir.clone().normalize(),
    from.clone(),
    len,
    color,
    1,
    0.5
  );

  arrow.userData.vectorData = { from: from.clone(), dir, to: to.clone() };
  worldGroup.add(arrow);

  const vObj = {
    from: from.clone(),
    to: to.clone(),
    dir,
    arrow,
    meshes: [arrow.cone, arrow.line],
  };

  vectorsHistory.push(vObj);
  refreshVectorList();
  return vObj;
}

function drawResultVector(from, dir, color = 0x00ff00, name) {
  const to = from.clone().add(dir);
  const vObj = createVectorArrow(from, to, color); // tạo vObj và push vào vectorsHistory

  // Gắn tên hoặc ghi log
  vObj.name = name;
  historyParams.addEntry(
    `${name}: (${dir.x.toFixed(3)}, ${dir.y.toFixed(3)}, ${dir.z.toFixed(3)})`
  );

  return vObj; // trả về để nếu cần chọn hoặc highlight
}

// ================== LOGIC ==================

let vectorsHistory = []; // lưu danh sách vector đã vẽ
let points3D = []; // lưu điểm 3D đã add
let selectedVectors = []; // danh sách vector đã chọn

// Vẽ vector từ input
function drawVectorFromInput() {
  const { x1, y1, z1, x2, y2, z2, nameFrom, nameTo } = vectorParams;

  if ([x1, y1, z1, x2, y2, z2].some((v) => isNaN(v))) {
    showTempLabel(
      "⚠️ Nhập tọa độ hợp lệ",
      new THREE.Vector3(0, 0, 0),
      "#ff4444"
    );
    return;
  }

  const from = new THREE.Vector3(x1, y1, z1);
  const to = new THREE.Vector3(x2, y2, z2);

  // Tạo vector và push vào history
  const vObj = createVectorArrow(from, to, 0x00ff00);

  // Tạo điểm đầu & cuối với tên từ GUI
  addPoint(from, nameFrom);
  addPoint(to, nameTo);

  historyParams.addEntry(
    `✏️ Vector từ ${nameFrom}(${x1},${y1},${z1}) → ${nameTo}(${x2},${y2},${z2})`
  );
}

// Vẽ điểm và nhãn rõ, đẹp dựa trên createLabel
function addPoint(pos, name) {
  // Tạo điểm (hình cầu nhỏ)
  const geometry = new THREE.SphereGeometry(0.1, 16, 16);
  const material = new THREE.MeshBasicMaterial({ color: 0xff3333 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(pos);
  worldGroup.add(mesh);

  // Text nhãn
  const labelText =
    name || `(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`;

  // Gọi createLabel để tạo nhãn CSS2D
  const label = createLabel(
    labelText,
    pos,
    "#ffffff", // màu chữ
    new THREE.Vector3(0.2, 0.2, 0.2), // offset lệch ra khỏi điểm
    "point" // tag để phân loại
  );

  drawParams.points.push({ mesh, label, pos, name: labelText });
  return { mesh, label, pos };
}

// ===== Hàm dựng vector ảo nét đứt (dịch v2 về chung gốc với v1) =====
function makeDashedClone(vObj1, vObj2, color = 0xff0000) {
  const origin = vObj1.from.clone();
  const v2 = vObj2.dir.clone();
  const dashedEnd = origin.clone().add(v2);

  const dashedGeometry = new THREE.BufferGeometry().setFromPoints([
    origin,
    dashedEnd,
  ]);
  const dashedMaterial = new THREE.LineDashedMaterial({
    color,
    dashSize: 0.2,
    gapSize: 0.1,
  });
  const dashedLine = new THREE.Line(dashedGeometry, dashedMaterial);
  dashedLine.computeLineDistances();
  worldGroup.add(dashedLine);

  return { origin, dashedDir: v2.clone(), dashedLine };
}

// ===== Chiếu vector u lên vector v =====
function projectionVector() {
  if (selectedVectors.length < 2) {
    showTempLabel(
      "⚠️ Chọn 2 vector (u và v)",
      new THREE.Vector3(0, 0, 0),
      "#ff4444"
    );
    return;
  }

  // Lấy 2 vector đã đưa về cùng gốc
  const two = getTwoVectorsUnified();
  if (!two) return;

  const { v1, v2, base } = two;

  // Tính projection
  const scalar = v1.dot(v2) / v2.lengthSq();
  const proj = v2.clone().multiplyScalar(scalar);

  // Vẽ vector chiếu
  drawResultVector(base, proj, 0x00ffff, "📍 Projection (u lên v)");

  showTempLabel(
    `📍 (${proj.x.toFixed(3)}, ${proj.y.toFixed(3)}, ${proj.z.toFixed(3)})`,
    base.clone().add(proj.clone().multiplyScalar(0.5)),
    "#00ffff"
  );
}
// ===== Triple scalar product (thể tích khối hộp) =====
function tripleProductFromHistory() {
  if (selectedVectors.length < 3) {
    showTempLabel("⚠️ Chọn 3 vector", new THREE.Vector3(0, 0, 0), "#ff4444");
    return;
  }

  const v1 = selectedVectors[0].dir.clone();
  const v2 = selectedVectors[1].dir.clone();
  const v3 = selectedVectors[2].dir.clone();

  // triple product
  const cross = new THREE.Vector3().crossVectors(v2, v3);
  const scalarTriple = v1.dot(cross);
  const volume = Math.abs(scalarTriple);

  showTempLabel(
    `📦 V = ${volume.toFixed(3)}`,
    new THREE.Vector3(0, 0, 0),
    "#00ffcc"
  );

  // ---- Hiển thị hình hộp song song ----
  const origin = new THREE.Vector3(0, 0, 0);

  // 8 đỉnh của hình hộp
  const vertices = [
    origin,
    v1,
    v2,
    v3,
    v1.clone().add(v2),
    v1.clone().add(v3),
    v2.clone().add(v3),
    v1.clone().add(v2).add(v3),
  ];

  // Các mặt (theo chỉ số đỉnh)
  const faces = [
    [0, 1, 4, 2], // đáy
    [0, 1, 5, 3],
    [0, 2, 6, 3],
    [7, 4, 1, 5],
    [7, 6, 2, 4],
    [7, 5, 3, 6], // nắp
  ];

  // Xóa khối cũ nếu có
  if (window.parallelepipedMesh) {
    worldGroup.remove(window.parallelepipedMesh);
  }

  // Geometry từ đỉnh và mặt
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const indices = [];

  // push vertices
  vertices.forEach((v) => {
    positions.push(v.x, v.y, v.z);
  });

  // push faces (2 tam giác / mặt)
  faces.forEach((face) => {
    indices.push(face[0], face[1], face[2]);
    indices.push(face[2], face[3], face[0]);
  });

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // Tạo mesh trong suốt để dễ hình dung
  const material = new THREE.MeshStandardMaterial({
    color: 0x00ffcc,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  worldGroup.add(mesh);

  window.parallelepipedMesh = mesh;
}
function doubleCrossProductFromHistory() {
  if (selectedVectors.length < 3) {
    showTempLabel(
      "⚠️ Chọn 3 vector (a, b, c)",
      new THREE.Vector3(0, 0, 0),
      "#ff4444"
    );
    return;
  }

  const a = selectedVectors[0].dir.clone();
  const b = selectedVectors[1].dir.clone();
  const c = selectedVectors[2].dir.clone();

  // (a×b)×c
  const ab = new THREE.Vector3().crossVectors(a, b);
  const result = new THREE.Vector3().crossVectors(ab, c);

  // Vẽ kết quả từ gốc (0,0,0)
  drawResultVector(new THREE.Vector3(0, 0, 0), result, 0x8800ff, "🌀 (a×b)×c");

  showTempLabel(
    `🌀 (${result.x.toFixed(3)}, ${result.y.toFixed(3)}, ${result.z.toFixed(
      3
    )})`,
    result.clone().multiplyScalar(0.5),
    "#8800ff"
  );
}

function drawParallelogram() {
  const two = getTwoVectorsUnified();
  if (!two) return;
  const { v1, v2, base } = two;

  // 4 đỉnh hình bình hành
  const A = base.clone();
  const B = base.clone().add(v1);
  const C = base.clone().add(v2);
  const D = base.clone().add(v1).add(v2);

  const vertices = [A, B, D, C]; // theo thứ tự
  const geom = new THREE.BufferGeometry().setFromPoints(vertices.concat([A]));
  const mat = new THREE.LineBasicMaterial({ color: 0x00ffcc });
  const line = new THREE.LineLoop(geom, mat);

  worldGroup.add(line);

  // Vẽ mặt mờ
  const shapeGeom = new THREE.BufferGeometry();
  const positions = [
    A.x,
    A.y,
    A.z,
    B.x,
    B.y,
    B.z,
    D.x,
    D.y,
    D.z,
    C.x,
    C.y,
    C.z,
  ];
  const indices = [0, 1, 2, 0, 2, 3];
  shapeGeom.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  shapeGeom.setIndex(indices);
  shapeGeom.computeVertexNormals();

  const shapeMat = new THREE.MeshStandardMaterial({
    color: 0x00ffcc,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(shapeGeom, shapeMat);
  worldGroup.add(mesh);

  historyParams.addEntry("🟦 Vẽ hình bình hành từ 2 vector");
}
function drawTriangleBetweenVectors() {
  const two = getTwoVectorsUnified();
  if (!two) return;
  const { v1, v2, base } = two;

  const A = base.clone();
  const B = base.clone().add(v1);
  const C = base.clone().add(v2);

  const geom = new THREE.BufferGeometry().setFromPoints([A, B, C, A]);
  const mat = new THREE.LineBasicMaterial({ color: 0xff00ff });
  const line = new THREE.Line(geom, mat);
  worldGroup.add(line);

  // Vẽ mặt mờ tam giác
  const triGeom = new THREE.BufferGeometry();
  const positions = [A.x, A.y, A.z, B.x, B.y, B.z, C.x, C.y, C.z];
  triGeom.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  triGeom.setIndex([0, 1, 2]);
  triGeom.computeVertexNormals();

  const triMat = new THREE.MeshStandardMaterial({
    color: 0xff00ff,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  const triMesh = new THREE.Mesh(triGeom, triMat);
  worldGroup.add(triMesh);

  // Vẽ cung góc
  createVectorAngleArcWithDashed(
    selectedVectors[0],
    selectedVectors[1],
    1.5,
    32
  );

  historyParams.addEntry("🔺 Vẽ tam giác và cung góc giữa 2 vector");
}
function drawProjectionCone() {
  if (selectedVectors.length < 2) {
    showTempLabel(
      "⚠️ Chọn 2 vector: u (chiếu) và v (trục)",
      new THREE.Vector3(0, 0, 0),
      "#ff4444"
    );
    return;
  }

  const two = getTwoVectorsUnified();
  if (!two) return;
  const { v1, v2, base } = two;

  const u = v1.clone().normalize();
  const axis = v2.clone().normalize();
  const angle = u.angleTo(axis);

  // Vẽ hình nón với trục = v2
  const height = v2.length();
  const radius = Math.tan(angle) * height;

  const coneGeom = new THREE.ConeGeometry(radius, height, 32, 1, true);
  const coneMat = new THREE.MeshStandardMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
  });
  const cone = new THREE.Mesh(coneGeom, coneMat);

  // Căn chỉnh theo trục v2
  cone.position.copy(base.clone().add(axis.clone().multiplyScalar(height / 2)));
  cone.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    axis.clone().normalize()
  );

  worldGroup.add(cone);
  const deg = THREE.MathUtils.radToDeg(angle).toFixed(2);
  showTempLabel(
    `🛑 Góc chiếu = ${deg}°`,
    base.clone().add(axis.clone().multiplyScalar(height * 0.6)),
    "#ffff00"
  );

  historyParams.addEntry(`🛑 Hình nón chiếu vector lên trục, góc = ${deg}°`);
}

// ===== Lấy 2 vector đã đưa về cùng gốc =====
function getTwoVectorsUnified() {
  if (selectedVectors.length < 2) {
    showTempLabel(
      "⚠️ Vui lòng chọn 2 vector",
      new THREE.Vector3(0, 0, 0),
      "#ff4444"
    );
    return null;
  }

  const vObj1 = selectedVectors[0];
  const vObj2 = selectedVectors[1];

  // Dựng vector ảo nét đứt cho v2 về gốc của v1
  const { origin, dashedDir, dashedLine } = makeDashedClone(vObj1, vObj2);

  // Lưu tham chiếu để xóa khi cần
  vObj1.dashedLine && worldGroup.remove(vObj1.dashedLine);
  vObj2.dashedLine && worldGroup.remove(vObj2.dashedLine);
  vObj2.dashedLine = dashedLine;

  return { v1: vObj1.dir.clone(), v2: dashedDir, base: origin };
}
// ===== Vẽ cung góc giữa 2 vector (dùng vector ảo nét đứt) =====
function createVectorAngleArcWithDashed(
  vObj1,
  vObj2,
  radius = 2,
  segments = 32
) {
  // Lấy gốc chung
  const origin = vObj1.from.clone();

  // Vector gốc và vector ảo đã dịch
  const v1 = vObj1.dir.clone().normalize();
  const v2 = vObj2.dir.clone().normalize();

  // Tạo quaternion để quay từ v1 sang v2
  const angle = v1.angleTo(v2);
  const axis = new THREE.Vector3().crossVectors(v1, v2).normalize();

  // Nếu 2 vector song song → không tạo cung
  if (axis.length() < 1e-6) {
    return { arc: null };
  }

  // Tạo các điểm cung tròn
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * angle;
    const q = new THREE.Quaternion().setFromAxisAngle(axis, t);
    const dir = v1.clone().applyQuaternion(q);
    points.push(origin.clone().add(dir.multiplyScalar(radius)));
  }

  // Vẽ cung nét liền
  const arcGeometry = new THREE.BufferGeometry().setFromPoints(points);
  const arcMaterial = new THREE.LineBasicMaterial({ color: 0xffff00 });
  const arc = new THREE.Line(arcGeometry, arcMaterial);
  worldGroup.add(arc);

  return { arc };
}

// ===== Các phép toán =====
// ===== Kiểm tra quan hệ giữa 2 vector =====
function checkVectorRelations() {
  const two = getTwoVectorsUnified();
  if (!two) {
    showTempLabel(
      "⚠️ Cần chọn 2 vector",
      new THREE.Vector3(0, 0, 0),
      "#ff0000"
    );
    return;
  }

  const { v1, v2, base } = two;
  const dot = v1.dot(v2);
  const cross = new THREE.Vector3().crossVectors(v1, v2);
  const isOrthogonal = Math.abs(dot) < 1e-6;
  const isParallel = cross.length() < 1e-6;
  let isSame = false;

  // Kiểm tra trùng nhau: song song + cùng hướng + cùng gốc
  if (isParallel) {
    const ratioX = v1.x !== 0 ? v2.x / v1.x : null;
    const ratioY = v1.y !== 0 ? v2.y / v1.y : null;
    const ratioZ = v1.z !== 0 ? v2.z / v1.z : null;

    // Lấy các tỉ số hợp lệ (không NaN, không Infinity)
    const ratios = [ratioX, ratioY, ratioZ].filter(
      (r) => r !== null && isFinite(r)
    );
    if (
      ratios.length > 0 &&
      ratios.every((r) => Math.abs(r - ratios[0]) < 1e-6)
    ) {
      // Cùng gốc?
      const sameOrigin =
        selectedVectors[0].from.distanceTo(selectedVectors[1].from) < 1e-6;
      isSame = sameOrigin;
    }
  }

  let msg = "📊 Quan hệ giữa 2 vector:\n";
  msg += isOrthogonal ? "✅ Vuông góc\n" : "❌ Không vuông góc\n";
  msg += isParallel ? "✅ Song song\n" : "❌ Không song song\n";
  msg += isSame ? "✅ Trùng nhau\n" : "❌ Không trùng nhau\n";

  showTempLabel(msg, base.clone().add(new THREE.Vector3(0, 0, 1)), "#ffff00");
}

// ===== Khoảng cách giữa 2 vector =====
function distanceBetweenVectors() {
  if (selectedVectors.length < 2) {
    showTempLabel(
      "⚠️ Cần chọn 2 vector",
      new THREE.Vector3(0, 0, 0),
      "#ff0000"
    );
    return;
  }

  const a1 = selectedVectors[0].from.clone();
  const a2 = selectedVectors[0].to.clone();
  const b1 = selectedVectors[1].from.clone();
  const b2 = selectedVectors[1].to.clone();

  const u = new THREE.Vector3().subVectors(a2, a1);
  const v = new THREE.Vector3().subVectors(b2, b1);
  const w0 = new THREE.Vector3().subVectors(a1, b1);

  const uxv = new THREE.Vector3().crossVectors(u, v);
  const denom = uxv.length();

  let dist;
  if (denom < 1e-6) {
    // 2 vector song song → lấy khoảng cách từ điểm đến đường
    const w0xu = new THREE.Vector3().crossVectors(w0, u);
    dist = w0xu.length() / u.length();
  } else {
    dist = Math.abs(w0.dot(uxv)) / denom;
  }

  // 👉 chọn vị trí để hiển thị nhãn (ở giữa 4 điểm đầu-cuối của 2 vector)
  const mid = a1.clone().add(a2).add(b1).add(b2).multiplyScalar(0.25);

  showTempLabel(`📏 d = ${dist.toFixed(3)}`, mid, "#00ffff");
}
// Hàm hiển thị công thức và kết quả vào ghi chú
function showInNote(guiHelper, displayParams, title, formula, value) {
  if (!displayParams.showInNote) return;

  const formulaText = `
${title}
Công thức: ${formula}

Thay số:
${value}
`;

  // Tạo note nếu chưa có
  if (!guiHelper._noteDiv) guiHelper.createNote();
  const textarea = guiHelper._noteDiv.querySelector("textarea");

  // Bạn có thể ghi đè hoặc nối vào note
  textarea.value = formulaText;
}

// Độ dài vector cuối cùng
// Độ dài vector được chọn
function getVectorLength() {
  if (selectedVectors.length === 0) {
    showTempLabel(
      "⚠️ Chưa chọn vector nào!",
      new THREE.Vector3(0, 0, 0),
      "#ff4444"
    );
    return;
  }

  // Lấy vector đầu tiên trong danh sách chọn
  const vObj = selectedVectors[0];
  const v = vObj.dir;

  const x = v.x.toFixed(3);
  const y = v.y.toFixed(3);
  const z = v.z.toFixed(3);
  const length = v.length().toFixed(3);

  // Hiển thị nhãn tạm trên scene
  const midPos = vObj.from.clone().add(v.clone().multiplyScalar(0.5));
  showTempLabel(`📏 |v| = ${length}`, midPos, "#00ffcc");

  // Hiển thị trong ghi chú nếu bật checkbox
  showInNote(
    guiHelper,
    displayParams,
    `Độ dài vector ${vObj.name || "(chưa đặt tên)"} = (${x}, ${y}, ${z})`,
    "|v| = √(x² + y² + z²)",
    `|v| = √(${x}² + ${y}² + ${z}²) = ${length}`
  );
}

// Vector đơn vị
function getUnitVector() {
  if (selectedVectors.length === 0) {
    showTempLabel(
      "⚠️ Chưa chọn vector nào!",
      new THREE.Vector3(0, 0, 0),
      "#ff4444"
    );
    return;
  }

  const vObj = selectedVectors[0];
  const vDir = vObj.dir.clone();
  const length = vDir.length();

  if (length === 0) {
    showTempLabel("⚠️ Vector có độ dài 0!", vObj.from.clone(), "#ff4444");
    return;
  }

  const unit = vDir.clone().normalize();
  const midPos = vObj.from.clone().add(vDir.clone().multiplyScalar(0.5));

  // Hiển thị nhãn tạm
  showTempLabel(
    `↔️ (${unit.x.toFixed(3)}, ${unit.y.toFixed(3)}, ${unit.z.toFixed(3)})`,
    midPos,
    "#44ccff"
  );

  // Hiển thị công thức trong ghi chú
  showInNote(
    guiHelper,
    displayParams,
    `Vector đơn vị của ${vObj.name || "(chưa đặt tên)"} = (${vDir.x.toFixed(
      3
    )}, ${vDir.y.toFixed(3)}, ${vDir.z.toFixed(3)})`,
    `u = v / |v|`,
    `u = (${vDir.x}, ${vDir.y}, ${vDir.z}) / √(${vDir.x}² + ${vDir.y}² + ${
      vDir.z
    }²) = (${unit.x.toFixed(3)}, ${unit.y.toFixed(3)}, ${unit.z.toFixed(3)})`
  );
}
// Cộng vector
function addSelectedVectors() {
  if (selectedVectors.length < 2) {
    showTempLabel(
      "⚠️ Chọn ít nhất 2 vector",
      new THREE.Vector3(0, 0, 0),
      "#ff4444"
    );
    return;
  }

  const base = selectedVectors[0].from.clone();
  let sum = new THREE.Vector3();
  selectedVectors.forEach((v) => sum.add(v.dir));

  const resultVector = drawResultVector(
    base,
    sum,
    0x0000ff,
    "➕ Tổng nhiều vector"
  );

  showTempLabel(
    `➕ (${sum.x.toFixed(3)}, ${sum.y.toFixed(3)}, ${sum.z.toFixed(3)})`,
    base.clone().add(sum.clone().multiplyScalar(0.5)),
    "#0000ff"
  );

  // Hiển thị công thức trong ghi chú
  const formula = selectedVectors
    .map((v, i) => `v${i + 1} = (${v.dir.x},${v.dir.y},${v.dir.z})`)
    .join(" + ");
  const value = `(${sum.x.toFixed(3)}, ${sum.y.toFixed(3)}, ${sum.z.toFixed(
    3
  )})`;
  showInNote(guiHelper, displayParams, "Tổng vector", formula, value);

  selectedVectors = [resultVector];
}

// Trừ vector
function subSelectedVectors() {
  if (selectedVectors.length < 2) {
    showTempLabel(
      "⚠️ Chọn ít nhất 2 vector",
      new THREE.Vector3(0, 0, 0),
      "#ff4444"
    );
    return;
  }

  const base = selectedVectors[0].from.clone();
  let result = selectedVectors[0].dir.clone();
  for (let i = 1; i < selectedVectors.length; i++)
    result.sub(selectedVectors[i].dir);

  const resultVector = drawResultVector(
    base,
    result,
    0xff00ff,
    "➖ Hiệu nhiều vector"
  );

  showTempLabel(
    `➖ (${result.x.toFixed(3)}, ${result.y.toFixed(3)}, ${result.z.toFixed(
      3
    )})`,
    base.clone().add(result.clone().multiplyScalar(0.5)),
    "#ff00ff"
  );

  const formula = selectedVectors
    .map((v, i) => (i === 0 ? `v${i + 1}` : `-v${i + 1}`))
    .join(" ");
  const value = `(${result.x.toFixed(3)}, ${result.y.toFixed(
    3
  )}, ${result.z.toFixed(3)})`;
  showInNote(guiHelper, displayParams, "Hiệu vector", formula, value);

  selectedVectors = [resultVector];
}

// Cross
function crossSelectedVectors() {
  if (selectedVectors.length < 2) {
    showTempLabel(
      "⚠️ Chọn ít nhất 2 vector",
      new THREE.Vector3(0, 0, 0),
      "#ff4444"
    );
    return;
  }

  let result = selectedVectors[0].dir.clone();
  for (let i = 1; i < selectedVectors.length; i++) {
    result = new THREE.Vector3().crossVectors(result, selectedVectors[i].dir);
  }

  const resultVector = drawResultVector(
    new THREE.Vector3(0, 0, 0),
    result,
    0xff8800,
    "✖️ Cross"
  );

  showTempLabel(
    `✖️ (${result.x.toFixed(3)}, ${result.y.toFixed(3)}, ${result.z.toFixed(
      3
    )})`,
    result.clone().multiplyScalar(0.5),
    "#ff8800"
  );

  const formula = selectedVectors.map((v, i) => `v${i + 1}`).join(" × ");
  const value = `(${result.x.toFixed(3)}, ${result.y.toFixed(
    3
  )}, ${result.z.toFixed(3)})`;
  showInNote(guiHelper, displayParams, "Tích có hướng (Cross)", formula, value);

  selectedVectors = [resultVector];
}

// ===== Góc giữa 2 vector =====
function angleBetweenFromHistory() {
  const two = getTwoVectorsUnified();
  if (!two) return;

  const { v1, v2, base } = two;
  const cosTheta = v1.dot(v2) / (v1.length() * v2.length());
  const angleRad = Math.acos(THREE.MathUtils.clamp(cosTheta, -1, 1));
  const angleDeg = THREE.MathUtils.radToDeg(angleRad);

  showTempLabel(`📐 ${angleDeg.toFixed(2)}°`, base, "#44ff44");

  if (selectedVectors.length === 2) {
    if (selectedVectors[0].angleArc)
      worldGroup.remove(selectedVectors[0].angleArc);
    if (selectedVectors[1].angleArc)
      worldGroup.remove(selectedVectors[1].angleArc);

    const { arc } = createVectorAngleArcWithDashed(
      selectedVectors[0],
      selectedVectors[1],
      2,
      32
    );
    selectedVectors[0].angleArc = arc;
    selectedVectors[1].angleArc = arc;
  }
}

// ===== Nhân vector với số =====
function scalarMultiplyFromHistory() {
  if (selectedVectors.length < 1) {
    showTempLabel("⚠️ Chọn 1 vector", new THREE.Vector3(0, 0, 0), "#ff4444");
    return;
  }

  const vObj = selectedVectors[0];
  const factor = vectorParams.scalarValue;
  const result = vObj.dir.clone().multiplyScalar(factor);

  drawResultVector(vObj.from.clone(), result, 0x00ffff, `📈 ${factor} × v`);
  showTempLabel(
    `📈 (${result.x.toFixed(3)}, ${result.y.toFixed(3)}, ${result.z.toFixed(
      3
    )})`,
    vObj.from.clone().add(result.clone().multiplyScalar(0.5)),
    "#00ffff"
  );
}

function createPlaneFromTwoVectors() {
  if (selectedVectors.length < 2) {
    showTempLabel("⚠️ Cần 2 vector", new THREE.Vector3(0, 0, 0), "#ff4444");
    return;
  }

  const { v1, v2, base } = getTwoVectorsUnified();
  if (!v1 || !v2) return;

  const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();
  if (normal.length() < 1e-6) {
    showTempLabel("⚠️ Hai vector song song", base, "#ff4444");
    return;
  }

  const planeSize = 10;
  const planeGeom = new THREE.PlaneGeometry(planeSize, planeSize);
  const planeMat = new THREE.MeshBasicMaterial({
    color: 0x8888ff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.4,
  });
  const planeMesh = new THREE.Mesh(planeGeom, planeMat);

  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    normal
  );
  planeMesh.setRotationFromQuaternion(quat);
  planeMesh.position.copy(base);
  worldGroup.add(planeMesh);

  historyParams.addEntry(
    `📄 Pháp tuyến = (${normal.x.toFixed(2)}, ${normal.y.toFixed(
      2
    )}, ${normal.z.toFixed(2)})`
  );
}

function createLineFromPointAndVector() {
  if (selectedVectors.length < 1 || points3D.length < 1) {
    showTempLabel(
      "⚠️ Cần 1 vector + 1 điểm",
      new THREE.Vector3(0, 0, 0),
      "#ff4444"
    );
    return;
  }

  const vObj = selectedVectors[0];
  const dir = vObj.dir.clone().normalize();
  const p = points3D.at(-1).pos.clone();

  const length = 20;
  const lineGeom = new THREE.BufferGeometry().setFromPoints([
    p.clone().sub(dir.clone().multiplyScalar(length / 2)),
    p.clone().add(dir.clone().multiplyScalar(length / 2)),
  ]);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xff0000 });
  const line = new THREE.Line(lineGeom, lineMat);
  worldGroup.add(line);

  historyParams.addEntry(
    `📏 Đường thẳng: (${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(
      1
    )}) dir=(${dir.x.toFixed(2)},${dir.y.toFixed(2)},${dir.z.toFixed(2)})`
  );
}

// Tạo container trong GUI
const handControlParams = {
  enabled: false,
  sensitivity: 1.0,
  cameraOn: false, // 👈 trạng thái bật/tắt cam
};

const guiHand = guiHelper.addTab("Cử chỉ tay", 300, {
  icon: "🖐️",
  label: "Cử chỉ tay",
});
guiHand.add(handControlParams, "enabled").name("✅ Kích hoạt");
guiHand.add(handControlParams, "sensitivity", 0.1, 3, 0.1).name("🎚️ Độ nhạy");

// ========== Tạo khung giao diện trong GUI ==========

// Container riêng để tránh đè lên nút close
const handContainer = document.createElement("div");
handContainer.style.display = "flex";
handContainer.style.flexDirection = "column";
handContainer.style.gap = "8px";
handContainer.style.marginTop = "28px"; // chừa khoảng trên cho nút close

// Trạng thái camera
const statusEl = document.createElement("div");
statusEl.style.padding = "4px";
statusEl.style.fontSize = "14px";
statusEl.style.color = "#0f0";
statusEl.textContent = "⌛ Đang chờ bật camera...";
handContainer.appendChild(statusEl);

// Video ẩn để xử lý
const videoElement = document.createElement("video");
videoElement.autoplay = true;
videoElement.playsInline = true;
videoElement.muted = true;
videoElement.style.display = "none";
handContainer.appendChild(videoElement);

// Canvas hiển thị camera + xử lý
const canvasElement = document.createElement("canvas");
canvasElement.width = 640;
canvasElement.height = 480;
canvasElement.style.width = "100%";
canvasElement.style.border = "1px solid #333";
canvasElement.style.borderRadius = "8px";
const canvasCtx = canvasElement.getContext("2d");
handContainer.appendChild(canvasElement);

// Nút bật/tắt camera
const camBtn = document.createElement("button");
camBtn.textContent = "📷 Bật Camera";
camBtn.style.padding = "6px 10px";
camBtn.style.borderRadius = "6px";
camBtn.style.border = "1px solid #555";
camBtn.style.background = "#222";
camBtn.style.color = "#0f0";
camBtn.style.cursor = "pointer";
camBtn.style.alignSelf = "flex-start";
handContainer.appendChild(camBtn);

// Thêm container vào tab GUI
guiHand.domElement.appendChild(handContainer);

function setStatus(msg) {
  statusEl.textContent = msg;
}

// Khởi tạo Mediapipe Hands
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.5,
});

hands.onResults((results) => {
  if (!handControlParams.enabled) return; // 🚫 tắt nếu chưa bật

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(
    results.image,
    0,
    0,
    canvasElement.width,
    canvasElement.height
  );

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    setStatus(`🙌 Phát hiện ${results.multiHandLandmarks.length} bàn tay`);

    // Vẽ tất cả bàn tay
    for (const landmarks of results.multiHandLandmarks) {
      drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
        color: "#00FF00",
        lineWidth: 1,
      });
      drawLandmarks(canvasCtx, landmarks, { color: "#FF0000", lineWidth: 1 });
    }

    const hand1 = results.multiHandLandmarks[0];

    // 👉 Xoay camera theo ngón trỏ bàn tay đầu tiên
    const indexFinger = hand1[8];
    const rotateX = indexFinger.x - 0.5;
    const rotateY = indexFinger.y - 0.5;

    camera.position.applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      -rotateX * 0.1 * handControlParams.sensitivity
    );
    camera.position.applyAxisAngle(
      new THREE.Vector3(1, 0, 0),
      -rotateY * 0.1 * handControlParams.sensitivity
    );

    // 👉 Di chuyển (pan) camera theo vị trí cổ tay bàn tay đầu tiên
    const wrist = hand1[0];
    const moveX = (wrist.x - 0.5) * 2 * handControlParams.sensitivity;
    const moveY = (wrist.y - 0.5) * 2 * handControlParams.sensitivity;

    camera.position.x += moveX;
    camera.position.y -= moveY; // canvas Y ngược
    controls.target.x += moveX;
    controls.target.y -= moveY;

    // 👉 Zoom nếu có đủ 2 bàn tay theo khoảng cách giữa cổ tay
    if (results.multiHandLandmarks.length >= 2) {
      const hand2 = results.multiHandLandmarks[1];
      const wrist1 = hand1[0];
      const wrist2 = hand2[0];

      const dx = wrist1.x - wrist2.x;
      const dy = wrist1.y - wrist2.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      camera.position.multiplyScalar(
        1 + (0.5 - dist) * 0.05 * handControlParams.sensitivity
      );
    }

    camera.lookAt(controls.target);
    controls.update();
  } else {
    setStatus("🕵️ Không phát hiện bàn tay nào");
  }

  canvasCtx.restore();
});

// Khởi tạo Camera nhưng chưa start
const cameraHand = new Camera(videoElement, {
  onFrame: async () => {
    await hands.send({ image: videoElement });
  },
  width: 640,
  height: 480,
});

// Toggle camera khi nhấn nút
camBtn.addEventListener("click", () => {
  if (!handControlParams.cameraOn) {
    cameraHand
      .start()
      .then(() => {
        setStatus("🎥 Camera đã bật. Đang nhận diện bàn tay...");
        camBtn.textContent = "📴 Tắt Camera";
        handControlParams.cameraOn = true;
      })
      .catch((err) => {
        setStatus("❌ Không mở được camera: " + err.message);
      });
  } else {
    // Dừng camera thủ công
    if (videoElement.srcObject) {
      videoElement.srcObject.getTracks().forEach((track) => track.stop());
      videoElement.srcObject = null;
    }
    setStatus("⏹️ Camera đã tắt.");
    camBtn.textContent = "📷 Bật Camera";
    handControlParams.cameraOn = false;
  }
});

// ✅ Hàm nội suy tuyến tính
const lerp = (a, b, t) => a + (b - a) * t;

// ✅ Tạo điểm từ hàm 1 biến
function createParametricPoints(fn, [t0, t1], steps) {
  return Array.from({ length: steps + 1 }, (_, i) =>
    fn(lerp(t0, t1, i / steps))
  );
}

// ✅ Tạo đoạn nối từ hàm 2 biến (u, v)
function createParametricSegments(fn, [u0, u1], [v0, v1], segments) {
  const points = [];

  for (let i = 1; i < segments; i++) {
    const u = lerp(u0, u1, i / segments);
    for (let j = 0; j < segments; j++) {
      const v1a = lerp(v0, v1, j / segments);
      const v1b = lerp(v0, v1, (j + 1) / segments);
      points.push(fn(u, v1a), fn(u, v1b)); // vĩ tuyến
    }
  }

  for (let j = 0; j < segments; j++) {
    const v = lerp(v0, v1, j / segments);
    for (let i = 0; i < segments; i++) {
      const u1a = lerp(u0, u1, i / segments);
      const u1b = lerp(u0, u1, (i + 1) / segments);
      points.push(fn(u1a, v), fn(u1b, v)); // kinh tuyến
    }
  }

  return points;
}
// geometryFunctions.js

// 🎯 Mặt cầu 3D
function sphere3D(theta, phi, r = 5) {
  return new THREE.Vector3(
    r * Math.sin(theta) * Math.cos(phi),
    r * Math.sin(theta) * Math.sin(phi),
    r * Math.cos(theta)
  );
}

// ❤️ Trái tim 3D
function heart3D(t, s = 2.5) {
  return new THREE.Vector3(
    s * 16 * Math.pow(Math.sin(t), 3),
    s *
      (13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t)),
    s * 4 * Math.sin(2 * t)
  );
}
// 🔷 Hình xuyến (Torus)
function torus3D(u, v, R = 4, r = 1.5) {
  return new THREE.Vector3(
    (R + r * Math.cos(v)) * Math.cos(u),
    (R + r * Math.cos(v)) * Math.sin(u),
    r * Math.sin(v)
  );
}

// 🔷 Sóng Sin 3D
function wave3D(x, z, A = 1, f = 1) {
  return new THREE.Vector3(x, A * Math.sin(f * (x ** 2 + z ** 2)), z);
}

// 🔷 Hình xoắn ốc
function spiral3D(t, a = 0.1, b = 0.2) {
  return new THREE.Vector3(a * t * Math.cos(t), a * t * Math.sin(t), b * t);
}

// 🔷 Mặt yên ngựa (Hyperbolic Paraboloid)
function saddle3D(x, z) {
  return new THREE.Vector3(x, x * x - z * z, z);
}

// 🔷 Elipsoid
function ellipsoid3D(theta, phi, rx = 4, ry = 2, rz = 1.5) {
  return new THREE.Vector3(
    rx * Math.sin(theta) * Math.cos(phi),
    ry * Math.sin(theta) * Math.sin(phi),
    rz * Math.cos(theta)
  );
}
// 🔶 Mặt Parabol 3D
function paraboloid3D(x, z, a = 0.5) {
  return new THREE.Vector3(x, a * (x * x + z * z), z);
}
// 🔶 Mặt sóng Sin-Cos 3D
function sincosWave3D(x, z, a = 1) {
  return new THREE.Vector3(x, a * Math.sin(x) * Math.cos(z), z);
}
// 🔶 Mobius Strip (Dải Mobius)
function mobius3D(u, v, R = 2) {
  const halfV = v / 2;
  return new THREE.Vector3(
    Math.cos(u) * (R + halfV * Math.cos(u / 2)),
    Math.sin(u) * (R + halfV * Math.cos(u / 2)),
    halfV * Math.sin(u / 2)
  );
}
// 🔶 Hình Chóp Xoay (Cone)
function cone3D(theta, h, r = 1) {
  return new THREE.Vector3(
    r * (1 - h) * Math.cos(theta),
    h,
    r * (1 - h) * Math.sin(theta)
  );
}
// 🔶 Cycloid 3D
function cycloid3D(t, r = 1) {
  return new THREE.Vector3(r * (t - Math.sin(t)), 0, r * (1 - Math.cos(t)));
}

// 🎯 Tạo các đối tượng hình học
const heart = new THREE.LineLoop(
  new THREE.BufferGeometry().setFromPoints(
    createParametricPoints(heart3D, [0, Math.PI * 2], 500)
  ),
  new THREE.LineBasicMaterial({ color: 0xff66cc })
);

const sphere = new THREE.LineSegments(
  new THREE.BufferGeometry().setFromPoints(
    createParametricSegments(sphere3D, [0, Math.PI], [0, Math.PI * 2], 30)
  ),
  new THREE.LineBasicMaterial({ color: 0x66ccff })
);

const torus = new THREE.LineSegments(
  new THREE.BufferGeometry().setFromPoints(
    createParametricSegments(torus3D, [0, Math.PI * 2], [0, Math.PI * 2], 50)
  ),
  new THREE.LineBasicMaterial({ color: 0xffcc00 })
);

const spiral = new THREE.LineLoop(
  new THREE.BufferGeometry().setFromPoints(
    createParametricPoints(spiral3D, [0, 10 * Math.PI], 1000)
  ),
  new THREE.LineBasicMaterial({ color: 0x00ff99 })
);

const wave = new THREE.LineSegments(
  new THREE.BufferGeometry().setFromPoints(
    createParametricSegments(wave3D, [-5, 5], [-5, 5], 50)
  ),
  new THREE.LineBasicMaterial({ color: 0x3366ff })
);

const saddle = new THREE.LineSegments(
  new THREE.BufferGeometry().setFromPoints(
    createParametricSegments(saddle3D, [-3, 3], [-3, 3], 50)
  ),
  new THREE.LineBasicMaterial({ color: 0xff6666 })
);

const ellipsoid = new THREE.LineSegments(
  new THREE.BufferGeometry().setFromPoints(
    createParametricSegments(ellipsoid3D, [0, Math.PI], [0, Math.PI * 2], 30)
  ),
  new THREE.LineBasicMaterial({ color: 0x00ccff })
);
// 🔶 Mặt Parabol 3D
const paraboloid = new THREE.LineSegments(
  new THREE.BufferGeometry().setFromPoints(
    createParametricSegments(paraboloid3D, [-3, 3], [-3, 3], 50)
  ),
  new THREE.LineBasicMaterial({ color: 0xcc00cc })
);

// 🔶 Sóng Sin-Cos 3D
const sincosWave = new THREE.LineSegments(
  new THREE.BufferGeometry().setFromPoints(
    createParametricSegments(sincosWave3D, [-5, 5], [-5, 5], 50)
  ),
  new THREE.LineBasicMaterial({ color: 0x00cccc })
);

// 🔶 Dải Mobius
const mobius = new THREE.LineSegments(
  new THREE.BufferGeometry().setFromPoints(
    createParametricSegments(mobius3D, [0, Math.PI * 2], [-1, 1], 100)
  ),
  new THREE.LineBasicMaterial({ color: 0xff9966 })
);

// 🔶 Hình Chóp Xoay (Cone)
const cone = new THREE.LineSegments(
  new THREE.BufferGeometry().setFromPoints(
    createParametricSegments(cone3D, [0, Math.PI * 2], [0, 1], 50)
  ),
  new THREE.LineBasicMaterial({ color: 0x9999ff })
);

// 🔶 Cycloid 3D
const cycloid = new THREE.LineLoop(
  new THREE.BufferGeometry().setFromPoints(
    createParametricPoints(cycloid3D, [0, 4 * Math.PI], 300)
  ),
  new THREE.LineBasicMaterial({ color: 0xffcc99 })
);

// ✅ Danh sách đối tượng để xử lý chung
const allObjects = {
  heart,
  sphere,
  torus,
  spiral,
  wave,
  saddle,
  ellipsoid,
  paraboloid,
  sincosWave,
  mobius,
  cone,
  cycloid,
};

Object.values(allObjects).forEach((obj) => {
  obj.visible = false;
  worldGroup.add(obj);
});

// Toggle visibility
function toggle(...objects) {
  objects.forEach((obj) => {
    if (obj) obj.visible = !obj.visible;
  });
}

// Vẽ đồ thị mặt
let surfaceMesh;
let formulaLabel; // thêm dòng này

function plotSurface(options = {}) {
  // Lấy tham số từ options hoặc dùng mặc định
  const {
    formula = "z=x^2+y^2",
    mode = "surface",
    resolution = 50,
    lightMode = "soft",
    xMin = -5,
    xMax = 5,
    yMin = -5,
    yMax = 5,
  } = options;

  // Chuẩn hóa công thức
  let formulaRaw = formula
    .toLowerCase()
    .replace(/−/g, "-") // dấu trừ unicode
    .replace(/×/g, "*") // dấu nhân unicode
    .replace(/÷/g, "/") // dấu chia unicode
    .replace(/\s+/g, ""); // xoá khoảng trắng

  // Xác định biến phụ thuộc
  let depVar = null;
  const vars = ["x", "y", "z"];
  let indepVars = [];

  for (let v of vars) {
    if (formulaRaw.startsWith(v + "=")) {
      depVar = v;
      indepVars = vars.filter((w) => w !== v);
      break;
    }
  }

  if (!depVar) {
    alert("❗ Vui lòng nhập công thức dưới dạng: z = f(x, y)");
    return;
  }

  const exprBody = formulaRaw.split("=")[1];
  let expr;
  try {
    expr = math.compile(exprBody);
  } catch (e) {
    alert("Lỗi công thức: " + e.message);
    return;
  }

  // Xoá mesh cũ nếu có
  if (surfaceMesh) worldGroup.remove(surfaceMesh);

  const geometry = new THREE.BufferGeometry();
  const stepX = (xMax - xMin) / resolution;
  const stepY = (yMax - yMin) / resolution;
  const countX = resolution + 1;
  const countY = resolution + 1;
  const points = [];

  for (let i = 0; i <= resolution; i++) {
    const u = xMin + i * stepX;
    for (let j = 0; j <= resolution; j++) {
      const v = yMin + j * stepY;
      let x = 0,
        y = 0,
        z = 0;
      const varsObj = {};
      varsObj[indepVars[0]] = u;
      varsObj[indepVars[1]] = v;
      try {
        const result = expr.evaluate(varsObj);
        if (depVar === "x") {
          x = result;
          y = u;
          z = v;
        } else if (depVar === "y") {
          x = u;
          y = result;
          z = v;
        } else {
          x = u;
          y = v;
          z = result;
        }
      } catch (e) {
        x = y = z = NaN;
      }
      points.push(x, y, z);
    }
  }

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(points, 3)
  );

  // === UV mapping ===
  const uv = [];
  for (let i = 0; i <= resolution; i++) {
    const u = xMin + i * stepX;
    for (let j = 0; j <= resolution; j++) {
      const v = yMin + j * stepY;
      const uCoord = (u - xMin) / (xMax - xMin);
      const vCoord = (v - yMin) / (yMax - yMin);
      uv.push(uCoord, vCoord);
    }
  }
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));

  if (mode === "surface") {
    const indices = [];
    for (let i = 0; i < countX - 1; i++) {
      for (let j = 0; j < countY - 1; j++) {
        const a = i * countY + j;
        const b = a + 1;
        const c = a + countY;
        const d = c + 1;
        indices.push(a, b, d, a, d, c);
      }
    }
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    let material;
    if (lightMode === "wireframe") {
      material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
      });
    } else {
      const texLoader = new THREE.TextureLoader();
      const texture = texLoader.load(
        "https://threejsfundamentals.org/threejs/resources/images/checker.png"
      );
      material = new THREE.MeshStandardMaterial({
        color: 0x00ffff,
        map: texture,
        metalness: 0.5,
        roughness: lightMode === "soft" ? 0.9 : 0.3,
        flatShading: lightMode === "strong",
        side: THREE.DoubleSide,
      });
    }
    surfaceMesh = new THREE.Mesh(geometry, material);
  } else {
    const group = new THREE.Group();
    for (let i = 0; i < countX; i++) {
      const linePoints = [];
      for (let j = 0; j < countY; j++) {
        const idx = i * countY + j;
        linePoints.push(
          new THREE.Vector3(
            points[idx * 3],
            points[idx * 3 + 1],
            points[idx * 3 + 2]
          )
        );
      }
      const geo = new THREE.BufferGeometry().setFromPoints(linePoints);
      group.add(
        new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffff00 }))
      );
    }
    for (let j = 0; j < countY; j++) {
      const linePoints = [];
      for (let i = 0; i < countX; i++) {
        const idx = i * countY + j;
        linePoints.push(
          new THREE.Vector3(
            points[idx * 3],
            points[idx * 3 + 1],
            points[idx * 3 + 2]
          )
        );
      }
      const geo = new THREE.BufferGeometry().setFromPoints(linePoints);
      group.add(
        new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffaa00 }))
      );
    }
    surfaceMesh = group;
  }

  worldGroup.add(surfaceMesh);
  if (formulaLabel) worldGroup.remove(formulaLabel);
  formulaLabel = createFormulaLabel(formulaRaw, new THREE.Vector3(0, 0, 0));
  worldGroup.add(formulaLabel);
}

function plotPrimitive() {
  const choice = document.getElementById("primitiveShape").value;
  let mesh;
  const material = new THREE.MeshStandardMaterial({ color: 0x33ffff });

  switch (choice) {
    case "cube":
      mesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), material);
      break;
    case "sphere":
      mesh = new THREE.Mesh(new THREE.SphereGeometry(7, 32, 32), material);
      break;
    case "cylinder":
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 15, 32), material);
      break;
    case "cone":
      mesh = new THREE.Mesh(new THREE.ConeGeometry(5, 15, 32), material);
      break;
    case "circle":
      mesh = new THREE.Mesh(new THREE.CircleGeometry(8, 32), material);
      break;
    case "ellipse":
      const ellipse = new THREE.Shape();
      ellipse.absellipse(0, 0, 8, 4, 0, Math.PI * 2, false, 0);
      const ellipseGeom = new THREE.ShapeGeometry(ellipse);
      mesh = new THREE.Mesh(ellipseGeom, material);
      break;
    case "triangle":
      const triShape = new THREE.Shape();
      triShape.moveTo(0, 10);
      triShape.lineTo(-8.66, -5);
      triShape.lineTo(8.66, -5);
      triShape.lineTo(0, 10);
      const triGeom = new THREE.ShapeGeometry(triShape);
      mesh = new THREE.Mesh(triGeom, material);
      break;
    case "pentagon":
      mesh = polygonMesh(5, 6, material);
      break;
    case "hexagon":
      mesh = polygonMesh(6, 6, material);
      break;
    case "pyramid":
      const geom = new THREE.ConeGeometry(7, 10, 4);
      mesh = new THREE.Mesh(geom, material);
      break;
    case "plane":
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), material);
      break;
    default:
      alert("Hãy chọn khối hình.");
      return;
  }

  mesh.position.set(
    Math.random() * 20 - 10,
    Math.random() * 20 - 10,
    Math.random() * 20 - 10
  );
  worldGroup.add(mesh);
}

function moveCameraTo(points) {
  const center = new THREE.Vector3();
  points.forEach((p) => center.add(p));
  center.divideScalar(points.length);

  camera.position.set(center.x + 10, center.y + 10, center.z + 10);
  camera.lookAt(center);
}

// Hàm hỗ trợ tạo đa giác 2D đều (pentagon, hexagon,...)
function polygonMesh(sides, radius, material) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const geometry = new THREE.ShapeGeometry(shape);
  return new THREE.Mesh(geometry, material);
}

let customMotionFunc = null;
let lastCompiledCode = "";

// Giữ vị trí gốc ban đầu cho các hiệu ứng như bounce
const originalPositions = new Map();
Object.values(allObjects).forEach((obj) => {
  originalPositions.set(obj, obj.position.clone());
});
let lastLogTime = 0;

function animate(time) {
  requestAnimationFrame(animate);
  controls.update();
  // if (time - lastLogTime > 500) { // mỗi 0.5s
  //   console.log(`Camera position: ${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)}`);
  //   console.log(`Camera lookAt: ${controls.target.x.toFixed(2)}, ${controls.target.y.toFixed(2)}, ${controls.target.z.toFixed(2)}`);
  //   lastLogTime = time;
  // }
  // Xoay cả worldGroup theo góc nhìn
  switch (displayParams.viewAngle) {
    case "top":
      worldGroup.rotation.set(-Math.PI / 2, 0, 0); // nhìn từ trên xuống
      break;
    case "front":
      worldGroup.rotation.set(0, 0, 0); // nhìn chính diện
      break;
    case "right":
      worldGroup.rotation.set(0, Math.PI / 2, 0); // nhìn từ bên phải
      break;
    case "isometric":
      worldGroup.rotation.set(-Math.PI / 4, Math.PI / 4, 0); // góc xiên 3D
      break;
    case "custom":
      // không ép góc, cho xoay tự do bằng OrbitControls
      break;
  }
  // Áp dụng hiệu ứng chuyển động nếu có
  Object.values(allObjects).forEach((obj) => {
    if (!obj.visible) return;

    switch (sampleParams.motionEffect) {
      case "rotateY":
        obj.rotation.y += 0.01;
        break;
      case "rotateX":
        obj.rotation.x += 0.01;
        break;
      case "bounce":
        const orig = originalPositions.get(obj);
        obj.position.y = orig.y + Math.sin(time * 0.005) * 0.5;
        break;
      case "wave":
        obj.rotation.z = Math.sin(time * 0.003) * 0.3;
        obj.position.y = Math.sin(time * 0.002) * 0.4;
        break;
      case "spin":
        obj.rotation.x += 0.01;
        obj.rotation.y += 0.01;
        break;
      case "shake":
        const origShake = originalPositions.get(obj);
        obj.position.x = origShake.x + Math.sin(time * 0.02) * 0.3;
        break;
      case "circle":
        const origCircle = originalPositions.get(obj);
        obj.position.x = origCircle.x + Math.cos(time * 0.002) * 1;
        obj.position.z = origCircle.z + Math.sin(time * 0.002) * 1;
        break;
      case "waveZ":
        obj.rotation.x = Math.sin(time * 0.002) * 0.3;
        obj.position.z = Math.sin(time * 0.003) * 0.4;
        break;
      case "blink":
        if (obj.material) {
          obj.material.transparent = true; // Đảm bảo bật chế độ trong suốt
          obj.material.opacity =
            0.5 + 0.5 * Math.sin(performance.now() * 0.005);
        }
        break;
      case "float":
        obj.position.y = Math.sin(time * 0.002) * 0.5;
        break;
      case "rotate":
        obj.rotation.y += 0.01;
        break;
      case "pulse":
        const s = 1 + 0.3 * Math.sin(time * 0.004);
        obj.scale.set(s, s, s);
        break;
      case "orbit":
        obj.position.x = Math.sin(time * 0.001) * 5;
        obj.position.z = Math.cos(time * 0.001) * 5;
        obj.lookAt(0, 0, 0);
        break;
      case "flashColor":
        const c = 0.5 + Math.sin(time * 0.01) * 0.5;
        obj.material.color.setRGB(c, 0.2, 1 - c);
        break;
    }

    // ✨ Chạy hiệu ứng người dùng viết
    if (sampleParams.customMotionCode.trim()) {
      try {
        // Cố tạo trước function 1 lần duy nhất (nếu khác với lần trước)
        if (sampleParams.customMotionCode !== lastCompiledCode) {
          customMotionFunc = new Function(
            "obj",
            "time",
            sampleParams.customMotionCode
          );
          lastCompiledCode = sampleParams.customMotionCode;
        }
        if (typeof customMotionFunc === "function") {
          customMotionFunc(obj, time);
        }
      } catch (err) {
        console.warn("Lỗi trong custom motion code:", err.message);
        customMotionFunc = null;
      }
    }
  });
  if (autoRotate) scene.rotation.y += 0.001;

  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

//////////////
// // Các hàm được dùng trong HTML cần gán vào window
// window.drawVectorFromInput = drawVectorFromInput;
// window.plotPrimitive = plotPrimitive;
// window.plotSurface = plotSurface;
// window.plotPolar = plotPolar;
// window.plotCustom3D = plotCustom3D;
window.updateLightMode = updateLightMode;
// window.toggle = toggle;
window.gridHelper = gridHelper;
window.axisTicksGroup = axisTicksGroup;
window.sphere = sphere; // nếu bạn đặt `sphereLine` đại diện cho mặt cầu 3D
window.heart = heart;
window.torus = torus;
window.spiral = spiral;
window.wave = wave;
window.saddle = saddle;
window.ellipsoid = ellipsoid;
window.paraboloid = paraboloid;
window.sincosWave = sincosWave;
window.mobius = mobius;
window.cone = cone;
window.cycloid = cycloid;
window.line = heart; // nếu `line` dùng cho đường cong tùy chỉnh
// window.setViewDirection = setViewDirection;
window.oLabel = oLabel;
window.xLabel = xLabel;
window.yLabel = yLabel;
window.zLabel = zLabel;
window.computeIntegral1D = computeIntegral1D;

// ============================================================
// MATH 3D RUNTIME BRIDGE
// ============================================================
//
// Đây là nguồn dữ liệu thật cho GuiHelper / Code Lab.
// Không dùng Math3DAPI làm nguồn ngược lại.
//
// ============================================================

window.Math3DRuntime = {

  get THREE() {
    return THREE;
  },

  get math() {
    return math;
  },

  get scene() {
    return scene;
  },

  get camera() {
    return camera;
  },

  get renderer() {
    return renderer;
  },

  get controls() {
    return controls;
  },

  get worldGroup() {
    return worldGroup;
  },

  get allObjects() {
    return allObjects;
  },

  get sampleParams() {
    return sampleParams;
  },

  get displayParams() {
    return displayParams;
  },

  get createShape() {
    return createShape;
  }

};