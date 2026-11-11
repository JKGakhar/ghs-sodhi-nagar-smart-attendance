/* ==========================================================================
   1. APP STATE & CONSTANTS
   ========================================================================== */
const COOLDOWN_MS = 4000;
let isCooldownActive = false;
let totalScansCount = 0;
let html5QrCode = null;
let availableCameras = [];
let studentsList = [];
let currentPhotoBase64 = null;

// Default SVG passport avatar placeholder (works 100% offline)
const DEFAULT_AVATAR = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 120' width='100' height='120'><rect width='100' height='120' fill='%23e2e8f0'/><circle cx='50' cy='42' r='22' fill='%2364748b'/><path d='M16 112 C16 78, 84 78, 84 112 Z' fill='%2364748b'/></svg>";

// Diverse, high-resolution dummy student portrait photos
const DUMMY_STUDENT_PHOTOS = [
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&h=180&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&h=180&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=180&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=180&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=180&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=180&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=180&fit=crop&crop=face",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=180&fit=crop&crop=face"
];

/* ==========================================================================
   2. DOM REFERENCES
   ========================================================================== */
const attendanceForm     = document.getElementById("attendanceForm");
const rollNumberInput    = document.getElementById("formRollNumber");
const cameraSelect       = document.getElementById("cameraSelect");
const cameraTroubleAlert = document.getElementById("cameraTroubleAlert");
const cameraStatusPill   = document.getElementById("cameraStatusPill");
const statusBanner       = document.getElementById("statusBanner");
const statusIcon         = document.getElementById("statusIcon");
const statusTitle        = document.getElementById("statusTitle");
const statusDesc         = document.getElementById("statusDesc");
const cooldownProgress   = document.getElementById("cooldownProgressBox");
const cooldownBar        = document.getElementById("cooldownBar");
const attendanceLogBody  = document.getElementById("attendanceLogBody");
const emptyRow           = document.getElementById("emptyRow");
const totalScansBadge    = document.getElementById("totalScansBadge");
const liveClock          = document.getElementById("liveClock");
const badgeContainer     = document.getElementById("badgeContainer");
const badgeCounter       = document.getElementById("badgeCounter");

/* ==========================================================================
   3. LIVE DIGITAL CLOCK
   ========================================================================== */
function updateLiveClock() {
  const now = new Date();
  const timeOpts = {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  };
  const dateOpts = { weekday: "short", month: "short", day: "numeric" };
  liveClock.textContent = `${now.toLocaleDateString(undefined, dateOpts)} • ${now.toLocaleTimeString(undefined, timeOpts)}`;
}
setInterval(updateLiveClock, 1000);
updateLiveClock();

/* ==========================================================================
   4. TAB SWITCHING (Scanner vs QR Studio)
   ========================================================================== */
function switchTab(tabName) {
  const tabScanner = document.getElementById("tabBtnScanner");
  const tabGenerator = document.getElementById("tabBtnGenerator");
  const paneScanner = document.getElementById("paneScanner");
  const paneGenerator = document.getElementById("paneGenerator");

  if (tabName === "scanner") {
    tabScanner.classList.add("active");
    tabGenerator.classList.remove("active");
    paneScanner.classList.add("active");
    paneGenerator.classList.remove("active");
  } else {
    tabGenerator.classList.add("active");
    tabScanner.classList.remove("active");
    paneGenerator.classList.add("active");
    paneScanner.classList.remove("active");
  }
}

function switchSubTab(subTab) {
  const subSingle = document.getElementById("subTabSingle");
  const subBulk = document.getElementById("subTabBulk");
  const formSingle = document.getElementById("formSingle");
  const formBulk = document.getElementById("formBulk");

  if (subTab === "single") {
    subSingle.classList.add("active");
    subBulk.classList.remove("active");
    formSingle.style.display = "block";
    formBulk.style.display = "none";
  } else {
    subBulk.classList.add("active");
    subSingle.classList.remove("active");
    formSingle.style.display = "none";
    formBulk.style.display = "block";
  }
}

/* ==========================================================================
   5. WEB AUDIO SYNTHESIZER (Success Chime & Duplicate Warning Buzzer)
   ========================================================================== */
function playSuccessBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioCtx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
  } catch (err) {
    console.warn("Web Audio API unavailable:", err);
  }
}

function playWarningBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioCtx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(380, audioCtx.currentTime);
    osc.frequency.setValueAtTime(260, audioCtx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  } catch (err) {
    console.warn("Web Audio API warning tone error:", err);
  }
}

/* ==========================================================================
   6. PHOTO & SCHOOL DETAILS HELPER
   ========================================================================== */
function previewStudentPhoto(input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = function(e) {
      currentPhotoBase64 = e.target.result;
      const thumb = document.getElementById("singlePhotoThumb");
      if (thumb) {
        thumb.src = currentPhotoBase64;
        thumb.style.display = "block";
      }
    };
    reader.readAsDataURL(file);
  }
}

function getStudentPhoto(photoUrl, name, roll) {
  if (photoUrl && String(photoUrl).trim().length > 5) {
    return String(photoUrl).trim();
  }
  // Assign a consistent, realistic dummy student photo
  let seed = 0;
  if (roll) {
    seed = parseInt(roll, 10) || 0;
  } else if (name) {
    seed = name.charCodeAt(0) + (name.length || 0);
  }
  return DUMMY_STUDENT_PHOTOS[Math.abs(seed) % DUMMY_STUDENT_PHOTOS.length];
}

function getSchoolProfile() {
  const school = document.getElementById("schoolNameInput")?.value.trim() || "GHS Sodhi Nagar";
  const udise  = document.getElementById("udiseInput")?.value.trim() || "03110805402";
  const block  = document.getElementById("blockInput")?.value.trim() || "Ghall Khurd";
  const dist   = document.getElementById("districtInput")?.value.trim() || "Ferozepur";
  return { school, udise, block, dist };
}

const schoolInputEl = document.getElementById("schoolNameInput");
if (schoolInputEl) {
  schoolInputEl.addEventListener("input", (e) => {
    const val = e.target.value.trim() || "GHS Sodhi Nagar";
    document.getElementById("headerSchoolName").textContent = `${val} - Smart Attendance`;
  });
}

/* ==========================================================================
   7. DAILY ATTENDANCE & DUPLICATE PREVENTION LOGIC (PER DAY)
   ========================================================================== */
function getTodayDateKey() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `ghs_attendance_${year}-${month}-${day}`;
}

function getTodayRecords() {
  try {
    const raw = localStorage.getItem(getTodayDateKey());
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveTodayRecord(student, timeStr) {
  try {
    const records = getTodayRecords();
    records.push({
      roll: student.roll,
      name: student.name,
      father: student.father,
      dob: student.dob,
      cls: student.cls,
      school: student.school,
      udise: student.udise,
      dist: student.dist,
      block: student.block,
      photo: student.photo || "",
      time: timeStr
    });
    localStorage.setItem(getTodayDateKey(), JSON.stringify(records));
  } catch (e) {
    console.warn("Could not write to localStorage:", e);
  }
}

function isAlreadyMarkedToday(roll) {
  if (!roll) return null;
  const records = getTodayRecords();
  return records.find(
    (r) => String(r.roll).trim().toLowerCase() === String(roll).trim().toLowerCase()
  );
}

function clearTodayAttendance() {
  if (confirm("Are you sure you want to clear today's attendance log? This will reset duplicate tracking for today.")) {
    try {
      localStorage.removeItem(getTodayDateKey());
    } catch (e) {}
    totalScansCount = 0;
    totalScansBadge.textContent = "0 Scanned Today";
    attendanceLogBody.innerHTML = `
      <tr id="emptyRow">
        <td colspan="5">
          <div class="empty-state">
            <span>📋</span>
            <p>No records captured yet in this session.</p>
          </div>
        </td>
      </tr>
    `;
    alert("Today's attendance log and duplicate tracker have been cleared.");
  }
}

function restoreTodayAttendance() {
  const records = getTodayRecords();
  if (records && records.length > 0) {
    if (emptyRow && emptyRow.parentNode) {
      emptyRow.remove();
    }
    totalScansCount = records.length;
    totalScansBadge.textContent = `${totalScansCount} Scanned Today`;

    for (let i = records.length - 1; i >= 0; i--) {
      renderAttendanceRow(records[i], records[i].time);
    }
  }
}

function formatDobForGoogleForm(dobStr) {
  if (!dobStr) return "2010-08-15";
  const clean = String(dobStr).trim();
  // If DD-MM-YYYY or DD/MM/YYYY
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(clean)) {
    const parts = clean.split(/[-/]/);
    return `${parts[2]}-${parts[1]}-${parts[0]}`; // Convert to YYYY-MM-DD for Google Form
  }
  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }
  return clean;
}

