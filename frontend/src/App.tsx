import { Route, Routes } from 'react-router-dom'
import Layout from './Layout'
import Home from './pages/Home'
import Logs from './pages/Logs'
import Docs from './pages/Docs'
import ChannelPage from './pages/ChannelPage'
import QueueStatus from './pages/QueueStatus'
import './App.css'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/queue" element={<QueueStatus />} />
        <Route
          path="/whatsapp"
          element={
            <ChannelPage
              title="WhatsApp"
              description="Send and receive WhatsApp messages."
            />
          }
        />
        <Route
          path="/call"
          element={
            <ChannelPage
              title="Call"
              description="Place and manage voice calls."
            />
          }
        />
        <Route
          path="/email"
          element={
            <ChannelPage
              title="Email"
              description="Send and receive email."
            />
          }
        />
      </Route>
    </Routes>
  )
}
