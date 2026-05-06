const userNameEl = document.getElementById('user-name');
const userRoleEl = document.getElementById('user-role');
const statusEl = document.getElementById('status');
const authPanel = document.getElementById('auth-panel');
const showLoginButton = document.getElementById('show-login');
const showRegisterButton = document.getElementById('show-register');
const logoutButton = document.getElementById('logout-button');
const loginTab = document.getElementById('login-tab');
const registerTab = document.getElementById('register-tab');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginButton = document.getElementById('login-button');
const registerButton = document.getElementById('register-button');
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const registerUsername = document.getElementById('register-username');
const registerPassword = document.getElementById('register-password');
const refreshButton = document.getElementById('refresh-button');
const ipsContainer = document.getElementById('ips');
const favoritesSection = document.getElementById('favorite-section');
const favoritesContainer = document.getElementById('favorites');
const selectedIpEl = document.getElementById('selected-ip');
const playButton = document.getElementById('play-button');
const feedbackTextarea = document.getElementById('feedback');
const feedbackButton = document.getElementById('feedback-button');
const adminPanel = document.getElementById('admin-panel');
const broadcastPanel = document.getElementById('broadcast-panel');
const schedulePanel = document.getElementById('schedule-panel');
const adminIpsContainer = document.getElementById('admin-ips');
const adminName = document.getElementById('admin-name');
const adminDescription = document.getElementById('admin-description');
const adminImage = document.getElementById('admin-image');
const adminTone = document.getElementById('admin-tone');
const adminCreate = document.getElementById('admin-create');

let currentUser = null;
let selectedIp = null;
let ipList = [];

function showMessage(text, type = 'info') {
  statusEl.textContent = text;
  statusEl.className = `status-message ${type}`;
  if (text) {
    setTimeout(() => {
      if (statusEl.textContent === text) {
        statusEl.textContent = '';
        statusEl.className = 'status-message';
      }
    }, 4500);
  }
}

function setAuthPanel(show) {
  authPanel.classList.toggle('hidden', !show);
}

function toggleAuthForm(tab) {
  loginTab.classList.toggle('active', tab === 'login');
  registerTab.classList.toggle('active', tab === 'register');
  loginForm.classList.toggle('hidden', tab !== 'login');
  registerForm.classList.toggle('hidden', tab !== 'register');
}

function updateUserView() {
  if (currentUser) {
    userNameEl.textContent = currentUser.username;
    userRoleEl.textContent = currentUser.role === 'admin' ? '管理员' : '普通用户';
    logoutButton.classList.remove('hidden');
    showLoginButton.classList.add('hidden');
    showRegisterButton.classList.add('hidden');
    if (currentUser.role === 'admin') {
      adminPanel.classList.remove('hidden');
      loadAdminIps();
    } else {
      adminPanel.classList.add('hidden');
    }
    broadcastPanel.classList.remove('hidden');
    schedulePanel.classList.remove('hidden');
    loadBroadcastLog();
    loadSchedules();
    populateScheduleIps();
  } else {
    userNameEl.textContent = '未登录';
    userRoleEl.textContent = '';
    logoutButton.classList.add('hidden');
    showLoginButton.classList.remove('hidden');
    showRegisterButton.classList.remove('hidden');
    adminPanel.classList.add('hidden');
    broadcastPanel.classList.add('hidden');
    schedulePanel.classList.add('hidden');
  }
}

function createCard(ip, onSelect) {
  const card = document.createElement('div');
  card.className = 'ip-card';
  card.innerHTML = `
    <img src="${ip.image}" alt="${ip.name}" />
    <div class="meta">
      <h3>${ip.name}</h3>
      <p>${ip.description}</p>
      <div class="card-footer">
        <span class="tone">频率：${ip.audio_tone}Hz</span>
        <button class="fav-button ${ip.isFavorite ? 'active' : ''}" data-ip="${ip.id}">
          ${ip.isFavorite ? '★ 已收藏' : '☆ 收藏'}
        </button>
      </div>
    </div>
  `;
  card.addEventListener('click', (event) => {
    if (event.target.closest('.fav-button')) return;
    onSelect(ip, card);
  });
  card.querySelector('.fav-button').addEventListener('click', async (event) => {
    event.stopPropagation();
    if (!currentUser) {
      showMessage('请先登录再收藏音柱', 'warning');
      return;
    }
    await toggleFavorite(ip.id);
  });
  return card;
}