/* ==========================================================================
   8. GOOGLE FORMS SUBMISSION (RECORDS ALL 9 FIELDS IN SHEETS)
   ========================================================================== */
function submitToGoogleForms(student) {
  const schoolProfile = getSchoolProfile();
  const schoolVal = student.school || schoolProfile.school || "GHS SODHI NAGAR";
  const udiseVal  = student.udise  || schoolProfile.udise  || "03110805402";
  const distVal   = student.dist   || schoolProfile.dist   || "FEROZEPUR";
  const blockVal  = student.block  || schoolProfile.block  || "GHALL KHURD";
  const rollVal   = String(student.roll || "").trim();
  const nameVal   = String(student.name || "").trim();
  const fatherVal = String(student.father || "").trim();
  const dobVal    = formatDobForGoogleForm(student.dob);
  const classVal  = String(student.cls || "").trim();

  // Populate hidden HTML form inputs for Method A
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };

  setVal("formSchoolName", schoolVal);
  setVal("formUdise", udiseVal);
  setVal("formDistrict", distVal);
  setVal("formBlock", blockVal);
  setVal("formRollNumber", rollVal);
  setVal("formStudentName", nameVal);
  setVal("formFatherName", fatherVal);
  setVal("formDob", dobVal);
  setVal("formClass", classVal);

  // Single, reliable hidden iframe form submission (Sent exactly once per scan)
  try {
    attendanceForm.submit();
    console.log(`[Google Form] Single submission dispatched for: ${nameVal} (Roll: ${rollVal})`);
  } catch (e) {
    console.error("Google Form submission error:", e);
  }
}

/* ==========================================================================
   9. ATTENDANCE LOG RENDERING & COOLDOWN
   ========================================================================== */
function renderAttendanceRow(student, timeStr) {
  const row = document.createElement("tr");

  row.innerHTML = `
    <td>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span class="roll-chip">#${escapeHtml(student.roll)}</span>
        <strong style="font-size: 0.9rem; color: var(--text-main);">${escapeHtml(student.name)}</strong>
      </div>
    </td>
    <td style="color: #334155;">
      ${escapeHtml(student.father || 'N/A')}
    </td>
    <td>
      <div>${escapeHtml(student.dob || 'N/A')}</div>
      <small style="color: var(--text-muted); font-weight: 600;">${escapeHtml(student.cls || '10th')}</small>
    </td>
    <td>
      <div style="font-weight: 600; color: var(--primary);">${escapeHtml(student.school || 'GHS Sodhi Nagar')}</div>
      <small style="color: var(--text-muted);">UDISE: ${escapeHtml(student.udise || '03110805402')}</small>
    </td>
    <td>
      <div style="color: var(--text-muted); font-size: 0.78rem;">${escapeHtml(timeStr)}</div>
      <span class="status-pill">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Recorded
      </span>
    </td>
  `;
  attendanceLogBody.insertBefore(row, attendanceLogBody.firstChild);
}

function recordAttendance(student, timeStr) {
  if (emptyRow && emptyRow.parentNode) {
    emptyRow.remove();
  }

  totalScansCount++;
  totalScansBadge.textContent = `${totalScansCount} Scanned Today`;

  renderAttendanceRow(student, timeStr);
  triggerSuccessCooldown(student);
}

