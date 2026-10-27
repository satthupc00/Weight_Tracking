// ===================================================================
// Đồng bộ Firebase (Auth email/mật khẩu + Firestore) qua REST API — không cần SDK nặng.
// Dữ liệu vẫn nằm trên máy là chính: mất mạng app chạy bình thường, có mạng thì tự đồng bộ.
// Mỗi lần cân là 1 tài liệu users/{uid}/entries/{YYYY-MM-DD} {weight, note, updatedAt, deleted}.
// Gộp dữ liệu: cùng 1 ngày, bản có updatedAt mới hơn thắng (kể cả bản "đã xoá").
// Mục tiêu + hạn chót + chiều cao ở tài liệu users/{uid} {goal, deadline, height, settingsUpdatedAt}.
// Created by Mondiro
// ===================================================================
(function () {
  const CFG = window.WT_FIREBASE || {};
  const CONFIGURED = !!(CFG.apiKey && CFG.projectId);
  const AUTH_KEY = 'wt_fb_auth_v1';      // {email, uid, refreshToken}
  const LAST_SYNC_KEY = 'wt_fb_last_sync_v1';
  const FS_BASE = `https://firestore.googleapis.com/v1/projects/${CFG.projectId}/databases/(default)/documents`;

  let auth = null;            // {email, uid, refreshToken}
  let idToken = null, idTokenExp = 0;
  let syncing = false, pending = false, timer = null;
  let state = 'off';          // off | idle | syncing | error | offline
  let lastError = '';

  const $ = (id) => document.getElementById(id);
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* ignore */ } };
  try { auth = JSON.parse(lsGet(AUTH_KEY) || 'null'); } catch (e) { auth = null; }

  // ---------------- Firebase Auth (REST) ----------------
  const AUTH_MSG = {
    EMAIL_EXISTS: 'Email này đã có tài khoản — bấm Đăng nhập.',
    EMAIL_NOT_FOUND: 'Chưa có tài khoản với email này — bấm Tạo tài khoản.',
    INVALID_PASSWORD: 'Sai mật khẩu.',
    INVALID_LOGIN_CREDENTIALS: 'Sai email hoặc mật khẩu.',
    INVALID_EMAIL: 'Email không hợp lệ.',
    MISSING_PASSWORD: 'Chưa nhập mật khẩu.',
    TOO_MANY_ATTEMPTS_TRY_LATER: 'Thử sai quá nhiều lần, đợi vài phút rồi thử lại.',
    USER_DISABLED: 'Tài khoản đã bị khoá.',
    OPERATION_NOT_ALLOWED: 'Firebase chưa bật đăng nhập Email/Password (xem README).',
    ADMIN_ONLY_OPERATION: 'Firebase đang tắt tạo tài khoản mới.',
  };
  function authError(data) {
    const code = (data && data.error && data.error.message || 'UNKNOWN').split(' ')[0].split(':')[0];
    if (code.startsWith('WEAK_PASSWORD')) return 'Mật khẩu cần ít nhất 6 ký tự.';
    return AUTH_MSG[code] || `Lỗi Firebase: ${code}`;
  }
  async function authCall(path, body) {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/${path}?key=${CFG.apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(authError(data));
    return data;
  }
  function setAuth(email, uid, refreshToken, token, expiresIn) {
    auth = { email, uid, refreshToken };
    lsSet(AUTH_KEY, JSON.stringify(auth));
    idToken = token; idTokenExp = Date.now() + (Number(expiresIn) - 60) * 1000;
  }
  async function getToken() {
    if (idToken && Date.now() < idTokenExp) return idToken;
    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${CFG.apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(auth.refreshToken)}`,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = data && data.error && data.error.message || '';
      if (/TOKEN_EXPIRED|USER_NOT_FOUND|INVALID_REFRESH_TOKEN|USER_DISABLED/.test(code)) { signOut(); throw new Error('Phiên đăng nhập hết hạn, đăng nhập lại nhé.'); }
      throw new Error('Không làm mới được phiên đăng nhập.');
    }
    setAuth(auth.email, data.user_id, data.refresh_token, data.id_token, data.expires_in);
    return idToken;
  }
  async function signIn(email, password, create) {
    const data = await authCall(create ? 'accounts:signUp' : 'accounts:signInWithPassword', { email, password, returnSecureToken: true });
    setAuth(data.email || email, data.localId, data.refreshToken, data.idToken, data.expiresIn);
  }
  function signOut() {
    auth = null; idToken = null; idTokenExp = 0;
    lsSet(AUTH_KEY, null); lsSet(LAST_SYNC_KEY, null);
    setState(CONFIGURED ? 'off' : 'off');
    renderPanel();
  }

  // ---------------- Firestore (REST) ----------------
  async function fsFetch(url, opts = {}) {
    const res = await fetch(url, { ...opts, headers: { 'Authorization': `Bearer ${await getToken()}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
    if (res.status === 404) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data && data.error && data.error.status === 'PERMISSION_DENIED'
        ? 'Firestore từ chối (kiểm tra Rules trong README).' : `Firestore lỗi ${res.status}`;
      throw new Error(msg);
    }
    return data;
  }
  const num = (f) => f ? Number(f.integerValue ?? f.doubleValue ?? 0) : 0;
  async function listRemoteEntries() {
    const out = new Map();
    let pageToken = '';
    do {
      const data = await fsFetch(`${FS_BASE}/users/${auth.uid}/entries?pageSize=300${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`);
      (data && data.documents || []).forEach(doc => {
        const f = doc.fields || {};
        const date = doc.name.split('/').pop();
        out.set(date, {
          date,
          weight: num(f.weight),
          note: f.note ? f.note.stringValue || '' : '',
          updatedAt: num(f.updatedAt),
          deleted: !!(f.deleted && f.deleted.booleanValue),
        });
      });
      pageToken = data && data.nextPageToken || '';
    } while (pageToken);
    return out;
  }
  const entryDoc = (r) => ({
    update: {
      name: `projects/${CFG.projectId}/databases/(default)/documents/users/${auth.uid}/entries/${r.date}`,
      fields: {
        weight: { doubleValue: r.weight || 0 },
        note: { stringValue: r.note || '' },
        updatedAt: { integerValue: String(r.updatedAt || 1) },
        deleted: { booleanValue: !!r.deleted },
      },
    },
  });
  async function commit(writes) {
    for (let i = 0; i < writes.length; i += 400) {
      await fsFetch(`${FS_BASE}:commit`, { method: 'POST', body: JSON.stringify({ writes: writes.slice(i, i + 400) }) });
    }
  }

  // ---------------- gộp dữ liệu 2 chiều ----------------
  async function syncNow() {
    if (!CONFIGURED || !auth) return;
    if (syncing) { pending = true; return; }
    if (!navigator.onLine) { setState('offline'); return; }
    syncing = true; pending = false;
    setState('syncing');
    try {
      const remote = await listRemoteEntries();
      const deleted = loadDeleted();
      const local = new Map(entries.map(e => [e.date, e]));
      const writes = [];
      let localChanged = false;
      const dates = new Set([...local.keys(), ...Object.keys(deleted), ...remote.keys()]);
      dates.forEach(date => {
        const le = local.get(date);
        const lt = le ? (le.updatedAt || 0) : (deleted[date] || 0);
        const r = remote.get(date);
        const rt = r ? r.updatedAt : -1;
        if (r && rt > lt) {               // bản trên Firebase mới hơn → cập nhật máy này
          if (r.deleted) { if (le) { local.delete(date); localChanged = true; } deleted[date] = rt; }
          else { local.set(date, { id: date, date, weight: r.weight, note: r.note, updatedAt: rt }); delete deleted[date]; localChanged = true; }
        } else if (lt > rt || (!r && (le || deleted[date]))) { // máy này mới hơn → đẩy lên
          const stamp = Math.max(lt, 1);
          if (le) {
            if (!le.updatedAt) { local.set(date, { ...le, updatedAt: stamp }); localChanged = true; }
            writes.push(entryDoc({ date, weight: le.weight, note: le.note, updatedAt: stamp }));
          } else {
            writes.push(entryDoc({ date, weight: 0, note: '', updatedAt: stamp, deleted: true }));
          }
        }
      });
      if (writes.length) await commit(writes);

      // mục tiêu + chiều cao
      const sdoc = await fsFetch(`${FS_BASE}/users/${auth.uid}`);
      const sf = sdoc && sdoc.fields || {};
      const rts = num(sf.settingsUpdatedAt), lts = Number(lsGet(SETTINGS_TS_KEY) || 0);
      let settingsChanged = false;
      if (rts > lts) {
        goalWeight = sf.goal && sf.goal.nullValue === undefined ? num(sf.goal) || null : null;
        heightCm = sf.height && sf.height.nullValue === undefined ? num(sf.height) || null : null;
        goalDeadline = sf.deadline && typeof sf.deadline.stringValue === 'string' && sf.deadline.stringValue ? sf.deadline.stringValue : null;
        saveGoal(goalWeight); saveHeight(heightCm); saveDeadline(goalDeadline);
        lsSet(SETTINGS_TS_KEY, String(rts));
        const gi = $('goalInput'), hi = $('heightInput');
        if (gi) gi.value = goalWeight !== null ? goalWeight : '';
        if (hi) hi.value = heightCm !== null ? heightCm : '';
        const di = $('deadlineInput');
        if (di) di.value = goalDeadline || '';
        settingsChanged = true;
      } else if (lts > rts) {
        await fsFetch(`${FS_BASE}/users/${auth.uid}?updateMask.fieldPaths=goal&updateMask.fieldPaths=height&updateMask.fieldPaths=deadline&updateMask.fieldPaths=settingsUpdatedAt`, {
          method: 'PATCH',
          body: JSON.stringify({ fields: {
            goal: goalWeight === null ? { nullValue: null } : { doubleValue: goalWeight },
            height: heightCm === null ? { nullValue: null } : { doubleValue: heightCm },
            deadline: goalDeadline ? { stringValue: goalDeadline } : { nullValue: null },
            settingsUpdatedAt: { integerValue: String(lts) },
          } }),
        });
      }

      if (localChanged) {
        entries = Array.from(local.values());
        saveDeleted(deleted);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); // ghi thẳng, không kích hoạt đồng bộ lại
      }
      if (localChanged || settingsChanged) drawChart();
      lsSet(LAST_SYNC_KEY, String(Date.now()));
      setState('idle');
    } catch (e) {
      lastError = e && e.message ? e.message : String(e);
      setState(navigator.onLine ? 'error' : 'offline');
    } finally {
      syncing = false;
      if (pending) schedule(500);
    }
  }
  function schedule(ms = 2500) {
    if (!CONFIGURED || !auth) return;
    clearTimeout(timer);
    timer = setTimeout(syncNow, ms);
  }
  window.__wtOnDataChanged = () => schedule();

  // ---------------- giao diện ----------------
  const ICON = $('syncIcon');
  function setState(s) {
    state = auth ? s : 'off';
    if (ICON) {
      ICON.className = `sync-ic ${state}`;
      ICON.title = { off: 'Chưa bật đồng bộ', idle: 'Đã đồng bộ', syncing: 'Đang đồng bộ…', error: 'Đồng bộ lỗi', offline: 'Không có mạng — sẽ đồng bộ khi có mạng' }[state];
    }
    renderStatus();
  }
  function fmtTime(ms) {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${d.getDate()}/${d.getMonth() + 1}`;
  }
  function renderStatus() {
    const el = $('syncStatus');
    if (!el) return;
    const last = Number(lsGet(LAST_SYNC_KEY) || 0);
    el.className = 'sync-status ' + state;
    el.textContent =
      state === 'syncing' ? 'Đang đồng bộ…'
      : state === 'error' ? `Lỗi: ${lastError}`
      : state === 'offline' ? 'Không có mạng — sẽ tự đồng bộ khi có mạng lại.'
      : last ? `Đã đồng bộ lúc ${fmtTime(last)}` : 'Chưa đồng bộ lần nào.';
  }
  function renderPanel() {
    const box = $('syncPanel');
    if (!box) return;
    if (!CONFIGURED) {
      box.innerHTML = '<div class="sync-note">Chưa kết nối Firebase. Làm theo hướng dẫn trong README (mục Đồng bộ Firebase), gửi apiKey + projectId để bật.</div>';
      return;
    }
    if (!auth) {
      box.innerHTML = `
        <div class="field"><label for="fbEmail">Email</label><input type="email" id="fbEmail" autocomplete="username" placeholder="vd: ban@gmail.com"></div>
        <div class="field"><label for="fbPass">Mật khẩu (ít nhất 6 ký tự)</label><input type="password" id="fbPass" autocomplete="current-password" placeholder="••••••"></div>
        <div class="sync-btns">
          <button class="rowbtn primary" id="fbSignIn"><span>Đăng nhập</span></button>
          <button class="rowbtn" id="fbSignUp"><span>Tạo tài khoản</span></button>
        </div>
        <button class="linkbtn" id="fbReset">Quên mật khẩu?</button>
        <div class="sync-note" id="fbMsg">Đăng nhập cùng 1 tài khoản trên các máy để thấy cùng dữ liệu.</div>`;
      const go = async (create) => {
        const email = $('fbEmail').value.trim(), pass = $('fbPass').value;
        const msg = $('fbMsg');
        msg.className = 'sync-note'; msg.textContent = create ? 'Đang tạo tài khoản…' : 'Đang đăng nhập…';
        try {
          await signIn(email, pass, create);
          renderPanel();
          await syncNow();
        } catch (e) { msg.className = 'sync-note err'; msg.textContent = e.message; }
      };
      $('fbSignIn').onclick = () => go(false);
      $('fbSignUp').onclick = () => go(true);
      $('fbReset').onclick = async () => {
        const email = $('fbEmail').value.trim(), msg = $('fbMsg');
        if (!email) { msg.className = 'sync-note err'; msg.textContent = 'Nhập email trước rồi bấm Quên mật khẩu.'; return; }
        try { await authCall('accounts:sendOobCode', { requestType: 'PASSWORD_RESET', email }); msg.className = 'sync-note'; msg.textContent = 'Đã gửi email đặt lại mật khẩu, kiểm tra hộp thư nhé.'; }
        catch (e) { msg.className = 'sync-note err'; msg.textContent = e.message; }
      };
      return;
    }
    box.innerHTML = `
      <div class="field"><label>Đã đăng nhập</label><div class="sync-email"></div><div class="sync-status" id="syncStatus"></div></div>
      <div class="sync-btns">
        <button class="rowbtn primary" id="fbSyncNow"><span>Đồng bộ ngay</span></button>
        <button class="rowbtn" id="fbSignOut"><span>Đăng xuất</span></button>
      </div>`;
    box.querySelector('.sync-email').textContent = auth.email;
    $('fbSyncNow').onclick = () => syncNow();
    $('fbSignOut').onclick = () => { if (confirm('Đăng xuất? Dữ liệu trên máy này vẫn giữ nguyên.')) signOut(); };
    renderStatus();
  }

  // ---------------- khởi động ----------------
  renderPanel();
  setState(auth ? 'idle' : 'off');
  if (ICON) ICON.addEventListener('click', () => { if (auth) syncNow(); });
  if (CONFIGURED && auth) syncNow();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schedule(300); });
  window.addEventListener('online', () => schedule(300));
  window.addEventListener('offline', () => { if (auth) setState('offline'); });
  window.WT_SYNC = { syncNow, get state() { return state; } }; // dùng khi kiểm thử
})();
