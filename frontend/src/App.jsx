import React, { useState, useEffect, useRef, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import axios from 'axios';
import { 
  Loader, Paper, Stack, Text, Group, ActionIcon, 
  Tooltip, Badge, Card, ScrollArea, TextInput, 
  Divider, Transition, Box, Title
} from '@mantine/core';
import {
  Upload, Search, Bell, User, Loader2, Database, 
  Quote, PanelRightClose, PanelLeftClose, PanelLeft, PanelRight, Minimize2, Maximize2, Layers,
  Send, Activity, Eye, EyeOff, Maximize, Hexagon, Sparkles, Crosshair,
  ChevronDown, ChevronUp, GitCompareArrows, Target, FileText
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
const WS_BASE = import.meta.env.VITE_WS_BASE || 'ws://localhost:8000';

const TYPE_COLORS = {
  Person: '#8b5cf6',       
  Organization: '#3b82f6', 
  Location: '#10b981',     
  Concept: '#f59e0b',      
  Event: '#ec4899',        
  Technology: '#6366f1',   
  Default: '#94a3b8'       
};

const EDGE_COLORS = {
  default: 'rgba(139, 92, 246, 0.25)',     
  highlighted: 'rgba(139, 92, 246, 0.9)', 
  dimmed: 'rgba(255, 255, 255, 0.05)'
};

const LOADING_STAGES = [
  'Querying vector matrices...',
  'Reranking top candidates...',
  'Synthesizing response...'
];

const PROVENANCE_TABS = {
  nodes: { label: 'Used Nodes', color: '#8b5cf6', mantineColor: 'violet', icon: Layers },
  reranked: { label: 'Reranked', color: '#3b82f6', mantineColor: 'blue', icon: Target },
  retrieved: { label: 'Vector Matches', color: '#6366f1', mantineColor: 'indigo', icon: GitCompareArrows }
};

// --- BFS HELPER: Identify the largest connected cluster to prevent the camera from zooming out for outliers ---
const getLargestComponentIds = (nodes, links) => {
  if (!nodes || nodes.length === 0) return new Set();
  
  const adj = new Map();
  nodes.forEach(n => adj.set(n.id || n, []));
  
  links.forEach(l => {
    const s = typeof l.source === 'object' ? l.source.id : l.source;
    const t = typeof l.target === 'object' ? l.target.id : l.target;
    if (adj.has(s)) adj.get(s).push(t);
    if (adj.has(t)) adj.get(t).push(s);
  });
  
  const visited = new Set();
  let largest = new Set();
  
  for (const node of nodes) {
    const id = node.id || node;
    if (!visited.has(id)) {
      const comp = new Set();
      const q = [id];
      visited.add(id);
      
      while (q.length > 0) {
        const curr = q.shift();
        comp.add(curr);
        (adj.get(curr) || []).forEach(neighbor => {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            q.push(neighbor);
          }
        });
      }
      if (comp.size > largest.size) largest = comp;
    }
  }
  return largest;
};

function renderFormattedResponse(text) {
  if (!text) return null;
  const blocks = text.split('\n');
  return blocks.map((block, bIdx) => {
    if (!block.trim()) return null;
    
    const parts = block.split(/\*\*([\s\S]*?)\*\*/g);
    return (
      <Text key={bIdx} size="sm" lh={1.6} fw={400} c="#f8fafc" mb="sm" style={{ display: 'block' }}>
        {parts.map((part, pIdx) => {
          if (pIdx % 2 === 1) {
            return (
              <Text component="span" key={pIdx} fw={700} c="#c084fc" style={{ letterSpacing: '0.2px' }}>
                {part}
              </Text>
            );
          }
          return part;
        })}
      </Text>
    );
  });
}

function ProvenancePanel({ sources = [], retrieved = [], nodes = [], isActiveHighlight, onToggleHighlight, onLocateNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('nodes');

  if (sources.length === 0 && retrieved.length === 0 && nodes.length === 0) return null;

  const tab = PROVENANCE_TABS[activeTab];

  return (
    <Stack gap="xs" mt="md" w="95%">
      <Group justify="space-between" w="100%">
        <Group
          gap={6}
          onClick={() => setIsOpen(o => !o)}
          style={{ cursor: 'pointer', width: 'fit-content', padding: '2px 4px' }}
        >
          <Quote size={12} color="#8b5cf6" />
          <Text size="xs" c="rgba(255,255,255,0.6)" tt="uppercase" fw={700} lts={1}>
            Data Provenance · {nodes.length + sources.length}
          </Text>
          {isOpen ? <ChevronUp size={12} color="rgba(255,255,255,0.4)" /> : <ChevronDown size={12} color="rgba(255,255,255,0.4)" />}
        </Group>

        <button
          onClick={onToggleHighlight}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
            cursor: 'pointer',
            border: isActiveHighlight ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid rgba(255,255,255,0.1)',
            background: isActiveHighlight ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.02)',
            color: isActiveHighlight ? '#c084fc' : 'rgba(255,255,255,0.5)',
            transition: 'all 0.2s ease',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}
        >
          {isActiveHighlight ? <Eye size={13} /> : <EyeOff size={13} />}
          Highlight in graph
        </button>
      </Group>

      <Transition mounted={isOpen} transition="scale-y" duration={250} timingFunction="cubic-bezier(0.16, 1, 0.3, 1)">
        {(styles) => (
          <Stack gap="sm" style={{ ...styles, transformOrigin: 'top' }}>
            <Group gap={6}>
              {Object.entries(PROVENANCE_TABS).map(([key, cfg]) => {
                let count = 0;
                if (key === 'nodes') count = nodes.length;
                else if (key === 'reranked') count = sources.length;
                else if (key === 'retrieved') count = retrieved.length;
                
                const active = activeTab === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 10px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                      letterSpacing: 0.5, textTransform: 'uppercase', cursor: 'pointer',
                      border: active ? `1px solid ${cfg.color}` : '1px solid rgba(255,255,255,0.06)',
                      background: active ? `${cfg.color}1c` : 'rgba(255,255,255,0.01)',
                      color: active ? cfg.color : 'rgba(255,255,255,0.4)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <cfg.icon size={11} />
                    {cfg.label} · {count}
                  </button>
                );
              })}
            </Group>

            {activeTab === 'nodes' && (
              <Stack gap={6}>
                {nodes.length === 0 ? (
                  <Text size="xs" c="rgba(255,255,255,0.3)" fs="italic">No linked entities found in source matrix.</Text>
                ) : (
                  nodes.map((node, idx) => {
                    const nodeColor = TYPE_COLORS[node.type] || TYPE_COLORS.Default;
                    return (
                      <Paper key={idx} p="xs" radius="sm" bg="rgba(20,20,25,0.6)" style={{ border: '1px solid rgba(255,255,255,0.04)' }}>
                        <Group justify="space-between" wrap="nowrap">
                          <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                            <Box w={6} h={6} style={{ borderRadius: '50%', backgroundColor: nodeColor, flexShrink: 0 }} />
                            <Text size="xs" fw={600} c="#f1f5f9" truncate title={node.name}>
                              {node.name}
                            </Text>
                            <Badge size="xs" color="gray" variant="light" style={{ textTransform: 'none', flexShrink: 0 }}>
                              {node.type}
                            </Badge>
                          </Group>
                          <Tooltip label="Locate and center on graph" position="left" withArrow>
                            <ActionIcon size="sm" variant="subtle" color="violet" onClick={() => onLocateNode(node.id)}>
                              <Crosshair size={12} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Paper>
                    );
                  })
                )}
              </Stack>
            )}

            {activeTab === 'reranked' && (
              <Stack gap={6}>
                {sources.length === 0 ? (
                  <Text size="xs" c="rgba(255,255,255,0.3)" fs="italic">No prioritized text coordinates available.</Text>
                ) : (
                  sources.map((item, idx) => (
                    <Paper key={idx} p="md" radius="sm" bg="rgba(20,20,25,0.6)" style={{ border: '1px solid rgba(255,255,255,0.05)', borderLeft: `3px solid ${tab.color}` }}>
                      <Text size="xs" fw={700} c={tab.color} tt="uppercase" lts={0.5} mb={4}>
                        Rank #{idx + 1}
                      </Text>
                      <Text size="xs" c="rgba(255,255,255,0.65)" lh={1.5}>{typeof item === 'string' ? item : item.text}</Text>
                    </Paper>
                  ))
                )}
              </Stack>
            )}

            {activeTab === 'retrieved' && (
              <Stack gap={6}>
                {retrieved.length === 0 ? (
                  <Text size="xs" c="rgba(255,255,255,0.3)" fs="italic">No search context matches available.</Text>
                ) : (
                  retrieved.map((item, idx) => (
                    <Paper key={idx} p="md" radius="sm" bg="rgba(20,20,25,0.6)" style={{ border: '1px solid rgba(255,255,255,0.05)', borderLeft: `3px solid ${tab.color}` }}>
                      <Text size="xs" fw={700} c={tab.color} tt="uppercase" lts={0.5} mb={4}>
                        Match #{idx + 1}
                      </Text>
                      <Text size="xs" c="rgba(255,255,255,0.65)" lh={1.5}>{typeof item === 'string' ? item : item.text}</Text>
                    </Paper>
                  ))
                )}
              </Stack>
            )}
          </Stack>
        )}
      </Transition>
    </Stack>
  );
}

