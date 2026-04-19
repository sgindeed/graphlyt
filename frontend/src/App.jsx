import React, { useState, useEffect, useRef, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import axios from 'axios';
import { Loader, Paper, Stack, Text, Group } from '@mantine/core';
import {
  Upload, Search, Bell, User, Loader2
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
const WS_BASE = import.meta.env.VITE_WS_BASE || 'ws://localhost:8000';

const TYPE_COLORS = {
  Person: '#ef4444', Organization: '#facc15',
  Location: '#10b981', Concept: '#60a5fa',
  Event: '#a78bfa', Default: '#64748b'
};

const EDGE_COLORS = {
  default: 'rgba(34, 211, 238, 0.58)',
  highlighted: 'rgba(56, 189, 248, 0.95)',
  dimmed: 'rgba(34, 211, 238, 0.16)'
};

export default function NeuralArchitect() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] }); 
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadPhase, setUploadPhase] = useState('idle');
  const [showNodeLabels, setShowNodeLabels] = useState(true);
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [isAnimationPaused, setIsAnimationPaused] = useState(false);
  const [nodeSearch, setNodeSearch] = useState('');

  // --- DYNAMIC DIMENSIONS STATE ---
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const [messages, setMessages] = useState([
    { sender: 'architect', text: 'Chat mode standby.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);

  const graphRef = useRef();
  const containerRef = useRef(); // Ref for the right-side section
  const chatScrollRef = useRef();
  const uploadTimersRef = useRef([]);

  const getNodeId = (node) => (typeof node === 'object' ? node?.id : node);
  const getNodeLabel = (node) => node?.label || node?.name || node?.title || node?.id || '';
  const getEdgeLabel = (link) => link?.label || link?.relation || link?.type || '';

  const createTextSprite = (text, { fontSize = 36, color = '#d8f9ff', scale = 16 } = {}) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return null;

    context.font = `700 ${fontSize}px Arial`;
    const textWidth = Math.ceil(context.measureText(text).width);
    const paddingX = 20;
    const paddingY = 12;

    canvas.width = textWidth + paddingX * 2;
    canvas.height = fontSize + paddingY * 2;

    context.font = `700 ${fontSize}px Arial`;
    context.fillStyle = color;
    context.textBaseline = 'middle';
    context.fillText(text, paddingX, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      opacity: 0.92
    });

    const sprite = new THREE.Sprite(material);
    const aspectRatio = canvas.width / canvas.height;
    sprite.scale.set(scale * aspectRatio, scale, 1);
    return sprite;
  };

  const nodeLabelObject = (node) => {
    if (!showNodeLabels) return null;
    const label = getNodeLabel(node);
    if (!label) return null;
    const sprite = createTextSprite(String(label), { fontSize: 32, color: '#e2ecff', scale: 10 });
    if (!sprite) return null;
    sprite.position.set(0, 10, 0);
    return sprite;
  };

  const edgeLabelObject = (link) => {
    if (!showEdgeLabels) return null;
    const label = getEdgeLabel(link);
    if (!label) return null;
    return createTextSprite(String(label), { fontSize: 28, color: '#bfdbfe', scale: 8 });
  };

  const positionEdgeLabel = (labelSprite, { start, end }) => {
    const middlePos = {
      x: start.x + (end.x - start.x) * 0.5,
      y: start.y + (end.y - start.y) * 0.5,
      z: start.z + (end.z - start.z) * 0.5
    };
    labelSprite.position.set(middlePos.x, middlePos.y + 2.8, middlePos.z);
  };

  const searchMatchedNodeIds = useMemo(() => {
    const q = nodeSearch.trim().toLowerCase();
    if (!q) return null;

    const matchedIds = new Set();
    graphData.nodes.forEach((node) => {
      const label = String(getNodeLabel(node)).toLowerCase();
      if (label.includes(q)) {
        matchedIds.add(getNodeId(node));
      }
    });

    return matchedIds;
  }, [graphData.nodes, nodeSearch]);

  const selectedNodeDegree = useMemo(() => {
    if (!selectedNode) return 0;
    const selectedId = getNodeId(selectedNode);
    return graphData.links.reduce((count, link) => {
      const sourceId = getNodeId(link.source);
      const targetId = getNodeId(link.target);
      return sourceId === selectedId || targetId === selectedId ? count + 1 : count;
    }, 0);
  }, [graphData.links, selectedNode]);

  const nodeTypeSummary = useMemo(() => {
    const counts = {};
    graphData.nodes.forEach((node) => {
      const t = node.type || 'Default';
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [graphData.nodes]);

  const { highlightedNodeIds, highlightedLinks } = useMemo(() => {
    const nodeIds = new Set();
    const links = new Set();

    if (!selectedNode) {
      return { highlightedNodeIds: nodeIds, highlightedLinks: links };
    }

    const selectedId = getNodeId(selectedNode);
    nodeIds.add(selectedId);

    graphData.links.forEach((link) => {
      const sourceId = getNodeId(link.source);
      const targetId = getNodeId(link.target);
      if (sourceId === selectedId || targetId === selectedId) {
        links.add(link);
        nodeIds.add(sourceId);
        nodeIds.add(targetId);
      }
    });

    return { highlightedNodeIds: nodeIds, highlightedLinks: links };
  }, [graphData.links, selectedNode]);

  const selectedNodeProperties = useMemo(() => {
    if (!selectedNode) return [];

    const hiddenKeys = new Set([
      'x', 'y', 'z', 'vx', 'vy', 'vz', 'index',
      '__threeObj', '__lineObj', '__indexColor', '__photonsObj'
    ]);

    return Object.entries(selectedNode).filter(([key, value]) => {
      if (hiddenKeys.has(key)) return false;
      if (typeof value === 'function') return false;
      if (value === undefined || value === null || value === '') return false;
      return true;
    });
  }, [selectedNode]);

  const clearUploadTimers = () => {
    uploadTimersRef.current.forEach((timerId) => clearTimeout(timerId));
    uploadTimersRef.current = [];
  };

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

  useEffect(() => {
    return () => {
      clearUploadTimers();
    };
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

    clearUploadTimers();
    setIsUploading(true);
    setUploadPhase('uploading');

    try {
      await axios.post(`${API_BASE}/api/clear`);
      setGraphData({ nodes: [], links: [] });
      setSelectedNode(null);
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`${API_BASE}/api/upload`, formData);

      setIsUploading(false);
      setUploadPhase('fetching');

      uploadTimersRef.current.push(
        setTimeout(() => setUploadPhase('streaming'), 2000)
      );

      setIsProcessing(true);
      const ws = new WebSocket(`${WS_BASE}/api/ws/extract/${res.data.doc_id}`);
      ws.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.type === 'node') {
          setGraphData(prev => ({ ...prev, nodes: [...prev.nodes, payload.data] }));
        } else if (payload.type === 'edge') {
          setGraphData(prev => ({ ...prev, links: [...prev.links, payload.data] }));
        } else if (payload.type === 'done') {
          clearUploadTimers();
          setIsProcessing(false);
          setUploadPhase('ready');
          ws.close();
          setTimeout(() => graphRef.current?.zoomToFit(1000, 100), 500);
        }
      };
    } catch {
      clearUploadTimers();
      setIsUploading(false);
      setIsProcessing(false);
      setUploadPhase('error');
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
    } catch {
      setIsChatLoading(false);
      setMessages(prev => [...prev, { sender: 'architect', text: 'Bridge error.' }]);
    }
  };

  const handleFitGraph = () => {
    graphRef.current?.zoomToFit(800, 120);
  };

  const handleToggleAnimation = () => {
    if (!graphRef.current) return;
    if (isAnimationPaused) {
      graphRef.current.resumeAnimation();
    } else {
      graphRef.current.pauseAnimation();
    }
    setIsAnimationPaused(prev => !prev);
  };

  const handleFocusFirstSearchMatch = () => {
    const q = nodeSearch.trim().toLowerCase();
    if (!q || !graphRef.current) return;
    const targetNode = graphData.nodes.find((node) => String(getNodeLabel(node)).toLowerCase().includes(q));
    if (!targetNode) return;

    const nodeX = targetNode.x || 0;
    const nodeY = targetNode.y || 0;
    const nodeZ = targetNode.z || 0;
    graphRef.current.centerAt(nodeX, nodeY, 800);
    graphRef.current.cameraPosition({ x: nodeX, y: nodeY, z: nodeZ + 130 }, targetNode, 900);
  };

  return (
    <div className="h-screen w-screen bg-[#0b1020] text-slate-300 font-sans flex flex-col overflow-hidden">

      {/* HEADER */}
      <header className="h-14 border-b border-white/5 bg-[#080c14]/80 backdrop-blur-xl px-8 flex items-center justify-between z-50">
        <h1 className="text-lg font-black tracking-tighter text-blue-300 uppercase italic">GRAPHLYT</h1>
        <div className="flex items-center gap-5 text-slate-500">
          <Search size={16} /> <Bell size={18} /> <User size={18} />
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">

        {/* LEFT SIDEBAR (FIXED WIDTH) */}
        <aside className="w-[400px] flex-shrink-0 bg-[#080c14] border-r border-white/5 p-5 flex flex-col gap-5 z-20">
          <div className="relative border border-dashed border-blue-400/30 rounded-xl p-8 flex flex-col items-center justify-center bg-[#0f172a]/60 hover:bg-blue-400/8 transition-all">
            <input type="file" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
            <div className="w-10 h-10 bg-blue-400/10 rounded flex items-center justify-center mb-3 text-blue-300">
              {isUploading ? <Loader2 className="animate-spin" /> : <Upload size={20} />}
            </div>
            <h3 className="text-sm font-bold">Upload manifest</h3>
          </div>

          <div className="flex-1 flex flex-col bg-[#0b1020] rounded-xl border border-white/5 overflow-hidden">
            <div ref={chatScrollRef} className="flex-1 p-4 space-y-4 overflow-y-auto text-[11px]">
              {messages.map((m, i) => (
                <div key={i} className={`p-3 rounded-lg ${m.sender === 'user' ? 'ml-auto bg-[#1e293b] w-[90%]' : 'bg-blue-500/10 border border-blue-400/25 text-blue-200 w-[90%]'}`}>
                  {m.text}{m.isTyping && <span className="animate-pulse">|</span>}
                </div>
              ))}
            </div>
            <form onSubmit={sendChatMessage} className="p-3 bg-black/20">
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Ask your question..." className="w-full bg-[#1e293b] border border-white/10 rounded-lg py-2 px-4 text-xs outline-none focus:border-blue-400/50" />
            </form>
          </div>
        </aside>

        {/* RIGHT SIDE (DYNAMNIC GRAPH) */}
        <section
          ref={containerRef}
          className="flex-1 relative bg-[#0b1020] overflow-hidden"
        >
          {/* Status HUD */}
          <div className="absolute top-6 left-6 z-10 pointer-events-none flex items-center gap-2 bg-black/40 backdrop-blur px-3 py-1.5 rounded-full border border-white/10">
            <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-yellow-400 animate-pulse' : 'bg-emerald-400'}`}></div>
            <span className="text-[9px] font-black uppercase tracking-widest">{isProcessing ? 'Mapping...' : 'Ready'}</span>
          </div>

          {(uploadPhase === 'streaming' || uploadPhase === 'ready') && (
          <div className="absolute top-6 left-52 z-10 pointer-events-none flex items-center gap-2 flex-wrap max-w-[70%]">
            <button
              type="button"
              onClick={() => setShowNodeLabels((prev) => !prev)}
              className={`pointer-events-auto px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-full border transition-colors duration-200 ${showNodeLabels ? 'bg-blue-400/20 text-blue-100 border-blue-300/40' : 'bg-slate-700/30 text-slate-400 border-slate-500/30'}`}
            >
              Node Labels: {showNodeLabels ? 'ON' : 'OFF'}
            </button>
            <button
              type="button"
              onClick={() => setShowEdgeLabels((prev) => !prev)}
              className={`pointer-events-auto px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-full border transition-colors duration-200 ${showEdgeLabels ? 'bg-blue-400/20 text-blue-100 border-blue-300/40' : 'bg-slate-700/30 text-slate-400 border-slate-500/30'}`}
            >
              Edge Labels: {showEdgeLabels ? 'ON' : 'OFF'}
            </button>
            <button
              type="button"
              onClick={handleToggleAnimation}
              className={`pointer-events-auto px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-full border transition-colors duration-200 ${isAnimationPaused ? 'bg-amber-300/20 text-amber-100 border-amber-300/50' : 'bg-emerald-300/20 text-emerald-100 border-emerald-300/40'}`}
            >
              Physics: {isAnimationPaused ? 'PAUSED' : 'RUNNING'}
            </button>
            <button
              type="button"
              onClick={handleFitGraph}
              className="pointer-events-auto px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-full border transition-colors duration-200 bg-slate-800/60 text-slate-200 border-slate-400/30 hover:bg-slate-700/60"
            >
              Fit View
            </button>
            <button
              type="button"
              onClick={() => setSelectedNode(null)}
              className="pointer-events-auto px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-full border transition-colors duration-200 bg-slate-800/60 text-slate-200 border-slate-400/30 hover:bg-slate-700/60"
            >
              Clear Focus
            </button>
            <div className="pointer-events-auto flex items-center gap-2 bg-black/40 border border-white/10 rounded-full px-2 py-1">
              <input
                value={nodeSearch}
                onChange={(e) => setNodeSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleFocusFirstSearchMatch();
                }}
                placeholder="Search node..."
                className="w-36 bg-transparent text-[10px] uppercase tracking-wider text-slate-200 placeholder:text-slate-500 outline-none"
              />
              <button
                type="button"
                onClick={handleFocusFirstSearchMatch}
                className="px-2 py-1 text-[9px] uppercase font-black rounded-full bg-blue-400/20 text-blue-100 border border-blue-300/30"
              >
                Focus
              </button>
            </div>
          </div>
          )}

          {(uploadPhase === 'streaming' || uploadPhase === 'ready') ? (
          <>
          {/* THE GRAPH: Using dynamic dimensions */}
          <ForceGraph3D
            ref={graphRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="rgba(0,0,0,0)"
            enableNavigationControls={true}
            enableNodeDrag={true}
            enablePointerInteraction={true}
            onNodeClick={(node) => setSelectedNode(node)}
            onBackgroundClick={() => setSelectedNode(null)}
            nodeLabel={() => ''}
            linkLabel={() => ''}
            nodeThreeObject={nodeLabelObject}
            nodeThreeObjectExtend={true}
            linkThreeObject={edgeLabelObject}
            linkPositionUpdate={positionEdgeLabel}

            // Nodes
            nodeColor={(n) => {
              const baseColor = TYPE_COLORS[n.type] || TYPE_COLORS.Default;
              if (searchMatchedNodeIds && !searchMatchedNodeIds.has(getNodeId(n))) {
                return selectedNode ? 'rgba(71, 85, 105, 0.12)' : 'rgba(71, 85, 105, 0.22)';
              }
              if (!selectedNode) return baseColor;
              return highlightedNodeIds.has(getNodeId(n)) ? baseColor : 'rgba(71, 85, 105, 0.18)';
            }}
            nodeRelSize={7}

            // Edges (Thickened for readability as requested)
            linkWidth={(l) => {
              if (searchMatchedNodeIds) {
                const sourceId = getNodeId(l.source);
                const targetId = getNodeId(l.target);
                const isSearchEdge = searchMatchedNodeIds.has(sourceId) || searchMatchedNodeIds.has(targetId);
                if (!isSearchEdge) return 1.8;
              }
              if (!selectedNode) return 5.2;
              return highlightedLinks.has(l) ? 6.8 : 2.8;
            }}
            linkColor={(l) => {
              if (searchMatchedNodeIds) {
                const sourceId = getNodeId(l.source);
                const targetId = getNodeId(l.target);
                const isSearchEdge = searchMatchedNodeIds.has(sourceId) || searchMatchedNodeIds.has(targetId);
                if (!isSearchEdge) return EDGE_COLORS.dimmed;
              }
              if (!selectedNode) return EDGE_COLORS.default;
              return highlightedLinks.has(l) ? EDGE_COLORS.highlighted : EDGE_COLORS.dimmed;
            }}
            linkDirectionalParticles={(l) => {
              if (searchMatchedNodeIds) {
                const sourceId = getNodeId(l.source);
                const targetId = getNodeId(l.target);
                const isSearchEdge = searchMatchedNodeIds.has(sourceId) || searchMatchedNodeIds.has(targetId);
                if (!isSearchEdge) return 0;
              }
              if (!selectedNode) return 4;
              return highlightedLinks.has(l) ? 6 : 0;
            }}
            linkDirectionalParticleWidth={(l) => (selectedNode && highlightedLinks.has(l) ? 3.6 : 2)}
            linkDirectionalParticleColor={() => '#ffffff'}
            linkDirectionalParticleSpeed={0.0065}
            linkDirectionalArrowLength={6}
            linkDirectionalArrowRelPos={1}

            showNavInfo={false}
          />


          {selectedNode && (
            <div className="absolute top-6 right-6 z-10 pointer-events-auto w-[320px] max-h-[70%] overflow-y-auto bg-black/50 backdrop-blur p-4 rounded-xl border border-blue-400/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-black uppercase tracking-wider text-blue-300">Node Properties</h3>
                <button
                  type="button"
                  onClick={() => setSelectedNode(null)}
                  className="text-[10px] text-slate-400 hover:text-white transition"
                >
                  Clear
                </button>
              </div>

              <div className="text-[11px] text-slate-300 space-y-2">
                <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
                  <span className="uppercase tracking-wide text-slate-500">degree</span>
                  <span className="text-blue-100 font-bold">{selectedNodeDegree}</span>
                </div>
                {selectedNodeProperties.map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between gap-3 border-b border-white/5 pb-1">
                    <span className="uppercase tracking-wide text-slate-500">{key}</span>
                    <span className="text-right break-all text-blue-100">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </span>
                  </div>
                ))}
                {selectedNodeProperties.length === 0 && (
                  <div className="text-slate-400">No visible properties found for this node.</div>
                )}
              </div>
            </div>
          )}

          <div className="absolute right-6 bottom-6 z-10 pointer-events-none w-[260px] bg-black/45 backdrop-blur p-4 rounded-xl border border-white/10 text-[10px] uppercase tracking-wider text-slate-300 space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-blue-500/10 border border-blue-300/20 rounded-lg p-2 text-center">
                <div className="text-slate-500">Nodes</div>
                <div className="text-blue-200 text-sm font-black">{graphData.nodes.length}</div>
              </div>
              <div className="bg-teal-500/10 border border-teal-300/20 rounded-lg p-2 text-center">
                <div className="text-slate-500">Edges</div>
                <div className="text-teal-200 text-sm font-black">{graphData.links.length}</div>
              </div>
              <div className="bg-amber-500/10 border border-amber-300/20 rounded-lg p-2 text-center">
                <div className="text-slate-500">Match</div>
                <div className="text-amber-200 text-sm font-black">{searchMatchedNodeIds ? searchMatchedNodeIds.size : graphData.nodes.length}</div>
              </div>
            </div>

            <div>
              <div className="text-slate-500 mb-1">Top Types</div>
              <div className="space-y-1">
                {nodeTypeSummary.length === 0 && <div className="text-slate-500">No data</div>}
                {nodeTypeSummary.map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-slate-300">{type}</span>
                    <span className="text-blue-100 font-bold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>



          {/* LEGEND */}
          <div className="absolute bottom-6 left-6 z-10 pointer-events-none bg-black/40 backdrop-blur p-4 rounded-xl border border-white/10">
            {Object.entries(TYPE_COLORS).filter(([k]) => k !== 'Default').map(([type, color]) => (
              <div key={type} className="flex items-center gap-3 mb-2 last:mb-0">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{type}</span>
              </div>
            ))}
          </div>
          </>
          ) : (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
            <Paper
              radius="xl"
              p="xl"
              withBorder
              className="w-full max-w-[520px] bg-[#0a101e]/85 border-white/10"
            >
              <Stack align="center" gap="lg">
                {(uploadPhase === 'uploading' || uploadPhase === 'fetching') && (
                  <Group gap="sm" align="center">
                    <Loader color="blue" type="dots" />
                    <Text c="blue.2" fw={600} fz="sm" tt="lowercase">
                      {uploadPhase === 'uploading' && 'preparing upload'}
                      {uploadPhase === 'fetching' && 'fetching nodes'}
                    </Text>
                  </Group>
                )}

                {uploadPhase === 'idle' && (
                  <Text c="gray.4" fw={600} fz="sm">Upload a document to start graph generation.</Text>
                )}

                {uploadPhase === 'error' && (
                  <Text c="red.3" fw={700} fz="sm">Upload failed. Please try again.</Text>
                )}
              </Stack>
            </Paper>
          </div>
          )}
        </section>
      </main>

      <footer className="h-10 border-t border-white/5 bg-[#080c14]/80 backdrop-blur-xl px-6 flex items-center justify-center text-xs text-slate-400">
        <p>
          Made with ❤️ and ⚡ by{' '}
          <a
            href="https://github.com/sgindeed"
            target="_blank"
            rel="noreferrer"
            className="text-blue-300 hover:text-blue-200 underline underline-offset-2"
          >
            Supratim
          </a>
        </p>
      </footer>
    </div>
  );
}
