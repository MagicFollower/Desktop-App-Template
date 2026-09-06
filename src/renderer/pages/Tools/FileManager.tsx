import { useEffect, useMemo, useRef, useState } from 'react';
import {
  UploadOutlined, DeleteOutlined, DownloadOutlined, SettingOutlined, FileTextOutlined, InboxOutlined,
  FolderAddOutlined, FolderOutlined, HomeOutlined,
} from '@ant-design/icons';
import QueryTableLayout from '../../components/QueryTableLayout/QueryTableLayout';
import QueryForm from '../../components/QueryForm/QueryForm';
import Pagination from '../../components/Pagination/Pagination';
import { useQueryTable } from '../../hooks/useQueryTable';
import Modal from '../../components/Modal/Modal';
import { useAuthStore } from '../../stores/useAuthStore';
import {
  loadFiles, uploadFile, deleteFiles, saveFilesTo, selectDownloadDir, loadFileConfig, saveFileConfig,
  loadFileDirs, createFileDir, deleteFileDir,
} from '../../services/sqlite';
import type { FileRecord, FileConfigRecord, FileStorage, FileDirRecord } from '../../services/sqlite';
import './FileManager.css';

/** 本地复刻 file-util.formatFileSize：主进程运行时代码不进渲染 bundle，
 * 复制 10 行低于改两份 tsconfig 的耦合成本（与 DocRuleManagement 预览函数同取舍） */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes;
  let unit = -1;
  do {
    value /= 1024;
    unit += 1;
  } while (value >= 1024 && unit < units.length - 1);
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

const STORAGE_LABELS: Record<FileStorage, string> = { local: '本地磁盘', ftp: 'FTP' };

const queryFields = [
  { name: 'key', label: '关键字', type: 'input' as const },
];

/** 按关键字过滤（名称/上传人，大小写不敏感）：与其它查询页同构，query.key 为搜索关键字。
 * 目录过滤不在此做：由选中目录（含子目录）在渲染端先限定范围 */
function filterFiles(rows: FileRecord[], query: { key?: unknown }): FileRecord[] {
  const kw = String(query.key ?? '').trim().toLowerCase();
  if (!kw) return rows;
  return rows.filter(
    (r) => r.name.toLowerCase().includes(kw) || r.uploadedBy.toLowerCase().includes(kw),
  );
}

/** 存储设置表单（查询契约不含 ftpPassword：编辑时密码留空 = 不修改） */
interface ConfigFormState {
  activeStorage: FileStorage;
  localDir: string;
  ftpHost: string;
  ftpPort: string;
  ftpUser: string;
  ftpPassword: string;
  ftpRoot: string;
  ftpSecure: boolean;
}

const emptyConfigForm: ConfigFormState = {
  activeStorage: 'local', localDir: '', ftpHost: '', ftpPort: '21', ftpUser: '', ftpPassword: '', ftpRoot: '', ftpSecure: false,
};

