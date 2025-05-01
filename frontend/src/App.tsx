import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import CompanyDetailsPage from './pages/CompanyDetailsPage'

// Placeholder components for future tasks
const SavedProspectsPage = () => (
  <div className="page">
    <h1>Saved Prospects</h1>
    <p>This page will be implemented in future tasks</p>
  </div>
)

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <nav>
          <a href="/">Home</a>
          <a href="/saved">Saved Prospects</a>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/company/:id" element={<CompanyDetailsPage />} />
          <Route path="/saved" element={<SavedProspectsPage />} />
          <Route path="*" element={<div>Page not found</div>} />
        </Routes>
      </main>
      <footer className="app-footer">
        <p>&copy; {new Date().getFullYear()} AI-Prospecting</p>
      </footer>
    </div>
  )
}

export default App 