function triggerSuccessCooldown(student) {
  isCooldownActive = true;

  statusBanner.className = "status-banner success";
  statusIcon.textContent = "✅";
  statusTitle.textContent = `Roll No: ${student.roll} (${student.name}) - Attendance Marked!`;
  statusDesc.textContent = `Father: ${student.father || 'N/A'} • Class: ${student.cls || '10th'} • Saved to Sheets.`;

  cooldownProgress.style.display = "block";
  cooldownBar.style.transition = "none";
  cooldownBar.style.width = "100%";

  setTimeout(() => {
    cooldownBar.style.transition = `width ${COOLDOWN_MS}ms linear`;
    cooldownBar.style.width = "0%";
  }, 50);

  setTimeout(() => {
    if (isCooldownActive) {
      statusBanner.className = "status-banner cooldown";
      statusIcon.textContent = "⏳";
      statusTitle.textContent = "Scanner in Cooldown";
      statusDesc.textContent = "Re-arming camera for next student...";
    }
  }, 1500);

  setTimeout(() => {
    isCooldownActive = false;
    cooldownProgress.style.display = "none";
    statusBanner.className = "status-banner ready";
    statusIcon.textContent = "📷";
    statusTitle.textContent = "Scanner Ready";
    statusDesc.textContent = "Position student QR code within camera frame.";
  }, COOLDOWN_MS);
}

function triggerDuplicateAlert(student, existingRecord) {
  isCooldownActive = true;

  statusBanner.className = "status-banner duplicate";
  statusIcon.textContent = "🚫";
  statusTitle.textContent = `Already Marked Today: #${student.roll} (${student.name})`;
  statusDesc.textContent = `Attendance was already recorded today at ${existingRecord.time || 'earlier'}. Duplicate record blocked!`;

  cooldownProgress.style.display = "block";
  cooldownBar.style.transition = "none";
  cooldownBar.style.width = "100%";

  const DUPLICATE_COOLDOWN = 2800;
  setTimeout(() => {
    cooldownBar.style.transition = `width ${DUPLICATE_COOLDOWN}ms linear`;
    cooldownBar.style.width = "0%";
  }, 50);

  setTimeout(() => {
    isCooldownActive = false;
    cooldownProgress.style.display = "none";
    statusBanner.className = "status-banner ready";
    statusIcon.textContent = "📷";
    statusTitle.textContent = "Scanner Ready";
    statusDesc.textContent = "Position student QR code within camera frame.";
  }, DUPLICATE_COOLDOWN);
}

/* ==========================================================================
   10. CAMERA INITIALIZATION & NOTREADABLEERROR HANDLING
   ========================================================================== */
async function initCameraSystem() {
  html5QrCode = new Html5Qrcode("reader");

  try {
    availableCameras = await Html5Qrcode.getCameras();
    cameraSelect.innerHTML = "";

    if (availableCameras && availableCameras.length > 0) {
      availableCameras.forEach((cam, index) => {
        const opt = document.createElement("option");
        opt.value = cam.id;
        opt.text = cam.label || `Camera ${index + 1}`;
        cameraSelect.appendChild(opt);
      });

      // Automatically switch and start camera whenever user changes dropdown selection
      cameraSelect.onchange = () => {
        startSelectedCamera();
      };

      startSelectedCamera();
    } else {
      cameraSelect.innerHTML = '<option value="">No cameras detected</option>';
      cameraStatusPill.textContent = "No Hardware Found";
    }
  } catch (err) {
    handleCameraError(err);
  }
}

async function startSelectedCamera() {
  const cameraId = cameraSelect.value;
  if (!cameraId || !html5QrCode) return;

  cameraTroubleAlert.style.display = "none";
  cameraStatusPill.textContent = "Switching camera...";
  cameraStatusPill.style.color = "var(--warning)";

  if (html5QrCode.isScanning) {
    try {
      await html5QrCode.stop();
      // Allow 100ms for OS to cleanly release previous video stream lock
      await new Promise(r => setTimeout(r, 100));
    } catch (e) {
      console.warn("Error stopping previous stream", e);
    }
  }

  const config = {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    aspectRatio: 1.0,
  };

  html5QrCode
    .start(
      cameraId,
      config,
      (decodedText) => onScanSuccess(decodedText),
      (errorMessage) => {
        /* Frame scan seeking */
      }
    )
    .then(() => {
      cameraStatusPill.textContent = "● Camera Active";
      cameraStatusPill.style.color = "var(--success)";
    })
    .catch((err) => {
      handleCameraError(err);
    });
}

async function stopCamera() {
  if (html5QrCode && html5QrCode.isScanning) {
    await html5QrCode.stop();
    cameraStatusPill.textContent = "Stopped";
    cameraStatusPill.style.color = "var(--text-muted)";
  }
}