function FileManager() {
  const username = useAuthStore((s) => s.userInfo?.username ?? '');

  // ---------- 逻辑目录（不落盘）：树形侧栏 ----------
  // 注意声明顺序：filter 闭包引用的这些值必须在 useQueryTable 调用之前定义——
  // hook 内部的 useMemo 首次渲染即执行 filter，定义在后面的 const 会触发 TDZ
  // （Cannot access 'xxx' before initialization）
  const [dirs, setDirs] = useState<FileDirRecord[]>([]);
  /** 当前选中目录：'root' = 全部（含未分组）；其余为目录 id */
  const [selectedDirId, setSelectedDirId] = useState('root');

  const selectedSubtreeIds = useMemo(() => {
    if (selectedDirId === 'root') return null;
    const ids = new Set<string>([selectedDirId]);
    // dirs 为 DFS 序（父在子前）：一遍扫描即可收齐子孙
    for (const d of dirs) {
      if (d.parentId && ids.has(d.parentId)) ids.add(d.id);
    }
    return ids;
  }, [dirs, selectedDirId]);

  /** 目录视图：先限定目录范围（选中目录含子目录）再交给关键字过滤。
   * 每次渲染重建（闭包读最新状态），useQueryTable 经 ref 固化引用 */
  const filterByDirAndKey = (rows: FileRecord[], query: { key?: unknown }): FileRecord[] => {
    const scoped = selectedSubtreeIds
      ? rows.filter((r) => r.dirId !== null && selectedSubtreeIds.has(r.dirId))
      : rows;
    return filterFiles(scoped, query);
  };

  const {
    loading, rows: pagedFiles, total, page, pageSize, search, reload, onPageChange,
  } = useQueryTable<FileRecord>({
    fetcher: () => loadFiles(),
    filter: filterByDirAndKey,
  });

  // 多选集合：以 id 为键（Set 便于并集/差集），勾选状态跨页保留由调用方决定——本页清空于删除/重载后
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState('');
  const [downloadOk, setDownloadOk] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FileRecord | null>(null);
  const [batchConfirmVisible, setBatchConfirmVisible] = useState(false);
  const [configVisible, setConfigVisible] = useState(false);
  const [configForm, setConfigForm] = useState<ConfigFormState>(emptyConfigForm);
  const [configError, setConfigError] = useState('');
  const [configLoaded, setConfigLoaded] = useState<FileConfigRecord | null>(null);

  // ---------- 逻辑目录：弹窗与行内操作状态 ----------
  const [dirCreateVisible, setDirCreateVisible] = useState(false);
  /** 新增目录的目标父目录：null = 根（与 FileDirInput.parentId 同语义） */
  const [dirCreateParent, setDirCreateParent] = useState<string | null>(null);
  const [dirCreateName, setDirCreateName] = useState('');
  const [dirError, setDirError] = useState('');
  const [dirDeleteTarget, setDirDeleteTarget] = useState<FileDirRecord | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 目录列表加载（树形 DFS 序已由服务端排好）；与文件列表同步刷新 */
  const reloadDirs = async () => {
    try {
      setDirs(await loadFileDirs());
    } catch {
      setDirs([]);
    }
  };

  useEffect(() => {
    void reloadDirs();
  }, []);

  /** id→ 深度表由扁平 DFS 序推导（父必在子前），目录树行缩进用 */
  const dirDepthById = useMemo(() => {
    const map = new Map<string, number>();
    const parentDepth = new Map<string | null, number>([[null, 0]]);
    for (const d of dirs) {
      const depth = (parentDepth.get(d.parentId) ?? 0) + 1;
      map.set(d.id, depth);
      parentDepth.set(d.id, depth);
    }
    return map;
  }, [dirs]);

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const allSelected = pagedFiles.length > 0 && pagedFiles.every((f) => prev.has(f.id));
      if (allSelected) {
        const next = new Set(prev);
        pagedFiles.forEach((f) => next.delete(f.id));
        return next;
      }
      const next = new Set(prev);
      pagedFiles.forEach((f) => next.add(f.id));
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleUploadClick = () => {
    setUploadError('');
    fileInputRef.current?.click();
  };

  /** 当前选中目录名（面包屑/上传提示用）：root = 全部文件 */
  const selectedDirName = useMemo(() => {
    if (selectedDirId === 'root') return '全部文件';
    return dirs.find((d) => d.id === selectedDirId)?.name ?? '全部文件';
  }, [dirs, selectedDirId]);

  const openDirCreate = (parentId: string | null) => {
    setDirCreateParent(parentId);
    setDirCreateName('');
    setDirError('');
    setDirCreateVisible(true);
  };

  /** 切换选中目录：useQueryTable 的 filtered 只依赖 [records, query]，
   * 选中目录变化不在其中——同步 reload（拉新 records）让过滤重算，列表才会切换视图 */
  const selectDir = (dirId: string) => {
    setSelectedDirId(dirId);
    void reload();
  };

  const handleDirCreate = async () => {
    setDirError('');
    try {
      await createFileDir(dirCreateParent, dirCreateName.trim());
      setDirCreateVisible(false);
      await reloadDirs();
      await reload();
    } catch (err) {
      // 例：目录名清洗后为空 / 父目录已被并发删除
      setDirError(err instanceof Error ? err.message : '新增目录失败，请重试');
    }
  };

  const handleDirDelete = async () => {
    if (!dirDeleteTarget) return;
    try {
      await deleteFileDir(dirDeleteTarget.id);
      // 删除的是当前选中目录 → 回到根视图，避免停留在已不存在的目录上
      if (selectedDirId === dirDeleteTarget.id) setSelectedDirId('root');
      setDirDeleteTarget(null);
      setDirError('');
      await reloadDirs();
      await reload();
    } catch (err) {
      // 目录非空（有子目录/有文件）等拒绝场景：Modal 保持打开，错误直接显示在确认框内
      setDirError(err instanceof Error ? err.message : '删除目录失败，请重试');
    }
  };

  const handleFilesPicked = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError('');
    setUploading(true);
    let failed = 0;
    let lastError = '';
    // 上传目标：选中目录视图下进入 = 上传到该目录；根视图 = 未分组
    const uploadDirId = selectedDirId === 'root' ? null : selectedDirId;
    for (const file of Array.from(files)) {
      try {
        // FileReader → ArrayBuffer → Uint8Array：适配层按通路编码（IPC 直传/HTTP 转 base64）
        const buffer = await file.arrayBuffer();
        await uploadFile({ name: file.name, mime: file.type, uploadedBy: username, dirId: uploadDirId }, new Uint8Array(buffer));
      } catch (err) {
        failed += 1;
        lastError = err instanceof Error ? err.message : '上传失败';
      }
    }
    setUploading(false);
    // 选完即清空 input 的 value：同名文件可连续选择重传
    if (fileInputRef.current) fileInputRef.current.value = '';
    await reload();
    await reloadDirs(); // 目录侧栏的文件计数随上传同步
    if (failed > 0) {
      setUploadError(failed === 1 ? lastError : `${failed} 个文件上传失败（最后一个原因：${lastError}）`);
    }
  };

  const handleDeleteSingle = async () => {
    if (!deleteTarget) return;
    await deleteFiles([deleteTarget.id]);
    setDeleteTarget(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(deleteTarget.id);
      return next;
    });
    await reload();
    await reloadDirs(); // 删文件后目录计数同步
  };

  const handleDeleteBatch = async () => {
    if (selectedIds.size === 0) return;
    await deleteFiles(Array.from(selectedIds));
    setBatchConfirmVisible(false);
    setSelectedIds(new Set());
    await reload();
    await reloadDirs(); // 删文件后目录计数同步
  };

  // 下载（单条/批量统一入口）：先选目录再保存；用户取消目录选择则静默返回
  const handleDownload = async (ids: string[]) => {
    if (ids.length === 0 || downloading) return;
    setDownloadMessage('');
    try {
      const dir = await selectDownloadDir();
      if (!dir) return; // 用户关闭了目录选择器
      setDownloading(true);
      const result = await saveFilesTo(ids, dir);
      if (result.saved === 0 && result.failed.length > 0) {
        setDownloadOk(false);
        setDownloadMessage(`下载失败：${result.failed.map((f) => f.name).join('、')}`);
      } else if (result.failed.length > 0) {
        setDownloadOk(false);
        setDownloadMessage(`已保存 ${result.saved} 个文件，${result.failed.length} 个失败：${result.failed.map((f) => f.name).join('、')}`);
      } else {
        setDownloadOk(true);
        setDownloadMessage(`已保存 ${result.saved} 个文件到 ${dir}`);
      }
    } catch (err) {
      setDownloadOk(false);
      setDownloadMessage(err instanceof Error ? err.message : '下载失败，请重试');
    } finally {
      setDownloading(false);
    }
  };

  const openConfig = async () => {
    setConfigError('');
    setConfigVisible(true);
    try {
      const cfg = await loadFileConfig();
      setConfigLoaded(cfg);
      setConfigForm({
        activeStorage: cfg.activeStorage,
        localDir: cfg.localDir,
        ftpHost: cfg.ftpHost,
        ftpPort: String(cfg.ftpPort),
        ftpUser: cfg.ftpUser,
        ftpPassword: '',
        ftpRoot: cfg.ftpRoot,
        ftpSecure: cfg.ftpSecure,
      });
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : '读取配置失败');
    }
  };

  const handleConfigSave = async () => {
    setConfigError('');
    const port = Number(configForm.ftpPort);
    if (configForm.activeStorage === 'ftp' && !Number.isInteger(port)) {
      setConfigError('FTP 端口需为整数');
      return;
    }
    try {
      await saveFileConfig({
        activeStorage: configForm.activeStorage,
        localDir: configForm.localDir.trim(),
        ftpHost: configForm.ftpHost.trim(),
        ftpPort: port,
        ftpUser: configForm.ftpUser.trim(),
        // 密码留空 = 不修改（只写不读的配套语义）
        ...(configForm.ftpPassword ? { ftpPassword: configForm.ftpPassword } : {}),
        ftpRoot: configForm.ftpRoot.trim(),
        ftpSecure: configForm.ftpSecure,
      });
      setConfigVisible(false);
      // 同步 toolbar 的「当前存储」提示
      setConfigLoaded(await loadFileConfig());
    } catch (err) {
      // 例：切到 ftp 但未填主机时，service 层的前置校验在此浮出
      setConfigError(err instanceof Error ? err.message : '保存失败，请重试');
    }
  };

  const allSelected = pagedFiles.length > 0 && pagedFiles.every((f) => selectedIds.has(f.id));

  /** 目录名显示：未分组（root 视图下不出该列内容时也用得上） */
  const dirNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of dirs) map.set(d.id, d.name);
    return map;
  }, [dirs]);

  /** 目录树行渲染（DFS 序直接缩进）：每行 = 选中 + 名称/计数 + 新增子目录 + 删除 */
  const renderDirRow = (dir: FileDirRecord) => {
    const depth = dirDepthById.get(dir.id) ?? 1;
    const active = selectedDirId === dir.id;
    return (
      <div key={dir.id} className={`file-dir-row${active ? ' active' : ''}`}>
        <button
          className="file-dir-select"
          style={{ paddingLeft: 8 + (depth - 1) * 16 }}
          onClick={() => selectDir(dir.id)}
          title="查看此目录（含子目录）的文件"
        >
          <FolderOutlined /> {dir.name}
          <span className="file-dir-count">({dir.fileCount})</span>
        </button>
        <span className="file-dir-actions">
          <button
            className="btn-link"
            onClick={() => openDirCreate(dir.id)}
            title={`在「${dir.name}」下新建子目录`}
          >
            <FolderAddOutlined /> 子目录
          </button>
          <button
            className="btn-link danger"
            onClick={() => { setDirError(''); setDirDeleteTarget(dir); }}
            title="删除此目录（仅限空目录）"
          >
            <DeleteOutlined /> 删除
          </button>
        </span>
      </div>
    );
  };

  return (
    <div className="file-page">
      {/* 目录侧栏（逻辑目录树，不落盘）：根行 = 全部文件（含未分组） */}
      <aside className="file-dir-panel">
        <div className="file-dir-header">
          <span>目录</span>
          <button
            className="btn-link"
            onClick={() => openDirCreate(null)}
            title="在根目录下新建目录"
          >
            <FolderAddOutlined /> 新增
          </button>
        </div>
        <div className="file-dir-row root-row">
          <button
            className={`file-dir-select${selectedDirId === 'root' ? ' active' : ''}`}
            onClick={() => selectDir('root')}
          >
            <HomeOutlined /> 全部文件
          </button>
        </div>
        {dirs.map(renderDirRow)}
        {dirs.length === 0 && (
          <p className="file-dir-empty">暂无目录，点击「新增」创建</p>
        )}
      </aside>

      <QueryTableLayout
      loading={loading}
      query={<QueryForm fields={queryFields} onSearch={search} />}
      toolbar={
        <div className="file-toolbar">
          <button className="btn-primary" onClick={handleUploadClick} disabled={uploading} title={selectedDirId === 'root' ? '上传到未分组' : `上传到「${selectedDirName}」`}>
            <UploadOutlined /> {uploading ? '上传中…' : '上传文件'}{selectedDirId !== 'root' ? `到「${selectedDirName}」` : ''}
          </button>
          <button
            className="btn-danger"
            onClick={() => setBatchConfirmVisible(true)}
            disabled={selectedIds.size === 0}
            title={selectedIds.size === 0 ? '先勾选左侧多选框' : `删除选中的 ${selectedIds.size} 个文件`}
          >
            <DeleteOutlined /> 批量删除{selectedIds.size > 0 ? `（${selectedIds.size}）` : ''}
          </button>
          <button
            className="btn-secondary"
            onClick={() => handleDownload(Array.from(selectedIds))}
            disabled={selectedIds.size === 0 || downloading}
            title={selectedIds.size === 0 ? '先勾选左侧多选框' : `下载选中的 ${selectedIds.size} 个文件到指定目录`}
          >
            <DownloadOutlined /> {downloading ? '下载中…' : '下载选中'}{selectedIds.size > 0 ? `（${selectedIds.size}）` : ''}
          </button>
          <button className="btn-secondary" onClick={openConfig}>
            <SettingOutlined /> 存储设置
          </button>
          <span className="file-storage-hint">
            当前存储：{configLoaded ? STORAGE_LABELS[configLoaded.activeStorage] : '—'}
          </span>
        </div>
      }
      pagination={
        total > 0 ? (
          <Pagination current={page} pageSize={pageSize} total={total} onChange={onPageChange} />
        ) : undefined
      }
    >
      {uploadError && <div className="file-upload-error">{uploadError}</div>}
      {downloadMessage && (
        <div className={downloadOk ? 'file-download-msg' : 'file-upload-error'}>{downloadMessage}</div>
      )}
      {/* 隐藏的原生文件选择器：multiple 多选；目录由服务端按 yyyy/MM 分桶，不由用户选择 */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => handleFilesPicked(e.target.files)}
      />
      <table className="data-table">
        <thead>
          <tr>
            <th className="file-check-col">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} title="全选本页" />
            </th>
            <th>文件名</th>
            <th>目录</th>
            <th>大小</th>
            <th className="file-path-col">相对路径</th>
            <th className="file-path-col">完整路径</th>
            <th>存储位置</th>
            <th>上传人</th>
            <th>上传时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {pagedFiles.map((file) => (
            <tr key={file.id}>
              <td className="file-check-col">
                <input
                  type="checkbox"
                  checked={selectedIds.has(file.id)}
                  onChange={() => toggleOne(file.id)}
                />
              </td>
              <td className="file-name-cell" title={file.storedName}>
                <FileTextOutlined /> {file.name}
              </td>
              <td title={file.dirId === null ? '未分组' : dirNameById.get(file.dirId) ?? ''}>
                {file.dirId === null ? <span className="file-dir-none">未分组</span> : dirNameById.get(file.dirId) ?? '-'}
              </td>
              <td>{formatSize(file.size)}</td>
              {/* 相对路径 = 分桶目录 + 存储名（契约字段直接拼接，物理根无关） */}
              <td className="file-path-cell" title={`${file.path}${file.storedName}`}>
                {file.path}{file.storedName}
              </td>
              {/* 完整路径按当前存储配置解析（local=磁盘绝对路径 / ftp=ftp://…），悬停看全量 */}
              <td className="file-path-cell" title={file.fullPath}>
                {file.fullPath}
              </td>
              <td>
                <span className={`storage-badge ${file.storage}`}>{STORAGE_LABELS[file.storage]}</span>
              </td>
              <td>{file.uploadedBy || '-'}</td>
              <td>{formatDate(file.createdAt)}</td>
              <td>
                <button
                  className="row-download-btn"
                  onClick={() => handleDownload([file.id])}
                  disabled={downloading}
                  title="下载此文件到指定目录"
                >
                  <DownloadOutlined /> 下载
                </button>
                <button className="row-delete-btn" onClick={() => setDeleteTarget(file)} title="删除此文件">
                  <DeleteOutlined /> 删除
                </button>
              </td>
            </tr>
          ))}
          {total === 0 && !loading && (
            <tr>
              <td colSpan={10} className="table-empty">
                <InboxOutlined /> {selectedDirId === 'root' ? '暂无文件，点击上方「上传文件」开始' : `「${selectedDirName}」及其子目录暂无文件`}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* 单条删除确认：说明物理文件与记录一并删除 */}
      <Modal
        title="删除文件"
        visible={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteSingle}
        confirmText="删除"
      >
        <p>确定删除「{deleteTarget?.name}」吗？</p>
        <p className="modal-hint">物理文件与上传记录将一并删除，不可恢复。</p>
      </Modal>

      {/* 批量删除确认 */}
      <Modal
        title="批量删除"
        visible={batchConfirmVisible}
        onClose={() => setBatchConfirmVisible(false)}
        onConfirm={handleDeleteBatch}
        confirmText="全部删除"
      >
        <p>确定删除选中的 {selectedIds.size} 个文件吗？</p>
        <p className="modal-hint">物理文件与上传记录将一并删除，不可恢复。</p>
      </Modal>

      {/* 存储设置：LOCAL/FTP 可配；FTP 凭据只写不读（密码留空 = 不修改） */}
      <Modal
        title="存储设置"
        visible={configVisible}
        onClose={() => setConfigVisible(false)}
        onConfirm={handleConfigSave}
        confirmText="保存"
      >
        <div className="modal-form">
          {configError && <p style={{ color: 'var(--color-danger)', margin: '0 0 12px', fontSize: '13px' }}>{configError}</p>}
          <div className="modal-form-row">
            <label>存储类型</label>
            <select
              value={configForm.activeStorage}
              onChange={(e) => setConfigForm({ ...configForm, activeStorage: e.target.value as FileStorage })}
            >
              <option value="local">LOCAL（本地磁盘）</option>
              <option value="ftp">FTP（远程服务器）</option>
            </select>
          </div>
          {configForm.activeStorage === 'local' ? (
            <div className="modal-form-row">
              <label>存储目录</label>
              <input
                value={configForm.localDir}
                placeholder="留空 = 应用数据目录下的 files"
                onChange={(e) => setConfigForm({ ...configForm, localDir: e.target.value })}
              />
            </div>
          ) : (
            <>
              <div className="modal-form-row">
                <label>主机地址</label>
                <input
                  value={configForm.ftpHost}
                  placeholder="如 192.168.1.10"
                  onChange={(e) => setConfigForm({ ...configForm, ftpHost: e.target.value })}
                />
              </div>
              <div className="modal-form-row">
                <label>端口</label>
                <input
                  value={configForm.ftpPort}
                  placeholder="默认 21"
                  onChange={(e) => setConfigForm({ ...configForm, ftpPort: e.target.value })}
                />
              </div>
              <div className="modal-form-row">
                <label>用户名</label>
                <input
                  value={configForm.ftpUser}
                  onChange={(e) => setConfigForm({ ...configForm, ftpUser: e.target.value })}
                />
              </div>
              <div className="modal-form-row">
                <label>密码</label>
                {/* 只写不读：编辑时不回显，留空 = 不修改 */}
                <input
                  type="password"
                  value={configForm.ftpPassword}
                  placeholder="留空 = 不修改"
                  onChange={(e) => setConfigForm({ ...configForm, ftpPassword: e.target.value })}
                />
              </div>
              <div className="modal-form-row">
                <label>根目录</label>
                <input
                  value={configForm.ftpRoot}
                  placeholder="FTP 登录根下的子目录，可留空"
                  onChange={(e) => setConfigForm({ ...configForm, ftpRoot: e.target.value })}
                />
              </div>
              <div className="modal-form-row">
                <label>FTPS</label>
                <select
                  value={configForm.ftpSecure ? '1' : '0'}
                  onChange={(e) => setConfigForm({ ...configForm, ftpSecure: e.target.value === '1' })}
                >
                  <option value="0">关闭（普通 FTP）</option>
                  <option value="1">开启（FTPS 显式加密）</option>
                </select>
              </div>
            </>
          )}
          <p className="modal-hint">切换存储类型只影响新上传的文件；已上传文件的存储位置记录在各自记录中。</p>
        </div>
      </Modal>

      {/* 新增目录：父目录由入口决定（根/某目录下），支持多级 */}
      <Modal
        title={dirCreateParent === null ? '新增目录（根目录下）' : `新增目录（在「${dirNameById.get(dirCreateParent) ?? ''}」下）`}
        visible={dirCreateVisible}
        onClose={() => setDirCreateVisible(false)}
        onConfirm={handleDirCreate}
        confirmText="创 建"
      >
        <div className="modal-form">
          {dirError && <p style={{ color: 'var(--color-danger)', margin: '0 0 12px', fontSize: '13px' }}>{dirError}</p>}
          <div className="modal-form-row">
            <label>目录名</label>
            <input
              value={dirCreateName}
              placeholder="最多 50 字，非法字符会被自动清洗"
              autoFocus
              onChange={(e) => setDirCreateName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && dirCreateName.trim()) void handleDirCreate(); }}
            />
          </div>
          <p className="modal-hint">目录为逻辑分组，不改变文件的磁盘存储位置；上传时上传到当前选中的目录。</p>
        </div>
      </Modal>

      {/* 删除目录确认：只允许空目录；非空时错误直接显示在框内（Modal 保持打开） */}
      <Modal
        title="删除目录"
        visible={!!dirDeleteTarget}
        onClose={() => { setDirError(''); setDirDeleteTarget(null); }}
        onConfirm={handleDirDelete}
        confirmText="删除"
      >
        <p>确定删除目录「{dirDeleteTarget?.name}」吗？</p>
        {dirError && <p style={{ color: 'var(--color-danger)', margin: '8px 0', fontSize: '13px' }}>{dirError}</p>}
        <p className="modal-hint">仅允许删除空目录（无子目录且无文件）；目录为逻辑分组，删除不影响磁盘文件。</p>
      </Modal>
    </QueryTableLayout>
    </div>
  );
}

export default FileManager;