export default function NeuralArchitect() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] }); 
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadPhase, setUploadPhase] = useState('idle');
  const [streamPhase, setStreamPhase] = useState('idle'); 
  const [documentStats, setDocumentStats] = useState({ chunkCount: 0, fileCount: 0, files: [] });
  
  const [isUploadCollapsed, setIsUploadCollapsed] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [isGraphCollapsed, setIsGraphCollapsed] = useState(false);

  const [showNodeLabels, setShowNodeLabels] = useState(true);
  const [isAnimationPaused, setIsAnimationPaused] = useState(false);
  const [nodeSearch, setNodeSearch] = useState('');
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isChatFocused, setIsChatFocused] = useState(false);

  const [messages, setMessages] = useState([
    { sender: 'architect', text: 'Workspace Initialized. Synchronize your documents to construct the knowledge graph.', sources: [], retrieved: [], nodes: [] }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [selectedNode, setSelectedNode] = useState(null);
  const [activeHighlightIndex, setActiveHighlightIndex] = useState(null);

  const graphRef = useRef();
  const containerRef = useRef(); 
  const chatScrollRef = useRef();
  const uploadTimersRef = useRef([]);
  const fileInputRef = useRef();

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.d3Force('charge').strength(-1000); 
      graphRef.current.d3Force('link').distance(() => 50 + Math.random() * 150);    
      graphRef.current.d3Force('center').strength(0.04); 
    }
  }, [graphData]);

  useEffect(() => {
    if (!isChatLoading) { setLoadingStage(0); return; }
    setLoadingStage(0);
    const interval = setInterval(() => {
      setLoadingStage(s => (s + 1 < LOADING_STAGES.length ? s + 1 : s));
    }, 900);
    return () => clearInterval(interval);
  }, [isChatLoading]);

  const getNodeId = (node) => (typeof node === 'object' ? node?.id : node);
  const getNodeLabel = (node) => node?.label || node?.name || node?.title || node?.id || '';

  const entityCounts = useMemo(() => {
    const counts = { Total: graphData.nodes.length };
    Object.keys(TYPE_COLORS).forEach(k => counts[k] = 0);
    graphData.nodes.forEach(n => {
      const t = n.type || 'Default';
      if (counts[t] !== undefined) counts[t]++;
      else counts['Default']++;
    });
    return counts;
  }, [graphData.nodes]);

  const searchMatchedNodeIds = useMemo(() => {
    const q = nodeSearch.trim().toLowerCase();
    if (!q) return null;
    const matchedIds = new Set();
    graphData.nodes.forEach((node) => {
      if (String(getNodeLabel(node)).toLowerCase().includes(q)) matchedIds.add(getNodeId(node));
    });
    return matchedIds;
  }, [graphData.nodes, nodeSearch]);

  const highlightedProvenanceNodeIds = useMemo(() => {
    if (activeHighlightIndex === null) return null;
    const msg = messages[activeHighlightIndex];
    if (!msg || !msg.nodes || msg.nodes.length === 0) return null;

    const matchedIds = new Set();
    msg.nodes.forEach(n => matchedIds.add(n.id));
    return matchedIds;
  }, [activeHighlightIndex, messages]);

  const { highlightedNodeIds, highlightedLinks } = useMemo(() => {
    const nodeIds = new Set();
    const links = new Set();
    if (!selectedNode) return { highlightedNodeIds: nodeIds, highlightedLinks: links };
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

  const isNodeFaded = (nodeId) => {
    if (searchMatchedNodeIds && !searchMatchedNodeIds.has(nodeId)) return true;
    if (highlightedProvenanceNodeIds && !highlightedProvenanceNodeIds.has(nodeId)) return true;
    return false;
  };

  const nodeCanvasObject = (node, ctx, globalScale) => {
    const label = getNodeLabel(node);
    const baseColor = TYPE_COLORS[node.type] || TYPE_COLORS.Default;
    const nodeId = getNodeId(node);
    
    const isFaded = isNodeFaded(nodeId);
    const isSelected = selectedNode && getNodeId(selectedNode) === nodeId;
    const isHighlighted = selectedNode && highlightedNodeIds.has(nodeId);

    let opacity = 1.0;
    if (isFaded) opacity = 0.1;
    else if (selectedNode && !isHighlighted) opacity = 0.2;

    const nodeRadius = isSelected ? 8 : 5;

    if (opacity > 0.2) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, isSelected ? 16 : 9, 0, 2 * Math.PI, false);
      ctx.fillStyle = baseColor;
      ctx.globalAlpha = isSelected ? 0.3 : 0.15;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI, false);
    ctx.fillStyle = baseColor;
    ctx.globalAlpha = opacity;
    ctx.fill();

    if (showNodeLabels && opacity > 0.2) {
      const fontSize = isSelected ? 14 : 10;
      ctx.font = `600 ${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isSelected ? '#ffffff' : '#f8fafc';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(label, node.x, node.y + nodeRadius + (isSelected ? 10 : 8));
      ctx.shadowBlur = 0; 
    }
    
    ctx.globalAlpha = 1.0; 
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isUploadCollapsed, isChatCollapsed, isGraphCollapsed]); 

  const typeMessage = (fullText, sources = [], retrieved = [], nodes = []) => {
    let currentText = "";
    const words = fullText.split(" ");
    let i = 0;
    setMessages(prev => [...prev, { sender: 'architect', text: "", sources: [], retrieved: [], nodes: [], isTyping: true }]);
    
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
          updated[updated.length - 1].sources = sources;
          updated[updated.length - 1].retrieved = retrieved;
          updated[updated.length - 1].nodes = nodes;
          return updated;
        });
        clearInterval(interval);
      }
    }, 25);
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    uploadTimersRef.current.forEach(clearTimeout);
    setIsUploading(true);
    setUploadPhase('uploading');
    setStreamPhase('idle');
    setDocumentStats({ chunkCount: 0, fileCount: 0, files: [] });

    try {
      await axios.post(`${API_BASE}/api/clear`);
      setGraphData({ nodes: [], links: [] });
      setSelectedNode(null);
      setActiveHighlightIndex(null);
      
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      
      const res = await axios.post(`${API_BASE}/api/upload`, formData);

      setDocumentStats({
        chunkCount: res.data.chunk_count,
        fileCount: res.data.file_count,
        files: res.data.files || []
      });
      setIsUploading(false);
      setUploadPhase('fetching');
      uploadTimersRef.current.push(setTimeout(() => setUploadPhase('streaming'), 2000));
      setIsProcessing(true);
      
      const ws = new WebSocket(`${WS_BASE}/api/ws/extract/${res.data.doc_id}`);
      ws.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.type === 'node') {
          setStreamPhase('nodes');
          setGraphData(prev => ({ ...prev, nodes: [...prev.nodes, payload.data] }));
        } else if (payload.type === 'edge') {
          setStreamPhase('edges');
          setGraphData(prev => {
            const sourceId = typeof payload.data.source === 'object' ? payload.data.source.id : payload.data.source;
            const targetId = typeof payload.data.target === 'object' ? payload.data.target.id : payload.data.target;
            
            const nodeIds = new Set(prev.nodes.map(n => n.id));
            if (nodeIds.has(sourceId) && nodeIds.has(targetId)) {
               return { ...prev, links: [...prev.links, payload.data] };
            } else {
               return prev; 
            }
          });
          if (graphRef.current) graphRef.current.d3ReheatSimulation(0.3);
        } else if (payload.type === 'error') {
          alert(`Pipeline Error: ${payload.message}`);
        } else if (payload.type === 'done') {
          setIsProcessing(false);
          setStreamPhase('ready');
          setUploadPhase('ready');
          ws.close();
          setTimeout(() => {
            if (graphRef.current) {
              const currentData = graphRef.current.graphData();
              const mainClusterIds = getLargestComponentIds(currentData.nodes, currentData.links);
              const padding = Math.min(dimensions.width, dimensions.height) * 0.1;
              graphRef.current.zoomToFit(1200, padding, node => mainClusterIds.has(node.id));
            }
          }, 1200);
        }
      };
    } catch (err) {
      console.error(err);
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
      typeMessage(res.data.reply, res.data.sources, res.data.retrieved, res.data.nodes);
    } catch {
      setIsChatLoading(false);
      setMessages(prev => [...prev, { sender: 'architect', text: 'Error: Connection to backend services failed.' }]);
    }
  };

  const handleFocusFirstSearchMatch = () => {
    const q = nodeSearch.trim().toLowerCase();
    if (!q || !graphRef.current) return;
    const targetNode = graphData.nodes.find((node) => String(getNodeLabel(node)).toLowerCase().includes(q));
    if (!targetNode) return;
    graphRef.current.centerAt(targetNode.x, targetNode.y, 800);
    graphRef.current.zoom(3, 800);
  };

  const handleLocateProvenanceNode = (nodeId) => {
    if (!graphRef.current) return;
    const target = graphData.nodes.find(n => getNodeId(n) === nodeId);
    if (!target) return;
    setSelectedNode(target);
    graphRef.current.centerAt(target.x, target.y, 800);
    graphRef.current.zoom(3, 800);
  };

  const handleToggleHighlight = (index) => {
    setActiveHighlightIndex(prev => {
      const isActivating = prev !== index;
      if (isActivating && isGraphCollapsed) {
        setIsGraphCollapsed(false);
      }
      return isActivating ? index : null;
    });
  };

  return (
    <Box h="100vh" w="100vw" style={{ 
      display: 'flex', flexDirection: 'column', overflow: 'hidden', 
      background: 'radial-gradient(circle at 50% 0%, #2b2b36 0%, #1a1a24 60%, #12121a 100%)',
      fontFamily: "'Inter', sans-serif" 
    }}>
      {/* --- TOP NAVIGATION BAR --- */}
      <Box p="md" pb={0} style={{ zIndex: 100 }}>
        <Paper h={64} px="xl" radius="md" style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
          background: 'rgba(30, 30, 36, 0.7)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          boxShadow: '0 4px 20 rgba(0, 0, 0, 0.2)'
        }}>
          <Group gap="xl">
            <Group gap="sm">
              <Hexagon size={22} color="#8b5cf6" fill="rgba(139, 92, 246, 0.2)" />
              <Title order={4} fw={800} lts={2} style={{ color: '#e2e8f0' }}>
                GRAPHLYT
              </Title>
            </Group>
            {documentStats.chunkCount > 0 && (
              <Badge variant="light" color="violet" size="md" radius="sm" leftSection={<Database size={12} />}>
                {documentStats.fileCount} File{documentStats.fileCount > 1 ? 's' : ''} • {documentStats.chunkCount} Vectors
              </Badge>
            )}
          </Group>
          <Group gap="md">
            <ActionIcon variant="subtle" color="gray" size="lg"><Bell size={18} /></ActionIcon>
            <ActionIcon variant="subtle" color="gray" size="lg"><User size={18} /></ActionIcon>
          </Group>
        </Paper>
      </Box>

      {/* --- 3-COLUMN MAIN LAYOUT --- */}
      <Box style={{ display: 'flex', flexDirection: 'row', flex: 1, overflow: 'hidden', padding: '16px', gap: '16px' }}>
        
        {/* COLUMN 1: UPLOAD & INGESTION */}
        <Box style={{ 
          display: 'flex', flexDirection: 'column', gap: 8,
          width: isUploadCollapsed ? 48 : 280, flexShrink: 0,
          transition: 'all 0.4s cubic-bezier(0.2, 0, 0, 1)', 
          overflow: 'hidden'
        }}>
          <Group justify={isUploadCollapsed ? "center" : "space-between"} wrap="nowrap" h={32} px={isUploadCollapsed ? 0 : 4}>
            {!isUploadCollapsed && <Text size="xs" fw={700} c="rgba(255,255,255,0.5)" tt="uppercase" lts={1}>Upload</Text>}
            <Tooltip label={isUploadCollapsed ? "Expand Upload" : "Collapse Upload"} position="bottom" withArrow>
              <ActionIcon variant="subtle" color="gray" onClick={() => setIsUploadCollapsed(!isUploadCollapsed)} style={{ minWidth: 32 }}>
                {isUploadCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
              </ActionIcon>
            </Tooltip>
          </Group>

          <Paper radius="md" style={{ 
            flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
            width: 280, 
            opacity: isUploadCollapsed ? 0 : 1, pointerEvents: isUploadCollapsed ? 'none' : 'auto',
            background: 'rgba(30, 30, 36, 0.5)', backdropFilter: 'blur(12px)', 
            border: '1px solid rgba(255, 255, 255, 0.05)', transition: 'opacity 0.2s ease-in-out'
          }}>
            <Box p="xl" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <Group justify="space-between" align="center" mb="lg">
                <Text size="xs" fw={700} c="rgba(255,255,255,0.5)" tt="uppercase" lts={1}>Ingestion Array</Text>
                {documentStats.files.length > 0 && (
                  <Tooltip label="Sync Documents" withArrow>
                    <ActionIcon size="sm" radius="md" variant="light" color="violet" onClick={() => fileInputRef.current?.click()}>
                      {isUploading ? <Loader2 className="animate-spin" size={12} /> : <Upload size={12} />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>

              <input ref={fileInputRef} type="file" multiple onChange={handleFileUpload} style={{ display: 'none' }} />

              {documentStats.files.length === 0 ? (
                <Card
                  radius="md" bg="rgba(139, 92, 246, 0.03)" onClick={() => fileInputRef.current?.click()}
                  style={{ 
                    border: '1px dashed rgba(139, 92, 246, 0.3)', cursor: 'pointer', transition: 'all 0.2s',
                    '&:hover': { borderColor: '#8b5cf6', backgroundColor: 'rgba(139, 92, 246, 0.08)' } 
                  }} p="xl" className="group relative"
                >
                  <Stack align="center" gap="md">
                    <Box style={{ padding: '12px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)' }} className="group-hover:scale-105">
                      {isUploading ? <Loader2 className="animate-spin text-violet-400" size={24} /> : <Upload color="#8b5cf6" size={24} />}
                    </Box>
                    <Box ta="center">
                      <Text fw={600} size="sm" c="#e2e8f0">{isUploading ? 'Processing...' : 'Upload Documents'}</Text>
                      <Text size="xs" c="rgba(255,255,255,0.4)" mt={4}>PDF format supported</Text>
                    </Box>
                  </Stack>
                </Card>
              ) : (
                <ScrollArea mah={250} type="auto" offsetScrollbars>
                  <Stack gap={8}>
                    {documentStats.files.map((f, idx) => (
                      <Group key={idx} justify="space-between" wrap="nowrap" p={10} style={{ borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                          <FileText size={13} color="#8b5cf6" style={{ flexShrink: 0 }} />
                          <Text size="xs" c="rgba(255,255,255,0.8)" fw={500} truncate style={{ maxWidth: 140 }} title={f.filename}>
                            {f.filename}
                          </Text>
                        </Group>
                        <Badge size="xs" variant="light" color="violet" style={{ flexShrink: 0 }}>
                          {f.chunk_count}
                        </Badge>
                      </Group>
                    ))}
                  </Stack>
                </ScrollArea>
              )}

              <Divider my="xl" color="rgba(255,255,255,0.05)" />
              <Stack gap="lg" mt="auto">
                <Group justify="space-between" align="center">
                  <Group gap="xs"><Box w={8} h={8} style={{ borderRadius: '50%', background: '#6366f1' }}/><Text size="xs" c="rgba(255,255,255,0.5)" tt="uppercase" fw={600}>Total Nodes</Text></Group>
                  <Text size="md" c="#e2e8f0" fw={700}>{graphData.nodes.length}</Text>
                </Group>
                <Group justify="space-between" align="center">
                  <Group gap="xs"><Box w={8} h={8} style={{ borderRadius: '50%', background: '#8b5cf6' }}/><Text size="xs" c="rgba(255,255,255,0.5)" tt="uppercase" fw={600}>Neural Edges</Text></Group>
                  <Text size="md" c="#e2e8f0" fw={700}>{graphData.links.length}</Text>
                </Group>
              </Stack>
            </Box>
          </Paper>
        </Box>

        {/* COLUMN 2: CHAT INTERFACE */}
        <Box style={{ 
          display: 'flex', flexDirection: 'column', gap: 8,
          width: isChatCollapsed ? 48 : (isGraphCollapsed && !isUploadCollapsed ? 'auto' : 380),
          flex: (!isChatCollapsed && isGraphCollapsed) ? 1 : '0 0 auto',
          flexShrink: 0, overflow: 'hidden',
          transition: 'all 0.4s cubic-bezier(0.2, 0, 0, 1)'
        }}>
          <Group justify={isChatCollapsed ? "center" : "space-between"} wrap="nowrap" h={32} px={isChatCollapsed ? 0 : 4}>
            {!isChatCollapsed && <Text size="xs" fw={700} c="rgba(255,255,255,0.5)" tt="uppercase" lts={1}>Chat Stream</Text>}
            <Tooltip label={isChatCollapsed ? "Expand Chat" : "Collapse Chat"} position="bottom" withArrow>
              <ActionIcon variant="subtle" color="gray" onClick={() => setIsChatCollapsed(!isChatCollapsed)} style={{ minWidth: 32 }}>
                {isChatCollapsed ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
              </ActionIcon>
            </Tooltip>
          </Group>

          <Paper radius="md" style={{ 
            flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
            minWidth: 380, 
            opacity: isChatCollapsed ? 0 : 1, pointerEvents: isChatCollapsed ? 'none' : 'auto',
            background: 'rgba(30, 30, 36, 0.5)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.05)', transition: 'opacity 0.2s ease-in-out'
          }}>
            <ScrollArea flex={1} p="lg" viewportRef={chatScrollRef} styles={{ scrollbar: { '&:hover': { background: 'transparent' } } }}>
              <Stack gap="xl">
                {messages.map((m, i) => (
                  <Box key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                    <Paper p="md" bg={m.sender === 'user' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)'} 
                      style={{ 
                        maxWidth: '95%', 
                        border: m.sender === 'user' ? '1px solid rgba(139, 92, 246, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)', 
                        borderRadius: m.sender === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px'
                      }}>
                      {m.sender === 'user' ? (
                        <Text size="sm" lh={1.6} fw={400} c="#f8fafc">{m.text}</Text>
                      ) : (
                        renderFormattedResponse(m.text)
                      )}
                      {m.isTyping && <span className="animate-pulse ml-1" style={{ color: '#8b5cf6' }}>▍</span>}
                    </Paper>
                    {!m.isTyping && ((m.sources && m.sources.length > 0) || (m.retrieved && m.retrieved.length > 0) || (m.nodes && m.nodes.length > 0)) && (
                      <ProvenancePanel 
                        sources={m.sources} 
                        retrieved={m.retrieved} 
                        nodes={m.nodes}
                        isActiveHighlight={activeHighlightIndex === i}
                        onToggleHighlight={() => handleToggleHighlight(i)}
                        onLocateNode={handleLocateProvenanceNode}
                      />
                    )}
                  </Box>
                ))}

                {isChatLoading && (
                  <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <Paper p="md" bg="rgba(255, 255, 255, 0.02)" style={{ borderRadius: '12px 12px 12px 2px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <Group gap="sm">
                        <Loader color="violet" type="dots" size="xs" />
                        <Text size="xs" c="rgba(255,255,255,0.5)" tt="uppercase" fw={600}>
                          {LOADING_STAGES[loadingStage]}
                        </Text>
                      </Group>
                    </Paper>
                  </Box>
                )}
              </Stack>
            </ScrollArea>
            <Box p="md" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(20,20,25,0.4)' }}>
              <form onSubmit={sendChatMessage}>
                <Paper 
                  radius="md" 
                  p={4} 
                  bg="rgba(0,0,0,0.2)" 
                  style={{ 
                    border: isChatFocused ? '1px solid #8b5cf6' : '1px solid rgba(255,255,255,0.08)', 
                    transition: 'border-color 0.2s'
                  }}
                >
                  <TextInput 
                    size="md" 
                    variant="unstyled" 
                    placeholder="Ask about your data..." 
                    value={chatInput} 
                    onChange={(e) => setChatInput(e.target.value)} 
                    onFocus={() => setIsChatFocused(true)}
                    onBlur={() => setIsChatFocused(false)}
                    px="sm" 
                    rightSection={
                      <ActionIcon type="submit" radius="md" size="md" disabled={isChatLoading || !chatInput.trim()} style={{ background: chatInput.trim() ? '#8b5cf6' : 'transparent', color: chatInput.trim() ? '#fff' : 'rgba(255,255,255,0.2)', border: 'none' }}><Send size={14} /></ActionIcon>
                    } 
                    styles={{ input: { color: '#f8fafc', fontSize: '14px' } }} 
                  />
                </Paper>
              </form>
            </Box>
          </Paper>
        </Box>

        {/* COLUMN 3: GRAPH VISUALIZATION */}
        <Box style={{ 
          display: 'flex', flexDirection: 'column', gap: 8,
          width: isGraphCollapsed ? 48 : 'auto', 
          flex: isGraphCollapsed ? '0 0 48px' : 1,
          flexShrink: 0, overflow: 'hidden',
          transition: 'all 0.4s cubic-bezier(0.2, 0, 0, 1)'
        }}>
          <Group justify={isGraphCollapsed ? "center" : "space-between"} wrap="nowrap" h={32} px={isGraphCollapsed ? 0 : 4}>
            {!isGraphCollapsed && <Text size="xs" fw={700} c="rgba(255,255,255,0.5)" tt="uppercase" lts={1}>Graph Matrix</Text>}
            <Tooltip label={isGraphCollapsed ? "Expand Graph" : "Collapse Graph"} position="bottom" withArrow>
              <ActionIcon variant="subtle" color="gray" onClick={() => setIsGraphCollapsed(!isGraphCollapsed)} style={{ minWidth: 32 }}>
                {isGraphCollapsed ? <PanelRight size={18} /> : <PanelRightClose size={18} />}
              </ActionIcon>
            </Tooltip>
          </Group>

          <Paper radius="md" ref={containerRef} style={{ 
              position: 'relative', // FIX: Ensures all absolute children stay within this bounds
              flex: 1, minWidth: 300, overflow: 'hidden',
              opacity: isGraphCollapsed ? 0 : 1, pointerEvents: isGraphCollapsed ? 'none' : 'auto',
              background: 'rgba(20, 20, 25, 0.4)', backdropFilter: 'blur(12px)', 
              border: '1px solid rgba(255, 255, 255, 0.05)', transition: 'opacity 0.2s ease-in-out'
            }}>
              
              <Paper p="xs" px="md" radius="md" bg="rgba(30,30,36,0.8)" style={{ position: 'absolute', top: 16, left: 16, zIndex: 10, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <Group gap="sm">
                  <Box w={8} h={8} style={{ borderRadius: '50%', backgroundColor: isProcessing ? (streamPhase === 'edges' ? '#ec4899' : '#f59e0b') : '#8b5cf6', animation: isProcessing ? 'pulse 1s infinite' : 'none' }} />
                  <Text size="xs" fw={700} c="#e2e8f0" lts={0.5} tt="uppercase">{!isProcessing ? 'Engine Ready' : (streamPhase === 'nodes' ? 'Extracting Entities...' : (streamPhase === 'edges' ? 'Mapping Relationships...' : 'Initializing...'))}</Text>
                </Group>
              </Paper>

              {(uploadPhase === 'streaming' || uploadPhase === 'ready') && (
                <Box style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
                  <Stack align="flex-end" gap="sm">
                    <Paper p={4} radius="md" bg="rgba(30,30,36,0.8)" style={{ border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <Group gap="xs">
                        <Tooltip label="Toggle Node Labels" withArrow>
                          <ActionIcon variant="subtle" color="gray" onClick={() => setShowNodeLabels(p => !p)} style={{ color: showNodeLabels ? '#8b5cf6' : '#64748b' }}>
                            {showNodeLabels ? <Eye size={16}/> : <EyeOff size={16}/>}
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Toggle Physics" withArrow>
                          <ActionIcon variant="subtle" color="gray" onClick={() => setIsAnimationPaused(p => !p)} style={{ color: isAnimationPaused ? '#ec4899' : '#64748b' }}>
                            <Activity size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Fit Main Cluster to Screen" withArrow>
                          <ActionIcon variant="subtle" color="gray" onClick={() => {
                             if (graphRef.current) {
                               const currentData = graphRef.current.graphData();
                               const mainClusterIds = getLargestComponentIds(currentData.nodes, currentData.links);
                               const padding = Math.min(dimensions.width, dimensions.height) * 0.1;
                               graphRef.current.zoomToFit(800, padding, node => mainClusterIds.has(node.id));
                             }
                          }} style={{ color: '#cbd5e1' }}>
                            <Maximize size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Paper>
                    <Paper p={4} radius="md" bg="rgba(30,30,36,0.8)" style={{ border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <TextInput size="xs" variant="unstyled" placeholder="Search entity..." value={nodeSearch} onChange={(e) => setNodeSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleFocusFirstSearchMatch()} px="sm" rightSection={
                          <ActionIcon size="sm" color="gray" variant="transparent" onClick={handleFocusFirstSearchMatch}><Search size={12} /></ActionIcon>
                        } styles={{ input: { width: 140, color: '#e2e8f0', fontSize: '12px' } }} />
                    </Paper>
                  </Stack>
                </Box>
              )}

              {(uploadPhase === 'streaming' || uploadPhase === 'ready') ? (
                <>
                  {/* FIX: Ensure the canvas container is pinned properly via standard CSS style */}
                  <Box style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                    <ForceGraph2D
                      ref={graphRef} graphData={graphData} width={dimensions.width} height={dimensions.height}
                      enableNodeDrag enablePointerInteraction
                      onNodeClick={setSelectedNode} onBackgroundClick={() => setSelectedNode(null)}
                      
                      nodeCanvasObject={nodeCanvasObject}
                      
                      linkCurvature={0.2}
                      linkWidth={(l) => {
                        if (isNodeFaded(getNodeId(l.source)) || isNodeFaded(getNodeId(l.target))) return 0.2;
                        if (!selectedNode) return 1.0;
                        return highlightedLinks.has(l) ? 3 : 0.5;
                      }}
                      linkColor={(l) => {
                        if (isNodeFaded(getNodeId(l.source)) || isNodeFaded(getNodeId(l.target))) return EDGE_COLORS.dimmed;
                        if (!selectedNode) return EDGE_COLORS.default;
                        return highlightedLinks.has(l) ? EDGE_COLORS.highlighted : EDGE_COLORS.dimmed;
                      }}
                      
                      linkDirectionalParticles={(l) => {
                        if (isNodeFaded(getNodeId(l.source)) || isNodeFaded(getNodeId(l.target))) return 0;
                        if (!selectedNode) return streamPhase === 'edges' ? 3 : 1.5; 
                        return highlightedLinks.has(l) ? 5 : 0;
                      }}
                      linkDirectionalParticleWidth={(l) => selectedNode && highlightedLinks.has(l) ? 3 : 2}
                      linkDirectionalParticleColor={() => '#e2e8f0'} 
                      linkDirectionalParticleSpeed={streamPhase === 'edges' ? 0.01 : 0.005} 
                      
                      d3AlphaDecay={0.02} 
                      d3VelocityDecay={0.2} 
                    />
                  </Box>

                  {/* --- COLOR REFERENCE LEGEND --- */}
                  <Box style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 10 }}>
                    <Paper p="md" radius="md" bg="rgba(30,30,36,0.8)" style={{ border: '1px solid rgba(255, 255, 255, 0.05)', minWidth: 180 }}>
                      <Stack gap="xs">
                        <Group justify="space-between" mb={4}>
                          <Text size="xs" fw={700} c="rgba(255,255,255,0.5)" tt="uppercase" lts={1}>Color Reference</Text>
                          <Badge size="xs" color="gray" variant="light">{entityCounts.Total} Nodes</Badge>
                        </Group>
                        {Object.entries(TYPE_COLORS).map(([type, color]) => (
                          <Group key={type} justify="space-between" gap="xl">
                            <Group gap="sm">
                              <Box w={10} h={10} style={{ borderRadius: '3px', backgroundColor: color }} />
                              <Text size="xs" fw={500} c="#cbd5e1">{type}</Text>
                            </Group>
                            <Text size="xs" fw={700} c={entityCounts[type] > 0 ? color : 'rgba(255,255,255,0.2)'}>
                              {entityCounts[type]}
                            </Text>
                          </Group>
                        ))}
                      </Stack>
                    </Paper>
                  </Box>

                  <Transition mounted={!!selectedNode} transition="slide-up" duration={250} timingFunction="ease">
                    {(styles) => (
                      <Card style={{ ...styles, position: 'absolute', bottom: 16, left: 16, width: 300, maxHeight: '50%', background: 'rgba(30,30,36,0.9)', border: '1px solid rgba(139, 92, 246, 0.3)', zIndex: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} radius="md" p="md">
                        <Group justify="space-between" mb="md" pb="xs" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                          <Group gap="xs">
                            <Layers size={14} color="#8b5cf6" />
                            <Text size="xs" fw={700} c="#e2e8f0" lts={1} tt="uppercase">Entity Data</Text>
                          </Group>
                          <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setSelectedNode(null)}>
                            &times;
                          </ActionIcon>
                        </Group>
                        <ScrollArea h="100%" type="scroll" offsetScrollbars>
                          <Stack gap="sm">
                            {selectedNode && (
                              <>
                                <Box p="sm" bg="rgba(139, 92, 246, 0.05)" style={{ borderRadius: 8, border: '1px solid rgba(139, 92, 246, 0.15)' }}>
                                  <Group justify="space-between" wrap="nowrap" align="flex-start" mb={6}>
                                    <Text size="xs" c="rgba(255,255,255,0.5)" fw={600} tt="uppercase">ID</Text>
                                    <Text size="xs" c="#a78bfa" fw={700} ta="right">node_{selectedNode.index + 1}</Text>
                                  </Group>
                                  
                                  <Group justify="space-between" wrap="nowrap" align="flex-start" mb={6}>
                                    <Text size="xs" c="rgba(255,255,255,0.5)" fw={600} tt="uppercase">Name</Text>
                                    <Text size="sm" c="#fff" fw={600} ta="right">{selectedNode.name || selectedNode.id}</Text>
                                  </Group>
                                  
                                  <Group justify="space-between" wrap="nowrap" align="flex-start">
                                    <Text size="xs" c="rgba(255,255,255,0.5)" fw={600} tt="uppercase">Type</Text>
                                    <Badge size="sm" color="violet" variant="outline">
                                      {selectedNode.type || 'Entity'}
                                    </Badge>
                                  </Group>
                                </Box>

                                {Object.entries(selectedNode).map(([key, value]) => {
                                  if (
                                    ['x','y','z','vx','vy','vz','fx','fy','fz','index', 'id', 'name', 'type', 'color'].includes(key) || 
                                    key.startsWith('__') || 
                                    typeof value === 'function'
                                  ) return null;
                                  
                                  return (
                                    <Box key={key} p="xs" bg="rgba(255,255,255,0.02)" style={{ borderRadius: 8, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                                      <Group justify="space-between" wrap="nowrap" align="flex-start">
                                        <Text size="xs" c="rgba(255,255,255,0.4)" fw={600} tt="uppercase">{key}</Text>
                                        <Text size="xs" c="#cbd5e1" fw={500} ta="right" style={{ wordBreak: 'break-all' }}>
                                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                        </Text>
                                      </Group>
                                    </Box>
                                  );
                                })}
                              </>
                            )}
                          </Stack>
                        </ScrollArea>
                      </Card>
                    )}
                  </Transition>
                </>
              ) : (
                <Box w="100%" h="100%" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Stack align="center" gap="md" p="xl" bg="rgba(30,30,36,0.5)" style={{ borderRadius: 16, border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    {(uploadPhase === 'uploading' || uploadPhase === 'fetching') ? (
                      <><Loader color="violet" type="bars" size="md" mb="xs" /><Text size="sm" fw={700} c="#e2e8f0" lts={1} tt="uppercase">Structuring Data</Text><Text c="rgba(255,255,255,0.4)" size="xs" ta="center" maw={240}>Mapping vectors and initiating architectural relationships.</Text></>
                    ) : (
                      <><Box p="md" style={{ borderRadius: '50%', background: 'rgba(255,255,255,0.02)' }}><Sparkles size={32} color="rgba(255,255,255,0.2)" strokeWidth={1.5} /></Box><Text c="rgba(255,255,255,0.3)" fw={600} size="xs" tt="uppercase" lts={1}>Graph Offline</Text></>
                    )}
                  </Stack>
                </Box>
              )}
            </Paper>
        </Box>
      </Box>
    </Box>
  );
}
