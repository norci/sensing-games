/**
 * PoseWorkerBase - base class for MediaPipe Workers
 */
import { FilesetResolver } from '@mediapipe/tasks-vision';

if (typeof self !== 'undefined' && !('import' in self)) {
  (self as unknown as Record<string, unknown>).import = async (url: string) => {
    const response = await fetch(url);
    let text = await response.text();

    text = text.replace(
      /if\s*\(\s*typeof\s*\(?\s*custom_dbg\s*\)?\s*===?\s*["']undefined["']\s*\)\s*\{\s*function\s+custom_dbg\s*\(\s*text\s*\)\s*\{/,
      "var custom_dbg; if (typeof custom_dbg === 'undefined') { custom_dbg = function(text) {"
    );

    text += '\nself.ModuleFactory = ModuleFactory;\n';

    const blob = new Blob([text], { type: 'text/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    try {
      await import(/* @vite-ignore */ blobUrl);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  };
}

export abstract class PoseWorkerBase {
  protected taskInstance: any | undefined;
  protected isInitializing = false;
  protected currentOptions: any = {};
  protected basePath = '/';
  private messageQueue: MessageEvent[] = [];
  private isProcessing = false;

  constructor() {
    self.onmessage = this.handleMessage.bind(this);
  }

  protected async handleMessage(event: MessageEvent) {
    if (this.isProcessing) {
      this.messageQueue.push(event);
      return;
    }

    this.isProcessing = true;
    await this.doHandleMessage(event);

    while (this.messageQueue.length > 0) {
      const next = this.messageQueue.shift()!;
      await this.doHandleMessage(next);
    }
    this.isProcessing = false;
  }

  private async doHandleMessage(event: MessageEvent) {
    const { type } = event.data;

    try {
      if (type === 'INIT') {
        const { modelAssetPath, delegate, baseUrl, ...rest } = event.data;
        this.basePath = baseUrl || '/';
        this.currentOptions = { modelAssetPath, delegate, ...rest };
        await this.initializeBase(event.data);
        const payload = this.getInitPayload();
        self.postMessage({ type: 'INIT_DONE', ...payload });
      } else if (type === 'SET_OPTIONS') {
        const { type: _type, ...optionsToUpdate } = event.data;
        Object.assign(this.currentOptions, optionsToUpdate);
        await this.updateOptions(optionsToUpdate);
        self.postMessage({ type: 'OPTIONS_UPDATED' });
      } else if (type === 'CLEANUP') {
        if (this.taskInstance) {
          (this.taskInstance as any).close?.();
          this.taskInstance = undefined;
        }
        self.postMessage({ type: 'CLEANUP_DONE' });
      } else {
        await this.handleCustomMessage(event.data);
      }
    } catch (error: any) {
      console.error('Worker Error:', error);
      self.postMessage({ type: 'ERROR', error: error?.message || String(error) });
    }
  }

  private async initializeBase(data: any) {
    if (this.isInitializing) return;
    this.isInitializing = true;
    try {
      if (this.taskInstance) {
        (this.taskInstance as any).close?.();
        this.taskInstance = undefined;
      }
      await this.initializeTask(data);
    } finally {
      this.isInitializing = false;
    }
  }

  protected async loadModelAsset(modelAssetPath: string): Promise<ArrayBuffer> {
    const response = await fetch(modelAssetPath);
    if (!response.ok) {
      throw new Error(`Failed to load model: ${response.statusText}`);
    }
    return response.arrayBuffer();
  }

  protected getWasmPath(): string {
    const base = this.basePath.endsWith('/') ? this.basePath.slice(0, -1) : this.basePath;
    return `${base}/wasm`;
  }

  protected async getVisionFileset() {
    const wasmPath = this.getWasmPath();
    const fileset = await FilesetResolver.forVisionTasks(wasmPath, true);
    return fileset;
  }

  protected updateOptions(_?: any): Promise<void> {
    return Promise.resolve();
  }

  protected abstract initializeTask(data?: any): Promise<void>;
  protected abstract handleCustomMessage(data: any): Promise<void>;

  protected getInitPayload(): any {
    return {};
  }
}
