import { contextBridge, ipcRenderer } from "electron";

import type {
  AppConfig,
  DesktopApi,
  MainErrorReport,
  OpenCodeStartupProgress,
} from "../src/types/desktop";
import { channels } from "./channels";

const api: DesktopApi = {
  compileExplorerProgram: (program) =>
    ipcRenderer.invoke(channels.compileExplorerProgram, program),
  getOpenCodeInfo: () => ipcRenderer.invoke(channels.getOpenCodeInfo),
  getOpenCodeInstallFolder: () => ipcRenderer.invoke(channels.getOpenCodeInstallFolder),
  getStudioMcpStatus: () => ipcRenderer.invoke(channels.getStudioMcpStatus),
  onOpenCodeStartupProgress: (listener) => {
    const handleProgress = (_event: Electron.IpcRendererEvent, progress: OpenCodeStartupProgress) =>
      listener(progress);
    ipcRenderer.on(channels.openCodeStartupProgress, handleProgress);
    return () => ipcRenderer.removeListener(channels.openCodeStartupProgress, handleProgress);
  },
  getVersion: () => ipcRenderer.invoke(channels.getVersion),
  getInstructionFiles: () => ipcRenderer.invoke(channels.getInstructionFiles),
  openUrl: (url) => ipcRenderer.invoke(channels.openUrl, url),
  loadConfig: () => ipcRenderer.invoke(channels.loadConfig),
  patchConfig: (patch: Partial<AppConfig>) => ipcRenderer.invoke(channels.patchConfig, patch),
  getPinnedState: () => ipcRenderer.invoke(channels.getPinnedState),
  setPinnedState: (pinned: boolean) => ipcRenderer.invoke(channels.setPinnedState, pinned),
  discoverCompatibleModels: (url: string, key: string) => ipcRenderer.invoke(channels.discoverCompatibleModels, url, key),
  blenderStatus: () => ipcRenderer.invoke(channels.blenderStatus),
  blenderCreateModel: (plan) => ipcRenderer.invoke(channels.blenderCreateModel, plan),
  openCreativeFile: (path) => ipcRenderer.invoke(channels.openCreativeFile, path),
  openIconFolder: () => ipcRenderer.invoke(channels.openIconFolder),
  figmaConfigured: () => ipcRenderer.invoke(channels.figmaConfigured),
  setFigmaToken: (token) => ipcRenderer.invoke(channels.setFigmaToken, token),
  figmaFrames: (url) => ipcRenderer.invoke(channels.figmaFrames, url),
  figmaGenerateUi: (url, id) => ipcRenderer.invoke(channels.figmaGenerateUi, url, id),
  figmaApplyUi: (source) => ipcRenderer.invoke(channels.figmaApplyUi, source),
  visionConfigured: () => ipcRenderer.invoke(channels.visionConfigured),
  listVisionModels: () => ipcRenderer.invoke(channels.listVisionModels),
  getVisionModel: () => ipcRenderer.invoke(channels.getVisionModel),
  setVisionModel: (id) => ipcRenderer.invoke(channels.setVisionModel, id),
  setVisionApiKey: (key) => ipcRenderer.invoke(channels.setVisionApiKey, key),
  describeImages: (images, context) => ipcRenderer.invoke(channels.describeImages, images, context),
  captureScreen: () => ipcRenderer.invoke(channels.captureScreen),
  findVisualReferences: (query) => ipcRenderer.invoke(channels.findVisualReferences, query),
  checkForUpdate: () => ipcRenderer.invoke(channels.checkForUpdate),
  installUpdate: () => ipcRenderer.invoke(channels.installUpdate),
  invokeExplorerProgram: (artifact, studioId) =>
    ipcRenderer.invoke(channels.invokeExplorerProgram, artifact, studioId),
  listExplorerProgramTools: () => ipcRenderer.invoke(channels.listExplorerProgramTools),
  relaunch: () => ipcRenderer.invoke(channels.relaunch),
  installStudioTargetPrograms: (envelopes) =>
    ipcRenderer.invoke(channels.installStudioTargetPrograms, envelopes),
  discoverStudioTargets: (programs) =>
    ipcRenderer.invoke(channels.discoverStudioTargets, programs),
  selectStudioTarget: (programs, targetKey) =>
    ipcRenderer.invoke(channels.selectStudioTarget, programs, targetKey),
  getBloxBotPrograms: () => ipcRenderer.invoke(channels.getBloxBotPrograms),
  onBloxBotProgramsUpdated: (listener) => {
    const handleUpdate = () => listener();
    ipcRenderer.on(channels.bloxbotProgramsUpdated, handleUpdate);
    return () => ipcRenderer.removeListener(channels.bloxbotProgramsUpdated, handleUpdate);
  },
  onMainError: (listener) => {
    const handleError = (_event: Electron.IpcRendererEvent, report: MainErrorReport) =>
      listener(report);
    ipcRenderer.on(channels.mainError, handleError);
    // Errors from before the window was listening are buffered in main until this arrives.
    ipcRenderer.send(channels.mainErrorReady);
    return () => ipcRenderer.removeListener(channels.mainError, handleError);
  },
};

contextBridge.exposeInMainWorld("bloxbot", api);
