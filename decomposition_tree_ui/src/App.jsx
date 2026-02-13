import { useState } from 'react'
import './App.css'
import Controls from './components/Controls/Controls'
import Items from './components/Items/Items'
import Navbar from './components/Navbar/Navbar'
import { TreeProvider } from './context/TreeContext'
import Footer from './components/Footer/Footer'

function App() {
  const [globalKPI, setGlobalKPI] = useState("");

  return (
    <TreeProvider>
      <div className="app-layout">
        <Navbar />

        <main className="app-content">
          <Items />
        </main>
        <Controls />
        {/* <Footer /> */}
      </div>
    </TreeProvider>
  );
}

export default App
