import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { TauriFilesystemProvider } from './filesystem/TauriFilesystemProvider'
import { FakeFilesystemProvider } from './filesystem/FakeFilesystemProvider'

// When VITE_FAKE_FS=true the app starts with the in-memory fake filesystem.
// This allows interactive UI exploration without a running Tauri backend:
//
//   VITE_FAKE_FS=true npm run dev
//
const useFakeFs = import.meta.env.VITE_FAKE_FS === 'true';
const fs = useFakeFs
  ? new FakeFilesystemProvider({ totalFiles: 1_000_000 })
  : new TauriFilesystemProvider();

createRoot(document.getElementById('root')!).render(<App fs={fs} />)