function renderIpList(ips) {
  ipsContainer.innerHTML = '';
  ipList = ips;
  ips.forEach(ip => ipsContainer.appendChild(createCard(ip, selectIp)));
}

function renderFavorites(favorites) {
  if (!currentUser || favorites.length === 0) {
    favoritesSection.classList.add('hidden');
    return;
  }
  favoritesSection.classList.remove('hidden');
  favoritesContainer.innerHTML = '';
  favorites.forEach(ip => favoritesContainer.appendChild(createCard(ip, selectIp)));
}

function selectIp(ip, card) {
  selectedIp = ip;
  playButton.disabled = false;
  selectedIpEl.textContent = `已选择：${ip.name} — ${ip.description}`;
  document.querySelectorAll('.ip-card').forEach(node => node.classList.remove('active'));
  card.classList.add('active');
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...options });
  return response.json();
}

async function loadProfile() {
  const data = await fetchJson('/api/profile');
  currentUser = data.user;
  updateUserView();
  if (currentUser) {
    loadFavorites();
  }
}

async function loadIps() {
  const data = await fetchJson('/api/ips');
  if (data.ips) {
    renderIpList(data.ips);
  }
}

async function loadFavorites() {
  const data = await fetchJson('/api/favorites');
  if (data.favorites) {
    renderFavorites(data.favorites);
  }
}

async function toggleFavorite(ipId) {
  const data = await fetchJson(`/api/favorites/${ipId}`, { method: 'POST' });
  if (data.error) {
    showMessage(data.error, 'error');
    return;
  }
  showMessage(data.message, 'success');
  await loadIps();
  await loadFavorites();
}

function playTone(frequency) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
  oscillator.connect(gain).connect(audioCtx.destination);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + 1.2);
}

async function playIp() {
  if (!selectedIp) return;
  const data = await fetchJson('/api/play', {
    method: 'POST',
    body: JSON.stringify({ ipId: selectedIp.id }),
  });

  if (data.error) {
    showMessage(data.error, 'error');
    return;
  }
  showMessage(data.message, 'success');
  playTone(data.audioTone || selectedIp.audio_tone || 330);
}

async function submitFeedback() {
  if (!selectedIp) {
    showMessage('请先选择一个音柱', 'warning');
    return;
  }
  const feedback = feedbackTextarea.value.trim();
  if (!feedback) {
    showMessage('反馈内容不能为空', 'warning');
    return;
  }
  const data = await fetchJson('/api/feedback', {
    method: 'POST',
    body: JSON.stringify({ ipId: selectedIp.id, feedback }),
  });
  if (data.error) {
    showMessage(data.error, 'error');
    return;
  }
  feedbackTextarea.value = '';
  showMessage(data.message, 'success');
}

async function login() {
  const data = await fetchJson('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username: loginUsername.value.trim(), password: loginPassword.value.trim() }),
  });
  if (data.error) {
    showMessage(data.error, 'error');
    return;
  }
  currentUser = data.user;
  updateUserView();
  setAuthPanel(false);
  await loadIps();
  await loadFavorites();
  showMessage('登录成功', 'success');
}

async function register() {
  const data = await fetchJson('/api/register', {
    method: 'POST',
    body: JSON.stringify({ username: registerUsername.value.trim(), password: registerPassword.value.trim() }),
  });
  if (data.error) {
    showMessage(data.error, 'error');
    return;
  }
  currentUser = data.user;
  updateUserView();
  setAuthPanel(false);
  await loadIps();
  await loadFavorites();
  showMessage('注册成功，已自动登录', 'success');
}

async function logout() {
  await fetchJson('/api/logout', { method: 'POST' });
  currentUser = null;
  updateUserView();
  renderFavorites([]);
  showMessage('已退出登录', 'info');
}

async function loadAdminIps() {
  const data = await fetchJson('/api/admin/ips');
  if (data.ips) {
    adminIpsContainer.innerHTML = '';
    data.ips.forEach(ip => {
      const row = document.createElement('div');
      row.className = 'admin-row';
      row.innerHTML = `
        <div>
          <strong>${ip.name}</strong>
          <p>${ip.description}</p>
          <small>${ip.image} · ${ip.audio_tone}Hz</small>
        </div>
        <div class="admin-actions">
          <button data-id="${ip.id}" class="edit">编辑</button>
          <button data-id="${ip.id}" class="delete">删除</button>
        </div>
      `;

      row.querySelector('.edit').addEventListener('click', () => editAdminIp(ip));
      row.querySelector('.delete').addEventListener('click', () => deleteAdminIp(ip.id));
      adminIpsContainer.appendChild(row);
    });
  }
}