function handleCameraError(err) {
  console.error("Camera initialization failed:", err);
  cameraStatusPill.textContent = "Error Starting";
  cameraStatusPill.style.color = "var(--danger)";

  const errString = (err && err.toString()) || "";
  if (
    errString.includes("NotReadableError") ||
    err.name === "NotReadableError"
  ) {
    cameraTroubleAlert.style.display = "block";
  } else if (
    errString.includes("NotAllowedError") ||
    err.name === "NotAllowedError"
  ) {
    statusBanner.className = "status-banner cooldown";
    statusTitle.textContent = "Permission Denied";
    statusDesc.textContent = "Please click the lock/camera icon in your browser URL bar to allow camera access.";
  }
}

/* ==========================================================================
   11. SCAN EVENT HANDLER (WITH STRICT PER-DAY DUPLICATE PREVENTION)
   ========================================================================== */
function onScanSuccess(decodedText) {
  if (isCooldownActive) return;

  const raw = decodedText.trim();
  if (!raw) return;

  // Immediately lock to prevent camera frame-burst from processing twice
  isCooldownActive = true;

  let student = null;
  const profile = getSchoolProfile();

  try {
    student = JSON.parse(raw);
    if (!student.school) student.school = profile.school;
    if (!student.udise)  student.udise  = profile.udise;
    if (!student.dist)   student.dist   = profile.dist;
    if (!student.block)  student.block  = profile.block;
  } catch (e) {
    if (raw.includes("|")) {
      const parts = raw.split("|").map(p => p.trim());
      student = {
        roll:   parts[0] || "Unknown",
        name:   parts[1] || `Roll ${parts[0]}`,
        father: parts[2] || "N/A",
        dob:    parts[3] || "N/A",
        cls:    parts[4] || "Class 10-A",
        school: parts[5] || profile.school,
        udise:  parts[6] || profile.udise,
        dist:   parts[7] || profile.dist,
        block:  parts[8] || profile.block
      };
    } else {
      student = {
        roll:   raw,
        name:   `Student ${raw}`,
        father: "N/A",
        dob:    "N/A",
        cls:    "Class 10-A",
        school: profile.school,
        udise:  profile.udise,
        dist:   profile.dist,
        block:  profile.block
      };
    }
  }

  // Look up student from in-memory cards to get their photo if available
  const existingCard = studentsList.find(s => String(s.roll) === String(student.roll));
  if (existingCard && existingCard.photo) {
    student.photo = existingCard.photo;
  }

  // Strict daily duplicate check
  const existingRecord = isAlreadyMarkedToday(student.roll);
  if (existingRecord) {
    playWarningBeep();
    triggerDuplicateAlert(student, existingRecord);
    return;
  }

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  playSuccessBeep();
  submitToGoogleForms(student);
  saveTodayRecord(student, timeStr);
  recordAttendance(student, timeStr);
}

function scanImageFile(inputElement) {
  if (!inputElement.files || inputElement.files.length === 0) return;
  const file = inputElement.files[0];

  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("reader");
  }

  html5QrCode
    .scanFile(file, true)
    .then((decodedText) => {
      onScanSuccess(decodedText);
    })
    .catch((err) => {
      alert("Could not detect a valid QR code in that image. Please try another image.");
    });
}

/* ==========================================================================
   12. STUDENT QR STUDIO & ID CARD GENERATOR
   ========================================================================== */
function addSingleStudent() {
  const roll   = document.getElementById("singleRoll").value.trim();
  const name   = document.getElementById("singleName").value.trim();
  const father = document.getElementById("singleFather").value.trim();
  const dob    = document.getElementById("singleDob").value.trim();
  const cls    = document.getElementById("singleClass").value.trim() || "Class 10-A";

  if (!roll || !name || !father) {
    alert("Please fill in Roll Number, Student Name, and Father's Name.");
    return;
  }

  const profile = getSchoolProfile();

  const photoUrlInput = document.getElementById("singlePhotoUrl")?.value.trim() || "";

  const student = {
    roll,
    name,
    father,
    dob: formatDate(dob),
    cls,
    school: profile.school,
    udise: profile.udise,
    block: profile.block,
    dist: profile.dist,
    photo: currentPhotoBase64 || getStudentPhoto(photoUrlInput, name, roll)
  };

  createStudentCard(student);

  // Reset inputs
  document.getElementById("singleRoll").value = "";
  document.getElementById("singleName").value = "";
  document.getElementById("singleFather").value = "";
  document.getElementById("singlePhotoFile").value = "";
  const thumb = document.getElementById("singlePhotoThumb");
  if (thumb) {
    thumb.src = "";
    thumb.style.display = "none";
  }
  currentPhotoBase64 = null;
}

