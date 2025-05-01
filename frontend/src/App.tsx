import { Routes, Route } from 'react-router-dom'
import { useState } from 'react'

// Import pages when they're created in future tasks
// import HomePage from './pages/HomePage'
// import CompanyDetailsPage from './pages/CompanyDetailsPage'
// import SavedProspectsPage from './pages/SavedProspectsPage'

const HomePage = () => (
  <div className="page">
    <h1>AI-Prospecting</h1>
    <p>B2B sales intelligence platform</p>
    <div className="placeholder">
      <h2>Company Search</h2>
      <p>Search functionality will be implemented in future tasks</p>
    </div>
  </div>
)

const CompanyDetailsPage = () => (
  <div className="page">
    <h1>Company Details</h1>
    <p>This page will be implemented in future tasks</p>
  </div>
)

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