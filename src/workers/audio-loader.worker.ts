/**
 * 🚀 Audio Loader Web Worker
 * 음원 다운로드와 버퍼링을 메인 스레드에서 분리하여 LCP 최적화
 */

interface AudioLoadRequest {
  type: 'LOAD_AUDIO';
  url: string;
  trackId: string;
  useRangeRequest: boolean; // HTTP Range Request 사용 여부
  rangeBytes?: number; // 초기 로딩할 바이트 수 (기본: 200KB)
}

interface AudioLoadSuccess {
  type: 'AUDIO_LOADED';
  trackId: string;
  blob: Blob;
  duration?: number;
  size: number;
}

interface AudioLoadError {
  type: 'AUDIO_ERROR';
  trackId: string;
  error: string;
}

type WorkerMessage = AudioLoadRequest;

// 🚀 HTTP Range Request로 음원의 처음 일부만 로드
async function loadAudioWithRange(url: string, rangeBytes: number = 204800): Promise<Blob> {
  console.log(`🚀 [Worker] Loading first ${rangeBytes / 1024}KB with Range Request: ${url}`);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Range': `bytes=0-${rangeBytes - 1}` // 처음 200KB만 요청
      }
    });
    
    if (response.status === 206 || response.status === 200) {
      // 206 Partial Content 또는 200 OK (Range 미지원 시)
      const blob = await response.blob();
      console.log(`✅ [Worker] Loaded ${blob.size / 1024}KB (status: ${response.status})`);
      return blob;
    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }
  } catch (error) {
    console.warn(`⚠️ [Worker] Range request failed, falling back to full load:`, error);
    // 폴백: 전체 파일 로드
    const response = await fetch(url);
    return await response.blob();
  }
}

// 🚀 전체 오디오 로드 (폴백용)
async function loadFullAudio(url: string): Promise<Blob> {
  console.log(`📥 [Worker] Loading full audio: ${url}`);
  const response = await fetch(url);
  const blob = await response.blob();
  console.log(`✅ [Worker] Loaded ${blob.size / 1024}KB`);
  return blob;
}

// 메시지 핸들러
self.addEventListener('message', async (e: MessageEvent<WorkerMessage>) => {
  const message = e.data;
  
  if (message.type === 'LOAD_AUDIO') {
    try {
      const { url, trackId, useRangeRequest, rangeBytes = 204800 } = message;
      
      // Range Request 또는 전체 로드
      const blob = useRangeRequest 
        ? await loadAudioWithRange(url, rangeBytes)
        : await loadFullAudio(url);
      
      // 성공 응답
      const response: AudioLoadSuccess = {
        type: 'AUDIO_LOADED',
        trackId,
        blob,
        size: blob.size
      };
      
      self.postMessage(response);
      
    } catch (error) {
      // 에러 응답
      const errorResponse: AudioLoadError = {
        type: 'AUDIO_ERROR',
        trackId: message.trackId,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      self.postMessage(errorResponse);
    }
  }
});

// Worker 준비 완료 알림
self.postMessage({ type: 'WORKER_READY' });

export {};