function handleCSVFile(input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  const reader = new FileReader();

  reader.onload = function (e) {
    const text = e.target.result;
    document.getElementById("bulkTextInput").value = text;
    processBulkText();
  };
  reader.readAsText(file);
}

function processBulkText() {
  const raw = document.getElementById("bulkTextInput").value.trim();
  if (!raw) {
    alert("Please enter student details or upload a CSV.");
    return;
  }

  const profile = getSchoolProfile();
  const lines = raw.split(/\r?\n/);

  lines.forEach((line) => {
    const parts = line.split(",").map(p => p.trim());
    if (parts.length >= 2) {
      const roll = parts[0];
      const name = parts[1];

      // Skip CSV header rows
      if (
        roll.toLowerCase().includes("roll") ||
        name.toLowerCase().includes("name")
      ) {
        return;
      }

      const father   = parts[2] ? parts[2] : "Sh. Guardian";
      const dob      = parts[3] ? formatDate(parts[3]) : "15-08-2010";
      const cls      = parts[4] ? parts[4] : "Class 10-A";
      const school   = parts[5] && !parts[5].startsWith("http") ? parts[5] : profile.school;
      const udise    = parts[6] ? parts[6] : profile.udise;
      const dist     = parts[7] ? parts[7] : profile.dist;
      const block    = parts[8] ? parts[8] : profile.block;
      const photoUrl = parts[9] || (parts[5] && parts[5].startsWith("http") ? parts[5] : "");

      if (roll && name) {
        createStudentCard({
          roll,
          name,
          father,
          dob,
          cls,
          school,
          udise,
          dist,
          block,
          photo: getStudentPhoto(photoUrl, name)
        });
      }
    }
  });
}

function loadSampleData() {
  const sample = [
    "101, Aarav Sharma, Sh. Rajesh Sharma, 15-08-2010, Class 10-A, GHS Sodhi Nagar, 03110805402, FEROZEPUR, GHALL KHURD, https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&h=180&fit=crop&crop=faces",
    "102, Simran Kaur, Sh. Gurdeep Singh, 12-05-2010, Class 10-A, GHS Sodhi Nagar, 03110805402, FEROZEPUR, GHALL KHURD, https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&h=180&fit=crop&crop=faces",
    "103, Rohan Verma, Sh. Ashok Verma, 22-11-2009, Class 10-B, GHS Sodhi Nagar, 03110805402, FEROZEPUR, GHALL KHURD, https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=180&fit=crop&crop=faces",
    "104, Priya Patel, Sh. Mukesh Patel, 08-03-2010, Class 10-B, GHS Sodhi Nagar, 03110805402, FEROZEPUR, GHALL KHURD, https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=180&fit=crop&crop=faces",
    "105, Gurpreet Singh, Sh. Balwinder Singh, 19-09-2010, Class 10-A, GHS Sodhi Nagar, 03110805402, FEROZEPUR, GHALL KHURD, https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=180&fit=crop&crop=faces",
    "106, Jasleen Kaur, Sh. Harjit Singh, 04-01-2010, Class 10-B, GHS Sodhi Nagar, 03110805402, FEROZEPUR, GHALL KHURD, https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=180&fit=crop&crop=faces"
  ].join("\n");

  document.getElementById("bulkTextInput").value = sample;
  processBulkText();
}

/**
 * Robust multi-tier QR code renderer.
 * Prevents "code length overflow" and empty QR slots by using:
 * 1. Compact pipe format (clean, ~90-115 chars, never overflows v10 capacity)
 * 2. Automatic fallback ladder: Level M (15%) -> Level L (7%) -> Minimal -> API fallback
 * 3. Strict try/catch wrapping so no student card ever remains empty.
 */
