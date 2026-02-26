import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { toast } from './components/ui/toaster'
import { setupConsoleCapture } from './lib/consoleCapture'
import './index.css'

try {
  const storedTheme = localStorage.getItem('devsync.theme')
  if (storedTheme === 'dark') {
    document.documentElement.classList.add('dark')
  }
} catch {
  // ignore
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error) => {
        const message =
          error instanceof Error ? error.message : '请求失败，请稍后重试'
        toast.error(message)
      },
    },
  },
})

setupConsoleCapture()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <App />
      </HashRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