async function createAdminIp() {
  const payload = {
    name: adminName.value.trim(),
    description: adminDescription.value.trim(),
    image: adminImage.value.trim(),
    audioTone: Number(adminTone.value.trim()),
  };
  if (!payload.name || !payload.description || !payload.image || !payload.audioTone) {
    showMessage('请填写管理员新增音柱的全部字段', 'warning');
    return;
  }
  const data = await fetchJson('/api/admin/ips', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (data.error) {
    showMessage(data.error, 'error');
    return;
  }
  adminName.value = '';
  adminDescription.value = '';
  adminImage.value = '/assets/ip-pill-1.svg';
  adminTone.value = '330';
  await loadAdminIps();
  await loadIps();
  showMessage(data.message, 'success');
}

async function editAdminIp(ip) {
  const name = prompt('音柱名称：', ip.name);
  const description = prompt('音柱描述：', ip.description);
  const image = prompt('图片路径：', ip.image);
  const audioTone = prompt('音频频率（Hz）：', ip.audio_tone);
  if (!name || !description || !image || !audioTone) {
    showMessage('编辑已取消或输入不完整', 'warning');
    return;
  }
  const data = await fetchJson(`/api/admin/ips/${ip.id}`, {
    method: 'PUT',
    body: JSON.stringify({ name, description, image, audioTone: Number(audioTone) }),
  });
  if (data.error) {
    showMessage(data.error, 'error');
    return;
  }
  await loadAdminIps();
  await loadIps();
  showMessage(data.message, 'success');
}

async function deleteAdminIp(ipId) {
  if (!confirm('确认删除该音柱吗？')) return;
  const data = await fetchJson(`/api/admin/ips/${ipId}`, { method: 'DELETE' });
  if (data.error) {
    showMessage(data.error, 'error');
    return;
  }
  await loadAdminIps();
  await loadIps();
  showMessage(data.message, 'success');
}

showLoginButton.addEventListener('click', () => setAuthPanel(true));
showRegisterButton.addEventListener('click', () => setAuthPanel(true));
logoutButton.addEventListener('click', logout);
loginTab.addEventListener('click', () => toggleAuthForm('login'));
registerTab.addEventListener('click', () => toggleAuthForm('register'));
loginButton.addEventListener('click', login);
registerButton.addEventListener('click', register);
refreshButton.addEventListener('click', () => loadIps());
playButton.addEventListener('click', playIp);
feedbackButton.addEventListener('click', submitFeedback);
adminCreate.addEventListener('click', createAdminIp);

// ========== 广播控制 ==========
async function loadBroadcastLog() {
  const data = await fetchJson('/api/broadcast/log?limit=20');
  const list = document.getElementById('broadcast-log-list');
  if (!data.log || data.log.length === 0) {
    list.innerHTML = '<p class="empty-tip">暂无播报记录</p>';
    return;
  }
  const typeLabel = { scheduled: '定时', live: '口播', interrupt: '插播' };
  list.innerHTML = data.log.map(r => `
    <div class="log-row">
      <span class="log-type log-type-${r.type}">${typeLabel[r.type] || r.type}</span>
      <span class="log-name">${r.name || '—'}</span>
      <span class="log-devices">${JSON.parse(r.device_ids || '[]').length} 台设备</span>
      <span class="log-time">${new Date(r.created_at).toLocaleString('zh-CN')}</span>
    </div>
  `).join('');
}

async function sendLiveBroadcast() {
  const content = document.getElementById('live-content').value.trim();
  if (!content) { showMessage('请输入口播内容', 'warning'); return; }
  const data = await fetchJson('/api/broadcast/live', { method: 'POST', body: JSON.stringify({ content }) });
  if (data.error) { showMessage(data.error, 'error'); return; }
  document.getElementById('live-content').value = '';
  showMessage(data.message, 'success');
  loadBroadcastLog();
}

async function sendInterruptBroadcast() {
  const ipId = Number(document.getElementById('interrupt-ip').value) || null;
  const content = document.getElementById('interrupt-content').value.trim() || null;
  if (!ipId && !content) { showMessage('请选择音柱或输入插播内容', 'warning'); return; }
  const data = await fetchJson('/api/broadcast/interrupt', { method: 'POST', body: JSON.stringify({ ipId, content }) });
  if (data.error) { showMessage(data.error, 'error'); return; }
  document.getElementById('interrupt-content').value = '';
  showMessage(data.message, 'success');
  loadBroadcastLog();
}

// ========== 定时播放 ==========
async function populateScheduleIps() {
  const data = await fetchJson('/api/ips');
  const selects = [document.getElementById('sch-ip'), document.getElementById('interrupt-ip')];
  selects.forEach(sel => {
    const base = sel.options[0].outerHTML;
    sel.innerHTML = base + (data.ips || []).map(ip => `<option value="${ip.id}">${ip.name} (${ip.audio_tone}Hz)</option>`).join('');
  });
}

async function loadSchedules() {
  const data = await fetchJson('/api/schedules');
  const list = document.getElementById('schedule-list');
  if (!data.schedules || data.schedules.length === 0) {
    list.innerHTML = '<p class="empty-tip">暂无计划</p>';
    return;
  }
  const repeatLabel = { once: '单次', daily: '每天', workdays: '工作日', weekly: '每周' };
  const statusLabel = { active: '启用', paused: '暂停', completed: '已完成' };
  list.innerHTML = data.schedules.map(s => `
    <div class="schedule-row">
      <div class="schedule-info">
        <strong>${s.name}</strong>
        <span class="sch-meta">${repeatLabel[s.repeat_type] || s.repeat_type} · ${s.scheduled_time}${s.scheduled_date ? ' · ' + s.scheduled_date : ''}</span>
        <span class="sch-status sch-status-${s.status}">${statusLabel[s.status] || s.status}</span>
      </div>
      <div class="schedule-actions">
        ${s.status !== 'completed' ? `<button class="toggle-btn" data-id="${s.id}" data-status="${s.status}">${s.status === 'active' ? '暂停' : '启用'}</button>` : ''}
        <button class="del-btn" data-id="${s.id}">删除</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const res = await fetchJson(`/api/schedules/${btn.dataset.id}/toggle`, { method: 'POST' });
      if (res.error) showMessage(res.error, 'error');
      else { showMessage(res.message, 'success'); loadSchedules(); }
    });
  });
  list.querySelectorAll('.del-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('确认删除该计划？')) return;
      const res = await fetchJson(`/api/schedules/${btn.dataset.id}`, { method: 'DELETE' });
      if (res.error) showMessage(res.error, 'error');
      else { showMessage(res.message, 'success'); loadSchedules(); }
    });
  });
}

async function createSchedule() {
  const repeatType = document.getElementById('sch-repeat').value;
  const daysOfWeek = repeatType === 'weekly'
    ? [...document.querySelectorAll('#sch-days input:checked')].map(el => Number(el.value))
    : [];
  const payload = {
    name: document.getElementById('sch-name').value.trim(),
    ipId: Number(document.getElementById('sch-ip').value) || null,
    repeatType,
    scheduledDate: document.getElementById('sch-date').value || null,
    scheduledTime: document.getElementById('sch-time').value,
    daysOfWeek,
  };
  if (!payload.name || !payload.scheduledTime) {
    showMessage('请填写计划名称和时间', 'warning');
    return;
  }
  const data = await fetchJson('/api/schedules', { method: 'POST', body: JSON.stringify(payload) });
  if (data.error) { showMessage(data.error, 'error'); return; }
  document.getElementById('sch-name').value = '';
  document.getElementById('sch-time').value = '';
  showMessage(data.message, 'success');
  loadSchedules();
}

// 事件绑定
document.getElementById('live-button').addEventListener('click', sendLiveBroadcast);
document.getElementById('interrupt-button').addEventListener('click', sendInterruptBroadcast);
document.getElementById('refresh-log-button').addEventListener('click', loadBroadcastLog);
document.getElementById('sch-create').addEventListener('click', createSchedule);
document.getElementById('refresh-schedule-button').addEventListener('click', loadSchedules);
document.getElementById('sch-repeat').addEventListener('change', function () {
  document.getElementById('sch-date').classList.toggle('hidden', this.value !== 'once');
  document.getElementById('sch-days').classList.toggle('hidden', this.value !== 'weekly');
});

loadProfile().then(loadIps).catch((err) => {
  console.error(err);
  showMessage('加载失败，请检查后端服务', 'error');
});