function renderStudentQRCode(holder, student) {
  if (!holder) return;
  holder.innerHTML = "";

  const profile = getSchoolProfile();
  const school  = student.school || profile.school || "GHS SODHI NAGAR";
  const udise   = student.udise  || profile.udise  || "03110805402";
  const dist    = student.dist   || profile.dist   || "FEROZEPUR";
  const block   = student.block  || profile.block  || "GHALL KHURD";
  const roll    = String(student.roll || "").trim();
  const name    = String(student.name || "").trim();
  const father  = String(student.father || "").trim();
  const dob     = String(student.dob || "").trim();
  const cls     = String(student.cls || "").trim();

  // Primary compact payload: 9 fields separated by pipes (clean, ~90-115 chars, never overflows v10)
  const pipePayload = [roll, name, father, dob, cls, school, udise, dist, block].join("|");

  const jsonPayload = JSON.stringify({
    roll: roll,
    name: name,
    father: father,
    dob: dob,
    cls: cls,
    school: school,
    udise: udise,
    dist: dist,
    block: block
  });

  let isRendered = false;

  if (typeof QRCode !== "undefined") {
    // Strategy 1: Compact Pipe payload with Level M (15% error correction, crisp modules, up to 213 chars)
    try {
      new QRCode(holder, {
        text: pipePayload,
        width: 256,
        height: 256,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
      if (holder.querySelector("canvas, img")) {
        isRendered = true;
      }
    } catch (e1) {
      console.warn(`[QR Gen] Pipe Level M failed for Roll ${roll}:`, e1.message);
      holder.innerHTML = "";
    }

    // Strategy 2: Compact Pipe payload with Level L (7% error correction, max capacity up to 271 chars)
    if (!isRendered) {
      try {
        new QRCode(holder, {
          text: pipePayload,
          width: 256,
          height: 256,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.L
        });
        if (holder.querySelector("canvas, img")) {
          isRendered = true;
        }
      } catch (e2) {
        console.warn(`[QR Gen] Pipe Level L failed for Roll ${roll}:`, e2.message);
        holder.innerHTML = "";
      }
    }

    // Strategy 3: Try JSON payload with Level L if compact was bypassed
    if (!isRendered) {
      try {
        new QRCode(holder, {
          text: jsonPayload,
          width: 256,
          height: 256,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.L
        });
        if (holder.querySelector("canvas, img")) {
          isRendered = true;
        }
      } catch (e3) {
        console.warn(`[QR Gen] JSON Level L failed for Roll ${roll}:`, e3.message);
        holder.innerHTML = "";
      }
    }

    // Strategy 4: Minimal Roll + Name payload with Level M
    if (!isRendered) {
      try {
        new QRCode(holder, {
          text: `${roll}|${name}|${school}`,
          width: 256,
          height: 256,
          colorDark: "#000000",
          colorLight: "#ffffff",
          correctLevel: QRCode.CorrectLevel.M
        });
        if (holder.querySelector("canvas, img")) {
          isRendered = true;
        }
      } catch (e4) {
        console.warn(`[QR Gen] Minimal payload failed for Roll ${roll}:`, e4.message);
        holder.innerHTML = "";
      }
    }
  }

  // Strategy 5: High-resolution server API fallback if client-side library is absent or all local attempts failed
  if (!isRendered) {
    const fallbackText = encodeURIComponent(pipePayload);
    const img = document.createElement("img");
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&margin=1&data=${fallbackText}`;
    img.alt = `Student QR ${roll}`;
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "contain";
    img.style.imageRendering = "pixelated";
    holder.appendChild(img);
  }
}

function createStudentCard(student) {
  student.photo = student.photo || getStudentPhoto(null, student.name);
  studentsList.push(student);
  badgeCounter.textContent = `${studentsList.length} Cards Generated`;

  const card = document.createElement("div");
  card.className = "id-card-wrapper";
  const uniqueId = `qr-${student.roll}-${studentsList.length}-${Math.random().toString(36).substring(2, 7)}`;

  card.innerHTML = `
    <!-- Exact Physical CR80 Size Card (85.6mm × 54mm) -->
    <div class="student-id-card">
      <div class="card-top-tag">STUDENT IDENTITY CARD</div>

      <div class="id-card-header">
        <div class="school-title">${escapeHtml(student.school || 'GHS SODHI NAGAR')}</div>
        <div class="school-udise">UDISE: ${escapeHtml(student.udise || '03110805402')}</div>
        <div class="school-loc">Block: ${escapeHtml(student.block || 'GHALL KHURD')} • Dist: ${escapeHtml(student.dist || 'FEROZEPUR')}</div>
      </div>
      
      <div class="id-card-body">
        <!-- Photo and QR Code Side-by-Side -->
        <div class="photo-qr-side-by-side">
          <div class="photo-container-compact">
            <img src="${escapeHtml(student.photo)}" alt="${escapeHtml(student.name)}" class="student-photo" onerror="this.onerror=null;this.src='${DEFAULT_AVATAR}';" />
          </div>
          <div class="qr-canvas-holder-compact" id="${uniqueId}"></div>
        </div>

        <!-- Student Name & Badges -->
        <div class="student-name-vertical">${escapeHtml(student.name)}</div>
        <div class="id-card-badges-row-vertical">
          <span class="roll-badge">Roll: ${escapeHtml(student.roll)}</span>
          <span class="class-badge">${escapeHtml(student.cls)}</span>
        </div>

        <!-- Key-Value Details Box -->
        <div class="student-details-list">
          <div class="detail-row">
            <span class="detail-label">Father's Name:</span>
            <span class="detail-value">${escapeHtml(student.father)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">Date of Birth:</span>
            <span class="detail-value">${escapeHtml(student.dob)}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">School Code:</span>
            <span class="detail-value">${escapeHtml(student.udise || '03110805402')}</span>
          </div>
        </div>

        <!-- Official Signatures Row (Eliminates bottom empty void) -->
        <div class="card-signatures-row">
          <div class="sign-block">Student Sign</div>
          <div class="sign-block">Principal Sign</div>
        </div>
      </div>

      <div class="id-card-footer-bar">
        ACADEMIC SESSION: 2026-27
      </div>
    </div>

    <!-- On-screen Action buttons (Hidden during PDF/printing) -->
    <div class="id-card-actions">
      <button class="btn btn-secondary" onclick="downloadQRCode('${uniqueId}', '${student.roll}')">💾 Save QR</button>
      <button class="btn btn-primary" onclick="testInScanner('${student.roll}')">⚡ Test Scan</button>
    </div>
  `;

  badgeContainer.appendChild(card);

  // Synchronously render QR code without fragile setTimeout delay
  const holder = card.querySelector(`#${uniqueId}`);
  if (holder) {
    renderStudentQRCode(holder, student);
    // Asynchronous double-check to guarantee element exists in all browser environments
    if (!holder.querySelector("canvas, img")) {
      setTimeout(() => renderStudentQRCode(holder, student), 40);
    }
  }
}

function setCardZoom(zoomLevel, btn) {
  document.documentElement.style.setProperty('--card-zoom', zoomLevel);
  document.querySelectorAll('.zoom-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function clearAllBadges() {
  studentsList = [];
  badgeContainer.innerHTML = "";
  badgeCounter.textContent = "0 Cards Generated";
}

function downloadQRCode(holderId, roll) {
  const holder = document.getElementById(holderId);
  if (!holder) return;
  const img = holder.querySelector("img");
  const canvas = holder.querySelector("canvas");

  let dataUrl = "";
  if (canvas) {
    dataUrl = canvas.toDataURL("image/png");
  } else if (img) {
    dataUrl = img.src;
  }

  if (dataUrl) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `Student_Roll_${roll}_QR.png`;
    a.click();
  }
}

function testInScanner(roll) {
  switchTab("scanner");
  const student = studentsList.find(s => String(s.roll) === String(roll)) || {
    roll: roll,
    name: "Student " + roll,
    father: "N/A",
    dob: "N/A",
    cls: "Class 10",
    school: getSchoolProfile().school,
    udise: getSchoolProfile().udise,
    block: getSchoolProfile().block,
    dist: getSchoolProfile().dist,
    photo: getStudentPhoto(null, "Student " + roll, roll)
  };
  onScanSuccess(JSON.stringify(student));
}

function formatDate(dateStr) {
  if (!dateStr) return "15-08-2010";
  if (dateStr.includes("-") && dateStr.split("-")[0].length === 4) {
    const [y, m, d] = dateStr.split("-");
    return `${d}-${m}-${y}`;
  }
  return dateStr;
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

/* ==========================================================================
   13. ONLOAD INITIALIZATION
   ========================================================================== */
window.addEventListener("DOMContentLoaded", () => {
  restoreTodayAttendance();
  initCameraSystem();
});
