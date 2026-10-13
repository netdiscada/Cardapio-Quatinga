// Cardapio Quatinga v3 - appUpdate.js
// Sistema de atualização in-app: verifica GitHub Releases, baixa APK e instala

(function (global) {
  const APP_CONFIG = global.APP_CONFIG || {};
  
  // Configuração do repositório
  const UPDATE_CONFIG = {
    owner: 'netdiscada',
    repo: 'Cardapio-Quatinga',
    currentVersion: '2026.1', // Será atualizado pelo build
    checkInterval: 24 * 60 * 60 * 1000, // 24 horas
    githubApiUrl: 'https://api.github.com/repos/netdiscada/Cardapio-Quatinga/releases/latest'
  };

  let updateCheckPromise = null;
  let isChecking = false;

  // Verifica se há atualização disponível
  async function checkForUpdates(silent = false) {
    if (isChecking) return updateCheckPromise;
    
    isChecking = true;
    updateCheckPromise = (async () => {
      try {
        // No APK nativo, usa versão do build; no PWA usa cache
        const currentVer = UPDATE_CONFIG.currentVersion;
        
        const response = await fetch(UPDATE_CONFIG.githubApiUrl, {
          headers: { 'Accept': 'application/vnd.github.v3+json' },
          cache: 'no-cache'
        });
        
        if (!response.ok) {
          if (!silent) console.log('[appUpdate] Falha ao verificar updates:', response.status);
          return null;
        }
        
        const release = await response.json();
        const latestVersion = release.tag_name?.replace('v', '') || release.name?.replace('v', '');
        
        if (!latestVersion) {
          if (!silent) console.log('[appUpdate] Versão não encontrada no release');
          return null;
        }
        
        const hasUpdate = compareVersions(latestVersion, currentVer) > 0;
        
        if (hasUpdate) {
          // Procura asset APK debug
          const apkAsset = release.assets?.find(a => 
            a.name.endsWith('.apk') && a.name.includes('debug')
          ) || release.assets?.find(a => a.name.endsWith('.apk'));
          
          if (apkAsset) {
            const updateInfo = {
              version: latestVersion,
              currentVersion: currentVer,
              downloadUrl: apkAsset.browser_download_url,
              fileName: apkAsset.name,
              size: apkAsset.size,
              releaseNotes: release.body || '',
              publishedAt: release.published_at
            };
            
            if (!silent) {
              console.log('[appUpdate] Nova versão disponível:', updateInfo.version);
              showUpdateNotification(updateInfo);
            }
            
            return updateInfo;
          }
        }
        
        if (!silent) console.log('[appUpdate] App atualizado (v' + currentVer + ')');
        return null;
        
      } catch (e) {
        if (!silent) console.error('[appUpdate] Erro ao verificar:', e);
        return null;
      } finally {
        isChecking = false;
      }
    })();
    
    return updateCheckPromise;
  }

  // Compara versões semânticas (ex: "2026.2" > "2026.1")
  function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    const maxLen = Math.max(parts1.length, parts2.length);
    
    for (let i = 0; i < maxLen; i++) {
      const n1 = parts1[i] || 0;
      const n2 = parts2[i] || 0;
      if (n1 !== n2) return n1 > n2 ? 1 : -1;
    }
    return 0;
  }

  // Mostra notificação de atualização disponível
  function showUpdateNotification(updateInfo) {
    const isNative = global.Capacitor?.isNativePlatform;
    
    // Cria notificação customizada (não usa sistema para ter botões de ação)
    const existing = document.getElementById('app-update-banner');
    if (existing) existing.remove();
    
    const banner = document.createElement('div');
    banner.id = 'app-update-banner';
    banner.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: white; padding: 12px 16px; text-align: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideDown 0.3s ease-out;
      font-family: 'Poppins', sans-serif;
    `;
    
    const sizeMB = (updateInfo.size / 1024 / 1024).toFixed(1);
    banner.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; gap: 12px; flex-wrap: wrap;">
        <span style="flex: 1; text-align: left; min-width: 200px;">
          <strong>📱 Nova versão ${updateInfo.version} disponível!</strong><br>
          <small>Tamanho: ${sizeMB} MB</small>
        </span>
        <button id="btn-update-now" style="
          background: white; color: #2563eb; border: none; padding: 8px 16px;
          border-radius: 20px; font-weight: 600; cursor: pointer;
          font-family: 'Poppins', sans-serif; font-size: 14px;
        ">Atualizar agora</button>
        <button id="btn-update-later" style="
          background: transparent; color: white; border: 1px solid rgba(255,255,255,0.5);
          padding: 8px 16px; border-radius: 20px; cursor: pointer;
          font-family: 'Poppins', sans-serif; font-size: 14px;
        ">Depois</button>
      </div>
      <style>
        @keyframes slideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      </style>
    `;
    
    document.body.appendChild(banner);
    
    // Event listeners
    document.getElementById('btn-update-now').onclick = () => {
      banner.remove();
      downloadAndInstall(updateInfo);
    };
    
    document.getElementById('btn-update-later').onclick = () => {
      banner.style.animation = 'slideDown 0.3s ease-in reverse';
      setTimeout(() => banner.remove(), 300);
    };
    
    // Auto-hide após 30 segundos
    setTimeout(() => {
      if (banner.parentNode) {
        banner.style.animation = 'slideDown 0.3s ease-in reverse';
        setTimeout(() => banner.remove(), 300);
      }
    }, 30000);
  }

  // Baixa e instala APK
  async function downloadAndInstall(updateInfo) {
    try {
      // Mostra progresso
      const progressBanner = document.createElement('div');
      progressBanner.id = 'app-update-progress';
      progressBanner.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
        background: #1f2937; color: white; padding: 16px;
        font-family: 'Poppins', sans-serif;
      `;
      progressBanner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 24px; height: 24px; border: 3px solid #374151; border-top-color: #2563eb; border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <div style="flex: 1;">
            <div style="font-weight: 600;">Baixando atualização...</div>
            <div id="download-progress" style="height: 4px; background: #374151; border-radius: 2px; overflow: hidden; margin-top: 8px;">
              <div id="download-bar" style="height: 100%; width: 0%; background: #2563eb; transition: width 0.3s;"></div>
            </div>
            <div id="download-status" style="font-size: 12px; color: #9ca3af; margin-top: 4px;">Iniciando...</div>
          </div>
        </div>
        <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
      `;
      document.body.appendChild(progressBanner);
      
      // Baixa com progresso
      const response = await fetch(updateInfo.downloadUrl);
      if (!response.ok) throw new Error('Falha no download: ' + response.status);
      
      const totalSize = parseInt(response.headers.get('content-length') || '0');
      const reader = response.body.getReader();
      const chunks = [];
      let loaded = 0;
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        
        if (totalSize > 0) {
          const percent = Math.round((loaded / totalSize) * 100);
          document.getElementById('download-bar').style.width = percent + '%';
          document.getElementById('download-status').textContent = 
            `${(loaded/1024/1024).toFixed(1)} / ${(totalSize/1024/1024).toFixed(1)} MB (${percent}%)`;
        }
      }
      
      const apkBlob = new Blob(chunks, { type: 'application/vnd.android.package-archive' });
      
      // Instala
      document.getElementById('download-status').textContent = 'Download concluído. Instalando...';
      document.getElementById('download-bar').style.width = '100%';
      
      await installApk(apkBlob, updateInfo.fileName);
      
    } catch (e) {
      console.error('[appUpdate] Erro no download/instalação:', e);
      showToast('Erro ao atualizar: ' + e.message, 'error');
    }
  }

  // Instala APK (nativo via Capacitor / PWA via download)
  async function installApk(apkBlob, fileName) {
    const isNative = global.Capacitor?.isNativePlatform;
    
    if (isNative && global.Capacitor.Plugins?.FileSystem) {
      try {
        // Salva no armazenamento do app
        const { Filesystem, Directory, Encoding } = global.Capacitor.Plugins;
        const base64 = await blobToBase64(apkBlob);
        
        await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache,
          encoding: Encoding.UTF8
        });
        
        // Pega URI do arquivo
        const fileUri = await Filesystem.getUri({
          directory: Directory.Cache,
          path: fileName
        });
        
        // Instala via intent
        if (global.Capacitor.Plugins?.AppLauncher) {
          await global.Capacitor.Plugins.AppLauncher.openUrl({ url: fileUri.uri });
        } else {
          // Fallback: compartilha arquivo
          if (global.Capacitor.Plugins?.Share) {
            await global.Capacitor.Plugins.Share.share({
              title: 'Atualização Cardápio Quatinga',
              text: 'Nova versão do app',
              url: fileUri.uri,
              dialogTitle: 'Instalar atualização'
            });
          }
        }
        
        showToast('Atualização baixada! Toque na notificação para instalar.', 'success');
        
      } catch (e) {
        console.error('[appUpdate] Erro instalação nativa:', e);
        // Fallback: download direto
        triggerDirectDownload(apkBlob, fileName);
      }
    } else {
      // PWA / Web: download direto
      triggerDirectDownload(apkBlob, fileName);
    }
    
    document.getElementById('app-update-progress')?.remove();
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function triggerDirectDownload(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('APK baixado! Abra o arquivo para instalar.', 'success');
  }

  // Verificação automática na inicialização
  async function initAutoUpdate() {
    // Verifica se já verificou hoje
    const lastCheck = localStorage.getItem('lastUpdateCheck');
    const now = Date.now();
    
    if (lastCheck && (now - parseInt(lastCheck)) < UPDATE_CONFIG.checkInterval) {
      // Verifica em background sem notificar
      checkForUpdates(true);
      return;
    }
    
    localStorage.setItem('lastUpdateCheck', now.toString());
    
    // Aguarda app carregar
    setTimeout(() => {
      checkForUpdates(false);
    }, 5000);
  }

  // Verificação manual (ex: botão no menu)
  global.manualUpdateCheck = async function() {
    const result = await checkForUpdates(false);
    if (!result) {
      showToast('App está atualizado!', 'success');
    }
    return result;
  };

  // Toast helper
  function showToast(msg, type = 'info') {
    if (global.showToast) {
      global.showToast(msg, type, 5000);
    } else {
      console.log('[appUpdate]', type.toUpperCase(), ':', msg);
    }
  }

  // Expõe API
  global.AppUpdate = {
    check: () => checkForUpdates(false),
    checkSilent: () => checkForUpdates(true),
    downloadAndInstall,
    getCurrentVersion: () => UPDATE_CONFIG.currentVersion
  };

  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoUpdate);
  } else {
    initAutoUpdate();
  }

})(window);