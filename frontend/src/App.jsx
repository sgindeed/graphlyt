import React, { useState, useEffect, useRef, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import axios from 'axios';
import { 
  Loader, Paper, Stack, Text, Group, ActionIcon, 
  Tooltip, Badge, Card, ScrollArea, TextInput, 
  Divider, Transition, Box, Title
} from '@mantine/core';
import {
  Upload, Search, Bell, User, Loader2, Database, 
  Quote, PanelRightClose, PanelLeftClose, Layers,
  Send, Activity, Eye, EyeOff, Maximize, Zap, Sparkles
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';
const WS_BASE = import.meta.env.VITE_WS_BASE || 'ws://localhost:8000';

// Neo-Cyber Palette
const TYPE_COLORS = {
  Person: '#ff2a5f',       
  Organization: '#00e5ff', 
  Location: '#39ff14',     
  Concept: '#b026ff',      
  Event: '#ffea00',        
  Technology: '#ff8c00',
  Default: '#a3a3a3'
};

const EDGE_COLORS = {
  default: 'rgba(0, 229, 255, 0.3)',
  highlighted: 'rgba(176, 38, 255, 0.9)',
  dimmed: 'rgba(255, 255, 255, 0.02)'
};

export default function NeuralArchitect() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] }); 
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadPhase, setUploadPhase] = useState('idle');
  const [streamPhase, setStreamPhase] = useState('idle'); 
  const [documentStats, setDocumentStats] = useState({ chunkCount: 0, fileCount: 0 });
  
  const [isGraphCollapsed, setIsGraphCollapsed] = useState(false);
  const [isUploadCollapsed, setIsUploadCollapsed] = useState(false);

  const [showNodeLabels, setShowNodeLabels] = useState(true);
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const [isAnimationPaused, setIsAnimationPaused] = useState(false);
  const [nodeSearch, setNodeSearch] = useState('');
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const [messages, setMessages] = useState([
    { sender: 'architect', text: 'Neural Interface Active. Synchronize your manifests to begin extraction.', sources: [] }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);

  const graphRef = useRef();
  const containerRef = useRef(); 
  const chatScrollRef = useRef();
  const uploadTimersRef = useRef([]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  // --- HYPER-EXPANSION PHYSICS ---
  useEffect(() => {
    if (graphRef.current) {
      // Force nodes heavily apart for a cinematic 3D spread
      graphRef.current.d3Force('charge').strength(-800);
      // Lengthen neural links 
      graphRef.current.d3Force('link').distance(150);
      // Soft center gravity so they don't drift to infinity
      graphRef.current.d3Force('center').strength(0.02);
    }
  }, [graphData]);

  const getNodeId = (node) => (typeof node === 'object' ? node?.id : node);
  const getNodeLabel = (node) => node?.label || node?.name || node?.title || node?.id || '';
  const getEdgeLabel = (link) => link?.label || link?.relation || link?.type || '';

  const searchMatchedNodeIds = useMemo(() => {
    const q = nodeSearch.trim().toLowerCase();
    if (!q) return null;
    const matchedIds = new Set();
    graphData.nodes.forEach((node) => {
      if (String(getNodeLabel(node)).toLowerCase().includes(q)) matchedIds.add(getNodeId(node));
    });
    return matchedIds;
  }, [graphData.nodes, nodeSearch]);

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

  // --- CUSTOM THREE.JS NODE RENDERER (NEON GLOW EFFECT) ---
  const nodeThreeObject = (node) => {
    const group = new THREE.Group();
    const baseColor = TYPE_COLORS[node.type] || TYPE_COLORS.Default;
    const nodeId = getNodeId(node);
    
    const isSearchMiss = searchMatchedNodeIds && !searchMatchedNodeIds.has(nodeId);
    const isSelected = selectedNode && getNodeId(selectedNode) === nodeId;
    const isHighlighted = selectedNode && highlightedNodeIds.has(nodeId);

    // Calculate opacity based on focus state
    let opacity = 0.9;
    if (isSearchMiss) opacity = 0.1;
    else if (selectedNode && !isHighlighted) opacity = 0.1;

    // 1. Solid Inner Core
    const coreSize = isSelected ? 8 : 5;
    const coreGeo = new THREE.SphereGeometry(coreSize, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({
      color: baseColor,
      transparent: true,
      opacity: opacity,
      depthWrite: true,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);

    // 2. Additive Blending Outer Glow (Aura)
    if (opacity > 0.1) {
      const auraSize = isSelected ? 16 : 9;
      const auraGeo = new THREE.SphereGeometry(auraSize, 32, 32);
      const auraMat = new THREE.MeshBasicMaterial({
        color: baseColor,
        transparent: true,
        opacity: isSelected ? 0.4 : 0.2,
        blending: THREE.AdditiveBlending, // This creates the neon effect
        depthWrite: false,
      });
      const auraMesh = new THREE.Mesh(auraGeo, auraMat);
      group.add(auraMesh);
    }

    // 3. Floating Label
    if (showNodeLabels && opacity > 0.1) {
      const labelText = getNodeLabel(node);
      if (labelText) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const fontSize = isSelected ? 42 : 32;
        context.font = `800 ${fontSize}px 'Space Grotesk', sans-serif`;
        const textWidth = context.measureText(labelText).width;
        
        canvas.width = textWidth + 40;
        canvas.height = fontSize + 40;
        
        // Label Glow & Color
        context.shadowColor = isSelected ? baseColor : '#000000';
        context.shadowBlur = isSelected ? 15 : 4;
        context.fillStyle = isSelected ? '#ffffff' : '#d1d5db';
        context.font = `800 ${fontSize}px 'Space Grotesk', sans-serif`;
        context.textBaseline = 'middle';
        context.fillText(labelText, 20, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(spriteMaterial);
        
        const scaleBase = isSelected ? 18 : 12;
        sprite.scale.set(scaleBase * (canvas.width / canvas.height), scaleBase, 1);
        sprite.position.set(0, isSelected ? 22 : 14, 0); // Float slightly above the node
        
        group.add(sprite);
      }
    }

    return group;
  };

  const createEdgeTextSprite = (text, color = '#00e5ff') => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = `800 24px Inter, sans-serif`;
    const textWidth = Math.ceil(context.measureText(text).width);
    canvas.width = textWidth + 30;
    canvas.height = 50;
    context.fillStyle = color;
    context.font = `800 24px Inter, sans-serif`;
    context.textBaseline = 'middle';
    context.fillText(text, 15, 25);
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.8 });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(7 * (canvas.width / canvas.height), 7, 1);
    return sprite;
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
  }, [isGraphCollapsed]);

  const typeMessage = (fullText, sources = []) => {
    let currentText = "";
    const words = fullText.split(" ");
    let i = 0;
    setMessages(prev => [...prev, { sender: 'architect', text: "", sources: [], isTyping: true }]);
    
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
    setDocumentStats({ chunkCount: 0, fileCount: 0 });

    try {
      await axios.post(`${API_BASE}/api/clear`);
      setGraphData({ nodes: [], links: [] });
      setSelectedNode(null);
      
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      
      const res = await axios.post(`${API_BASE}/api/upload`, formData);

      setDocumentStats({ chunkCount: res.data.chunk_count, fileCount: res.data.file_count });
      setIsUploading(false);
      setUploadPhase('fetching');
      uploadTimersRef.current.push(setTimeout(() => setUploadPhase('streaming'), 2000));
      setIsProcessing(true);
      setIsGraphCollapsed(false); 
      
      const ws = new WebSocket(`${WS_BASE}/api/ws/extract/${res.data.doc_id}`);
      ws.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (payload.type === 'node') {
          setStreamPhase('nodes');
          setGraphData(prev => ({ ...prev, nodes: [...prev.nodes, payload.data] }));
        } else if (payload.type === 'edge') {
          setStreamPhase('edges');
          setGraphData(prev => ({ ...prev, links: [...prev.links, payload.data] }));
          if (graphRef.current) graphRef.current.d3ReheatSimulation(0.3);
        } else if (payload.type === 'error') {
          alert(`Pipeline Error: ${payload.message}`);
        } else if (payload.type === 'done') {
          setIsProcessing(false);
          setStreamPhase('ready');
          setUploadPhase('ready');
          ws.close();
          setTimeout(() => graphRef.current?.zoomToFit(1200, 100), 800);
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
      typeMessage(res.data.reply, res.data.sources);
    } catch {
      setIsChatLoading(false);
      setMessages(prev => [...prev, { sender: 'architect', text: 'Error: Link to reasoning engine severed.' }]);
    }
  };

  const handleFocusFirstSearchMatch = () => {
    const q = nodeSearch.trim().toLowerCase();
    if (!q || !graphRef.current) return;
    const targetNode = graphData.nodes.find((node) => String(getNodeLabel(node)).toLowerCase().includes(q));
    if (!targetNode) return;
    graphRef.current.centerAt(targetNode.x, targetNode.y, 800);
    graphRef.current.cameraPosition({ x: targetNode.x, y: targetNode.y, z: targetNode.z + 180 }, targetNode, 900);
  };

  return (
    <Box h="100vh" w="100vw" style={{ 
      display: 'flex', flexDirection: 'column', overflow: 'hidden', 
      background: 'radial-gradient(circle at 50% 0%, #1a1025 0%, #050505 60%, #000000 100%)',
      fontFamily: "'Space Grotesk', Inter, sans-serif" 
    }}>
      
      {/* HEADER */}
      <Box p="md" pb={0} style={{ zIndex: 100 }}>
        <Paper h={64} px="xl" radius="xl" style={{ 
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
          background: 'rgba(15, 15, 20, 0.4)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
        }}>
          <Group gap="xl">
            <Group gap="sm">
              <Zap size={20} color="#00e5ff" fill="#00e5ff" style={{ filter: 'drop-shadow(0 0 8px #00e5ff)' }} />
              <Title order={3} fw={900} lts={3} variant="gradient" gradient={{ from: '#00e5ff', to: '#b026ff', deg: 90 }}>
                GRAPHLYT
              </Title>
            </Group>
            {documentStats.chunkCount > 0 && (
              <Badge variant="filled" size="md" radius="sm" style={{ background: 'rgba(0, 229, 255, 0.1)', color: '#00e5ff', border: '1px solid rgba(0, 229, 255, 0.3)', boxShadow: '0 0 15px rgba(0, 229, 255, 0.1)' }} leftSection={<Database size={12} />}>
                {documentStats.fileCount} File{documentStats.fileCount > 1 ? 's' : ''} • {documentStats.chunkCount} Vectors
              </Badge>
            )}
          </Group>
          <Group gap="md">
            <Tooltip label={isUploadCollapsed ? "Open Workspace" : "Close Workspace"} position="bottom" withArrow>
              <ActionIcon variant="transparent" onClick={() => setIsUploadCollapsed(!isUploadCollapsed)} size="lg" radius="md" style={{ color: isUploadCollapsed ? '#555' : '#fff', transition: 'all 0.3s' }}>
                <PanelLeftClose size={20} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={isGraphCollapsed ? "Open Engine" : "Close Engine"} position="bottom" withArrow>
              <ActionIcon variant="transparent" onClick={() => setIsGraphCollapsed(!isGraphCollapsed)} size="lg" radius="md" style={{ color: isGraphCollapsed ? '#555' : '#fff', transition: 'all 0.3s' }}>
                <PanelRightClose size={20} />
              </ActionIcon>
            </Tooltip>
            <Divider orientation="vertical" color="rgba(255,255,255,0.1)" />
            <ActionIcon variant="subtle" color="gray" size="lg" style={{ color: '#888', '&:hover': { color: '#00e5ff', filter: 'drop-shadow(0 0 8px #00e5ff)' } }}><Bell size={18} /></ActionIcon>
            <ActionIcon variant="subtle" color="gray" size="lg" style={{ color: '#888', '&:hover': { color: '#b026ff', filter: 'drop-shadow(0 0 8px #b026ff)' } }}><User size={18} /></ActionIcon>
          </Group>
        </Paper>
      </Box>

      {/* MASTER LAYOUT */}
      <Box style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: '16px', gap: '16px' }}>
        
        {/* PANEL 1: UPLOAD */}
        <Box w={isUploadCollapsed ? 0 : 320} style={{ transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)', overflow: 'hidden', flexShrink: 0, opacity: isUploadCollapsed ? 0 : 1 }}>
          <Paper w={320} h="100%" p="xl" radius="2xl" style={{ 
            display: 'flex', flexDirection: 'column',
            background: 'rgba(15, 15, 20, 0.4)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.05)',
            boxShadow: 'inset 0 0 80px rgba(0, 0, 0, 0.5), 0 8px 32px rgba(0, 0, 0, 0.4)'
          }}>
            <Text size="xs" fw={800} c="rgba(255,255,255,0.4)" tt="uppercase" lts={2} mb="xl">Ingestion Matrix</Text>
            <Card radius="xl" bg="rgba(0, 229, 255, 0.02)" style={{ 
                border: '1px dashed rgba(0, 229, 255, 0.3)', cursor: 'pointer', transition: 'all 0.3s ease',
                boxShadow: '0 0 20px rgba(0, 229, 255, 0.0)', '&:hover': { borderColor: '#00e5ff', backgroundColor: 'rgba(0, 229, 255, 0.05)', boxShadow: '0 0 20px rgba(0, 229, 255, 0.1)' } 
              }} p="xl" className="group relative">
              <input type="file" multiple onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
              <Stack align="center" gap="md">
                <Box style={{ padding: '16px', borderRadius: '50%', background: 'rgba(0, 229, 255, 0.1)', border: '1px solid rgba(0, 229, 255, 0.2)', transition: 'all 0.3s' }} className="group-hover:scale-110 group-hover:shadow-[0_0_15px_rgba(0,229,255,0.4)]">
                  {isUploading ? <Loader2 className="animate-spin text-[#00e5ff]" size={28} /> : <Upload color="#00e5ff" size={28} />}
                </Box>
                <Box ta="center">
                  <Text fw={700} c="#fff" lts={1}>Sync Manifests</Text>
                  <Text size="xs" c="rgba(255,255,255,0.4)">Multi-PDF Array</Text>
                </Box>
              </Stack>
            </Card>
            <Divider my="xl" color="rgba(255,255,255,0.05)" />
            <Stack gap="lg">
              <Group justify="space-between" align="center">
                <Group gap="xs"><Box w={8} h={8} style={{ borderRadius: '50%', background: '#b026ff', boxShadow: '0 0 8px #b026ff' }}/><Text size="xs" c="rgba(255,255,255,0.6)" tt="uppercase" fw={600} lts={1}>Graph Nodes</Text></Group>
                <Text size="lg" c="#fff" fw={800} style={{ textShadow: '0 0 10px rgba(176, 38, 255, 0.5)' }}>{graphData.nodes.length}</Text>
              </Group>
              <Group justify="space-between" align="center">
                <Group gap="xs"><Box w={8} h={8} style={{ borderRadius: '50%', background: '#00e5ff', boxShadow: '0 0 8px #00e5ff' }}/><Text size="xs" c="rgba(255,255,255,0.6)" tt="uppercase" fw={600} lts={1}>Neural Edges</Text></Group>
                <Text size="lg" c="#fff" fw={800} style={{ textShadow: '0 0 10px rgba(0, 229, 255, 0.5)' }}>{graphData.links.length}</Text>
              </Group>
            </Stack>
          </Paper>
        </Box>

        {/* PANEL 2: CHAT */}
        <Paper style={{ 
          flex: 1, display: 'flex', flexDirection: 'column', position: 'relative',
          background: 'rgba(10, 10, 15, 0.4)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '24px',
          boxShadow: 'inset 0 0 80px rgba(0, 0, 0, 0.5), 0 8px 32px rgba(0, 0, 0, 0.4)'
        }}>
          <ScrollArea flex={1} p="xl" viewportRef={chatScrollRef} styles={{ scrollbar: { '&:hover': { background: 'transparent' } } }}>
            <Stack gap="xl" maw={800} mx="auto">
              {messages.map((m, i) => (
                <Box key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                  <Paper p="lg" bg={m.sender === 'user' ? 'rgba(0, 229, 255, 0.1)' : 'rgba(255, 255, 255, 0.02)'} style={{ maxWidth: '85%', border: m.sender === 'user' ? '1px solid rgba(0, 229, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)', borderRadius: m.sender === 'user' ? '24px 24px 4px 24px' : '24px 24px 24px 4px', color: '#fff', boxShadow: m.sender === 'user' ? '0 8px 32px rgba(0, 229, 255, 0.1)' : '0 8px 32px rgba(0,0,0,0.2)', backdropFilter: 'blur(10px)' }}>
                    <Text size="sm" lh={1.7} fw={400} lts={0.3}>{m.text}{m.isTyping && <span className="animate-pulse ml-1" style={{ color: '#00e5ff', textShadow: '0 0 8px #00e5ff' }}>▍</span>}</Text>
                  </Paper>
                  {m.sources && m.sources.length > 0 && !m.isTyping && (
                    <Stack gap="xs" mt="md" w="85%">
                      <Group gap="xs" mt={4}><Quote size={12} color="#39ff14" /><Text size="xs" c="#39ff14" tt="uppercase" fw={800} lts={1} style={{ textShadow: '0 0 10px rgba(57, 255, 20, 0.3)' }}>Data Provenance</Text></Group>
                      {m.sources.map((src, idx) => (
                        <Paper key={idx} p="md" radius="xl" bg="rgba(0,0,0,0.4)" style={{ border: '1px solid rgba(255,255,255,0.05)', borderLeft: '3px solid #39ff14' }}><Text size="xs" c="rgba(255,255,255,0.6)" lh={1.6}>{src}</Text></Paper>
                      ))}
                    </Stack>
                  )}
                </Box>
              ))}
            </Stack>
          </ScrollArea>
          <Box p="xl" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <form onSubmit={sendChatMessage} style={{ maxWidth: 800, margin: '0 auto' }}>
              <Paper radius="xl" p={4} bg="rgba(0,0,0,0.4)" style={{ border: '1px solid rgba(255,255,255,0.1)', transition: 'all 0.3s', '&:focus-within': { borderColor: '#00e5ff', boxShadow: '0 0 20px rgba(0, 229, 255, 0.1)' } }}>
                <TextInput size="lg" radius="xl" variant="unstyled" placeholder="Query the unified matrix..." value={chatInput} onChange={(e) => setChatInput(e.target.value)} px="md" rightSection={
                    <ActionIcon type="submit" radius="xl" size="lg" disabled={isChatLoading || !chatInput.trim()} style={{ background: chatInput.trim() ? 'linear-gradient(135deg, #00e5ff, #0088ff)' : 'transparent', color: chatInput.trim() ? '#000' : 'rgba(255,255,255,0.2)', border: 'none', boxShadow: chatInput.trim() ? '0 0 15px rgba(0, 229, 255, 0.4)' : 'none' }}><Send size={16} /></ActionIcon>
                  } styles={{ input: { color: '#fff', fontSize: '15px' } }} />
              </Paper>
            </form>
          </Box>
        </Paper>

        {/* PANEL 3: DYNAMIC 3D GRAPH */}
        <Box w={isGraphCollapsed ? 0 : '45vw'} style={{ transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)', overflow: 'hidden', flexShrink: 0, opacity: isGraphCollapsed ? 0 : 1 }}>
          <Paper w="100%" h="100%" radius="2xl" position="relative" ref={containerRef} style={{ 
            background: 'rgba(5, 5, 8, 0.6)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.05)',
            boxShadow: 'inset 0 0 80px rgba(0, 0, 0, 0.8), 0 8px 32px rgba(0, 0, 0, 0.4)', overflow: 'hidden'
          }}>
            
            <Paper position="absolute" top={24} left={24} p="xs" px="md" radius="xl" bg="rgba(0,0,0,0.6)" style={{ zIndex: 10, border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
              <Group gap="sm">
                <Box w={8} h={8} style={{ borderRadius: '50%', backgroundColor: isProcessing ? (streamPhase === 'edges' ? '#ff2a5f' : '#ffea00') : '#00e5ff', boxShadow: isProcessing ? (streamPhase === 'edges' ? '0 0 10px #ff2a5f' : '0 0 10px #ffea00') : '0 0 10px #00e5ff', animation: isProcessing ? 'pulse 1s infinite' : 'none' }} />
                <Text size="xs" fw={800} c="#fff" lts={1} tt="uppercase">{!isProcessing ? 'Engine Ready' : (streamPhase === 'nodes' ? 'Spawning Entities...' : (streamPhase === 'edges' ? 'Forging Neural Links...' : 'Initializing...'))}</Text>
              </Group>
            </Paper>

            {(uploadPhase === 'streaming' || uploadPhase === 'ready') && (
              <Box position="absolute" top={24} right={24} style={{ zIndex: 10 }}>
                <Stack align="flex-end" gap="md">
                  <Paper p="xs" radius="xl" bg="rgba(0,0,0,0.6)" style={{ border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                    <Group gap="xs">
                      <Tooltip label="Toggle Node Labels" withArrow>
                        <ActionIcon variant="transparent" color="gray" radius="xl" onClick={() => setShowNodeLabels(p => !p)} style={{ color: showNodeLabels ? '#00e5ff' : '#888', filter: showNodeLabels ? 'drop-shadow(0 0 5px #00e5ff)' : 'none' }}>
                          {showNodeLabels ? <Eye size={18}/> : <EyeOff size={18}/>}
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Toggle Physics" withArrow>
                        <ActionIcon variant="transparent" color="gray" radius="xl" onClick={() => setIsAnimationPaused(p => !p)} style={{ color: isAnimationPaused ? '#ff2a5f' : '#888', filter: isAnimationPaused ? 'drop-shadow(0 0 5px #ff2a5f)' : 'none' }}>
                          <Activity size={18} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Fit to Screen" withArrow>
                        <ActionIcon variant="transparent" color="gray" radius="xl" onClick={() => graphRef.current?.zoomToFit(800, 100)} style={{ color: '#fff' }}>
                          <Maximize size={18} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Paper>
                  <Paper p={4} radius="xl" bg="rgba(0,0,0,0.6)" style={{ border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                    <TextInput size="sm" radius="xl" variant="unstyled" placeholder="Locate Node..." value={nodeSearch} onChange={(e) => setNodeSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleFocusFirstSearchMatch()} px="md" rightSection={
                        <ActionIcon size="md" radius="xl" color="gray" variant="transparent" onClick={handleFocusFirstSearchMatch} style={{ color: '#00e5ff' }}><Search size={14} /></ActionIcon>
                      } styles={{ input: { width: 160, color: '#fff', fontSize: '12px', fontWeight: 600, letterSpacing: '0.5px' } }} />
                  </Paper>
                </Stack>
              </Box>
            )}

            {(uploadPhase === 'streaming' || uploadPhase === 'ready') ? (
              <>
                <Box position="absolute" top={0} left={0} right={0} bottom={0}>
                  <ForceGraph3D
                    ref={graphRef} graphData={graphData} width={dimensions.width} height={dimensions.height}
                    backgroundColor="rgba(0,0,0,0)" enableNavigationControls enableNodeDrag enablePointerInteraction
                    onNodeClick={setSelectedNode} onBackgroundClick={() => setSelectedNode(null)}
                    
                    // Use exclusively our custom Three.js object renderer
                    nodeThreeObject={nodeThreeObject} 
                    
                    // Edge Styling
                    linkCurvature={0.2} // Organic neural curves
                    linkWidth={(l) => {
                      if (searchMatchedNodeIds && !(searchMatchedNodeIds.has(getNodeId(l.source)) || searchMatchedNodeIds.has(getNodeId(l.target)))) return 0.5;
                      if (!selectedNode) return 1.5;
                      return highlightedLinks.has(l) ? 4 : 0.8;
                    }}
                    linkColor={(l) => {
                      if (searchMatchedNodeIds && !(searchMatchedNodeIds.has(getNodeId(l.source)) || searchMatchedNodeIds.has(getNodeId(l.target)))) return EDGE_COLORS.dimmed;
                      if (!selectedNode) return EDGE_COLORS.default;
                      return highlightedLinks.has(l) ? EDGE_COLORS.highlighted : EDGE_COLORS.dimmed;
                    }}
                    
                    // Particles
                    linkDirectionalParticles={(l) => {
                      if (searchMatchedNodeIds && !(searchMatchedNodeIds.has(getNodeId(l.source)) || searchMatchedNodeIds.has(getNodeId(l.target)))) return 0;
                      if (!selectedNode) return streamPhase === 'edges' ? 4 : 2; 
                      return highlightedLinks.has(l) ? 6 : 0;
                    }}
                    linkDirectionalParticleWidth={(l) => selectedNode && highlightedLinks.has(l) ? 4 : 2.5}
                    linkDirectionalParticleColor={() => '#ffffff'} 
                    linkDirectionalParticleSpeed={streamPhase === 'edges' ? 0.015 : 0.008} 
                    
                    // Physics Decays
                    d3AlphaDecay={0.02} 
                    d3VelocityDecay={0.2} 
                    showNavInfo={false}
                  />
                </Box>

                <Box position="absolute" bottom={24} right={24} style={{ zIndex: 10 }}>
                  <Paper p="md" radius="xl" bg="rgba(0,0,0,0.6)" style={{ border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)' }}>
                    <Stack gap="xs">
                      <Text size="xs" fw={800} c="rgba(255,255,255,0.5)" tt="uppercase" lts={1} mb={4}>Entity Legend</Text>
                      {Object.entries(TYPE_COLORS).filter(([k]) => k !== 'Default').map(([type, color]) => (
                        <Group key={type} gap="sm">
                          <Box w={10} h={10} style={{ borderRadius: '50%', backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
                          <Text size="xs" fw={600} c="#fff" lts={0.5}>{type}</Text>
                        </Group>
                      ))}
                    </Stack>
                  </Paper>
                </Box>

                <Transition mounted={!!selectedNode} transition="scale-y" duration={300} timingFunction="cubic-bezier(0.16, 1, 0.3, 1)">
                  {(styles) => (
                    <Card style={{ ...styles, position: 'absolute', bottom: 24, left: 24, width: 340, maxHeight: '50%', background: 'rgba(10, 10, 15, 0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(0, 229, 255, 0.3)', boxShadow: '0 20px 40px rgba(0,0,0,0.6), inset 0 0 20px rgba(0, 229, 255, 0.05)' }} radius="xl" p="xl">
                      <Group justify="space-between" mb="lg" pb="sm" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <Group gap="xs"><Layers size={16} color="#00e5ff" style={{ filter: 'drop-shadow(0 0 5px #00e5ff)' }} /><Text size="xs" fw={800} c="#fff" lts={2} tt="uppercase">Entity Data</Text></Group>
                        <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setSelectedNode(null)} style={{ color: '#fff' }}>&times;</ActionIcon>
                      </Group>
                      <ScrollArea h="100%" type="scroll" offsetScrollbars>
                        <Stack gap="md">
                          {selectedNode && Object.entries(selectedNode).map(([key, value]) => {
                            if (['x','y','z','vx','vy','vz','index','__threeObj','__lineObj','__indexColor','__photonsObj'].includes(key) || typeof value === 'function') return null;
                            return (
                              <Box key={key} p="sm" bg="rgba(255,255,255,0.02)" style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                                <Group justify="space-between" wrap="nowrap" align="flex-start">
                                  <Text size="xs" c="rgba(255,255,255,0.5)" fw={700} tt="uppercase" lts={1}>{key}</Text>
                                  <Text size="sm" c="#00e5ff" fw={500} ta="right" style={{ wordBreak: 'break-all', textShadow: '0 0 10px rgba(0,229,255,0.3)' }}>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</Text>
                                </Group>
                              </Box>
                            );
                          })}
                        </Stack>
                      </ScrollArea>
                    </Card>
                  )}
                </Transition>
              </>
            ) : (
              <Box w="100%" h="100%" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Stack align="center" gap="lg" p="xl" bg="rgba(0,0,0,0.4)" style={{ borderRadius: 32, border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
                  {(uploadPhase === 'uploading' || uploadPhase === 'fetching') ? (
                    <><Loader color="#00e5ff" type="bars" size="lg" mb="sm" /><Text size="md" fw={800} c="#fff" lts={2} tt="uppercase" style={{ textShadow: '0 0 15px rgba(0,229,255,0.5)' }}>Synthesizing Network</Text><Text c="rgba(255,255,255,0.5)" size="sm" ta="center" maw={260} lh={1.6}>Mapping vector coordinates and executing structural neural linkages.</Text></>
                  ) : (
                    <><Box p="lg" style={{ borderRadius: '50%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}><Sparkles size={40} color="rgba(255,255,255,0.2)" strokeWidth={1.5} /></Box><Text c="rgba(255,255,255,0.4)" fw={700} size="sm" tt="uppercase" lts={2}>Engine Offline. Awaiting Data.</Text></>
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