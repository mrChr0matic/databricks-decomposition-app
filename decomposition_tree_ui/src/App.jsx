import { useState } from 'react'
import './App.css'
import Controls from './components/Controls/Controls'
import Items from './components/Items/Items'
import Navbar from './components/Navbar/Navbar'
import { TreeProvider } from './context/TreeContext'
import Footer from './components/Footer/Footer'
import Genie from './components/Genie/Genie'

function App() {
  const [globalKPI, setGlobalKPI] = useState("");
  const [isGenieOpen, setIsGenieOpen] = useState(false);

  return (
    <TreeProvider>
      <div className="app-layout">
        <Navbar onGenieToggle={() => setIsGenieOpen(true)} />

        <main className="app-content">
          <Items />
        </main>
        <Controls />

        <Genie
          isOpen={isGenieOpen}
          onClose={() => setIsGenieOpen(false)}
        />
        {/* <Footer /> */}
      </div>
    </TreeProvider>
  );
}

export default App
