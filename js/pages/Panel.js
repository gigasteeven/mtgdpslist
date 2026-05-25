import { store } from '../main.js';

// sha256 хеш пароля
const _h = '5de542185526a06c4edfd26b872691f6f69157bc4da5711035b611a994129aa1';

async function sha256(str) {
    const buf = new TextEncoder().encode(str);
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// github api обёртка
class GH {
    constructor(token, repo) {
        this.token = token;
        this.base = `https://api.github.com/repos/${repo}/contents`;
    }

    async get(path) {
        const r = await fetch(`${this.base}/${path}`, {
            headers: { 'Authorization': `token ${this.token}` }
        });
        if (!r.ok) return null;
        return await r.json();
    }

    async read(path) {
        const data = await this.get(path);
        if (!data || !data.content) return null;
        const text = atob(data.content.replace(/\n/g, ''));
        return { content: JSON.parse(text), sha: data.sha };
    }

    async write(path, content, msg) {
        // сначала берём sha текущего файла (если есть)
        const existing = await this.get(path);
        const body = {
            message: msg || `update ${path}`,
            content: btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 4)))),
        };
        if (existing && existing.sha) body.sha = existing.sha;

        const r = await fetch(`${this.base}/${path}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${this.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        return r.ok;
    }

    async del(path, msg) {
        const existing = await this.get(path);
        if (!existing || !existing.sha) return false;

        const r = await fetch(`${this.base}/${path}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `token ${this.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: msg || `delete ${path}`,
                sha: existing.sha,
            }),
        });
        return r.ok;
    }

    // проверка что токен рабочий
    async check() {
        try {
            const r = await fetch(this.base, {
                headers: { 'Authorization': `token ${this.token}` }
            });
            return r.ok;
        } catch(e) { return false; }
    }
}

export default {
    template: `
        <main class="page-panel" v-if="!auth">
            <div class="panel-login">
                <h2>Вход</h2>
                <form @submit.prevent="login">
                    <input
                        type="password"
                        v-model="pwd"
                        placeholder="Пароль"
                        :class="{ 'shake': loginErr }"
                        autocomplete="off"
                    />
                    <button type="submit">Войти</button>
                </form>
                <p v-if="loginErr" class="panel-err">Неверный пароль</p>
            </div>
        </main>

        <main v-else class="page-panel">
            <div class="panel-sidebar">
                <div class="panel-nav">
                    <button
                        v-for="tab in tabs"
                        :key="tab.id"
                        :class="{ active: curTab === tab.id }"
                        @click="curTab = tab.id"
                    >{{ tab.label }}</button>
                </div>
                <div class="panel-status" v-if="gh">
                    <span class="status-dot ok"></span> GitHub
                </div>
                <div class="panel-status" v-else>
                    <span class="status-dot off"></span> Оффлайн
                </div>
                <button class="panel-logout" @click="logout">Выйти</button>
            </div>

            <div class="panel-content">

                <!-- уровни -->
                <div v-if="curTab === 'levels'" class="panel-section">
                    <div class="panel-head">
                        <h2>Уровни ({{ listData.length }})</h2>
                        <button class="btn-add" @click="showAddLevel = true">+ Добавить</button>
                    </div>

                    <div v-if="showAddLevel" class="panel-form">
                        <h3>Новый уровень</h3>
                        <div class="form-grid">
                            <label>Имя файла <input v-model="newLvl.fileName" placeholder="Bloodbath" /></label>
                            <label>Название <input v-model="newLvl.name" placeholder="Название уровня" /></label>
                            <label>ID <input v-model="newLvl.id" placeholder="12345" /></label>
                            <label>Автор <input v-model="newLvl.author" placeholder="Автор" /></label>
                            <label>Верификатор <input v-model="newLvl.verifier" placeholder="Ник" /></label>
                            <label>Видео верификации <input v-model="newLvl.verification" placeholder="https://..." /></label>
                            <label>Соавторы <input v-model="newLvl.creators" placeholder="Через запятую" /></label>
                            <label>Мин. процент <input v-model="newLvl.percent" type="number" placeholder="100" /></label>
                            <label>Пароль <input v-model="newLvl.password" placeholder="Free to copy" /></label>
                            <label>Позиция <input v-model="newLvl.position" type="number" :placeholder="listData.length + 1" /></label>
                        </div>
                        <div class="form-actions">
                            <button @click="addLevel" class="btn-save" :disabled="saving">{{ saving ? 'Сохраняю...' : 'Сохранить' }}</button>
                            <button @click="showAddLevel = false" class="btn-cancel">Отмена</button>
                        </div>
                    </div>

                    <table class="panel-table" v-if="listData.length">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Название</th>
                                <th>ID</th>
                                <th>Автор</th>
                                <th>Рекорды</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(lvl, i) in listData" :key="lvl.path">
                                <td class="col-rank">{{ i + 1 }}</td>
                                <td>{{ lvl.name }}</td>
                                <td>{{ lvl.id }}</td>
                                <td>{{ lvl.author }}</td>
                                <td>{{ lvl.records ? lvl.records.length : 0 }}</td>
                                <td class="col-actions">
                                    <button @click="startEditLevel(i)" title="Редактировать">✏️</button>
                                    <button v-if="i > 0" @click="moveLevel(i, -1)" title="Вверх">⬆</button>
                                    <button v-if="i < listData.length - 1" @click="moveLevel(i, 1)" title="Вниз">⬇</button>
                                    <button @click="removeLevel(i)" title="Удалить" class="btn-del">✕</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <p v-else class="panel-empty">Лист пуст</p>

                    <!-- модалка редактирования -->
                    <div v-if="editIdx !== null" class="panel-modal-bg" @click.self="editIdx = null">
                        <div class="panel-modal">
                            <h3>Редактировать: {{ editLvl.name }}</h3>
                            <div class="form-grid">
                                <label>Название <input v-model="editLvl.name" /></label>
                                <label>ID <input v-model="editLvl.id" /></label>
                                <label>Автор <input v-model="editLvl.author" /></label>
                                <label>Верификатор <input v-model="editLvl.verifier" /></label>
                                <label>Видео <input v-model="editLvl.verification" /></label>
                                <label>Мин. % <input v-model="editLvl.percentToQualify" type="number" /></label>
                                <label>Пароль <input v-model="editLvl.password" /></label>
                            </div>

                            <h4 style="margin-top:1rem">Рекорды</h4>
                            <table class="panel-table panel-table-sm" v-if="editLvl.records && editLvl.records.length">
                                <thead><tr><th>Игрок</th><th>%</th><th>Hz</th><th>Mobile</th><th></th></tr></thead>
                                <tbody>
                                    <tr v-for="(rec, ri) in editLvl.records" :key="ri">
                                        <td><input v-model="rec.user" class="input-sm" /></td>
                                        <td><input v-model.number="rec.percent" type="number" class="input-sm" /></td>
                                        <td><input v-model.number="rec.hz" type="number" class="input-sm" /></td>
                                        <td><input type="checkbox" v-model="rec.mobile" /></td>
                                        <td><button @click="editLvl.records.splice(ri, 1)" class="btn-del">✕</button></td>
                                    </tr>
                                </tbody>
                            </table>
                            <p v-else style="opacity:.5;margin:.5rem 0">Нет рекордов</p>

                            <button @click="addRecordToEdit" class="btn-add" style="margin-top:.5rem">+ Рекорд</button>

                            <div class="form-actions" style="margin-top:1.5rem">
                                <button @click="saveEditLevel" class="btn-save" :disabled="saving">{{ saving ? 'Сохраняю...' : 'Сохранить' }}</button>
                                <button @click="editIdx = null" class="btn-cancel">Отмена</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- редакторы -->
                <div v-if="curTab === 'editors'" class="panel-section">
                    <div class="panel-head">
                        <h2>Редакторы</h2>
                        <button class="btn-add" @click="addEditor">+ Добавить</button>
                    </div>

                    <table class="panel-table" v-if="editors.length">
                        <thead><tr><th>Имя</th><th>Роль</th><th>Ссылка</th><th></th></tr></thead>
                        <tbody>
                            <tr v-for="(ed, i) in editors" :key="i">
                                <td><input v-model="ed.name" /></td>
                                <td>
                                    <select v-model="ed.role">
                                        <option value="owner">owner</option>
                                        <option value="admin">admin</option>
                                        <option value="helper">helper</option>
                                        <option value="dev">dev</option>
                                        <option value="trial">trial</option>
                                    </select>
                                </td>
                                <td><input v-model="ed.link" placeholder="https://..." /></td>
                                <td><button @click="editors.splice(i, 1)" class="btn-del">✕</button></td>
                            </tr>
                        </tbody>
                    </table>
                    <p v-else class="panel-empty">Нет редакторов</p>

                    <button @click="saveEditors" class="btn-save" style="margin-top:1rem" :disabled="saving">
                        {{ saving ? 'Сохраняю...' : 'Сохранить' }}
                    </button>
                </div>

                <!-- настройки -->
                <div v-if="curTab === 'settings'" class="panel-section">
                    <h2>Настройки GitHub</h2>
                    <p style="margin:.5rem 0;opacity:.7">Токен нужен для записи изменений прямо в репозиторий</p>

                    <div class="panel-form" style="margin-top:1rem">
                        <div class="form-grid">
                            <label>Репозиторий <input v-model="cfg.repo" placeholder="user/repo" /></label>
                            <label>Ветка <input v-model="cfg.branch" placeholder="main" /></label>
                            <label style="grid-column:1/-1">
                                GitHub Token
                                <input v-model="cfg.token" type="password" placeholder="ghp_xxxxxxxxxxxx" />
                            </label>
                        </div>
                        <div class="form-actions">
                            <button @click="saveConfig" class="btn-save">Сохранить и проверить</button>
                            <button @click="clearConfig" class="btn-cancel">Очистить</button>
                        </div>
                        <p v-if="cfgStatus" :style="{ color: cfgStatus === 'ok' ? '#4a9' : '#e55', marginTop: '.5rem' }">
                            {{ cfgStatus === 'ok' ? '✓ Подключено' : '✕ Ошибка подключения' }}
                        </p>

                        <div style="margin-top:1.5rem;opacity:.6;font-size:.85rem">
                            <p><b>Как получить токен:</b></p>
                            <p>GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)</p>
                            <p>Нужен scope: <code>repo</code> (полный доступ к репозиторию)</p>
                        </div>
                    </div>
                </div>

                <!-- экспорт -->
                <div v-if="curTab === 'export'" class="panel-section">
                    <h2>Экспорт данных</h2>
                    <p style="margin:.5rem 0;opacity:.7">Скачать данные как JSON файлы</p>
                    <div class="export-btns">
                        <button @click="exportList">📥 _list.json</button>
                        <button @click="exportEditors">📥 _editors.json</button>
                        <button @click="exportAll">📥 Всё</button>
                    </div>
                </div>
            </div>

            <!-- уведомление -->
            <transition name="notif">
                <div v-if="notif" class="panel-notif" :class="notifType">{{ notif }}</div>
            </transition>
        </main>
    `,

    data: () => ({
        auth: false,
        pwd: '',
        loginErr: false,
        curTab: 'levels',
        tabs: [
            { id: 'levels', label: 'Уровни' },
            { id: 'editors', label: 'Редакторы' },
            { id: 'settings', label: 'Настройки' },
            { id: 'export', label: 'Экспорт' },
        ],
        listOrder: [],
        listData: [],
        editors: [],
        showAddLevel: false,
        newLvl: {
            fileName: '', name: '', id: '', author: '',
            verifier: '', verification: '', creators: '',
            percent: 100, password: 'Free to copy', position: null,
        },
        editIdx: null,
        editLvl: {},
        editPath: '',
        saving: false,
        notif: '',
        notifType: 'ok',
        gh: null,
        cfg: {
            repo: 'gigasteeven/mtgdpslist',
            branch: 'main',
            token: '',
        },
        cfgStatus: '',
        store,
    }),

    async mounted() {
        const s = sessionStorage.getItem('_pa');
        if (s === '1') {
            this.auth = true;
            this.restoreConfig();
            await this.loadData();
        }
    },

    methods: {
        async login() {
            const h = await sha256(this.pwd);
            if (h === _h) {
                this.auth = true;
                this.loginErr = false;
                sessionStorage.setItem('_pa', '1');
                this.restoreConfig();
                await this.loadData();
            } else {
                this.loginErr = true;
                setTimeout(() => { this.loginErr = false; }, 600);
            }
            this.pwd = '';
        },

        logout() {
            this.auth = false;
            this.gh = null;
            sessionStorage.removeItem('_pa');
        },

        // восстановить конфиг из localStorage
        restoreConfig() {
            try {
                const saved = localStorage.getItem('_pcfg');
                if (saved) {
                    const c = JSON.parse(saved);
                    this.cfg.repo = c.repo || this.cfg.repo;
                    this.cfg.branch = c.branch || this.cfg.branch;
                    this.cfg.token = c.token || '';
                    if (this.cfg.token && this.cfg.repo) {
                        this.gh = new GH(this.cfg.token, this.cfg.repo);
                    }
                }
            } catch(e) {}
        },

        async saveConfig() {
            localStorage.setItem('_pcfg', JSON.stringify(this.cfg));

            if (this.cfg.token && this.cfg.repo) {
                const g = new GH(this.cfg.token, this.cfg.repo);
                const ok = await g.check();
                if (ok) {
                    this.gh = g;
                    this.cfgStatus = 'ok';
                    this.toast('GitHub подключён');
                } else {
                    this.gh = null;
                    this.cfgStatus = 'err';
                    this.toast('Не удалось подключиться', 'err');
                }
            } else {
                this.cfgStatus = '';
            }
        },

        clearConfig() {
            this.cfg = { repo: 'gigasteeven/mtgdpslist', branch: 'main', token: '' };
            this.gh = null;
            this.cfgStatus = '';
            localStorage.removeItem('_pcfg');
            this.toast('Конфиг очищен');
        },

        async loadData() {
            try {
                const res = await fetch('./data/_list.json');
                this.listOrder = await res.json();

                this.listData = [];
                for (const fname of this.listOrder) {
                    try {
                        const r = await fetch(`./data/${fname}.json`);
                        const lvl = await r.json();
                        lvl.path = fname;
                        this.listData.push(lvl);
                    } catch(e) {
                        this.listData.push({ path: fname, name: fname + ' (ошибка)', id: '?', author: '?', records: [] });
                    }
                }

                const edRes = await fetch('./data/_editors.json');
                this.editors = await edRes.json();
            } catch(e) {
                this.toast('Ошибка загрузки', 'err');
            }
        },

        // ======== запись через github ========

        async pushFile(path, data, msg) {
            if (!this.gh) {
                // фоллбек — скачать файл
                this.downloadJSON(path.replace('data/', ''), data);
                return true;
            }
            return await this.gh.write(path, data, msg);
        },

        async pushDelete(path, msg) {
            if (!this.gh) return false;
            return await this.gh.del(path, msg);
        },

        // сохранить _list.json + файл уровня
        async commitLevel(lvl, msg) {
            this.saving = true;
            try {
                const order = this.listData.map(l => l.path);
                const copy = { ...lvl };
                delete copy.path;

                const ok1 = await this.pushFile('data/_list.json', order, msg || `update list`);
                const ok2 = await this.pushFile(`data/${lvl.path}.json`, copy, msg || `update ${lvl.name}`);

                if (ok1 && ok2) {
                    this.toast(this.gh ? 'Сохранено в репозиторий' : 'Файлы скачаны');
                } else {
                    this.toast('Ошибка при сохранении', 'err');
                }
            } catch(e) {
                this.toast('Ошибка: ' + e.message, 'err');
            }
            this.saving = false;
        },

        async commitList(msg) {
            this.saving = true;
            try {
                const order = this.listData.map(l => l.path);
                const ok = await this.pushFile('data/_list.json', order, msg || 'update list');
                if (!ok) this.toast('Ошибка сохранения _list.json', 'err');
            } catch(e) {
                this.toast('Ошибка: ' + e.message, 'err');
            }
            this.saving = false;
        },

        // ======== уровни ========

        async addLevel() {
            const n = this.newLvl;
            if (!n.fileName || !n.name) {
                this.toast('Заполни имя файла и название', 'err');
                return;
            }
            if (this.listOrder.includes(n.fileName)) {
                this.toast('Файл с таким именем уже есть', 'err');
                return;
            }

            const lvl = {
                id: n.id ? (isNaN(n.id) ? n.id : parseInt(n.id)) : 0,
                name: n.name,
                author: n.author || 'Unknown',
                creators: n.creators ? n.creators.split(',').map(s => s.trim()).filter(Boolean) : [],
                verifier: n.verifier || n.author || 'Unknown',
                verification: n.verification || '',
                percentToQualify: parseInt(n.percent) || 100,
                password: n.password || 'Free to copy',
                records: [],
            };

            const pos = parseInt(n.position) || this.listData.length + 1;
            const idx = Math.max(0, Math.min(pos - 1, this.listData.length));

            lvl.path = n.fileName;
            this.listData.splice(idx, 0, lvl);
            this.listOrder.splice(idx, 0, n.fileName);

            await this.commitLevel(lvl, `add ${n.name}`);

            this.newLvl = {
                fileName: '', name: '', id: '', author: '',
                verifier: '', verification: '', creators: '',
                percent: 100, password: 'Free to copy', position: null,
            };
            this.showAddLevel = false;
        },

        startEditLevel(i) {
            this.editIdx = i;
            this.editPath = this.listData[i].path;
            this.editLvl = JSON.parse(JSON.stringify(this.listData[i]));
        },

        addRecordToEdit() {
            if (!this.editLvl.records) this.editLvl.records = [];
            this.editLvl.records.push({ user: '', percent: 100, hz: 60, link: '', mobile: false });
        },

        async saveEditLevel() {
            this.editLvl.path = this.editPath;
            this.listData[this.editIdx] = JSON.parse(JSON.stringify(this.editLvl));

            const lvl = this.listData[this.editIdx];
            const copy = { ...lvl };
            delete copy.path;

            this.saving = true;
            const ok = await this.pushFile(`data/${lvl.path}.json`, copy, `edit ${lvl.name}`);
            this.saving = false;

            if (ok) {
                this.toast(this.gh ? 'Сохранено' : 'Файл скачан');
            } else {
                this.toast('Ошибка', 'err');
            }
            this.editIdx = null;
        },

        async moveLevel(i, dir) {
            const j = i + dir;
            [this.listData[i], this.listData[j]] = [this.listData[j], this.listData[i]];
            [this.listOrder[i], this.listOrder[j]] = [this.listOrder[j], this.listOrder[i]];
            this.listData = [...this.listData];
            this.listOrder = [...this.listOrder];

            await this.commitList(`swap #${i+1} and #${j+1}`);
            this.toast(this.gh ? 'Порядок обновлён' : 'Файл скачан');
        },

        async removeLevel(i) {
            const lvl = this.listData[i];
            if (!confirm(`Удалить "${lvl.name}"?`)) return;

            this.listData.splice(i, 1);
            this.listOrder.splice(i, 1);

            this.saving = true;
            const order = this.listData.map(l => l.path);
            await this.pushFile('data/_list.json', order, `remove ${lvl.name}`);
            // удаляем сам файл из репо
            await this.pushDelete(`data/${lvl.path}.json`, `delete ${lvl.name}`);
            this.saving = false;

            this.toast(this.gh ? 'Удалено из репозитория' : 'Уровень удалён');
        },

        // ======== редакторы ========

        addEditor() {
            this.editors.push({ role: 'helper', name: '', link: '' });
        },

        async saveEditors() {
            const data = this.editors.map(e => {
                const obj = { role: e.role, name: e.name };
                if (e.link) obj.link = e.link;
                return obj;
            });

            this.saving = true;
            const ok = await this.pushFile('data/_editors.json', data, 'update editors');
            this.saving = false;

            this.toast(ok ? (this.gh ? 'Редакторы обновлены' : 'Файл скачан') : 'Ошибка', ok ? 'ok' : 'err');
        },

        // ======== экспорт ========

        exportList() { this.downloadJSON('_list.json', this.listOrder); },
        exportEditors() { this.downloadJSON('_editors.json', this.editors); },
        exportAll() {
            this.exportList();
            this.exportEditors();
            for (const lvl of this.listData) {
                const copy = { ...lvl };
                delete copy.path;
                this.downloadJSON(lvl.path + '.json', copy);
            }
            this.toast('Все файлы скачаны');
        },

        downloadJSON(name, data) {
            const blob = new Blob([JSON.stringify(data, null, 4)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = name;
            a.click();
            URL.revokeObjectURL(a.href);
        },

        toast(msg, type = 'ok') {
            this.notif = msg;
            this.notifType = type;
            setTimeout(() => { this.notif = ''; }, 3000);
        },
    },
};
