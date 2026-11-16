import { runProcess } from './music-discovery.mjs'

export function createMusicRuntime({ configured, onStatus = () => {}, execute = runProcess } = {}) {
  let pending
  return () => pending ??= (async () => {
    const binary = configured || 'yt-dlp'
    try {
      await execute(binary, ['--ignore-config', '--version'], {
        shell: false, timeout: 7000, maxBuffer: 16384, windowsHide: true
      })
      onStatus('yt-dlp listo')
      return binary
    } catch (error) {
      onStatus('yt-dlp no disponible; se usará el buscador público')
      throw error
    }
  })()
}
