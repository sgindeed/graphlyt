import React, { useState, useEffect, useRef } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import axios from 'axios';
import { 
  Upload, Search, Bell, User, Cpu, CheckCircle2, 
  History, Send, Maximize2, ZoomIn, Loader2 
} from 'lucide-react';

const API_BASE = 'http://localhost:8000';
const WS_BASE = 'ws://localhost:8000';

const TYPE_COLORS = { 
  Person: '#ff007b', Organization: '#fec931', 
  Location: '#00ff88', Concept: '#00e5ff', 
  Event: '#bb00ff', Default: '#475569' 
};

export default function NeuralArchitect() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  
  // --- DYNAMIC DIMENSIONS STATE ---
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  const [messages, setMessages] = useState([
    { sender: 'architect', text: 'Neural Interface Standby. Awaiting manifest ingestion.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  const graphRef = useRef();
  const containerRef = useRef(); // Ref for the right-side section
  const chatScrollRef = useRef();

  // --- 1. RESIZE LOGIC: TRULY FILL THE RIGHT SIDE ---
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };

    // Initial set
    updateDimensions();

    // Listen for window resize
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // --- TYPING EFFECT ---
  const typeMessage = (fullText) => {
    let currentText = "";
    const words = fullText.split(" ");
    let i = 0;
    setMessages(prev => [...prev, { sender: 'architect', text: "", isTyping: true }]);
    const interval = setInterval(() => {
      if (i < words.length) {
        currentText += (i === 0 ? "" : " ") + words[i];
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1].text = currentText;
          return updated;
        });
        i++;
      } else {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1].isTyping = false;
          return updated;
        });
        clearInterval(interval);
      }
    }, 30);
  };

  // --- BACKEND INTEGRATION ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    try {
      await axios.post(`${API_BASE}/api/clear`);
      setGraphData({ nodes: [], links: [] });
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`${API_BASE}/api/upload`, formData);
      setIsUploading(false);
      setIsProcessing(true);
      const ws = new WebSocket(`${WS_BASE}/api/ws/extract/${res.data.doc_id}`);
      ws.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.type === 'node') {
          setGraphData(prev => ({ ...prev, nodes: [...prev.nodes, payload.data] }));
        } else if (payload.type === 'edge') {
          setGraphData(prev => ({ ...prev, links: [...prev.links, payload.data] }));
        } else if (payload.type === 'done') {
          setIsProcessing(false);
          setUploadStatus(payload);
          ws.close();
          setTimeout(() => graphRef.current?.zoomToFit(1000, 100), 500);
        }
      };
    } catch (e) {
      setIsUploading(false);
      setIsProcessing(false);
    }
  };

  const sendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;
    const query = chatInput;
    setMessages(prev => [...prev, { sender: 'user', text: query }]);
    setChatInput('');
    setIsChatLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/chat`, { message: query });
      setIsChatLoading(false);
      typeMessage(res.data.reply);
    } catch (e) {
      setIsChatLoading(false);
      setMessages(prev => [...prev, { sender: 'architect', text: 'Bridge error.' }]);
    }
  };

  return (
    <div className="h-screen w-screen bg-[#05080f] text-slate-300 font-sans flex flex-col overflow-hidden">
      
      {/* HEADER */}
      <header className="h-14 border-b border-white/5 bg-[#080c14]/80 backdrop-blur-xl px-8 flex items-center justify-between z-50">
        <h1 className="text-lg font-black tracking-tighter text-[#00e5ff] uppercase italic">THE NEURAL ARCHITECT</h1>
        <div className="flex items-center gap-5 text-slate-500">
          <Search size={16} /> <Bell size={18} /> <User size={18} />
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        
        {/* LEFT SIDEBAR (FIXED WIDTH) */}
        <aside className="w-[400px] flex-shrink-0 bg-[#080c14] border-r border-white/5 p-5 flex flex-col gap-5 z-20">
          <div className="relative border border-dashed border-[#00e5ff]/30 rounded-xl p-8 flex flex-col items-center justify-center bg-[#0a101e]/50 hover:bg-[#00e5ff]/5 transition-all">
            <input type="file" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
            <div className="w-10 h-10 bg-[#00e5ff]/10 rounded flex items-center justify-center mb-3 text-[#00e5ff]">
              {isUploading ? <Loader2 className="animate-spin" /> : <Upload size={20} />}
            </div>
            <h3 className="text-sm font-bold">Upload manifest</h3>
          </div>

          <div className="flex-1 flex flex-col bg-[#05080f] rounded-xl border border-white/5 overflow-hidden">
            <div ref={chatScrollRef} className="flex-1 p-4 space-y-4 overflow-y-auto text-[11px]">
              {messages.map((m, i) => (
                <div key={i} className={`p-3 rounded-lg ${m.sender === 'user' ? 'ml-auto bg-[#151c2e] w-[90%]' : 'bg-[#00e5ff]/5 border border-[#00e5ff]/20 text-[#00e5ff] w-[90%]'}`}>
                  {m.text}{m.isTyping && <span className="animate-pulse">|</span>}
                </div>
              ))}
            </div>
            <form onSubmit={sendChatMessage} className="p-3 bg-black/20">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Query matrix..." className="w-full bg-[#151c2e] border border-white/10 rounded-lg py-2 px-4 text-xs outline-none focus:border-[#00e5ff]/40" />
            </form>
          </div>
        </aside>

        {/* RIGHT SIDE (DYNAMNIC GRAPH) */}
        <section 
          ref={containerRef} 
          className="flex-1 relative bg-[#05080f] overflow-hidden"
        >
          {/* Status HUD */}
          <div className="absolute top-6 left-6 z-10 flex items-center gap-2 bg-black/40 backdrop-blur px-3 py-1.5 rounded-full border border-white/10">
            <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-400'}`}></div>
            <span className="text-[9px] font-black uppercase tracking-widest">{isProcessing ? 'Mapping...' : 'Ready'}</span>
          </div>

          {/* THE GRAPH: Using dynamic dimensions */}
          <ForceGraph3D
            ref={graphRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="rgba(0,0,0,0)"
            
            // Nodes
            nodeColor={n => TYPE_COLORS[n.type] || TYPE_COLORS.Default}
            nodeRelSize={7}
            
            // Edges (Thickened for readability as requested)
            linkWidth={3.5}
            linkColor={() => 'rgba(255, 255, 255, 0.12)'}
            linkDirectionalParticles={4}
            linkDirectionalParticleWidth={2.5}
            linkDirectionalParticleSpeed={0.006}
            linkDirectionalArrowLength={6}
            linkDirectionalArrowRelPos={1}
            
            showNavInfo={false}
          />

          

          {/* LEGEND */}
          <div className="absolute bottom-6 left-6 z-10 bg-black/40 backdrop-blur p-4 rounded-xl border border-white/10">
             {Object.entries(TYPE_COLORS).filter(([k]) => k !== 'Default').map(([type, color]) => (
               <div key={type} className="flex items-center gap-3 mb-2 last:mb-0">
                 <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div>
                 <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{type}</span>
               </div>
             ))}
          </div>
        </section>
      </main>
    </div>
  );
}